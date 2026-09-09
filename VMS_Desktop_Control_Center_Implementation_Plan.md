# VMS Desktop Control Center --- Implementation Plan

## 0. FIRST RULE --- LEARN BEFORE EXECUTING

**MANDATORY FOR ANY AI AGENTIC CODING AGENT:**

Before changing, creating, deleting, or refactoring any code, first
**learn and understand the existing VMS repository as an expert Software
Engineer**.

Do not immediately start coding.

First inspect and understand:

1.  The complete repository structure.
2.  `vms-backend` architecture, Django settings, ASGI configuration,
    REST API, WebSocket routing, authentication, and dependencies.
3.  `vms-dashboard` architecture, Next.js version, package manager,
    scripts, environment variables, API configuration, and WebSocket
    configuration.
4.  `vms-screen` architecture, Next.js version, package manager,
    scripts, environment variables, API configuration, and WebSocket
    configuration.
5.  `vms-scanner` architecture, React Native + Expo version, package
    manager, Expo configuration, API configuration, and current
    LAN/device behavior.
6.  `vms-contracts` and how shared contracts/types/configuration are
    used.
7.  Existing `scripts`, `.venv`, `.gitignore`, `CLAUDE.md`, and relevant
    documentation.
8.  Existing commands currently used to run each service.
9.  Existing ports, hosts, URLs, environment variables, and
    service-to-service communication.
10. Existing build, development, and production workflows.

Use the repository's existing implementation as the source of truth.

**Do not invent architecture that conflicts with the existing code.**

Before implementation, produce a concise internal/external understanding
of: - what exists, - how services communicate, - what must remain
unchanged, - what must be added, - potential compatibility risks, - and
the safest implementation sequence.

Then implement the plan incrementally and verify every important step.

------------------------------------------------------------------------

# 1. Objective

Build a **PySide6 desktop application named VMS Desktop Control Center**
for the existing Visitor Management System (VMS).

The desktop application must act as a **service orchestrator/control
center**, not as the business-logic layer of VMS.

Its responsibilities are:

-   Detect the current LAN/Wi-Fi IPv4 address.
-   Validate the local development environment.
-   Validate required VMS project directories and dependencies.
-   Start the VMS services.
-   Stop individual services.
-   Start individual services.
-   Run all services with one button.
-   Monitor service state.
-   Capture and display process stdout/stderr.
-   Display user-friendly application logs.
-   Display raw terminal logs for each service.
-   Check that services are actually ready before opening browsers.
-   Configure LAN-aware URLs/environment values where necessary.
-   Open the Dashboard and Lobby Screen automatically after they are
    ready.
-   Provide clear errors when a service cannot start.
-   Prepare the application for future packaging as a Windows executable
    with PyInstaller.

The desktop launcher must **not** rewrite or duplicate the VMS business
logic.

------------------------------------------------------------------------

# 2. Existing VMS Architecture

The repository currently contains these major services:

``` text
vms/
├── .claude/
├── .venv/
├── scripts/
├── vms-backend/
├── vms-contracts/
├── vms-dashboard/
├── vms-scanner/
├── vms-screen/
├── .gitignore
├── CLAUDE.md
├── example-id-card.jpg
├── test_websocket_flow.py
└── vms-system-architecture-icons.drawio
```

## 2.1 Backend

Directory:

``` text
vms-backend/
```

Purpose:

-   Django application.
-   Django REST Framework APIs.
-   WebSocket functionality through ASGI.
-   Runs with Uvicorn.

Required backend command:

``` bash
uvicorn config.asgi:application --host 0.0.0.0 --port 8000
```

This command is a hard requirement.

The desktop launcher must preserve this command/behavior.

Backend port:

``` text
8000
```

Backend host:

``` text
0.0.0.0
```

Expected LAN URL:

``` text
http://<LAN_IP>:8000
```

WebSocket base URL should use the LAN IP when accessed by other devices:

``` text
ws://<LAN_IP>:8000
```

------------------------------------------------------------------------

## 2.2 Dashboard

Directory:

``` text
vms-dashboard/
```

Technology:

-   Next.js.
-   Admin dashboard.
-   Communicates with the backend REST API.
-   Consumes backend WebSocket functionality.

Current development command:

``` bash
npm run dev
```

Recommended LAN development behavior:

``` bash
npm run dev -- -H 0.0.0.0 -p 3000
```

However, **first inspect the existing `package.json` and Next.js version
before changing the command**.

Dashboard port:

``` text
3000
```

Expected LAN URL:

``` text
http://<LAN_IP>:3000
```

------------------------------------------------------------------------

