"""Is this machine able to run VMS at all?

Everything here is cheap, synchronous and side-effect free — it reads the disk
and pokes at ports, and it changes nothing. That is what lets `Run All` call it
first and stop before starting anything when the answer is no.

The point is not to produce a pass/fail. It is to produce a sentence somebody
at a registration desk can act on: which check failed, on what path, and what
to do about it.
"""

from __future__ import annotations

import shutil
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
    VENV_UVICORN,
)
from network import detect_lan_ip, is_lan_address, port_in_use


@dataclass(frozen=True)
class Check:
    label: str
    ok: bool
    #: Shown when the check fails. Names the path or port, and the fix.
    detail: str = ""
    #: A failed non-blocking check is a warning: Run All still proceeds.
    blocking: bool = True


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
        Check(
            f"Uvicorn ({VENV_UVICORN.name})",
            VENV_UVICORN.is_file(),
            detail=(
                f"Not found: {VENV_UVICORN}\n"
                f'Install it into the virtual environment:\n'
                f'  "{VENV_PYTHON}" -m pip install "uvicorn[standard]"'
            ),
        ),
    ]


def _port_check(label: str, port: int) -> Check:
    """A busy port is blocking, and this does NOT try to free it.

    Killing whatever holds a port is the kind of helpfulness that ends a
    conference: the process could be the backend somebody started by hand five
    minutes ago with a room full of delegates arriving. Report it; let a person
    decide.
    """
    busy = port_in_use(port)
    return Check(
        label=f"{label} port {port}",
        ok=not busy,
        detail=describe_port_conflict(label, port) if busy else "",
    )


def describe_port_conflict(label: str, port: int) -> str:
    return (
        f"Port {port} is already in use, so {label} cannot bind it.\n\n"
        "Most likely one of:\n"
        f"  - a VMS {label.lower()} that is already running (check the taskbar "
        "for a terminal window);\n"
        "  - another application using the same port.\n\n"
        "Nothing has been stopped automatically. Close the other process, or "
        "use the service that is already running."
    )


def run(*, include_scanner: bool) -> Report:
    """Every check, in the order a person would want to read them."""
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
        _port_check("Backend", BACKEND_PORT),
        _port_check("Dashboard", DASHBOARD_PORT),
        _port_check("Lobby Screen", SCREEN_PORT),
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
