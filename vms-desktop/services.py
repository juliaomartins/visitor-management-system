"""One lifecycle model for all four services.

`QProcess`, not `subprocess`. The difference that matters is not style: a
blocking `subprocess.run` or a `.communicate()` on the GUI thread freezes the
window for as long as the child runs, and these children run for the length of
a conference. `QProcess` is event-driven — output arrives as signals on the
same thread that paints, and nothing waits.

STARTED IS NOT READY, and this module deliberately refuses to conflate them. It
reports `RUNNING` when the OS has a process, and nothing more. Whether the
service can actually answer a request is `launcher.ReadinessProbe`'s question,
because it is answered over the network rather than by the process table. A
uvicorn that starts and then dies on a bad database password is `RUNNING` for
about two seconds, and calling that ready is how a launcher opens a browser
onto a connection error.
"""

from __future__ import annotations

import os
from enum import Enum

from PySide6.QtCore import (
    QObject,
    QProcess,
    QProcessEnvironment,
    QTimer,
    Signal,
)

from config import ServiceSpec
from network import port_in_use
from processes import kill_tree, kill_tree_command, port_owners, summarize_output


class State(str, Enum):
    """Explicit states, because "is the process alive" is not enough.

    STOPPED   nothing running
    STARTING  asked to start; the OS has not confirmed yet
    RUNNING   the process exists and has not exited
    READY     the service answered its readiness probe
    STOPPING  asked to stop; waiting for it to go
    ERROR     failed to start, or exited when it should not have
    """

    STOPPED = "STOPPED"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    READY = "READY"
    STOPPING = "STOPPING"
    ERROR = "ERROR"


#: How long to keep checking that a stopped service actually let its port go.
#: Next dev servers hold theirs for a moment after the process is gone; uvicorn
#: releases almost at once. Generous, because the cost of waiting is a card that
#: says STOPPING for a second longer, and the cost of giving up early is a card
#: that says STOPPED above a port nobody can bind.
PORT_RELEASE_TIMEOUT_MS = 8_000

#: Poll interval while waiting for that. `network.port_in_use` is a connect
#: test with a 0.35s timeout, so this is not a tight loop.
PORT_POLL_MS = 250

#: How long after issuing the tree kill to check that the child actually went.
#: `taskkill /F` is `TerminateProcess`, which is immediate when it is allowed at
#: all, so this is not a grace period -- it is the moment to notice a REFUSAL.
#: "Access is denied" against a service started by another user leaves the
#: child alive, and without this the card sits at STOPPING for the rest of the
#: event with nothing on screen to say why.
KILL_REPORT_MS = 2_000


def _own_process_group() -> None:
    """Put the child in its own process group. POSIX only.

    `kill_tree_command` signals the NEGATED pid on POSIX, which addresses the
    process group with that id -- and a group with that id only exists if the
    child leads one. QProcess children otherwise inherit the launcher's group,
    so the signal would find no such group, or worse, a real one that belongs
    to something else entirely.

    Runs in the forked child between `fork` and `exec`, so it must not raise:
    an exception here escapes into a half-built process.
    """
    try:
        os.setpgid(0, 0)
    except OSError:
        pass


