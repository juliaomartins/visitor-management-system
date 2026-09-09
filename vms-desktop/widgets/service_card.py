"""One card per service. Presentation only — it owns no process.

The card knows how to *show* a state and how to *emit* an intent. It never
starts anything itself: the window wires its signals to the registry. That
split is what lets the same card serve the backend, two Next apps and an
optional Expo service without growing a branch per service.

IT SURVIVES BEING MADE NARROW, which it did not before. The buttons sat in one
`QHBoxLayout`, so below about 290px Qt had nowhere to put them and elided their
labels to "...." — three identical dots where Start, Stop and Open used to be.
They now reflow onto a second row, and the card refuses to go below a width
where that still reads.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
)

from i18n import t
from services import State
from widgets import theme
from widgets.theme import subtle, title

#: Below this the three buttons cannot share a row at a readable size.
WRAP_BELOW = 320

#: The card stops shrinking here. Narrower than this and the name itself
#: elides, at which point the card is decoration rather than a control.
MIN_WIDTH = 232


class ServiceCard(QFrame):
    """Name, technology, port, state, and the things you can do."""

    start_requested = Signal(str)
    stop_requested = Signal(str)
    open_requested = Signal(str)
    enabled_changed = Signal(str, bool)

    def __init__(
        self,
        key: str,
        name_key: str,
        technology: str,
        port: int | None,
        *,
        can_open: bool,
        optional: bool,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.key = key
        self._name_key = name_key
        self._technology = technology
        self._port = port
        self._state = State.STOPPED
        self._note = ""
        self._wrapped: bool | None = None

        self.setObjectName("serviceCard")
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Fixed)
        self.setMinimumWidth(MIN_WIDTH)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(4)

        header = QHBoxLayout()
        header.setSpacing(8)
        self._title = title("")
        # The name may be long in Portuguese ("Ecra do atrio"); let it elide
        # rather than force the whole card wider than its column.
        self._title.setSizePolicy(
            QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred
        )
        header.addWidget(self._title, 1)

        # The optional service says so on its own card rather than in a
        # settings dialog: whether the scanner runs is a decision made at the
        # moment of pressing Run All, not once at install time.
        self._enable: QCheckBox | None = None
        if optional:
            self._enable = QCheckBox()
            self._enable.setChecked(False)
            self._enable.toggled.connect(
                lambda on: self.enabled_changed.emit(self.key, on)
            )
            header.addWidget(self._enable, 0)
        layout.addLayout(header)

        self._where = subtle("")
        self._where.setSizePolicy(
            QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred
        )
        layout.addWidget(self._where)

        layout.addSpacing(6)

        self._status = QLabel()
        self._status.setTextFormat(Qt.TextFormat.RichText)
        layout.addWidget(self._status)

        # A THIN INDETERMINATE BAR, shown only while something is in flight.
        #
        # Starting a Next dev server takes eight seconds or more on a cold
        # cache. Without a moving element the window looks frozen, and the
        # honest signal that work is happening is worth four pixels of height.
        # It has no percentage because there is nothing to measure -- the bar
        # says "still going", not "this far".
        self._progress = QProgressBar()
        self._progress.setRange(0, 0)
        self._progress.setTextVisible(False)
        self._progress.setVisible(False)
        layout.addWidget(self._progress)

        layout.addSpacing(6)

        self._buttons = QGridLayout()
        self._buttons.setHorizontalSpacing(8)
        self._buttons.setVerticalSpacing(6)

        self._start = QPushButton()
        self._start.clicked.connect(lambda: self.start_requested.emit(self.key))

        self._stop = QPushButton()
        self._stop.clicked.connect(lambda: self.stop_requested.emit(self.key))

        self._open: QPushButton | None = None
        if can_open:
            self._open = QPushButton()
            self._open.clicked.connect(lambda: self.open_requested.emit(self.key))

        for button in self._each_button():
            # Minimum, not Preferred: the button may grow into spare width but
            # must never be squeezed below the width of its own label.
            button.setSizePolicy(
                QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Fixed
            )
            button.setMinimumHeight(32)

        layout.addLayout(self._buttons)

        self._lay_out_buttons(wrapped=False)
        self.retranslate()
        self.restyle()
        self.set_state(State.STOPPED)

    # ------------------------------------------------------------ plumbing --

    def _each_button(self) -> list[QPushButton]:
        return [b for b in (self._start, self._stop, self._open) if b is not None]

    def _lay_out_buttons(self, *, wrapped: bool) -> None:
        """One row when there is room, two when there is not."""
        if wrapped == self._wrapped:
            return
        self._wrapped = wrapped

        for button in self._each_button():
            self._buttons.removeWidget(button)
        self._buttons.setColumnStretch(0, 0)
        self._buttons.setColumnStretch(1, 0)
        self._buttons.setColumnStretch(2, 1)

        if wrapped:
            # Start gets the full width on its own row: it is the button
            # somebody is reaching for, and it should not be the one that ends
            # up half the size of Open.
            span = 2 if self._open is not None else 1
            self._buttons.addWidget(self._start, 0, 0, 1, span)
            self._buttons.addWidget(self._stop, 1, 0)
            if self._open is not None:
                self._buttons.addWidget(self._open, 1, 1)
            self._buttons.setColumnStretch(2, 0)
        else:
            self._buttons.addWidget(self._start, 0, 0)
            self._buttons.addWidget(self._stop, 0, 1)
            if self._open is not None:
                self._buttons.addWidget(self._open, 0, 2)
                self._buttons.setColumnStretch(3, 1)

    def resizeEvent(self, event) -> None:  # noqa: N802  (Qt naming)
        super().resizeEvent(event)
        self._lay_out_buttons(wrapped=event.size().width() < WRAP_BELOW)

    # -------------------------------------------------------------- content --

    @property
    def include_in_run_all(self) -> bool:
        """Non-optional services are always included."""
        return True if self._enable is None else self._enable.isChecked()

    def retranslate(self) -> None:
        self._title.setText(t(self._name_key))
        where = (
            t("svc.port", port=self._port)
            if self._port is not None
            else t("svc.expoPort")
        )
        self._where.setText(f"{self._technology}  ·  {where}")
        if self._enable is not None:
            self._enable.setText(t("svc.includeInRunAll"))
        if self._open is not None:
            self._open.setText(t("svc.open"))
        # The two that change with state are set there, so this defers to it.
        self.set_state(self._state, self._note)

    def restyle(self) -> None:
        self.setStyleSheet(theme.card_qss())
        self._start.setStyleSheet(theme.primary_button_qss())
        self._stop.setStyleSheet(theme.ghost_button_qss())
        if self._open is not None:
            self._open.setStyleSheet(theme.ghost_button_qss())
        self._progress.setStyleSheet(theme.progress_qss())
        theme.restyle_labels(self)
        self.set_state(self._state, self._note)

    def set_state(self, state: State, note: str = "") -> None:
        self._state = state
        self._note = note
        colour = theme.state_colours()[state]
        faint = theme.current().text_faint

        # The word carries the meaning and the dot only reinforces it. A status
        # shown as colour alone fails anyone who cannot separate amber from
        # green -- the same rule the scanner's verdicts follow.
        text = f'<span style="color:{colour}; font-size:15px;">●</span>&nbsp; '
        text += (
            f'<span style="color:{colour}; font-weight:600;">'
            f"{t('state.' + state.value)}</span>"
        )
        if note:
            text += f'&nbsp; <span style="color:{faint};">{note}</span>'
        self._status.setText(text)

        busy = state in (State.STARTING, State.STOPPING)
        self._progress.setVisible(busy)

        # The label reports what is happening rather than what you may do. A
        # disabled button reading "Start" during an eight-second boot looks
        # broken; one reading "Starting..." is the same button telling you why
        # it is not available.
        self._start.setText(
            t("svc.starting") if state is State.STARTING else t("svc.start")
        )
        self._stop.setText(
            t("svc.stopping") if state is State.STOPPING else t("svc.stop")
        )

        active = state in (State.STARTING, State.RUNNING, State.READY, State.STOPPING)
        self._start.setEnabled(not active)
        self._stop.setEnabled(active and state is not State.STOPPING)
        if self._open is not None:
            # Only once it can actually answer. Opening a browser at a service
            # that has merely started is how a user meets a connection error
            # and concludes the app is broken.
            self._open.setEnabled(state is State.READY)
