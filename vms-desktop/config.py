"""Where everything is, and how each service is started.

ONE PLACE FOR EVERY PATH, PORT AND COMMAND. Nothing below is repeated in the
widgets or the launcher — those ask this module. Changing a port here changes it
in the preflight check, the readiness probe, the URL card and the browser call
at once, which is the only way those four stay in agreement.

WHY THE COMMANDS LOOK LIKE THEY DO
----------------------------------
Every command here was taken from `CLAUDE.md` and the projects' own
`package.json` files rather than invented. Three of them carry constraints that
are not obvious and must not be "tidied":

* The backend runs as ONE process, always. `--workers 1` is explicit even
  though it is uvicorn's default, because CLAUDE.md makes it a hard constraint:
  the Channels layer keeps group membership in a Python dict inside the
  process, so a second worker makes a scan reach the lobby screen only
  sometimes. `--reload` is absent for the same reason — it forks.

* The backend runs from the repository's own `.venv`, by calling
  `uvicorn.exe` inside it directly. Not `activate.bat && uvicorn`: activation
  is a shell mutation that does not survive into a child process, so a
  `cmd /c "call activate && ..."` wrapper buys nothing over naming the
  executable, and costs an extra process that Windows will not kill with its
  parent.

* Next dev servers get `--hostname 0.0.0.0`, so phones on the LAN can reach
  them. Without it Next binds loopback and the failure reads as "the network is
  down".
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path


def repository_root() -> Path:
    """The VMS checkout this launcher belongs to.

    Resolved from where the code actually is, never hard-coded, and it has to
    work in two quite different situations:

    * running from source, where this file is `<root>/vms-desktop/config.py`;
    * running from a PyInstaller build, where the executable is expected to sit
      beside the service directories (see the README's deployment layout).

    `sys.frozen` is what PyInstaller sets, and `sys.executable` is then the
    .exe rather than a Python interpreter — so the two cases genuinely need
    different anchors.
    """
    if getattr(sys, "frozen", False):
        # dist/VMS Control Center/VMS Control Center.exe -> look outward for the
        # checkout. The exe may sit at the root, or one level down inside its
        # onedir folder.
        start = Path(sys.executable).resolve().parent
    else:
        start = Path(__file__).resolve().parent.parent

    for candidate in (start, *start.parents):
        if (candidate / "vms-backend").is_dir() and (candidate / ".venv").is_dir():
            return candidate

    # Nothing matched. Return the best guess so the preflight check can report a
    # precise, quotable path instead of the launcher dying on an import.
    return start


ROOT = repository_root()

VENV_DIR = ROOT / ".venv"
VENV_SCRIPTS = VENV_DIR / ("Scripts" if os.name == "nt" else "bin")
VENV_PYTHON = VENV_SCRIPTS / ("python.exe" if os.name == "nt" else "python")
VENV_UVICORN = VENV_SCRIPTS / ("uvicorn.exe" if os.name == "nt" else "uvicorn")

BACKEND_DIR = ROOT / "vms-backend"
DASHBOARD_DIR = ROOT / "vms-dashboard"
SCREEN_DIR = ROOT / "vms-screen"
SCANNER_DIR = ROOT / "vms-scanner"

BACKEND_PORT = 8000
DASHBOARD_PORT = 3000
SCREEN_PORT = 3001

#: The backend's readiness probe. It exists already, takes no auth
#: (`AllowAny`), and reports the LAN address the server believes it has — so it
#: answers "is it up?" and "did it bind the right interface?" in one request.
#: The path is `/api/v1/health`, NOT the `/api/health/` an earlier draft of the
#: plan guessed at.
HEALTH_PATH = "/api/v1/health"

#: npm is a shell script on Windows and has to be invoked as `npm.cmd`.
NPM = "npm.cmd" if os.name == "nt" else "npm"

#: Long enough for a cold Next build on a laptop, short enough that a genuinely
#: broken service is reported rather than waited on forever.
READY_TIMEOUT_MS = {
    "backend": 60_000,
    "dashboard": 180_000,
    "screen": 180_000,
    "scanner": 120_000,
}


class Mode:
    """Development or production, for the two Next apps only."""

    DEV = "dev"
    PROD = "prod"


@dataclass(frozen=True)
class ServiceSpec:
    """Everything needed to start one service and know whether it is up."""

    key: str
    name: str
    technology: str
    directory: Path
    #: Executable plus arguments. Never a shell string: `QProcess` with a
    #: program and an argument list needs no quoting rules and cannot be
    #: confused by a space in a path.
    program: str
    arguments: list[str]
    #: None for the scanner, which Expo assigns dynamically.
    port: int | None = None
    #: The URL a person would open. None where there is nothing to open.
    opens_in_browser: bool = False
    #: Optional services are skipped by Run All unless enabled.
    optional: bool = False
    #: Extra process environment, filled in per-run with the detected LAN IP.
    env: dict[str, str] = field(default_factory=dict)


def backend_spec() -> ServiceSpec:
    return ServiceSpec(
        key="backend",
        name="Backend",
        technology="Django + Channels (uvicorn)",
        directory=BACKEND_DIR,
        program=str(VENV_UVICORN),
        arguments=[
            "config.asgi:application",
            "--host",
            "0.0.0.0",
            "--port",
            str(BACKEND_PORT),
            # Not a default we are restating for neatness -- see the module
            # docstring. One process, always.
            "--workers",
            "1",
        ],
        port=BACKEND_PORT,
    )


def dashboard_spec(mode: str) -> ServiceSpec:
    return ServiceSpec(
        key="dashboard",
        name="Dashboard",
        technology="Next.js 16",
        directory=DASHBOARD_DIR,
        program=NPM,
        arguments=_next_args(mode, DASHBOARD_PORT),
        port=DASHBOARD_PORT,
        opens_in_browser=True,
    )


def screen_spec(mode: str) -> ServiceSpec:
    return ServiceSpec(
        key="screen",
        name="Lobby Screen",
        technology="Next.js 16",
        directory=SCREEN_DIR,
        program=NPM,
        arguments=_next_args(mode, SCREEN_PORT),
        port=SCREEN_PORT,
        opens_in_browser=True,
    )


def scanner_spec() -> ServiceSpec:
    return ServiceSpec(
        key="scanner",
        name="Scanner",
        technology="Expo SDK 57",
        directory=SCANNER_DIR,
        program=NPM,
        # `expo start` from the project's own "start" script. No `-c`: clearing
        # the Metro cache is a deliberate act after an .env change, not
        # something a launcher should do on every run.
        arguments=["run", "start"],
        port=None,
        optional=True,
    )


def _next_args(mode: str, port: int) -> list[str]:
    """`npm run dev` / `npm start`, bound to every interface.

    `--` separates npm's own arguments from the script's. Next 16 accepts
    `--hostname` and `--port` on both `dev` and `start`.
    """
    script = "dev" if mode == Mode.DEV else "start"
    return ["run", script, "--", "--hostname", "0.0.0.0", "--port", str(port)]


def build_args() -> list[str]:
    """Production builds run once, ahead of `npm start`, and must succeed."""
    return ["run", "build"]


def service_specs(mode: str) -> list[ServiceSpec]:
    """The four services, in the order Run All should start them."""
    return [backend_spec(), dashboard_spec(mode), screen_spec(mode), scanner_spec()]


def service_environment(key: str, lan_ip: str) -> dict[str, str]:
    """LAN-aware environment for one service.

    THESE VARIABLE NAMES COME FROM THE REPOSITORY, NOT FROM A CONVENTION.
    An earlier draft of the plan suggested `NEXT_PUBLIC_API_URL` and
    `NEXT_PUBLIC_WS_URL`; neither exists anywhere in this codebase, and adding
    them would be configuration drift that reads as configuration.

    What actually exists, per each project's `.env.example` and CLAUDE.md:

    * dashboard  `VMS_BACKEND_ORIGIN`            server-side only; it proxies
    * screen     `NEXT_PUBLIC_VMS_BACKEND_ORIGIN` last resort; it probes first
    * scanner    `EXPO_PUBLIC_API_URL`            a default; the app can be told

    PASSED AS PROCESS ENVIRONMENT, NEVER WRITTEN TO `.env`. CLAUDE.md is
    explicit that `.env` is per-machine, gitignored, and must not have an IP
    written into it — "a documented address is a documented lie the moment DHCP
    hands out a new one". A variable that lives only for the lifetime of the
    child process cannot go stale on disk.

    An `.env` the user has already written still wins for the two Next apps:
    Next loads `.env.local` over the inherited environment. That is the right
    precedence — a deliberate local choice should outrank a launcher's guess.
    """
    origin = f"http://{lan_ip}:{BACKEND_PORT}"

    if key == "dashboard":
        return {"VMS_BACKEND_ORIGIN": origin}
    if key == "screen":
        return {"NEXT_PUBLIC_VMS_BACKEND_ORIGIN": origin}
    if key == "scanner":
        return {"EXPO_PUBLIC_API_URL": origin}
    return {}


def service_urls(lan_ip: str) -> list[tuple[str, str]]:
    """The addresses to show on the network card, in reading order."""
    return [
        ("Backend", f"http://{lan_ip}:{BACKEND_PORT}"),
        ("WebSocket", f"ws://{lan_ip}:{BACKEND_PORT}/ws/screen/"),
        ("Dashboard", f"http://{lan_ip}:{DASHBOARD_PORT}"),
        ("Lobby Screen", f"http://{lan_ip}:{SCREEN_PORT}"),
    ]
