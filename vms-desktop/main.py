"""VMS Desktop Control Center — application entry point and main window.

An ORCHESTRATION LAYER, and nothing more. It starts the four services that
already exist, watches them, and shows what they say. It holds no visitor data,
speaks no part of the VMS API beyond one unauthenticated health probe, and
would be deletable tomorrow without changing how VMS works.

Everything the window does with a service goes through `ServiceRegistry`;
everything it knows about paths and commands comes from `config`. The window
itself only wires signals and paints.
"""

from __future__ import annotations

import sys
import webbrowser
from pathlib import Path

# Running from source, `vms-desktop/` is the import root. PyInstaller sets this
# up itself, so it is only needed for the developer path.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from PySide6.QtCore import Qt, QTimer  # noqa: E402
from PySide6.QtGui import QGuiApplication, QIcon  # noqa: E402
from PySide6.QtWidgets import (  # noqa: E402
    QApplication,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

import preflight  # noqa: E402
from config import Mode, service_environment, service_specs  # noqa: E402
from launcher import Orchestrator  # noqa: E402
from network import detect_lan_ip  # noqa: E402
from services import ServiceRegistry, State  # noqa: E402
from widgets.log_viewer import LogViewer  # noqa: E402
from widgets.network_card import NetworkCard  # noqa: E402
from widgets.service_card import ServiceCard  # noqa: E402
from widgets.theme import (  # noqa: E402
    DANGER_BUTTON_QSS,
    PRIMARY_BUTTON_QSS,
    STATE_COLOURS,
    TEXT_FAINT,
    WINDOW_QSS,
)

APP_NAME = "VMS Control Center"


class ControlCenter(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.setStyleSheet(WINDOW_QSS)

        icon = Path(__file__).resolve().parent / "assets" / "vms.ico"
        if icon.is_file():
            self.setWindowIcon(QIcon(str(icon)))

        self._mode = Mode.DEV
        self._lan_ip = detect_lan_ip()

        self._specs = {spec.key: spec for spec in service_specs(self._mode)}
        self._registry = ServiceRegistry(list(self._specs.values()), self)
        self._orchestrator = Orchestrator(self._registry, self._specs, self)

        self._build_ui()
        self._connect()

        # Apply geometry only after the card grid exists. Windows may deliver a
        # resize event synchronously from resize()/setMinimumSize(), and the
        # handler needs the layout objects created by _build_ui().
        available = QGuiApplication.primaryScreen().availableGeometry()
        self.resize(
            min(1180, int(available.width() * 0.94)),
            min(880, int(available.height() * 0.94)),
        )
        self.setMinimumSize(760, 520)

        self._network.set_address(self._lan_ip)
        self._logs.app(f"{APP_NAME} ready. LAN address {self._lan_ip}.")
        self._logs.app(
            "Run All checks the environment first, then starts the backend and "
            "waits for it before starting anything else."
        )
        self._logs.app(
            "LAN access needs Windows Firewall to permit ports 8000, 3000 and "
            "3001. No firewall rule is changed automatically."
        )

    # ------------------------------------------------------------------ ui --

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)

        root = QVBoxLayout(central)
        root.setContentsMargins(16, 12, 16, 12)
        root.setSpacing(10)

        root.addLayout(self._build_header())
        self._network = NetworkCard()
        root.addWidget(self._network)

        self._grid = QGridLayout()
        self._grid.setHorizontalSpacing(12)
        self._grid.setVerticalSpacing(12)
        self._cards: dict[str, ServiceCard] = {}

        for spec in self._specs.values():
            self._cards[spec.key] = ServiceCard(
                spec.key,
                spec.name,
                spec.technology,
                spec.port,
                can_open=spec.opens_in_browser,
                optional=spec.optional,
            )
        self._columns = 0
        self._relayout_cards(4)
        root.addLayout(self._grid)

        self._logs = LogViewer(
            list(self._specs), {k: s.name for k, s in self._specs.items()}
        )
        # A floor, not a preference. Without it the cards and the network card
        # take their natural heights first and the log is squeezed to nothing
        # on a short screen -- and the log is most of the point.
        self._logs.setMinimumHeight(170)
        root.addWidget(self._logs, stretch=1)

    def _relayout_cards(self, columns: int) -> None:
        """Arrange the four cards in 1, 2 or 4 columns.

        NOT COSMETIC. Two rows of cards cost about 155px of height, and on a
        1280x720 laptop -- which is what this was measured on -- that pushes the
        log viewer off the bottom of the screen entirely. The log is most of the
        point of a control centre, so on a wide window the cards go in one row
        and give the height back.
        """
        if columns == self._columns:
            return
        self._columns = columns

        for card in self._cards.values():
            self._grid.removeWidget(card)
        for index, card in enumerate(self._cards.values()):
            self._grid.addWidget(card, index // columns, index % columns)

    def resizeEvent(self, event) -> None:  # noqa: N802  (Qt naming)
        super().resizeEvent(event)
        width = event.size().width()
        self._relayout_cards(4 if width >= 1150 else 2 if width >= 720 else 1)

    def _build_header(self) -> QHBoxLayout:
        header = QHBoxLayout()

        left = QVBoxLayout()
        left.setSpacing(1)
        heading = QLabel("VMS CONTROL CENTER")
        font = heading.font()
        font.setPointSize(17)
        font.setWeight(font.Weight.Bold)
        heading.setFont(font)
        left.addWidget(heading)
        subtitle = QLabel("Visitor Management System")
        subtitle.setStyleSheet(f"color: {TEXT_FAINT};")
        left.addWidget(subtitle)
        header.addLayout(left)

        header.addStretch(1)

        self._overall = QLabel()
        self._overall.setTextFormat(Qt.TextFormat.RichText)
        header.addWidget(self._overall)
        header.addSpacing(14)

        self._run_all = QPushButton("▶  Run All")
        self._run_all.setStyleSheet(PRIMARY_BUTTON_QSS)
        self._run_all.setMinimumHeight(38)
        header.addWidget(self._run_all)

        self._stop_all = QPushButton("■  Stop All")
        self._stop_all.setStyleSheet(DANGER_BUTTON_QSS)
        self._stop_all.setMinimumHeight(38)
        header.addWidget(self._stop_all)

        self._refresh_overall()
        return header

    def _connect(self) -> None:
        self._run_all.clicked.connect(self._on_run_all)
        self._stop_all.clicked.connect(self._on_stop_all)
        self._network.refresh_requested.connect(self._on_refresh_network)

        for card in self._cards.values():
            card.start_requested.connect(self._on_start_one)
            card.stop_requested.connect(self._on_stop_one)
            card.open_requested.connect(self._on_open_one)

        self._registry.state_changed.connect(self._on_state_changed)
        self._registry.output.connect(self._logs.service)
        self._registry.exited_unexpectedly.connect(self._on_unexpected_exit)

        self._orchestrator.log.connect(self._logs.app)
        self._orchestrator.open_browser.connect(self._on_open_browser)
        self._orchestrator.finished.connect(self._on_run_all_finished)

    # -------------------------------------------------------------- actions --

    def _on_refresh_network(self) -> None:
        self._lan_ip = detect_lan_ip()
        self._network.set_address(self._lan_ip)
        self._logs.app(f"Network re-detected: {self._lan_ip}")

    def _on_run_all(self) -> None:
        include_scanner = self._cards["scanner"].include_in_run_all

        report = preflight.run(include_scanner=include_scanner)
        self._logs.app(preflight.format_report(report))

        if not report.ok:
            first = report.failures[0]
            QMessageBox.critical(
                self,
                "Cannot start VMS",
                f"{first.label}\n\n{first.detail}\n\n"
                "Nothing has been started. The Application log lists every "
                "check.",
            )
            return

        self._lan_ip = report.lan_ip
        self._network.set_address(self._lan_ip)
        self._run_all.setEnabled(False)
        self._orchestrator.start_all(self._lan_ip, include_scanner=include_scanner)

    def _on_stop_all(self) -> None:
        self._orchestrator.cancel()
        self._logs.app("Stopping all services...")
        self._registry.stop_all()
        self._run_all.setEnabled(True)

    def _on_start_one(self, key: str) -> None:
        """Starting one service by hand still waits for readiness properly."""
        spec = self._specs[key]
        self._logs.app(f"Starting {spec.name}...")
        self._registry[key].start(service_environment(key, self._lan_ip))

        from launcher import ReadinessProbe, probe_for

        probe = probe_for(spec, self._lan_ip)
        if probe is None:
            return

        readiness = ReadinessProbe(probe, self)
        readiness.ready.connect(self._on_single_ready)
        readiness.timed_out.connect(
            lambda k: self._logs.app(f"{self._specs[k].name} did not report ready.")
        )
        readiness.start()

    def _on_single_ready(self, key: str) -> None:
        self._registry[key].mark_ready()
        self._logs.app(f"{self._specs[key].name} is ready.")

    def _on_stop_one(self, key: str) -> None:
        self._logs.app(f"Stopping {self._specs[key].name}...")
        self._registry[key].stop()

    def _on_open_one(self, key: str) -> None:
        spec = self._specs[key]
        if spec.port is not None:
            self._on_open_browser(key, f"http://{self._lan_ip}:{spec.port}")

    def _on_open_browser(self, key: str, url: str) -> None:
        self._logs.app(f"Opening {self._specs[key].name}: {url}")
        webbrowser.open(url)

    # -------------------------------------------------------------- signals --

    def _on_state_changed(self, key: str, state: State) -> None:
        self._cards[key].set_state(state)
        self._refresh_overall()

    def _on_unexpected_exit(self, key: str, code: int) -> None:
        spec = self._specs[key]
        self._logs.app(
            f"{spec.name} stopped on its own (exit code {code}). "
            f"See the {spec.name} tab for what it printed."
        )
        self._run_all.setEnabled(True)

    def _on_run_all_finished(self, ok: bool) -> None:
        self._run_all.setEnabled(True)
        if not ok:
            QMessageBox.warning(
                self,
                "Some services are not ready",
                "One or more services did not answer in time.\n\n"
                "They may still be starting. The per-service tabs show what "
                "each one printed.",
            )

    def _refresh_overall(self) -> None:
        """ONLINE / PARTIAL / OFFLINE, from the states rather than a flag."""
        states = [self._registry[key].state for key in self._specs]
        required = [
            self._registry[key].state
            for key, spec in self._specs.items()
            if not spec.optional
        ]

        if all(state is State.READY for state in required):
            word, colour = "ONLINE", STATE_COLOURS[State.READY]
        elif any(state is State.ERROR for state in states):
            word, colour = "PARTIAL", STATE_COLOURS[State.ERROR]
        elif any(
            state in (State.STARTING, State.RUNNING, State.READY, State.STOPPING)
            for state in states
        ):
            word, colour = "PARTIAL", STATE_COLOURS[State.STARTING]
        else:
            word, colour = "OFFLINE", STATE_COLOURS[State.STOPPED]

        self._overall.setText(
            f'<span style="color:{colour}; font-size:15px;">●</span>&nbsp;'
            f'<span style="color:{colour}; font-weight:700; letter-spacing:1px;">{word}</span>'
        )

    # ----------------------------------------------------------------- exit --

    def closeEvent(self, event) -> None:  # noqa: N802  (Qt naming)
        """Never leave orphaned services behind.

        A control centre that exits while uvicorn and two Next servers keep
        running is worse than one that never started them: the ports stay held,
        the next launch fails its preflight, and nothing on screen explains why.
        """
        running = [self._specs[k].name for k in self._specs if self._registry[k].is_active]

        if running:
            answer = QMessageBox.question(
                self,
                "Stop running services?",
                "These are still running and will be stopped:\n\n  "
                + "\n  ".join(running)
                + "\n\nClose the control centre?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Cancel,
            )
            if answer is not QMessageBox.StandardButton.Yes:
                event.ignore()
                return

            self._orchestrator.cancel()
            self._registry.stop_all()
            self._registry.force_stop_all()

        event.accept()


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)

    window = ControlCenter()
    window.show()

    # Give Qt one turn of the event loop before anything heavy, so the window
    # is on screen rather than the app appearing to hang on launch.
    QTimer.singleShot(0, lambda: None)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
