"""Readiness, and the Run All sequence.

TWO JOBS, BOTH ASYNCHRONOUS.

`ReadinessProbe` answers "can this service actually serve a request yet?" by
asking it over the network, on a timer, until it says yes or the clock runs
out. `Orchestrator` chains those answers into a start order.

NOTHING HERE SLEEPS. `time.sleep()` on the GUI thread is the single easiest way
to make a launcher look broken: the window stops repainting, the title bar says
"Not Responding", and the user force-quits it in the middle of starting a
conference. Every wait in this file is a `QTimer` or a Qt network callback.
"""

from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import QObject, QTimer, QUrl, Signal
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkReply, QNetworkRequest

from config import HEALTH_PATH, READY_TIMEOUT_MS, ServiceSpec
from services import ServiceRegistry, State

#: How often to re-ask. Fast enough that a ready service is noticed promptly,
#: slow enough that a slow Next build is not hammered while it compiles.
POLL_MS = 700


@dataclass(frozen=True)
class Probe:
    key: str
    url: str
    timeout_ms: int


def probe_for(spec: ServiceSpec, lan_ip: str) -> Probe | None:
    """What to request to decide a service is up.

    THE BACKEND IS ASKED FOR ITS HEALTH ENDPOINT, not its root. `/` on a DRF
    project answers 404, which is a perfectly good sign the server is alive but
    indistinguishable from a server that is alive and misconfigured.
    `/api/v1/health` already exists, takes no auth, and reports the LAN address
    the backend believes it bound — so a 200 here means "up" and "reachable at
    this address" in one answer.

    The two Next apps are asked for their root. Next answers 200 there once it
    has compiled, and during a cold `next dev` compile it holds the connection
    open rather than refusing it — which is exactly the "starting, not ready"
    state worth waiting through.

    The scanner has no HTTP surface worth probing. Expo's dev server port is
    assigned dynamically and CLAUDE.md is explicit that it must not be assumed,
    so the scanner is treated as ready once its process is running and left to
    report itself through its own log.
    """
    if spec.key == "backend":
        return Probe(spec.key, f"http://{lan_ip}:{spec.port}{HEALTH_PATH}", READY_TIMEOUT_MS["backend"])
    if spec.key in ("dashboard", "screen"):
        return Probe(spec.key, f"http://{lan_ip}:{spec.port}/", READY_TIMEOUT_MS[spec.key])
    return None