## 2.3 Lobby Screen

Directory:

``` text
vms-screen/
```

Technology:

-   Next.js.
-   Displays visitors arriving at the entrance.
-   Receives visitor scan/event information through the
    backend/WebSocket architecture.

Current development command:

``` bash
npm run dev
```

Recommended LAN development behavior:

``` bash
npm run dev -- -H 0.0.0.0 -p 3001
```

However, **first inspect the existing `package.json` and Next.js version
before changing the command**.

Lobby Screen port:

``` text
3001
```

Expected LAN URL:

``` text
http://<LAN_IP>:3001
```

------------------------------------------------------------------------

## 2.4 Scanner

Directory:

``` text
vms-scanner/
```

Technology:

-   React Native.
-   Expo.
-   Guard application.
-   Scans visitor QR codes.
-   Sends scan information to the backend.
-   Backend/WebSocket flow causes the Lobby Screen to update.

Current development command:

``` bash
npm start
```

Expo may use a dynamically assigned port.

The scanner is different from the two web applications because it
normally runs on a physical mobile device.

The desktop launcher should support:

``` bash
npm start
```

and preferably use LAN mode where compatible with the existing Expo
configuration.

Do not assume a fixed scanner port unless the repository already defines
one.

The scanner must be optional because production/demo use may involve an
already-built APK.

------------------------------------------------------------------------

# 3. Target Architecture

The PySide6 application should sit above the existing services:

``` text
                         VMS Desktop
                       Control Center
                           PySide6
                              |
        +---------------------+---------------------+
        |                     |                     |
    Run All              Individual             Monitoring
        |                  Controls                 |
        |                     |                     |
        +----------+----------+---------------------+
                   |
        +----------+----------+-----------+
        |          |          |           |
        v          v          v           v
    Backend    Dashboard    Screen     Scanner
    :8000        :3000      :3001       Expo
        |          |          |           |
        +----------+----------+-----------+
                   |
                 LAN IP
```

The desktop application is an orchestration layer.

It should not become a replacement for:

-   Django.
-   REST API.
-   WebSocket server.
-   Next.js.
-   React Native.
-   Expo.

------------------------------------------------------------------------

# 4. Recommended New Directory

Add:

``` text
vms-desktop/
```

Recommended structure:

``` text
vms-desktop/
├── main.py
├── config.py
├── network.py
├── services.py
├── launcher.py
├── preflight.py
├── requirements.txt
│
├── widgets/
│   ├── service_card.py
│   ├── log_viewer.py
│   └── network_card.py
│
└── assets/
    └── vms.ico
```

The exact structure may be adjusted after inspecting the existing
repository.

Keep the desktop application independent from `vms-backend`.

------------------------------------------------------------------------

# 5. Core GUI Requirements

Create a professional desktop control center.

Main UI should contain:

## Header

Display:

``` text
VMS CONTROL CENTER
Visitor Management System
```

Also show an overall status:

``` text
ONLINE
```

or:

``` text
PARTIAL
```

or:

``` text
OFFLINE
```

------------------------------------------------------------------------

## Network Section

Display:

``` text
LAN IP
192.168.x.x
```

and generated service URLs:

``` text
Backend
http://192.168.x.x:8000

WebSocket
ws://192.168.x.x:8000

Dashboard
http://192.168.x.x:3000

Lobby Screen
http://192.168.x.x:3001
```

Provide a refresh mechanism if the network changes.

------------------------------------------------------------------------

# 6. Service Cards

Create four service cards:

1.  Backend
2.  Dashboard
3.  Lobby Screen
4.  Scanner

Each card should display:

-   Service name.
-   Technology.
-   Port or Expo status.
-   Running/stopped/error state.
-   Start button.
-   Stop button.
-   Open button where applicable.
-   Useful status information.

Example:

``` text
+--------------------------------+
| BACKEND                        |
| Port: 8000                     |
|                                |
| ● Running                      |
|                                |
| [ Start ] [ Stop ] [ Open ]   |
+--------------------------------+
```

For Scanner:

``` text
+--------------------------------+
| SCANNER                        |
| Expo LAN                       |
|                                |
| ● Running                      |
|                                |
| [ Start ] [ Stop ]             |
+--------------------------------+
```

------------------------------------------------------------------------

# 7. Global Controls

Provide:

``` text
[ ▶ RUN ALL ]
[ ■ STOP ALL ]
```

`RUN ALL` must start the services in a safe sequence.

`STOP ALL` must gracefully stop all managed processes.

------------------------------------------------------------------------

# 8. Run-All Sequence

Do not launch everything blindly at the same time.

Use this sequence:

``` text
RUN ALL
   |
   v
Detect LAN IP
   |
   v
Preflight checks
   |
   v
Validate ports/dependencies
   |
   v
Start Backend
   |
   v
Wait for Backend readiness
   |
   +----------------------+
   |                      |
   v                      v
Start Dashboard       Start Screen
   |                      |
   v                      v
Wait for readiness    Wait for readiness
   |                      |
   +----------+-----------+
              |
              v
       Start Scanner
              |
              v
       All services ready
              |
              v
    Open Dashboard browser
              |
              v
    Open Screen browser
```

The scanner may be skipped if the user has disabled it.

------------------------------------------------------------------------

# 9. Backend Startup Requirement

The backend must be started with:

``` bash
uvicorn config.asgi:application --host 0.0.0.0 --port 8000
```

The implementation should preferably use the project's `.venv`
executable where possible, for example:

``` text
.venv/Scripts/uvicorn.exe
```

on Windows.

Do not globally depend on whichever Python installation happens to be
installed.

Before finalizing the executable path, inspect the actual repository and
environment.

------------------------------------------------------------------------

# 9.1 Backend Virtual Environment Activation — Mandatory

Before starting the VMS backend, the desktop launcher must ensure the
repository's Python virtual environment is activated/used.

The repository contains:

```text
.venv/
```

The backend must **never accidentally run against the system/global Python
environment** when the project virtual environment is available.

On Windows, the activation script is normally:

```text
.venv\Scripts\activate.bat
```

The backend startup flow must therefore be:

```text
Locate repository root
        |
        v
Locate .venv
        |
        v
Verify .venv\Scripts\activate.bat
        |
        v
Activate/call the virtual environment
        |
        v
Run:
uvicorn config.asgi:application --host 0.0.0.0 --port 8000
```

For a Windows process launched by PySide6, activation is a shell operation.
A robust implementation may use a command equivalent to:

```bat
call "<VMS_ROOT>\.venv\Scripts\activate.bat" && uvicorn config.asgi:application --host 0.0.0.0 --port 8000
```

or another implementation that guarantees the same result by directly
invoking the Uvicorn executable from the virtual environment.

**Important:** the implementation must verify which approach is most
reliable with the existing repository and PySide6 `QProcess`. Do not
pretend that activation persists across separate processes. The actual
backend process must run with the `.venv` Python environment.

Before starting the backend, verify:

```text
[ ] .venv exists
[ ] .venv\Scripts exists
[ ] Python executable exists
[ ] Uvicorn executable/module is available in .venv
[ ] Backend working directory is vms-backend
```

If the virtual environment is missing or unusable, do not silently fall
back to global Python. Show a clear error and stop the backend startup.

Example:

```text
Backend cannot start.

Python virtual environment was not found or is invalid:

<VMS_ROOT>\.venv

Create/repair the project virtual environment and install the backend
dependencies before starting VMS.
```

The coding agent must inspect the actual `.venv` layout and existing
project scripts before finalizing the implementation.

---

# 10. Process Management

Use **PySide6 `QProcess`** rather than ordinary blocking `subprocess`
calls for managed long-running services.

Each service process should support:

-   Start.
-   Stop.
-   Kill as a fallback when graceful shutdown fails.
-   stdout capture.
-   stderr capture.
-   process state.
-   exit code.
-   process error.
-   Qt signals for UI updates.

A service abstraction should be created so all four services follow the
same lifecycle model.

Conceptually:

``` text
ServiceProcess
├── name
├── command
├── working_directory
├── environment
├── process
├── start()
├── stop()
├── read_stdout()
├── read_stderr()
└── status
```

Do not block the GUI thread.

------------------------------------------------------------------------

# 11. Preflight Checks

Before `RUN ALL`, validate the environment.

At minimum check:

``` text
✓ Python available
✓ Uvicorn available
✓ Node.js available
✓ npm available
✓ vms-backend exists
✓ vms-dashboard exists
✓ vms-screen exists
✓ vms-scanner exists
✓ required ports are available
✓ LAN IP detected
```

Also inspect actual project requirements before adding assumptions.

If a check fails, show a clear message.

Example:

``` text
Preflight Check

✓ Python found
✓ Uvicorn found
✓ Node.js found
✓ npm found

✓ Backend found
✓ Dashboard found
✓ Screen found
✓ Scanner found

✕ Port 3000 is already in use

Dashboard cannot be started.
```

------------------------------------------------------------------------

# 12. LAN IP Detection

The application must detect the active LAN/Wi-Fi IPv4 address.

Do not hard-code an address such as:

``` text
192.168.1.20
```

