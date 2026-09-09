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

from enum import Enum

from PySide6.QtCore import QObject, QProcess, QProcessEnvironment, Signal

from config import ServiceSpec


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


#: How long a service gets to exit politely before it is killed. Next dev
#: servers take a moment to release their port; uvicorn goes almost at once.
GRACE_MS = 6_000


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
        """Ask politely, then insist.

        `terminate()` is a real request the child can act on — uvicorn closes
        its sockets, Next tears its watcher down. `kill()` is the fallback, and
        only after the grace period, because killing a Next dev server outright
        can leave its port held for a while afterwards.
        """
        if not self.is_active:
            return

        self._stopping = True
        self._set_state(State.STOPPING)
        self._process.terminate()

        if not self._process.waitForFinished(GRACE_MS):
            self.output.emit(
                self.spec.key,
                "Did not exit within the grace period; killing it.\n",
            )
            self._process.kill()
            self._process.waitForFinished(2_000)

    def force_stop(self) -> None:
        """Used on application exit, where there is no time to be polite."""
        if self._process.state() != QProcess.ProcessState.NotRunning:
            self._stopping = True
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
        if self._stopping:
            self.output.emit(self.spec.key, "Stopped.\n")
            self._set_state(State.STOPPED)
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
