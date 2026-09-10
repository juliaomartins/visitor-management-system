"""Stopping a child that is not the process we started.

WHY THIS MODULE EXISTS
----------------------
`QProcess.terminate()` does not stop any of these services on Windows, and
`kill()` only half does. Both were measured rather than assumed:

    terminate() ended it?        NO      (both process shapes)
    waitForFinished blocked for  6.0s    (the full grace period, every time)
    kill(), port free afterwards NO -- held by ['9980']

The reason is two separate Windows facts stacked on top of each other.

1. `terminate()` posts `WM_CLOSE` to the child's top-level windows. A console
   program has none, and none of these four services runs a Qt event loop, so
   the message lands nowhere and the child never hears the request. Qt's own
   documentation says as much: console applications on Windows "can only be
   terminated by calling kill()".

2. `kill()` is `TerminateProcess`, and it terminates ONE process -- the one we
   started. But `npm.cmd` is a batch file, so the process we started is
   `cmd.exe`; the Node server holding port 3000 is its grandchild. Killing the
   parent orphans the grandchild, which carries on listening. That is the
   whole of "I pressed Stop and the port is still busy".

CTRL+C IS NOT AVAILABLE TO US, and it is worth saying why, because it is the
obvious thing to reach for -- it works when you press it in cmd. It works there
because your terminal and the server share a console, and Ctrl+C is delivered
to every process attached to that console. A GUI process has no console to
share. `GenerateConsoleCtrlEvent` can only signal a process group within the
CALLER's console, so a Qt application cannot use it to reach a child it spawned
without one. Handing each child its own console (`CREATE_NEW_CONSOLE`) would
flash a terminal window per service on screen and still leave us unable to
signal into it. It is a dead end, not an oversight.

So: kill the whole tree, by the pid of the process we started. Ownership is
never in doubt -- `/T` walks down from our own child, so nothing outside what
this launcher spawned can be caught by it.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass

WINDOWS = os.name == "nt"

#: Hide the console window `taskkill` and `netstat` would otherwise flash up.
#: Windows-only flag, so it is resolved lazily rather than at import.
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def kill_tree_command(pid: int) -> tuple[str, list[str]]:
    """The command that ends `pid` and everything below it.

    Returned rather than run, so the caller can drive it through `QProcess`
    and keep the GUI thread free -- see rule 2 in CLAUDE.md.

    `/T` is the flag that matters and the one usually left off: without it this
    is just `kill()` with extra steps, and the Node process keeps the port.
    """
    if WINDOWS:
        return ("taskkill", ["/PID", str(pid), "/T", "/F"])
    # POSIX: negating the pid signals the whole process group.
    return ("kill", ["-KILL", f"-{pid}"])


def kill_tree_now(pid: int, timeout: float = 3.0) -> bool:
    """Blocking tree kill, for application exit only.

    Everywhere else this belongs on `QProcess`. On the way out there is no
    window left to keep responsive and no next event loop turn to wait for, so
    blocking briefly is the honest thing to do.
    """
    program, arguments = kill_tree_command(pid)
    try:
        completed = subprocess.run(
            [program, *arguments],
            capture_output=True,
            timeout=timeout,
            creationflags=_NO_WINDOW if WINDOWS else 0,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return completed.returncode == 0


@dataclass(frozen=True)
class PortOwner:
    """Who is holding a port, for a log line a person can act on."""

    pid: str
    image: str

    def __str__(self) -> str:
        return f"{self.image} (pid {self.pid})"


def port_owners(port: int) -> list[PortOwner]:
    """Which processes are LISTENING on `port`, named.

    FOR REPORTING, NOT FOR KILLING. A pid found this way has not been shown to
    belong to us -- it may be a stale orphan, or somebody's own dev server, or
    an unrelated program that happens to have taken the port. `preflight.py`
    already refuses to free a busy port for exactly this reason, and killing by
    port here would contradict it.

    PARSED PRECISELY, because the obvious `findstr 8000` is a trap: it also
    matches port 18000, any foreign address containing those digits, and pid
    8000 itself. Matching is on the local address's final `:<port>` and on the
    LISTENING state, and the pid is taken from the last column.

    Windows lists IPv4 and IPv6 listeners on separate lines. They are normally
    the same process, so results are de-duplicated by pid; when they genuinely
    differ both are returned rather than one being picked.
    """
    if not WINDOWS:
        return []

    try:
        netstat = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            timeout=5.0,
            creationflags=_NO_WINDOW,
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return []

    pids: list[str] = []
    for line in netstat.splitlines():
        parts = line.split()
        if len(parts) < 5 or parts[0].upper() != "TCP":
            continue
        local, state, pid = parts[1], parts[3], parts[4]
        if local.rsplit(":", 1)[-1] != str(port) or state.upper() != "LISTENING":
            continue
        if pid not in pids:
            pids.append(pid)

    return [PortOwner(pid=pid, image=_image_name(pid)) for pid in pids]


def _image_name(pid: str) -> str:
    """The executable behind a pid. "a process" when it cannot be resolved."""
    try:
        listing = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
            capture_output=True,
            text=True,
            timeout=5.0,
            creationflags=_NO_WINDOW,
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return "a process"

    first = listing.strip().splitlines()[0] if listing.strip() else ""
    if first.startswith('"'):
        return first.split('","')[0].strip('"')
    return "a process"