The IP can change depending on the network.

A robust implementation should determine the local outbound interface/IP
and fall back safely to:

``` text
127.0.0.1
```

only when no LAN address can be detected.

Display the detected IP in the UI.

------------------------------------------------------------------------

# 13. LAN Communication

This is critical.

Do not use `localhost` for clients that run on other devices.

Bad for mobile/LAN clients:

``` text
http://localhost:8000
ws://localhost:8000
```

Correct:

``` text
http://<LAN_IP>:8000
ws://<LAN_IP>:8000
```

Example:

``` text
http://192.168.1.20:8000
ws://192.168.1.20:8000
```

Remember:

``` text
localhost
```

means the current device.

Therefore, an Android phone using:

``` text
localhost:8000
```

will try to connect to the Android phone itself, not the VMS PC.

------------------------------------------------------------------------

# 14. Frontend Environment Configuration

Inspect the existing environment configuration before modifying it.

Where appropriate, the launcher should provide LAN-aware values such as:

``` env
NEXT_PUBLIC_API_URL=http://<LAN_IP>:8000
NEXT_PUBLIC_WS_URL=ws://<LAN_IP>:8000
```

Do not blindly overwrite existing `.env` files.

Prefer one of these approaches depending on the current project
architecture:

1.  Runtime environment injection.
2.  Temporary process environment variables.
3.  A generated development configuration.
4.  Existing project-supported environment mechanisms.

Preserve user/project configuration.

The launcher must not introduce configuration drift.

------------------------------------------------------------------------

# 15. Service Readiness

Starting a process does not mean the service is ready.

The application must distinguish:

``` text
PROCESS STARTED
```

from:

``` text
SERVICE READY
```

For the backend, preferably use an existing health endpoint.

If no health endpoint exists, inspect the API and add a minimal health
endpoint only if appropriate.

Example:

``` text
GET /api/health/
```

Expected response:

``` json
{
  "status": "ok"
}
```

For Dashboard:

``` text
http://<LAN_IP>:3000
```

For Screen:

``` text
http://<LAN_IP>:3001
```

The launcher should wait until the service actually responds before
declaring it ready.

Do not use blocking `time.sleep()` on the PySide6 GUI thread.

Use Qt-compatible asynchronous mechanisms such as `QTimer`, worker
threads, or asynchronous readiness checks.

------------------------------------------------------------------------

# 16. Browser Opening

Only open browsers after the relevant service is ready.

Dashboard:

``` text
http://<LAN_IP>:3000
```

Lobby Screen:

``` text
http://<LAN_IP>:3001
```

Do not automatically open the backend unless useful to the user.

Use Python's browser-opening mechanism or an appropriate Qt-supported
method.

------------------------------------------------------------------------

# 17. Development vs Production Mode

Support two conceptual modes if practical.

## Development

Dashboard:

``` bash
npm run dev
```

Screen:

``` bash
npm run dev
```

The launcher waits until the server is ready.

## Production

For web applications:

``` text
npm run build
```

must succeed first.

Then:

``` text
npm start
```

Only after the production server is ready should the browser open.

Recommended production sequence:

``` text
npm run build
       |
       v
Build success?
       |
      YES
       |
       v
npm start
       |
       v
Server ready
       |
       v
Open browser
```

Do not assume a particular Next.js version or command syntax until
inspecting each project's `package.json`.

If the repository currently uses another production strategy, preserve
it.

------------------------------------------------------------------------

# 18. Logs

The application must provide two levels of logging.

## 18.1 User/Application Log

Human-readable lifecycle messages:

``` text
[20:30:01] Detecting network...
[20:30:01] LAN IP: 192.168.1.20

[20:30:02] Starting VMS Backend...
[20:30:04] Backend is ready.

[20:30:04] Starting VMS Dashboard...
[20:30:07] Dashboard is ready.

[20:30:07] Starting VMS Screen...
[20:30:10] Screen is ready.

[20:30:10] Starting VMS Scanner...
[20:30:12] All services are running.
```

## 18.2 Raw Terminal Logs

Capture stdout/stderr exactly enough to troubleshoot:

``` text
[BACKEND] INFO: Application startup complete
[BACKEND] INFO: Uvicorn running on http://0.0.0.0:8000

[DASHBOARD] Ready
[SCREEN] Ready
```

Do not hide errors.

------------------------------------------------------------------------

# 19. Log Viewer

Use tabs:

``` text
[ ALL ]
[ BACKEND ]
[ DASHBOARD ]
[ SCREEN ]
[ SCANNER ]
```

The All tab combines all service logs.

Each service tab displays only its own stdout/stderr.

