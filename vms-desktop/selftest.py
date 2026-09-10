"""Checks for everything in the control centre that does not need a window.

RUN THIS BEFORE TRUSTING A BUILD:

    ..\\.venv\\Scripts\\python.exe selftest.py

It covers config, network and preflight — the layers that decide *what* gets
run and *whether it may*. Those are the parts where a mistake is quiet and
expensive: a wrong uvicorn flag, an invented environment variable, a port check
that always says "free". The Qt layers need a display and are verified by
running the app.

No test framework: pytest is not installed in this repository and CLAUDE.md is
explicit about not pretending otherwise.
"""

from __future__ import annotations

import os
import socket
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402
import network  # noqa: E402
import preflight  # noqa: E402
import processes  # noqa: E402

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    print(f"  {'OK  ' if condition else 'FAIL'}  {label}")
    if not condition:
        failures.append(f"{label}{': ' + detail if detail else ''}")


print("config — paths")
check("repository root found", (config.ROOT / "vms-backend").is_dir(), str(config.ROOT))
check("no absolute path is hard-coded", "C:\\Users" not in Path(config.__file__).read_text(encoding="utf-8"))
check("venv python located", config.VENV_PYTHON.is_file(), str(config.VENV_PYTHON))
check("venv uvicorn located", config.VENV_UVICORN.is_file(), str(config.VENV_UVICORN))

print("\nconfig — the backend command CLAUDE.md requires")
backend = config.backend_spec()
args = backend.arguments
check("runs config.asgi:application", args[0] == "config.asgi:application")
check("binds 0.0.0.0", "--host" in args and args[args.index("--host") + 1] == "0.0.0.0")
check("port 8000", "--port" in args and args[args.index("--port") + 1] == "8000")
check(
    "one worker (hard constraint: InMemoryChannelLayer)",
    "--workers" in args and args[args.index("--workers") + 1] == "1",
)
check("no --reload (it forks)", "--reload" not in args)
check("uses the venv uvicorn, not a global one", str(config.VENV_DIR) in backend.program)
check("working directory is vms-backend", backend.directory == config.BACKEND_DIR)

print("\nconfig — the Next commands")
for spec in (config.dashboard_spec(config.Mode.DEV), config.screen_spec(config.Mode.DEV)):
    check(f"{spec.name}: npm on Windows is npm.cmd", spec.program == config.NPM)
    check(f"{spec.name}: binds every interface", "0.0.0.0" in spec.arguments)
    check(f"{spec.name}: correct port", str(spec.port) in spec.arguments)
    check(f"{spec.name}: dev script", "dev" in spec.arguments)

prod = config.dashboard_spec(config.Mode.PROD)
check("production uses `npm start`", "start" in prod.arguments and "dev" not in prod.arguments)
check("production build command is `npm run build`", config.build_args() == ["run", "build"])

print("\nconfig — the scanner is optional and has no assumed port")
scanner = config.scanner_spec()
check("optional", scanner.optional)
check("no port assumed (Expo assigns it)", scanner.port is None)
check("not opened in a browser", not scanner.opens_in_browser)

print("\nconfig — environment names come from the repository")
dash_env = config.service_environment("dashboard", "10.0.0.7")
screen_env = config.service_environment("screen", "10.0.0.7")
scan_env = config.service_environment("scanner", "10.0.0.7")
check("dashboard uses VMS_BACKEND_ORIGIN", dash_env == {"VMS_BACKEND_ORIGIN": "http://10.0.0.7:8000"})
check(
    "screen uses NEXT_PUBLIC_VMS_BACKEND_ORIGIN",
    screen_env == {"NEXT_PUBLIC_VMS_BACKEND_ORIGIN": "http://10.0.0.7:8000"},
)
check("scanner uses EXPO_PUBLIC_API_URL", scan_env == {"EXPO_PUBLIC_API_URL": "http://10.0.0.7:8000"})

source = Path(config.__file__).read_text(encoding="utf-8")
for invented in ("NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WS_URL"):
    # Named only inside the docstring that explains why they are not used.
    used = f'"{invented}"' in source
    check(f"{invented} is not set anywhere", not used)

check("no service is told to use localhost", "localhost" not in str(dash_env | screen_env | scan_env))

print("\nnetwork")
lan = network.detect_lan_ip()
check("an address was detected", bool(lan))
check("it is a real IPv4", len(lan.split(".")) == 4 and all(p.isdigit() for p in lan.split(".")))
print(f"        detected: {lan}  (LAN-reachable: {network.is_lan_address(lan)})")
check("loopback is not treated as a LAN address", not network.is_lan_address("127.0.0.1"))
check("link-local is not treated as a LAN address", not network.is_lan_address("169.254.10.2"))

