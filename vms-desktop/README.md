# VMS Desktop Control Center

A PySide6 window that starts, watches and stops the four VMS services. It is an
**orchestration layer** — it holds no visitor data, implements no business
logic, and speaks exactly one VMS endpoint (`/api/v1/health`, unauthenticated,
used as a readiness probe). Delete it and VMS still works exactly as before.

```
                     VMS Control Center
                            |
     +----------+-----------+-----------+
     v          v           v           v
  Backend   Dashboard    Screen      Scanner
   :8000      :3000      :3001     Expo (dynamic)
```

## Running it

```powershell
..\.venv\Scripts\python.exe main.py
```

Self-tests for everything that does not need a window:

```powershell
..\.venv\Scripts\python.exe selftest.py
```

## What it will and will not do

**Run All** checks the environment, starts the backend, *waits until the health
endpoint answers*, then starts the dashboard and lobby screen together, waits
for each, and opens a browser only for the ones that answered. The scanner is
opt-in per run via the checkbox on its card.

**It never opens a browser at a service that has merely started.** A process
existing and a service answering are different claims, and the state model
keeps them apart: `RUNNING` is amber, `READY` is green.

**It will not free a port for you.** If 8000 is busy it says so and stops.
Killing whatever holds a port is how a launcher takes down a backend somebody
started by hand with delegates already arriving.

**It will not fall back to a global Python.** If `.venv` is missing or has no
`uvicorn.exe`, the backend does not start and the message says which path was
checked.

## Configuration it passes down

Per-run process environment only. Nothing is written to any `.env` —
CLAUDE.md is explicit that those are per-machine, gitignored, and must not have
an IP written into them.

| Service | Variable | Why that name |
|---|---|---|
| Dashboard | `VMS_BACKEND_ORIGIN` | server-side; it proxies `/api` and `/media` |
| Lobby screen | `NEXT_PUBLIC_VMS_BACKEND_ORIGIN` | the browser needs it for the WebSocket |
| Scanner | `EXPO_PUBLIC_API_URL` | inlined by Expo at bundle time |

These are the repository's own names, taken from each project's
`.env.example`. An earlier draft of the implementation plan suggested
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`; neither exists anywhere in VMS,
and introducing them would be configuration drift dressed as configuration.

A `.env.local` a user has already written still wins — Next loads it over the
inherited environment, which is the right precedence.

## The backend command

```
.venv\Scripts\uvicorn.exe config.asgi:application --host 0.0.0.0 --port 8000 --workers 1
```

`--workers 1` is explicit even though it is uvicorn's default, because
CLAUDE.md makes one process a hard constraint: Channels keeps group membership
in a dict inside the process, so a second worker makes a scan reach the lobby
screen only sometimes. `--reload` is absent for the same reason.

The virtual environment is used by **naming its executable**, not by
`activate.bat && uvicorn`. Activation mutates a shell; that mutation does not
survive into a child process, so the wrapper would add a process without adding
correctness.

## Packaging

```powershell
..\.venv\Scripts\pyinstaller.exe --noconfirm --clean "VMS Control Center.spec"
```

Output: `dist\VMS Control Center\VMS Control Center.exe` — double-click, no
terminal.

**Onedir, not onefile.** Onefile unpacks to a fresh `%TEMP%` directory each
launch, so `sys.executable` would have no relation to the VMS checkout — and
this launcher finds the repository by walking outward from its own location.

### This executable is NOT standalone

It bundles the GUI and Qt. It does **not** bundle, and still requires on the
target machine:

- the VMS checkout (`vms-backend`, `vms-dashboard`, `vms-screen`, `vms-scanner`)
- `.venv` with the backend's dependencies installed
- Node.js and npm on `PATH`
- PostgreSQL, per the backend's own requirements
- `node_modules` installed in each frontend

Expected layout, with the executable beside the service directories:

```
VMS/
├── VMS Control Center.exe      (or dist\VMS Control Center\ alongside)
├── .venv/
├── vms-backend/
├── vms-dashboard/
├── vms-screen/
└── vms-scanner/
```

`config.repository_root()` walks outward from the executable looking for a
directory that contains both `vms-backend` and `.venv`, so the exe can sit at
the root or one level down without configuration.

## Firewall

LAN access needs Windows Firewall to permit 8000, 3000 and 3001. The app says
so on the network card and **changes no firewall rule** — that is an
administrator's decision, not a launcher's.

## Layout

```
main.py        window, wiring, browser opening
config.py      every path, port, command and environment name
network.py     LAN detection, port probing
preflight.py   environment checks, readable failures
services.py    QProcess lifecycle, the state model
launcher.py    readiness probes and the Run All sequence
widgets/       presentation only, no process logic
selftest.py    checks for everything that needs no display
```
