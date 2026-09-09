"""One card per service. Presentation only — it owns no process.

The card knows how to *show* a state and how to *emit* an intent. It never
starts anything itself: the window wires its signals to the registry. That
split is what lets the same card serve the backend, two Next apps and an
optional Expo service without growing a branch per service.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
)

from services import State
from widgets.theme import (
    CARD_QSS,
    GHOST_BUTTON_QSS,
    PRIMARY_BUTTON_QSS,
    STATE_COLOURS,
    muted,
    subtle,
    title,
)


class ServiceCard(QFrame):
    """Name, technology, port, state, and the three things you can do."""

    start_requested = Signal(str)
    stop_requested = Signal(str)
    open_requested = Signal(str)
    enabled_changed = Signal(str, bool)

    def __init__(
        self,
        key: str,
        name: str,
        technology: str,
        port: int | None,
        *,
        can_open: bool,
        optional: bool,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.key = key
        self._state = State.STOPPED

        self.setObjectName("serviceCard")
        self.setStyleSheet(CARD_QSS)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Fixed)

        layout = QVBoxLayout(self)
        # Trimmed for a 1280x720 laptop: four cards, a network panel and a
        # usable log do not all fit at generous padding, and the log is the
        # one of the three that must not lose.
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(4)

        header = QHBoxLayout()
        header.setSpacing(8)
        header.addWidget(title(name))
        header.addStretch(1)

        # The optional service says so on its own card rather than in a
        # settings dialog: whether the scanner runs is a decision made at the
        # moment of pressing Run All, not once at install time.
        self._enable: QCheckBox | None = None
        if optional:
            self._enable = QCheckBox("Include in Run All")
            self._enable.setChecked(False)
            self._enable.toggled.connect(
                lambda on: self.enabled_changed.emit(self.key, on)
            )
            header.addWidget(self._enable)
        layout.addLayout(header)

        where = f"Port {port}" if port is not None else "Expo — port assigned at runtime"
        layout.addWidget(subtle(f"{technology}  ·  {where}"))

        layout.addSpacing(6)

        self._status = QLabel()
        self._status.setTextFormat(Qt.TextFormat.RichText)
        layout.addWidget(self._status)

        layout.addSpacing(8)

        buttons = QHBoxLayout()
        buttons.setSpacing(8)

        self._start = QPushButton("Start")
        self._start.setStyleSheet(PRIMARY_BUTTON_QSS)
        self._start.clicked.connect(lambda: self.start_requested.emit(self.key))
        buttons.addWidget(self._start)

        self._stop = QPushButton("Stop")
        self._stop.setStyleSheet(GHOST_BUTTON_QSS)
        self._stop.clicked.connect(lambda: self.stop_requested.emit(self.key))
        buttons.addWidget(self._stop)

        self._open: QPushButton | None = None
        if can_open:
            self._open = QPushButton("Open")
            self._open.setStyleSheet(GHOST_BUTTON_QSS)
            self._open.clicked.connect(lambda: self.open_requested.emit(self.key))
            buttons.addWidget(self._open)

        buttons.addStretch(1)
        layout.addLayout(buttons)

        self.set_state(State.STOPPED)

    @property
    def include_in_run_all(self) -> bool:
        """Non-optional services are always included."""
        return True if self._enable is None else self._enable.isChecked()

    def set_state(self, state: State, note: str = "") -> None:
        self._state = state
        colour = STATE_COLOURS[state]

        # The word carries the meaning and the dot only reinforces it. A status
        # shown as colour alone fails anyone who cannot separate amber from
        # green -- the same rule the scanner's verdicts follow.
        text = f'<span style="color:{colour}; font-size:15px;">●</span>&nbsp; '
        text += f'<span style="color:{colour}; font-weight:600;">{state.value}</span>'
        if note:
            text += f'&nbsp; <span style="color:#8b96a5;">{note}</span>'
        self._status.setText(text)

        active = state in (State.STARTING, State.RUNNING, State.READY, State.STOPPING)
        self._start.setEnabled(not active)
        self._stop.setEnabled(active and state is not State.STOPPING)
        if self._open is not None:
            # Only once it can actually answer. Opening a browser at a service
            # that has merely started is how a user meets a connection error
            # and concludes the app is broken.
            self._open.setEnabled(state is State.READY)
