"""Is this machine able to run VMS at all?

Everything here is cheap, synchronous and side-effect free — it reads the disk
and pokes at ports, and it changes nothing. That is what lets `Run All` call it
first and stop before starting anything when the answer is no.

The point is not to produce a pass/fail. It is to produce a sentence somebody
at a registration desk can act on: which check failed, on what path, and what
to do about it.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from config import (
    BACKEND_DIR,
    BACKEND_PORT,
    DASHBOARD_DIR,
    DASHBOARD_PORT,
    NPM,
    ROOT,
    SCANNER_DIR,
    SCREEN_DIR,
    SCREEN_PORT,
    VENV_DIR,
    VENV_PYTHON,
    VENV_SCRIPTS,
    Mode,
)
from network import detect_lan_ip, is_lan_address, port_in_use
from processes import PortOwner, port_owners


@dataclass(frozen=True)
class Check:
    label: str
    ok: bool
    #: Shown when the check fails. Names the path or port, and the fix.
    detail: str = ""
    #: A failed non-blocking check is a warning: Run All still proceeds.
    blocking: bool = True
    #: Set only by the port checks. The window offers to free a busy port, and
    #: it needs the number to do it -- parsing it back out of `label` would be
    #: a second place for the two to disagree.
    port: int | None = None
    #: Who is holding that port, already resolved. Carried on the check rather
    #: than looked up again at the moment of display, so the pid named in the
    #: dialog is the pid the check actually found: `netstat` a second later can
    #: report a different process, and offering to kill THAT one is how a
    #: launcher shoots something it never saw.
    owners: tuple[PortOwner, ...] = ()


@dataclass(frozen=True)
class Report:
    checks: list[Check]
    lan_ip: str

    @property
    def ok(self) -> bool:
        """True when nothing BLOCKING failed. Warnings do not stop a run."""
        return all(check.ok for check in self.checks if check.blocking)

    @property
    def failures(self) -> list[Check]:
        return [check for check in self.checks if not check.ok]


def _directory(label: str, path: Path) -> Check:
    return Check(
        label=label,
        ok=path.is_dir(),
        detail=f"Not found: {path}",
    )


def _virtualenv_checks() -> list[Check]:
    """The `.venv`, in the order the failures make sense to read.

    THE BACKEND MUST NEVER FALL BACK TO A GLOBAL PYTHON. A system interpreter
    almost certainly lacks Django, Channels and the project's pinned versions,
    so the fallback does not produce a working backend — it produces a
    confusing traceback several seconds after a button press. These checks
    exist so the launcher can refuse instead.
    """
    if not VENV_DIR.is_dir():
        return [
            Check(
                label="Python virtual environment",
                ok=False,
                detail=(
                    f"Not found: {VENV_DIR}\n"
                    "Create it and install the backend requirements before "
                    "starting VMS. The backend will not be run against a "
                    "global Python."
                ),
            )
        ]

    return [
        Check("Python virtual environment", True),
        Check(
            f"Interpreter ({VENV_PYTHON.name})",
            VENV_PYTHON.is_file(),
            detail=f"Not found: {VENV_PYTHON}\nThe virtual environment looks incomplete.",
        ),
        # THE UVICORN CHECK USED TO BE `VENV_UVICORN.is_file()` AND PROVED
        # NOTHING. On a project copied to another computer that file is present
        # and unrunnable, so the check passed and the backend died silently a
        # second later. Running the interpreter answers the question the stat
        # was only pretending to ask.
        interpreter_check(),
    ]


def interpreter_check(python: Path | None = None) -> Check:
    """Run the interpreter and make it import uvicorn. Do not trust the filename.

    EXISTENCE WAS THE WRONG QUESTION, and it cost a whole event-day morning on
    a copied project. `VENV_UVICORN.is_file()` said yes -- the file had been
    copied along with everything else -- and the backend then exited with code
    1 and printed nothing at all, because a Windows console-script stub carries
    the absolute path of the interpreter that created it and that path was on
    the other computer.

    So this executes something. `-c "import uvicorn"` is enough to prove three
    things at once that a stat cannot prove any of: the interpreter runs, its
    virtual environment resolves after whatever move brought it here, and
    uvicorn is installed in it.

    Cheap enough for a preflight -- one interpreter start, no server, no port,
    nothing written.
    """
    python = python or VENV_PYTHON
    label = "Backend interpreter"

    try:
        completed = subprocess.run(
            [str(python), "-c", "import uvicorn"],
            capture_output=True,
            text=True,
            timeout=30.0,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0,
        )
    except FileNotFoundError:
        return Check(label, False, detail=_interpreter_missing(python))
    except OSError as error:
        return Check(label, False, detail=f"{python}\ncould not be run: {error}")
    except subprocess.TimeoutExpired:
        return Check(label, False, detail=f"{python}\ndid not answer within 30s.")

    if completed.returncode == 0:
        return Check(label, True)

    said = " ".join((completed.stdout or "").split() + (completed.stderr or "").split())
    return Check(label, False, detail=_interpreter_failed(python, completed.returncode, said))


def _interpreter_missing(python: Path) -> str:
    return (
        f"Not found: {python}\n"
        "The virtual environment is missing. Create it and install the backend "
        "requirements before starting VMS."
    )


def _interpreter_failed(python: Path, code: int, said: str) -> str:
    """Name the two ways a COPIED project fails, because both are silent."""
    lines = [
        f"{python}",
        f"exists, but could not run `import uvicorn` (exit code {code}).",
        "",
    ]
    if said:
        lines += ["It said:", f"  {said}", ""]
    else:
        lines += [
            "It printed nothing at all, which is itself the clue.",
            "",
        ]

    lines += [
        "This is what a COPIED virtual environment looks like. A venv cannot be",
        "moved between machines or drives: it records the path it was built at.",
        "",
        "Recreate it, from the folder above this one:",
        f"  python -m venv .venv",
        f'  .venv\\Scripts\\python.exe -m pip install -r vms-backend\\requirements.txt',
        "",
        "Copy the project's source, never its .venv.",
    ]
    return "\n".join(lines)


def build_check(label: str, directory: Path) -> Check:
    """Has this app been built? Production mode only.

    `next start` WITHOUT A BUILD PRINTS SUCCESS AND THEN DIES. Measured:

        > next start
        ✓ Ready in 341ms                              <- stdout
        Error: Could not find a production build ...   <- stderr
        exit code 1

    So the log's last cheerful line says the opposite of what happened, the
    card flicks RUNNING and drops to ERROR, and the readiness probe spends a
    minute confirming it. That is the same shape as the `uvicorn.exe` bug, and
    a single file on disk turns it into a refusal before anything starts.

    `.next/BUILD_ID` is the right marker rather than `.next/` itself: a dev
    server creates `.next/` too, so its presence proves nothing. BUILD_ID is
    written by `next build` and by nothing else.

    IT DOES NOT CHECK WHETHER THE BUILD IS CURRENT. Building is deliberate and
    manual here; see `build_age_warning` for the softer question.
    """
    build_id = directory / ".next" / "BUILD_ID"
    if build_id.is_file():
        return Check(f"{label} is built", True)

    return Check(
        f"{label} is built",
        False,
        detail=(
            f"No production build in: {directory / '.next'}\n\n"
            "Production mode serves a compiled app; it does not compile one. "
            "Build it first:\n"
            f"  cd {directory}\n"
            "  npm run build\n\n"
            "Or switch the control centre back to Development mode, which "
            "compiles as it serves."
        ),
    )


def build_age_warning(label: str, directory: Path) -> Check | None:
    """Warn when sources are newer than the build. Never blocks.

    A WARNING, BECAUSE THE LAUNCHER DOES NOT GET A VOTE ON WHEN YOU ARE DONE.
    You may have edited one file and not meant to ship it yet; refusing to
    start would be the launcher second-guessing a deliberate workflow. It says
    what it sees and starts anyway -- the same treatment the LAN address check
    gets.

    Returns None when there is nothing to say, so callers can drop it.
    """
    build_id = directory / ".next" / "BUILD_ID"
    if not build_id.is_file():
        return None  # build_check already has this covered, and louder

    built_at = build_id.stat().st_mtime
    newest = _newest_source(directory)
    if newest is None or newest <= built_at:
        return None

    from datetime import datetime

    when = datetime.fromtimestamp(built_at).strftime("%d/%m/%Y %H:%M")
    return Check(
        f"{label} build is current",
        False,
        detail=(
            f"Source files are newer than the build of {when}.\n"
            f"  cd {directory}\n"
            "  npm run build\n\n"
            "Starting anyway: the running app will serve the older build."
        ),
        blocking=False,
    )


#: Directories never worth walking for a source mtime. `node_modules` alone is
#: tens of thousands of files and is not what anybody edits; `.next` is the
#: build output and is newer than itself by definition.
_SKIP_DIRS = {"node_modules", ".next", ".git", "dist", "out", ".turbo"}

#: What counts as a source file for the staleness question.
_SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"}


def _newest_source(directory: Path) -> float | None:
    """The newest source mtime in an app, or None if it cannot be read."""
    newest: float | None = None
    try:
        for path in directory.rglob("*"):
            if any(part in _SKIP_DIRS for part in path.parts):
                continue
            if path.suffix not in _SOURCE_SUFFIXES or not path.is_file():
                continue
            mtime = path.stat().st_mtime
            if newest is None or mtime > newest:
                newest = mtime
    except OSError:
        return None
    return newest


def _production_checks(mode: str) -> list[Check]:
    """The build checks, and only when a build is what will be served."""
    if mode != Mode.PROD:
        return []

    checks: list[Check] = []
    for label, directory in (("Dashboard", DASHBOARD_DIR), ("Lobby Screen", SCREEN_DIR)):
        checks.append(build_check(label, directory))
        stale = build_age_warning(label, directory)
        if stale is not None:
            checks.append(stale)
    return checks


def port_check(label: str, port: int) -> Check:
    """A busy port is blocking, and this still does NOT free it.

    Killing whatever holds a port is the kind of helpfulness that ends a
    conference: the process could be the backend somebody started by hand five
    minutes ago with a room full of delegates arriving. Report it; let a person
    decide.

    WHAT CHANGED IS THAT IT NOW SAYS WHO. "Port 3000 is already in use" leaves
    the person at the desk with nothing to act on, so the window offered them
    no choice but to guess. The pid and the image name turn that into a
    decision they can actually make -- and the decision stays theirs: the kill
    is behind a button and a confirmation, never on this path.
    """
    busy = port_in_use(port)
    owners = tuple(port_owners(port)) if busy else ()
    return Check(
        label=f"{label} port {port}",
        ok=not busy,
        detail=describe_port_conflict(label, port, owners) if busy else "",
        port=port,
        owners=owners,
    )


def describe_port_conflict(
    label: str, port: int, owners: Sequence[PortOwner] = ()
) -> str:
    """The conflict as a sentence, naming the holder when one can be found.

    `owners` can be empty on a genuinely busy port: `netstat` needs no
    privilege but the process may be gone by the time it runs, and on a
    non-Windows machine the lookup returns nothing at all. The text degrades to
    the old wording rather than claiming a process it cannot name.
    """
    if owners:
        held = "\n".join(f"  - {owner}" for owner in owners)
        who = f"It is held by:\n{held}\n\n"
    else:
        who = (
            "The holding process could not be identified.\n\n"
            "Most likely one of:\n"
            f"  - a VMS {label.lower()} that is already running (check the "
            "taskbar for a terminal window);\n"
            "  - another application using the same port.\n\n"
        )

    return (
        f"Port {port} is already in use, so {label} cannot bind it.\n\n"
        f"{who}"
        "Nothing has been stopped automatically. Close the other process, or "
        "use the service that is already running."
    )


def run(*, include_scanner: bool, mode: str = Mode.DEV) -> Report:
    """Every check, in the order a person would want to read them.

    `mode` adds the two production-only checks. In development the Next apps
    compile as they serve, so asking whether they are built would be a
    question with no meaning and a failure with no fix.
    """
    lan_ip = detect_lan_ip()

    checks: list[Check] = [
        Check(
            "Repository root",
            (ROOT / "vms-backend").is_dir(),
            detail=(
                f"Could not find a VMS checkout at: {ROOT}\n"
                "The control centre expects to sit beside the service "
                "directories."
            ),
        ),
        *_virtualenv_checks(),
        Check(
            "Node.js",
            shutil.which("node") is not None,
            detail="`node` is not on PATH. Install Node.js and reopen the control centre.",
        ),
        Check(
            "npm",
            shutil.which(NPM) is not None,
            detail=f"`{NPM}` is not on PATH. It ships with Node.js.",
        ),
        _directory("vms-backend", BACKEND_DIR),
        _directory("vms-dashboard", DASHBOARD_DIR),
        _directory("vms-screen", SCREEN_DIR),
        _directory("vms-scanner", SCANNER_DIR),
        *_production_checks(mode),
        port_check("Backend", BACKEND_PORT),
        port_check("Dashboard", DASHBOARD_PORT),
        port_check("Lobby Screen", SCREEN_PORT),
        Check(
            "LAN address",
            is_lan_address(lan_ip),
            detail=(
                f"No LAN address found; falling back to {lan_ip}.\n"
                "Phones and the lobby screen will not be able to reach this "
                "machine. Check the Wi-Fi or cable."
            ),
            # A warning, not a blocker: everything still works on this machine,
            # which is exactly the case when someone is testing on one laptop.
            blocking=False,
        ),
    ]

    if not include_scanner:
        checks = [c for c in checks if c.label != "vms-scanner"]

    return Report(checks=checks, lan_ip=lan_ip)


def format_report(report: Report) -> str:
    """The report as it appears in the application log."""
    lines = ["Preflight check", ""]
    for check in report.checks:
        lines.append(f"  {'OK  ' if check.ok else 'FAIL'}  {check.label}")
    lines.append("")

    for check in report.failures:
        if check.detail:
            lines.append(f"{check.label}:")
            lines.extend(f"  {line}" for line in check.detail.splitlines())
            lines.append("")

    lines.append(
        "All checks passed." if report.ok else "Start cancelled: see the failures above."
    )
    return "\n".join(lines)