Provide useful controls such as:

``` text
[Clear Logs]
```

and optionally:

``` text
[Copy]
```

Do not allow logs to freeze the GUI.

------------------------------------------------------------------------

# 20. Service State Model

Use explicit states rather than only a boolean.

Recommended states:

``` text
STOPPED
STARTING
RUNNING
READY
STOPPING
ERROR
```

The UI should visually distinguish them.

Example:

``` text
● STOPPED
● STARTING
● READY
● ERROR
```

Do not rely only on whether `QProcess` is alive.

------------------------------------------------------------------------

# 21. Port Checking

Before startup, check:

``` text
8000
3000
3001
```

If a port is occupied:

-   Identify that the port is already in use.
-   Determine whether it is an existing managed VMS process if possible.
-   Avoid blindly killing unrelated processes.
-   Explain the problem to the user.
-   Allow safe recovery.

Example:

``` text
Port 8000 is already in use.

Possible causes:
- Another VMS backend is running.
- Another application is using port 8000.

Do not automatically kill unknown processes.
```

------------------------------------------------------------------------

# 22. Windows Considerations

The initial target is Windows desktop.

Account for:

-   `npm.cmd` rather than assuming Unix `npm`.
-   Windows path separators.
-   `.venv\Scripts\`.
-   executable discovery.
-   process termination behavior.
-   browser opening.
-   Windows Firewall/network accessibility.
-   PyInstaller packaging.

Avoid hard-coded absolute paths.

Resolve paths relative to the VMS repository or application location.

------------------------------------------------------------------------

# 23. Firewall / LAN Warning

The launcher should be able to report that LAN access may require
Windows Firewall permission.

Do not silently modify firewall rules.

Show a warning if necessary:

``` text
LAN Access

Backend: 8000
Dashboard: 3000
Screen: 3001

Make sure Windows Firewall permits LAN access
for the required applications/ports.
```

Only implement automatic firewall configuration if explicitly designed,
documented, and confirmed safe.

------------------------------------------------------------------------

# 24. Scanner Handling

Treat Scanner as optional.

Possible states:

``` text
Scanner: Disabled
Scanner: Stopped
Scanner: Starting
Scanner: Running
```

Provide:

``` text
[Start Scanner]
[Stop Scanner]
```

Do not require Expo to be running when the user intends to use an
already-built APK.

The launcher should support:

``` text
Run All without Scanner
```

if the scanner is disabled.

------------------------------------------------------------------------

# 25. Configuration Design

Centralize service configuration without hard-coding everything into the
UI.

A configuration model should contain information similar to:

``` text
Backend
  name
  directory
  command
  host
  port

Dashboard
  name
  directory
  command
  host
  port

Screen
  name
  directory
  command
  host
  port

Scanner
  name
  directory
  command
  host
  port/dynamic
```

Do not duplicate these values across multiple Python files.

------------------------------------------------------------------------

# 26. Suggested Components

Recommended separation:

``` text
main.py
    Application entry point.

config.py
    Paths, service definitions, ports, configurable options.

network.py
    LAN IP detection and network helpers.

preflight.py
    Environment/dependency/port/project checks.

services.py
    QProcess-based service lifecycle management.

launcher.py
    Startup sequence, readiness checks, Run All/Stop All orchestration.

widgets/
    UI components only.
```

Keep business logic out of widgets.

------------------------------------------------------------------------

# 27. Error Handling

The application must handle:

-   Missing project directory.
-   Missing Python.
-   Missing virtual environment.
-   Missing Uvicorn.
-   Missing Node.js.
-   Missing npm.
-   Invalid working directory.
-   Port already in use.
-   Process startup failure.
-   Process unexpectedly exiting.
-   Build failure.
-   Backend readiness timeout.
-   Dashboard readiness timeout.
-   Screen readiness timeout.
-   Scanner/Expo failure.
-   LAN IP unavailable.

Errors should be shown in both:

1.  User-friendly status/message.
2.  Detailed terminal/application log.

Example:

``` text
Dashboard failed to start.

Reason:
npm exited with code 1.