class ServiceProcess(QObject):
    """A single managed child process.

    Owns exactly one `QProcess` and translates its signals into something the
    UI can use without knowing anything about Qt process internals.
    """

    state_changed = Signal(str, object)  # key, State
    output = Signal(str, str)  # key, text
    #: Emitted when the process ends without being asked to. The launcher turns
    #: this into a visible failure rather than a card that quietly says STOPPED.
    exited_unexpectedly = Signal(str, int)  # key, exit code

    def __init__(self, spec: ServiceSpec, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.spec = spec
        self._state = State.STOPPED
        self._stopping = False

        self._process = QProcess(self)
        # One stream, in the order the child actually wrote it. Keeping stdout
        # and stderr apart re-orders a traceback relative to the log lines
        # around it, which is the moment those lines are most useful.
        self._process.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        self._process.readyReadStandardOutput.connect(self._drain)
        self._process.started.connect(self._on_started)
        self._process.errorOccurred.connect(self._on_error)
        self._process.finished.connect(self._on_finished)

        # POSIX only, and absent from the Windows build of PySide6 entirely --
        # there is no fork there to modify. Windows gets its tree by `/T`.
        if hasattr(self._process, "setChildProcessModifier"):
            self._process.setChildProcessModifier(_own_process_group)

    # ---------------------------------------------------------------- state --

    @property
    def state(self) -> State:
        return self._state

    def _set_state(self, state: State) -> None:
        if state is self._state:
            return
        self._state = state
        self.state_changed.emit(self.spec.key, state)

    def mark_ready(self) -> None:
        """Called by the readiness probe, and only from RUNNING.

        Guarded so a probe that answers late — after the process already died —
        cannot paint a dead service green.
        """
        if self._state is State.RUNNING:
            self._set_state(State.READY)

    @property
    def is_active(self) -> bool:
        return self._state in (State.STARTING, State.RUNNING, State.READY)

    # -------------------------------------------------------------- control --

    def start(self, extra_env: dict[str, str] | None = None) -> None:
        if self.is_active:
            return

        if not self.spec.directory.is_dir():
            self.output.emit(
                self.spec.key,
                f"Working directory does not exist: {self.spec.directory}\n",
            )
            self._set_state(State.ERROR)
            return

        self._stopping = False
        self._process.setWorkingDirectory(str(self.spec.directory))
        self._process.setProcessEnvironment(self._environment(extra_env or {}))

        self._set_state(State.STARTING)
        self.output.emit(
            self.spec.key,
            f"$ {self.spec.program} {' '.join(self.spec.arguments)}\n"
            f"  (in {self.spec.directory})\n",
        )
        self._process.start(self.spec.program, list(self.spec.arguments))

    def stop(self) -> None:
        """Kill the tree we started, then prove the port is actually free.

        THIS USED TO CALL `terminate()` AND WAIT, AND IT DID NEITHER THING IT
        LOOKED LIKE IT DID. Measured against both process shapes this app
        starts:

            terminate() ended it?        NO
            waitForFinished blocked for  6.0s
            port free after kill()?      NO -- held by ['9980']

        So every Stop press froze the window for the full grace period, and
        then left the port occupied anyway. `processes.py` carries the two
        Windows facts behind that; the short version is that a console child
        never receives `WM_CLOSE`, and `npm.cmd` means the process we started
        is `cmd.exe` rather than the Node server holding the port.

        Nothing here blocks. The kill runs as its own child process and the
        port check runs on a timer, because these services are stopped from a
        window somebody is looking at.
        """
        if not self.is_active:
            return

        self._stopping = True
        self._set_state(State.STOPPING)

        pid = int(self._process.processId())
        if pid <= 0:
            # Asked to stop between `start()` and the OS confirming a pid.
            # There is no tree to kill yet; kill() reaches the one process.
            self._process.kill()
            return

        program, arguments = kill_tree_command(pid)
        self.output.emit(self.spec.key, f"$ {program} {' '.join(arguments)}\n")

        killer = QProcess(self)
        killer.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        killer.finished.connect(
            lambda code, _status: self._on_kill_finished(killer, code)
        )
        killer.errorOccurred.connect(lambda error: self._on_kill_error(killer, error))
        killer.start(program, arguments)

        # THE KILL IS NOT THE PROOF. Ask again in a moment whether the child is
        # actually gone, because a refused `taskkill` otherwise ends here in
        # silence: `finished` never fires for a process that did not die.
        QTimer.singleShot(KILL_REPORT_MS, self._report_if_still_running)

    def _on_kill_finished(self, killer: QProcess, code: int) -> None:
        """Say what the tree kill did, and never let a failure pass as success."""
        merged = bytes(killer.readAllStandardOutput()).decode("utf-8", errors="replace")
        killer.deleteLater()

        # Both streams are merged onto one channel above, so this carries
        # `taskkill`'s SUCCESS line and its ERROR line alike.
        message = summarize_output(merged, None)

        if code == 0:
            if message:
                self.output.emit(self.spec.key, f"{message}\n")
            return

        self.output.emit(
            self.spec.key,
            f"The stop command exited with code {code}"
            + (f": {message}" if message else " and said nothing")
            + "\n",
        )

    def _on_kill_error(self, killer: QProcess, error: QProcess.ProcessError) -> None:
        """The killer itself failing to run. Rare, and invisible without this."""
        if error is QProcess.ProcessError.FailedToStart:
            program = killer.program()
            self.output.emit(
                self.spec.key,
                f"Could not run `{program}` to stop this service. "
                "It is still running.\n",
            )
            self._set_state(State.ERROR)

    def _report_if_still_running(self) -> None:
        """The watchdog: after the kill, is the child actually gone?

        Only the process WE started is checked here. Whether the port came free
        is a separate question with a separate answer, and `_await_port_release`
        asks it once this one is satisfied.
        """
        if not self._stopping:
            return
        if self._process.state() is QProcess.ProcessState.NotRunning:
            return

        self.output.emit(
            self.spec.key,
            f"This service is still running {KILL_REPORT_MS // 1000}s after being "
            "asked to stop, so the stop command did not take.\n"
            "The usual cause is that it was started by a different user, or "
            "with privileges this launcher does not have.\n",
        )
        self._set_state(State.ERROR)

    def force_stop(self) -> None:
        """Used on application exit, where there is no time to be polite.

        The one place a blocking call is right: the window is closing, so there
        is no event loop turn left to come back on, and an orphaned Node server
        would outlive the launcher and hold its port against the next run.
        """
        if self._process.state() == QProcess.ProcessState.NotRunning:
            return

        self._stopping = True
        pid = int(self._process.processId())
        if pid > 0:
            result = kill_tree(pid)
            # Nobody is looking at the log by now, but this run's log file and
            # anyone watching a console still get the reason -- and a failure
            # here is exactly the one that leaves a node holding 3000 against
            # the next launch.
            if not result.ok:
                self.output.emit(
                    self.spec.key,
                    f"Tree kill on exit failed (code {result.returncode}): "
                    f"{result.message or 'no output'}\n",
                )
        self._process.kill()
        self._process.waitForFinished(2_000)

    # --------------------------------------------------------------- plumbing --

    def _environment(self, extra: dict[str, str]) -> QProcessEnvironment:
        """The parent environment plus this service's LAN-aware additions.

        Inherited rather than replaced: npm needs PATH, uvicorn needs the
        system variables, and the backend reads its database password from the
        environment `.env` already populated. Only the keys in `extra` are
        touched.
        """
        env = QProcessEnvironment.systemEnvironment()
        for key, value in extra.items():
            env.insert(key, value)
        return env

    def _drain(self) -> None:
        raw = bytes(self._process.readAllStandardOutput())
        if not raw:
            return
        # Children write whatever their console encoding is. Never let a stray
        # byte take the launcher down with a decode error.
        self.output.emit(self.spec.key, raw.decode("utf-8", errors="replace"))

    def _await_port_release(self) -> None:
        """Poll until the port is free, then say STOPPED -- or name who holds it.

        On a timer rather than a wait, because this runs while somebody is
        looking at the window.

        IT DOES NOT KILL WHATEVER STILL HOLDS THE PORT. Nothing here can show
        that process was started by this launcher, and
        `preflight.describe_port_conflict` already refuses the same thing for
        the same reason: freeing a port by force is how somebody discovers, at
        the worst possible moment, that the launcher shot something else.
        """
        port = self.spec.port
        assert port is not None  # the caller checked

        elapsed = 0

        def check() -> None:
            nonlocal elapsed

            if not port_in_use(port):
                timer.stop()
                self.output.emit(self.spec.key, f"Stopped. Port {port} released.\n")
                self._set_state(State.STOPPED)
                return

            elapsed += PORT_POLL_MS
            if elapsed < PORT_RELEASE_TIMEOUT_MS:
                return

            timer.stop()
            owners = port_owners(port)
            held = ", ".join(str(owner) for owner in owners) if owners else "something"
            self.output.emit(
                self.spec.key,
                f"The process was stopped, but port {port} is still held by "
                f"{held}.\n"
                "It was left alone: this launcher only stops what it started.\n",
            )
            self._set_state(State.ERROR)

        timer = QTimer(self)
        timer.setInterval(PORT_POLL_MS)
        timer.timeout.connect(check)
        timer.start()

    def _on_started(self) -> None:
        self._set_state(State.RUNNING)

    def _on_error(self, error: QProcess.ProcessError) -> None:
        if error is QProcess.ProcessError.FailedToStart:
            self.output.emit(
                self.spec.key,
                f"Failed to start: {self.spec.program}\n"
                "The executable was not found, or is not runnable from here.\n",
            )
            self._set_state(State.ERROR)
        elif not self._stopping:
            self.output.emit(self.spec.key, f"Process error: {error.name}\n")

    def _on_finished(self, code: int, status: QProcess.ExitStatus) -> None:
        # DRAIN BEFORE REPORTING. `readyReadStandardOutput` is not guaranteed to
        # fire again for whatever was still in the pipe when the child exited,
        # and for a service that dies during startup those last few lines are
        # the entire reason anyone opens the log. Losing them leaves a card
        # saying ERROR above an empty tab.
        self._drain()

        if self._stopping:
            # OUR PROCESS IS GONE, WHICH IS NOT THE SAME AS THE SERVICE
            # BEING GONE -- conflating those is the whole of this bug. The
            # pid we held for a Next app was `cmd.exe`; the Node server that
            # owns the port is its child. Say STOPPED once the port agrees.
            if self.spec.port is None:
                self.output.emit(self.spec.key, "Stopped.\n")
                self._set_state(State.STOPPED)
            else:
                self._await_port_release()
            return

        # Nobody asked for this. Say so loudly: a service that dies three
        # seconds after starting is the most common real failure, and the
        # reason is almost always in the last few lines above.
        self.output.emit(
            self.spec.key,
            f"Exited unexpectedly with code {code} ({status.name}).\n",
        )
        self._set_state(State.ERROR)
        self.exited_unexpectedly.emit(self.spec.key, code)


class ServiceRegistry(QObject):
    """The four services, addressed by key."""

    state_changed = Signal(str, object)
    output = Signal(str, str)
    exited_unexpectedly = Signal(str, int)

    def __init__(self, specs: list[ServiceSpec], parent: QObject | None = None) -> None:
        super().__init__(parent)
        self._services: dict[str, ServiceProcess] = {}

        for spec in specs:
            service = ServiceProcess(spec, self)
            service.state_changed.connect(self.state_changed)
            service.output.connect(self.output)
            service.exited_unexpectedly.connect(self.exited_unexpectedly)
            self._services[spec.key] = service

    def __getitem__(self, key: str) -> ServiceProcess:
        return self._services[key]

    def __iter__(self):
        return iter(self._services.values())

    @property
    def keys(self) -> list[str]:
        return list(self._services)

    def stop_all(self) -> None:
        """Reverse of the start order: dependents first, backend last."""
        for key in ("scanner", "screen", "dashboard", "backend"):
            if key in self._services:
                self._services[key].stop()

    def force_stop_all(self) -> None:
        for service in self._services.values():
            service.force_stop()