# A port we hold ourselves must read as busy, and the same port must read as
# free the moment we let go. Anything less and the preflight check is theatre.
held = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
held.bind(("127.0.0.1", 0))
held.listen(1)
held_port = held.getsockname()[1]
check(f"a held port ({held_port}) reads as in use", network.port_in_use(held_port))
held.close()
check(f"the same port reads as free once released", not network.port_in_use(held_port))

print("\npreflight")
report = preflight.run(include_scanner=True)
by_label = {c.label: c for c in report.checks}
check("reports a LAN address", bool(report.lan_ip))
check("checks the virtual environment", any("virtual environment" in c.label for c in report.checks))
check("checks node", "Node.js" in by_label)
check("checks npm", "npm" in by_label)
for directory in ("vms-backend", "vms-dashboard", "vms-screen", "vms-scanner"):
    check(f"checks {directory}", directory in by_label)
for port in (8000, 3000, 3001):
    check(f"checks port {port}", any(f"port {port}" in c.label for c in report.checks))

check(
    "scanner check is dropped when the scanner is disabled",
    "vms-scanner" not in {c.label for c in preflight.run(include_scanner=False).checks},
)
check(
    "a missing LAN address warns but does not block",
    not by_label["LAN address"].blocking,
)
check("the report renders", "Preflight check" in preflight.format_report(report))

print("\nprocesses — a failed tree kill must not look like a success")
# A pid that cannot exist. Real `taskkill`, real exit code, no mock: the entire
# point is that the launcher notices when the kill did not happen.
dead = processes.kill_tree(999999)
check("a failed tree kill does not report ok", not dead.ok)
check("it carries the exit code", dead.returncode != 0, str(dead.returncode))
check("it carries the killer's own words", "999999" in dead.message, repr(dead.message))
check("it renders as a single log line", "\n" not in dead.message.strip(), repr(dead.message))

print("\nprocesses — netstat is parsed precisely, not searched for digits")
# Every trap `findstr 8000` falls into, in one sample: a longer port ending in
# the same digits, a foreign address carrying them, a pid that is literally
# 8000, and a row that is not LISTENING.
sample = """
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       4242
  TCP    0.0.0.0:38000          0.0.0.0:0              LISTENING       111
  TCP    127.0.0.1:9999         127.0.0.1:8000         ESTABLISHED     222
  TCP    0.0.0.0:1234           0.0.0.0:0              LISTENING       8000
  TCP    0.0.0.0:8000           0.0.0.0:0              TIME_WAIT       333
  TCP    [::]:8000              [::]:0                 LISTENING       4242
"""
pids = processes.listening_pids(sample, 8000)
check("finds the real listener", pids == ["4242"], str(pids))
check("port 38000 is not port 8000", "111" not in pids)
check("a foreign address is not a local one", "222" not in pids)
check("a pid that looks like a port is not a port", "8000" not in pids)
check("only LISTENING counts", "333" not in pids)
check("the IPv4 and IPv6 rows of one process are one owner", len(pids) == 1, str(pids))

print("\nprocesses — the holder of a real port is found and named")
mine = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
mine.bind(("127.0.0.1", 0))
mine.listen(1)
mine_port = mine.getsockname()[1]
owners = processes.port_owners(mine_port)
check(
    f"this process is named as the holder of {mine_port}",
    any(o.pid == str(os.getpid()) for o in owners),
    str([str(o) for o in owners]),
)
check(
    "the holder is named by image, not only by pid",
    any("python" in o.image.lower() for o in owners),
    str([str(o) for o in owners]),
)

print("\npreflight — a busy port says WHO holds it")
busy = preflight.port_check("Dashboard", mine_port)
check("the check fails", not busy.ok)
check("the detail names the pid", str(os.getpid()) in busy.detail, busy.detail)
check("the detail names the image", "python" in busy.detail.lower(), busy.detail)
check("the check carries the port, so the UI can offer to free it", busy.port == mine_port)
check(
    "the check carries the owners, so nothing has to re-parse netstat",
    any(o.pid == str(os.getpid()) for o in busy.owners),
    str([str(o) for o in busy.owners]),
)
mine.close()
check("a free port carries no owners", preflight.port_check("Dashboard", mine_port).owners == ())

print("\n" + "=" * 62)
if failures:
    print(f"{len(failures)} FAILED\n")
    for line in failures:
        print(f"  - {line}")
    sys.exit(1)

print("All self-tests passed.")
print("\nNot covered here (needs a display): the window, the service cards,")
print("QProcess start/stop, and the readiness probes. Run the app for those.")