See the Dashboard terminal log for details.
```

------------------------------------------------------------------------

# 28. Safety Rules for the Coding Agent

The AI agent implementing this plan must follow these rules:

1.  **Learn first.**
2.  Inspect before modifying.
3.  Never delete existing VMS functionality without evidence it is
    obsolete.
4.  Never rewrite working VMS applications unnecessarily.
5.  Preserve existing API contracts.
6.  Preserve existing WebSocket behavior.
7.  Preserve existing authentication.
8.  Preserve existing environment configuration unless modification is
    required.
9.  Do not hard-code the user's current LAN IP.
10. Do not hard-code absolute machine-specific paths.
11. Do not automatically kill unrelated processes.
12. Do not block the PySide6 GUI thread.
13. Do not open browsers before service readiness.
14. Do not declare a service ready merely because its process started.
15. Test each service independently.
16. Test Run All.
17. Test Stop All.
18. Test individual Start/Stop.
19. Test LAN connectivity.
20. Test browser opening.
21. Test failure scenarios.
22. Keep implementation maintainable and modular.
23. Follow existing repository coding conventions when they exist.
24. Do not add unnecessary dependencies.
25. Prefer the simplest robust implementation.

------------------------------------------------------------------------

# 29. Implementation Phases

## Phase 1 --- Repository Discovery

Inspect:

``` text
vms-backend
vms-dashboard
vms-screen
vms-scanner
vms-contracts
scripts
.venv
CLAUDE.md
package.json files
requirements files
environment files
```

Determine:

-   actual framework versions,
-   package managers,
-   commands,
-   ports,
-   API URLs,
-   WebSocket URLs,
-   build commands,
-   existing scripts.

Do not implement until this understanding is complete.

------------------------------------------------------------------------

## Phase 2 --- PySide6 Skeleton

Create:

``` text
vms-desktop/
```

Set up:

-   PySide6 dependency.
-   Main window.
-   Application entry point.
-   Basic layout.
-   Service cards.
-   Network card.
-   Log viewer.

At this stage, service execution can be stubbed if necessary.

------------------------------------------------------------------------

## Phase 3 --- Network Layer

Implement:

-   LAN IP detection.
-   URL generation.
-   Network display.
-   Refresh handling.

Verify the detected address against the actual machine.

------------------------------------------------------------------------

## Phase 4 --- Service Process Manager

Implement QProcess-based process management.

Test Backend first.

Required command:

``` bash
uvicorn config.asgi:application --host 0.0.0.0 --port 8000
```

Verify:

-   process starts,
-   stdout appears,
-   stderr appears,
-   process status changes,
-   stop works.

------------------------------------------------------------------------

## Phase 5 --- Preflight

Implement checks for:

-   directories,
-   Python,
-   Uvicorn,
-   Node.js,
-   npm,
-   ports,
-   required configuration.

Show results before Run All.

------------------------------------------------------------------------

## Phase 6 --- Backend Readiness

Implement asynchronous readiness detection.

Prefer an existing health endpoint.

If needed, implement a minimal backend health endpoint after confirming
that it does not conflict with the existing API.

------------------------------------------------------------------------

## Phase 7 --- Dashboard

Integrate Dashboard startup.

Verify:

``` text
LAN host
Port 3000
```

Verify that Dashboard actually communicates with:

``` text
http://<LAN_IP>:8000
```

and WebSocket connections use:

``` text
ws://<LAN_IP>:8000
```

where appropriate.

------------------------------------------------------------------------

## Phase 8 --- Screen

Integrate Lobby Screen startup.

Verify:

``` text
LAN host
Port 3001
```

Verify REST/WebSocket communication with backend.

------------------------------------------------------------------------

## Phase 9 --- Scanner

Integrate Expo startup as an optional service.

Verify the existing Expo LAN configuration.

Test:

``` text
Mobile Device
      |
      v
LAN
      |
      v
VMS Backend :8000
```

Do not assume the Expo port.

------------------------------------------------------------------------

## Phase 10 --- Run All

Implement the full startup sequence:

``` text
Preflight
  ↓
LAN detection
  ↓
Backend
  ↓
Backend ready
  ↓
Dashboard + Screen
  ↓
Dashboard ready
  ↓
Screen ready
  ↓
Optional Scanner
  ↓
Open Dashboard
  ↓
Open Screen
```

------------------------------------------------------------------------

## Phase 11 --- Stop All

Implement graceful shutdown:

``` text
Scanner
Screen
Dashboard
Backend
```

Use termination first and kill only as a controlled fallback.

Do not terminate unrelated processes.

------------------------------------------------------------------------

## Phase 12 --- Production Mode

If supported by the existing project:

``` text
Dashboard:
npm run build
npm start