class ReadinessProbe(QObject):
    """Polls one URL until it answers, or until the deadline passes."""

    ready = Signal(str)
    timed_out = Signal(str)

    def __init__(self, probe: Probe, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self._probe = probe
        self._elapsed = 0
        self._inflight: QNetworkReply | None = None
        self._finished = False

        self._net = QNetworkAccessManager(self)
        self._timer = QTimer(self)
        self._timer.setInterval(POLL_MS)
        self._timer.timeout.connect(self._tick)

    def start(self) -> None:
        self._elapsed = 0
        self._finished = False
        self._timer.start()
        self._tick()

    def stop(self) -> None:
        self._finished = True
        self._timer.stop()
        if self._inflight is not None:
            self._inflight.abort()
            self._inflight = None

    def _tick(self) -> None:
        if self._finished:
            return

        self._elapsed += POLL_MS
        if self._elapsed > self._probe.timeout_ms:
            self.stop()
            self.timed_out.emit(self._probe.key)
            return

        # One request in flight at a time. A service that is compiling holds
        # the connection, and queuing a new request every tick would pile up
        # sockets against a server already busy.
        if self._inflight is not None:
            return

        request = QNetworkRequest(QUrl(self._probe.url))
        request.setTransferTimeout(POLL_MS * 2)
        reply = self._net.get(request)
        self._inflight = reply
        reply.finished.connect(lambda: self._on_reply(reply))

    def _on_reply(self, reply: QNetworkReply) -> None:
        self._inflight = None
        status = reply.attribute(QNetworkRequest.Attribute.HttpStatusCodeAttribute)
        reply.deleteLater()

        if self._finished:
            return

        # Any HTTP answer means something is listening and serving. A 200 is
        # the happy case; a 3xx or 4xx still proves the server is up, which is
        # the question being asked -- the dashboard root redirects to /login
        # when signed out, and that is a ready dashboard.
        if isinstance(status, int) and status > 0:
            self.stop()
            self.ready.emit(self._probe.key)


class Orchestrator(QObject):
    """Run All, as a chain of readiness rather than a chain of sleeps."""

    log = Signal(str)
    #: Emitted when a service is ready and worth opening in a browser.
    open_browser = Signal(str, str)  # key, url
    finished = Signal(bool)  # everything asked for came up

    def __init__(
        self,
        registry: ServiceRegistry,
        specs: dict[str, ServiceSpec],
        parent: QObject | None = None,
    ) -> None:
        super().__init__(parent)
        self._registry = registry
        self._specs = specs
        self._probes: dict[str, ReadinessProbe] = {}

        self._lan_ip = "127.0.0.1"
        self._include_scanner = False
        self._pending: set[str] = set()
        self._failed = False
        self._running = False

    def set_specs(self, specs: dict[str, ServiceSpec]) -> None:
        """Replace the specs after a mode change.

        The registry keeps its `ServiceProcess` objects -- their signals are
        already wired to the cards -- so only the commands move. Guarded by the
        window, which refuses a mode change while anything is running.
        """
        self._specs = specs

    @property
    def running(self) -> bool:
        return self._running

    def start_all(self, lan_ip: str, *, include_scanner: bool) -> None:
        self._lan_ip = lan_ip
        self._include_scanner = include_scanner
        self._failed = False
        self._running = True
        self._pending = set()

        self.log.emit(f"LAN address: {lan_ip}")
        self._start_one("backend")

    def cancel(self) -> None:
        for probe in self._probes.values():
            probe.stop()
        self._probes.clear()
        self._pending.clear()
        self._running = False

    # ------------------------------------------------------------ sequencing --

    def _start_one(self, key: str) -> None:
        spec = self._specs[key]
        service = self._registry[key]

        if service.state is State.READY:
            self.log.emit(f"{spec.name} is already running.")
            self._on_ready(key)
            return

        from config import service_environment

        self.log.emit(f"Starting {spec.name}...")
        self._pending.add(key)
        service.start(service_environment(key, self._lan_ip))

        probe = probe_for(spec, self._lan_ip)
        if probe is None:
            # Nothing to poll -- the scanner. Its process starting is the most
            # this layer can honestly claim, and it says so.
            self.log.emit(f"{spec.name} started. Watch its log for the QR code.")
            self._on_ready(key)
            return

        readiness = ReadinessProbe(probe, self)
        readiness.ready.connect(self._on_ready)
        readiness.timed_out.connect(self._on_timeout)
        self._probes[key] = readiness
        readiness.start()

    def _on_ready(self, key: str) -> None:
        self._pending.discard(key)
        spec = self._specs[key]

        if key in self._probes:
            self._registry[key].mark_ready()
            self.log.emit(f"{spec.name} is ready.")
            self._probes.pop(key).deleteLater()

        if key == "backend":
            # Both Next apps together: they are independent of each other and
            # each spends most of its startup compiling, so serialising them
            # doubles the wait for no benefit.
            self._start_one("dashboard")
            self._start_one("screen")
            return

        if key in ("dashboard", "screen"):
            if spec.opens_in_browser:
                self.open_browser.emit(key, f"http://{self._lan_ip}:{spec.port}")
            if not self._pending:
                self._after_web()
            return

        if key == "scanner":
            self._done()

    def _after_web(self) -> None:
        if self._include_scanner:
            self._start_one("scanner")
        else:
            self.log.emit("Scanner is disabled; skipping it.")
            self._done()

    def _on_timeout(self, key: str) -> None:
        spec = self._specs[key]
        self._failed = True
        self._pending.discard(key)
        if key in self._probes:
            self._probes.pop(key).deleteLater()

        seconds = READY_TIMEOUT_MS[key] // 1000
        self.log.emit(
            f"{spec.name} did not become ready within {seconds}s. "
            f"Its process may still be starting -- see the {spec.name} log."
        )

        # Carry on with the rest. A dashboard that is slow to compile should
        # not stop the lobby screen from coming up.
        if key == "backend":
            self._start_one("dashboard")
            self._start_one("screen")
        elif not self._pending:
            self._after_web()

    def _done(self) -> None:
        self._running = False
        if self._failed:
            self.log.emit("Some services did not report ready. See the logs above.")
        else:
            self.log.emit("All services are running.")
        self.finished.emit(not self._failed)