Screen:
npm run build
npm start
```

Only launch the browser after successful build and readiness.

Never report success when a build failed.

------------------------------------------------------------------------

## Phase 13 --- UI Polish

Improve:

-   spacing,
-   typography,
-   service cards,
-   status indicators,
-   terminal viewer,
-   buttons,
-   disabled states,
-   error messages,
-   responsive layout,
-   application icon.

Keep the UI professional and appropriate for a VMS operations/control
tool.

------------------------------------------------------------------------

# 30. Verification Checklist

Before declaring the implementation complete, verify all of the
following.

## Repository

``` text
[ ] Existing services were inspected first.
[ ] Existing commands were verified.
[ ] Existing environment variables were verified.
[ ] Existing API/WebSocket architecture was preserved.
```

## Backend

``` text
[ ] Project virtual environment is verified before startup.
[ ] Backend runs using the repository `.venv`.
[ ] Starts with the required Uvicorn command.
[ ] Uses port 8000.
[ ] Listens on 0.0.0.0.
[ ] REST API works.
[ ] WebSocket works.
[ ] Logs appear in PySide6.
[ ] Stop works.
[ ] Readiness check works.
```

## Dashboard

``` text
[ ] Starts successfully.
[ ] Uses port 3000.
[ ] LAN access works.
[ ] Backend API connection works.
[ ] WebSocket connection works where applicable.
[ ] Browser opens only after ready.
[ ] Stop works.
```

## Screen

``` text
[ ] Starts successfully.
[ ] Uses port 3001.
[ ] LAN access works.
[ ] Backend connection works.
[ ] WebSocket visitor update works.
[ ] Browser opens only after ready.
[ ] Stop works.
```

## Scanner

``` text
[ ] Starts when enabled.
[ ] Expo LAN behavior works.
[ ] Mobile device can connect.
[ ] QR scan reaches backend.
[ ] Scanner can be disabled.
```

## Desktop App

``` text
[ ] LAN IP detection works.
[ ] `.venv` detection/validation works.
[ ] Backend virtual-environment startup works.
[ ] Preflight checks work.
[ ] Run All works.
[ ] Stop All works.
[ ] Individual Start works.
[ ] Individual Stop works.
[ ] Logs work.
[ ] Service states update correctly.
[ ] Errors are understandable.
[ ] GUI never freezes during startup.
[ ] Browser opens only after readiness.
```

## Windows Executable

```text
[ ] PyInstaller build succeeds.
[ ] Packaged `.exe` launches by double-click.
[ ] No manual CMD/PowerShell launch is required.
[ ] GUI starts without an unwanted console window.
[ ] Packaged app resolves paths correctly.
[ ] Packaged app can find `.venv`.
[ ] Packaged app can find all VMS service directories.
[ ] Packaged app starts/stops all required services.
[ ] Packaged app displays child-process logs.
[ ] Packaged app opens browsers after readiness.
[ ] Packaged app works over LAN.
[ ] Packaged app does not leave unwanted child processes after exit.
```

## LAN

``` text
[ ] PC can access backend through LAN IP.
[ ] Mobile can access backend through LAN IP.
[ ] Dashboard can reach backend.
[ ] Screen can reach backend.
[ ] Scanner can reach backend.
[ ] WebSocket works over LAN.
```

------------------------------------------------------------------------

# 31. Final Acceptance Scenario

The implementation is considered successful when a user can:

1.  Open the VMS Desktop Control Center.
2.  See the current LAN IP.
3.  Click:

``` text
RUN ALL
```

4.  See preflight checks.
5.  See Backend start on:

``` text
0.0.0.0:8000
```

6.  See Backend become `READY`.
7.  See Dashboard start on:

``` text
0.0.0.0:3000
```

8.  See Lobby Screen start on:

``` text
0.0.0.0:3001
```

9.  Optionally see Scanner start through Expo.
10. See live terminal output from every service.
11. See the Dashboard browser open automatically only after it is ready.
12. See the Lobby Screen browser open automatically only after it is
    ready.
13. Use the physical scanner on the LAN.
14. Scan a visitor QR code.
15. See the backend receive the scan.
16. See the Lobby Screen update through the existing WebSocket flow.
17. Stop individual services when required.
18. Click:

``` text
STOP ALL
```

19. See all managed processes stop cleanly.
20. Close the control center and verify it does not leave unwanted
    managed child processes running.
21. Double-click the packaged Windows `.exe`.
22. Confirm the GUI opens without manually starting CMD/PowerShell.
23. Run the complete VMS workflow from the packaged `.exe`.

------------------------------------------------------------------------

# 32. Windows `.exe` Packaging — Mandatory Final Deliverable

After all VMS Desktop Control Center functionality is implemented and
verified, build the PySide6 desktop application into a Windows executable.

The final user experience must be:

```text
Double-click VMS Control Center.exe
              |
              v
       Desktop GUI opens
              |
              v
        Click RUN ALL
              |
              v
       VMS services start
```

The user must **not** need to open CMD, PowerShell, or Windows Terminal
manually to start the desktop control center.

## 32.1 Packaging Technology

Use **PyInstaller** unless repository constraints discovered during the
learning phase require another appropriate Windows packaging approach.

Prefer a maintainable packaging configuration, potentially a `.spec`
file, rather than relying only on a long one-off command.

The package must include the PySide6 desktop application and required
desktop assets.

Do not incorrectly bundle the entire VMS source tree into the executable
unless there is a demonstrated need.

The VMS services are separate applications and may continue to live in
their existing repository directories.

## 32.2 External Runtime Strategy

The coding agent must explicitly determine and document the runtime
strategy before packaging.

A practical deployment layout may be:

```text
VMS/
├── VMS Control Center.exe
├── .venv/
├── vms-backend/
├── vms-dashboard/
├── vms-screen/
└── vms-scanner/
```

If this architecture is used, the executable must resolve paths relative
to the VMS installation/repository location instead of using
developer-specific absolute paths.

Do not assume PyInstaller automatically packages:

- Python backend dependencies into the backend process,
- Node.js,
- npm,
- Next.js projects,
- Expo,
- Android tooling.

These are separate runtime concerns.

The final implementation must verify the required runtime dependencies on
the target Windows machine.

## 32.3 No Manual Terminal Requirement

When the `.exe` is launched:

- The PySide6 GUI must appear directly.
- No manual terminal command should be required to launch the GUI.
- Use a GUI/windowed PyInstaller build.
- Child service console windows should be hidden when appropriate, while
  their stdout/stderr remains visible inside the application's terminal
  log viewer.
- Do not hide service errors from the user.

The implementation must test the actual packaged `.exe`, not only the
Python source execution.

## 32.4 PyInstaller Build Strategy

Evaluate `onedir` first because the VMS Desktop Control Center starts
external services and needs predictable access to project directories and
runtime files.

A possible build command is conceptually:

```bash
pyinstaller --noconfirm --clean --windowed --name "VMS Control Center" ...
```

The exact command and `.spec` configuration must be based on the actual
desktop application's imports and assets after implementation.

If `onefile` is later chosen, verify carefully that it does not create
path, startup, asset, child-process, or runtime-discovery problems.

## 32.5 Application Icon

Use:

```text
vms-desktop/assets/vms.ico
```

if a suitable icon exists.

The packaged application should use the icon in executable metadata and
the desktop application window/taskbar where supported.

## 32.6 Packaging Verification

After building the `.exe`, test it independently from the Python source.

Required test:

```text
[ ] Close all VMS terminals/processes.
[ ] Double-click the `.exe`.
[ ] Desktop GUI opens.
[ ] No manual CMD/PowerShell command is required.
[ ] LAN IP is detected.
[ ] Preflight runs.
[ ] `.venv` is detected.
[ ] Backend starts using the project virtual environment.
[ ] Backend uses port 8000.
[ ] Dashboard starts.
[ ] Screen starts.
[ ] Scanner starts when enabled.
[ ] Logs appear in the GUI.
[ ] Browser opens only after readiness.
[ ] REST communication works.
[ ] WebSocket communication works.
[ ] LAN/mobile communication works.
[ ] Individual Stop works.
[ ] STOP ALL works.
[ ] Closing the desktop app does not leave unwanted VMS child
    processes running.
```

## 32.7 Clean-Machine Test

If possible, perform a clean Windows test or a test on another Windows
machine with the documented prerequisites.

Verify exactly which dependencies must be installed externally.

Do not claim the application is "standalone" if Node.js, npm, the VMS
source directories, `.venv`, or other runtimes are still required.

Document the actual deployment requirements.

## 32.8 Final Build Output

The final build should have a clear output location, for example:

```text
dist/
└── VMS Control Center/
    └── VMS Control Center.exe
```

The exact layout may differ depending on the selected PyInstaller mode.

The final implementation must identify the exact executable path and
verify that it launches successfully by double-clicking it.

---

# 33. Expert Engineering Principle

The final system should follow this principle:

``` text
Existing VMS Applications
        +
PySide6 Orchestration Layer
        =
VMS Desktop Control Center
```

The PySide6 application is a **launcher, supervisor,
network/configuration helper, readiness monitor, and log viewer**.

It is not the backend and should not duplicate backend functionality.

The implementation must prioritize:

-   correctness,
-   LAN reliability,
-   process isolation,
-   asynchronous GUI behavior,
-   observability,
-   maintainability,
-   safe process management,
-   compatibility with the existing VMS,
-   and successful verification before claiming completion.

**Most important: understand the existing repository first, then
implement the smallest robust change that satisfies this plan.**
