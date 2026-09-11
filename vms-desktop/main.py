"""VMS Desktop Control Center — application entry point and main window.

An ORCHESTRATION LAYER, and nothing more. It starts the four services that
already exist, watches them, and shows what they say. It holds no visitor data,
speaks no part of the VMS API beyond one unauthenticated health probe, and
would be deletable tomorrow without changing how VMS works.

Everything the window does with a service goes through `ServiceRegistry`;
everything it knows about paths and commands comes from `config`. The window
itself only wires signals and paints.

IT HAS TO SURVIVE BEING MADE SMALL. Earlier it did not: the cards sat directly
in the window, so dragging the edge in squeezed fixed-height widgets until the
status word clipped and the buttons elided to "....". The panels now live in a
splitter over a scroll area, which is the difference between a window that gets
tighter and a window that gets broken.
"""

from __future__ import annotations

import sys
import webbrowser
from pathlib import Path

# Running from source, `vms-desktop/` is the import root. PyInstaller sets this
# up itself, so it is only needed for the developer path.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from PySide6.QtCore import QEvent, QSize, Qt, QTimer  # noqa: E402
from PySide6.QtGui import QAction, QActionGroup, QGuiApplication, QIcon  # noqa: E402
from PySide6.QtWidgets import (  # noqa: E402
    QApplication,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMenu,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

import i18n  # noqa: E402
import preflight  # noqa: E402
from config import Mode, service_environment, service_specs  # noqa: E402
from i18n import t  # noqa: E402
from launcher import Orchestrator  # noqa: E402
from network import detect_lan_ip, port_in_use  # noqa: E402
from processes import kill_tree  # noqa: E402
from services import ServiceRegistry, State  # noqa: E402
from widgets import icons, theme  # noqa: E402
from widgets.log_viewer import LogViewer  # noqa: E402
from widgets.network_card import NetworkCard  # noqa: E402
from widgets.service_card import ServiceCard  # noqa: E402

APP_NAME = "VMS Control Center"

#: How long the wait cursor stays after a start is asked for.
#:
#: A CONFIRMATION, NOT A PROGRESS BAR. Holding the busy cursor for the eight
#: seconds a Next dev server really takes would make a responsive window feel
#: hung, and nothing is blocked in the meantime — the click already returned.
#: Half a second says "that registered"; the card's own bar carries the rest.
CLICK_FEEDBACK_MS = 550

#: The log's share of the height below the header, held at every window size.
#:
#: A CONTRACT, NOT A LEFTOVER. The log used to be given whatever the service
#: cards did not want, which on a default window was about 110 pixels -- four
#: lines, in the one panel that explains why a service just died. At 35% an
#: 880px window shows roughly fifteen lines, which is a traceback rather than
#: the end of one, and the cards above scroll for the difference.
LOG_SHARE = 0.35


class ControlCenter(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(APP_NAME)

        i18n.load()
        theme.set_palette(i18n.settings().value("theme", "dark"))

        # SIZED TO THE SCREEN THAT EXISTS, not to a number that looked right on
        # a development monitor. A fixed 1180x860 is TALLER than a 1280x720
        # laptop, and Windows then clamps the window and clips the URL column --
        # measured on exactly such a machine.
        available = QGuiApplication.primaryScreen().availableGeometry()
        self.resize(
            min(1180, int(available.width() * 0.94)),
            min(880, int(available.height() * 0.94)),
        )
        # Small, because the splitter and the scroll area below genuinely cope.
        # This is roughly the point where one card plus a few log lines still
        # read; past it the window would be lying about being usable.
        self.setMinimumSize(420, 420)

        icon = Path(__file__).resolve().parent / "assets" / "vms.ico"
        if icon.is_file():
            self.setWindowIcon(QIcon(str(icon)))

        #: Guards against re-entering the share calculation from the layout
        #: request its own `setSizes` provokes.
        self._share_pending = False

        # Remembered like the theme and the language. A machine set up for the
        # event stays in production across restarts; a developer's stays in
        # development. Neither has to remember to set it on the morning.
        stored = i18n.settings().value("mode", Mode.DEV)
        self._mode = stored if stored in (Mode.DEV, Mode.PROD) else Mode.DEV
        self._lan_ip = detect_lan_ip()

        self._specs = {spec.key: spec for spec in service_specs(self._mode)}
        self._registry = ServiceRegistry(list(self._specs.values()), self)
        self._orchestrator = Orchestrator(self._registry, self._specs, self)

        self._build_ui()
        self._connect()
        self.restyle()
        self.retranslate()

        self._network.set_address(self._lan_ip)
        self._logs.app(t("msg.ready", app=APP_NAME, ip=self._lan_ip))
        self._logs.app(t("msg.runAllHint"))
        self._logs.app(t("msg.firewall"))

    # ------------------------------------------------------------------ ui --

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)

        root = QVBoxLayout(central)
        root.setContentsMargins(16, 12, 16, 12)
        root.setSpacing(10)

        root.addLayout(self._build_header())

        # THE SPLITTER IS WHY THIS SURVIVES A SMALL WINDOW.
        #
        # Above: the network card and the service cards, inside a scroll area,
        # so when there is not enough height they scroll instead of being
        # compressed past legibility. Below: the log. The user can drag the
        # balance, and neither half can crush the other.
        self._split = QSplitter(Qt.Orientation.Vertical)
        self._split.setChildrenCollapsible(False)
        self._split.setHandleWidth(8)

        panels = QWidget()
        panel_layout = QVBoxLayout(panels)
        panel_layout.setContentsMargins(0, 0, 0, 0)
        panel_layout.setSpacing(10)

        self._network = NetworkCard()
        panel_layout.addWidget(self._network)

        self._grid = QGridLayout()
        self._grid.setHorizontalSpacing(12)
        self._grid.setVerticalSpacing(12)
        self._cards: dict[str, ServiceCard] = {}

        for spec in self._specs.values():
            self._cards[spec.key] = ServiceCard(
                spec.key,
                spec.name_key,
                spec.technology,
                spec.port,
                can_open=spec.opens_in_browser,
                optional=spec.optional,
            )
        self._columns = 0
        self._relayout_cards(4)
        panel_layout.addLayout(self._grid)
        panel_layout.addStretch(1)

        self._panels = panels
        # THE SHARE DEPENDS ON THIS WIDGET'S SIZE HINT, so it has to be
        # recomputed when the hint changes -- not only when the window does.
        # Reflowing 4 columns to 2 reports a transitional hint for one more
        # turn than a resize gets, and the share was computed against it:
        # 474px where the settled answer was 436, leaving a 38px band.
        panels.installEventFilter(self)

        self._scroll = QScrollArea()
        self._scroll.setWidget(panels)
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        # Never a horizontal bar: the cards reflow to fewer columns instead,
        # and a control panel you have to scroll sideways is a failed layout.
        self._scroll.setHorizontalScrollBarPolicy(
            Qt.ScrollBarPolicy.ScrollBarAlwaysOff
        )
        self._split.addWidget(self._scroll)

        self._logs = LogViewer(
            list(self._specs), {k: s.name_key for k, s in self._specs.items()}
        )
        self._logs.setMinimumHeight(120)
        self._split.addWidget(self._logs)

        # Both halves are told the same ratio, so anything Qt redistributes
        # between our own calls moves the same way `_apply_log_share` would.
        self._split.setStretchFactor(0, round((1 - LOG_SHARE) * 100))
        self._split.setStretchFactor(1, round(LOG_SHARE * 100))
        root.addWidget(self._split, stretch=1)

    def eventFilter(self, watched, event) -> bool:  # noqa: N802  (Qt naming)
        """Recompute the share when the panel column's own layout changes.

        A RESIZE IS NOT THE ONLY THING THAT MOVES THE ANSWER. The share is
        computed from the panel column's size hint, and that hint settles a
        turn later than the resize which caused it: reflowing four columns to
        two reported 474px, then 436px. Watching the widget catches the second
        number; waiting longer would only have been a guess about how long.
        """
        if watched is self._panels and event.type() == QEvent.Type.LayoutRequest:
            self._schedule_log_share()
        return super().eventFilter(watched, event)

    def _schedule_log_share(self) -> None:
        """Apply the share once, after the current layout pass finishes."""
        if self._share_pending:
            return
        self._share_pending = True
        QTimer.singleShot(0, self._apply_log_share)

    def _apply_log_share(self) -> None:
        """Give the log its share of the height, and any the cards refuse.

        A FLOOR, NOT A CEILING, and the difference is 348 pixels. Held to
        exactly 35%, a 1920x1080 window put the four cards in a single row that
        wanted 295px, gave the pane 643px, and left the remaining 348px empty
        directly above the log -- a band of nothing between the only two things
        on screen. So the log takes what the cards do not want: about 70% at
        1920x1080, 42% at 1180x880, and the plain 35% from 900x700 down, where
        the cards want more than there is and the pane scrolls instead.

        THIS REPLACES A RULE THAT FITTED THE CARDS FIRST, and the trade it made
        has been reversed deliberately. That rule asked the panel column how
        tall it wanted to be, gave it exactly that, and handed the log whatever
        was left -- which on an 880px window was about 110 pixels. Four lines.
        The log is the only window into four child processes, so on the morning
        something dies at 08:40 those four lines are the whole diagnosis.

        What that rule was protecting against was real: a card grid cut through
        the middle of a row of buttons reads as broken. It is the lesser cost.
        The cards already reflow to fewer columns as the window narrows, and
        the panels already sit in a scroll area built for exactly this -- so a
        short panel area scrolls, while a short log simply hides the answer.

        NOT A STRETCH FACTOR, and not a one-time balance. A stretch factor only
        distributes the space a resize ADDS, so it drifts away from the ratio
        the moment anything else sets a size; a one-time balance is undone by
        the first resize. The share is asserted outright, whenever the geometry
        changes.

        A drag still works -- the splitter is not locked -- and the next resize
        restores the share.
        """
        self._share_pending = False

        total = self._split.height()
        if total <= 0:
            return

        # The HANDLE is part of the splitter's height and belongs to neither
        # pane. Left out of this sum, Qt scales both sides down to make room
        # and the log lands a few pixels under its share -- 34.6% where the
        # constant says 35.
        content = total - self._split.handleWidth()

        # What the cards genuinely want, asked of them rather than assumed. It
        # changes with the column count, so it must be read after the reflow --
        # which is why the caller defers this by an event loop turn.
        needs = self._scroll.widget().sizeHint().height()

        log = max(
            round(total * LOG_SHARE),  # the guaranteed share
            content - needs,  # plus anything the cards do not want
            self._logs.minimumHeight(),  # never below legible
        )
        log = min(log, content)  # a window too small for even the floor

        # Settled already? Do not write the same sizes back -- `setSizes`
        # posts another layout request, which would call this again.
        if self._split.sizes() == [content - log, log]:
            return
        self._split.setSizes([content - log, log])

    def showEvent(self, event) -> None:  # noqa: N802  (Qt naming)
        super().showEvent(event)
        # After the first layout pass, when the splitter has a real height.
        self._schedule_log_share()

    def _relayout_cards(self, columns: int) -> None:
        """Arrange the four cards in 1, 2 or 4 columns.

        NOT COSMETIC. Two rows of cards cost about 155px of height, and on a
        1280x720 laptop -- which is what this was measured on -- that pushes the
        log viewer off the bottom of the screen entirely.
        """
        if columns == self._columns:
            return
        self._columns = columns

        for card in self._cards.values():
            self._grid.removeWidget(card)
        for index, card in enumerate(self._cards.values()):
            self._grid.addWidget(card, index // columns, index % columns)
        for column in range(4):
            self._grid.setColumnStretch(column, 1 if column < columns else 0)

    def _columns_for(self, width: int) -> int:
        """How many cards fit across, asked of the cards rather than guessed.

        A COLUMN COUNT IS ONLY RIGHT IF THE CARD IN IT IS. Four columns at
        1180px gives each card about 280px, which is narrower than its own
        button row wants once the buttons carry icons -- so every card with an
        Open button wrapped to two rows, grew taller than the panel area, and
        was cut off half way down. Fewer, wider columns is the better trade:
        the cards stay one row tall and nothing is clipped.

        Falls back to a plain width rule if the cards cannot be asked yet,
        which is only true during construction.
        """
        cards = list(self._cards.values())
        if not cards:
            return 1

        spacing = self._grid.horizontalSpacing()
        margins = 32  # the root layout's left and right
        # The widest of the four: they differ, and a column has to hold any.
        needed = max(card._row_needs() for card in cards)

        for columns in (4, 2):
            if width - margins >= columns * needed + (columns - 1) * spacing:
                return columns
        return 1

    def resizeEvent(self, event) -> None:  # noqa: N802  (Qt naming)
        super().resizeEvent(event)
        width = event.size().width()
        self._relayout_cards(self._columns_for(width))
        rows = 1 if width >= 900 else 2
        self._lay_out_header(rows=rows)
        # Measured against what the buttons ACTUALLY report, which already
        # includes whatever the display scaling did to them.
        needed = sum(
            b.sizeHint().width() + 8
            for b in (self._language, self._theme, self._mode_button, self._run_all, self._stop_all)
        ) + self._overall.sizeHint().width()
        room = width - 32 - (self._titles.sizeHint().width() if rows == 1 else 0)
        self._lay_out_controls(rows=1 if needed <= room else 2)
        # MEASURED, NOT GUESSED. A pixel threshold has to be right in three
        # languages at once, and it is not: "Mudar para claro" is a third wider
        # than "Switch to light", so a number tuned on English clips Portuguese.
        # Asking the font how wide the full labels would be gets it right in
        # every language, including ones added later.
        available = width - (32 if rows == 1 else 32)
        if rows == 1:
            available -= self._titles.sizeHint().width()
        self._set_compact_controls(self._full_controls_width() > available)

        # LAST, because everything above can change the header's height and so
        # the splitter's. Deferred by a turn for the same reason: the header
        # rows laid out just now have not been measured yet, and a share
        # computed against the old height is wrong by exactly one row.
        self._schedule_log_share()

    def _build_header(self) -> QGridLayout:
        """Title on the left, controls on the right -- until there is no room.

        THE HEADER WAS THE LAST THING TO BREAK WHEN NARROW. It was one
        QHBoxLayout, so below about 700px the title elided to "VMS CON", the
        theme button to "ch to", and Run All left the window entirely. A row
        that cannot wrap will always do that; this one drops the controls onto
        a second row instead, and shortens their labels again below that.
        """
        header = QGridLayout()
        header.setHorizontalSpacing(8)
        header.setVerticalSpacing(8)
        header.setContentsMargins(0, 0, 0, 0)

        left = QVBoxLayout()
        left.setSpacing(1)
        self._heading = QLabel("VMS CONTROL CENTER")
        font = self._heading.font()
        font.setPointSize(17)
        font.setWeight(font.Weight.Bold)
        self._heading.setFont(font)
        left.addWidget(self._heading)
        self._subtitle = QLabel()
        left.addWidget(self._subtitle)

        self._titles = QWidget()
        self._titles.setLayout(left)
        # Ignored horizontally: the title may elide, but it must never be the
        # reason a control is pushed off the window.
        self._titles.setSizePolicy(
            QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred
        )

        self._overall = QLabel()
        self._overall.setTextFormat(Qt.TextFormat.RichText)

        # Language and theme sit beside the controls they affect rather than in
        # a settings dialog: the reason anyone reaches for either is the person
        # or the room in front of them, and both change during a day.
        self._language = QPushButton()
        self._language.setMinimumHeight(34)
        self._language_menu = QMenu(self)
        self._language_group = QActionGroup(self)
        self._language_group.setExclusive(True)
        for code, label in i18n.LANGUAGES:
            action = QAction(label, self)
            action.setCheckable(True)
            action.setChecked(code == i18n.current())
            action.triggered.connect(lambda _checked, c=code: self._set_language(c))
            self._language_group.addAction(action)
            self._language_menu.addAction(action)
        self._language.setMenu(self._language_menu)

        self._theme = QPushButton()
        self._theme.setMinimumHeight(34)
        self._theme.clicked.connect(self._toggle_theme)

        # Mode sits with language and theme rather than in a settings dialog,
        # for the same reason those two do: it is changed because of the room
        # you are in -- editing at a desk, or running a conference.
        self._mode_button = QPushButton()
        self._mode_button.setMinimumHeight(34)
        self._mode_button.clicked.connect(self._toggle_mode)

        self._run_all = QPushButton()
        self._run_all.setMinimumHeight(38)

        self._stop_all = QPushButton()
        self._stop_all.setMinimumHeight(38)

        # THE CONTROL ROW WRAPS TOO, and it has to.
        #
        # Compact labels alone were not enough: on a screen with display
        # scaling every button is a quarter wider than the offscreen test
        # measures, so a row that "just fits" at 100% loses Run All entirely at
        # 125%. A layout that can put the actions on their own line does not
        # care what the scaling is.
        self._controls = QWidget()
        # Preferred, not Ignored: the row must be allowed to ask for the width
        # its buttons need. Making it Ignored starved it at full size, which is
        # the opposite failure to the one being fixed.
        self._controls.setSizePolicy(
            QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Preferred
        )
        # A column of rows, not a grid with spans. Spanning cells made the
        # column widths satisfy two different rows at once, and the total came
        # out wider than the window -- which is how Run All ended up off the
        # right edge at 470px even in compact mode.
        self._control_box = QVBoxLayout(self._controls)
        self._control_box.setContentsMargins(0, 0, 0, 0)
        self._control_box.setSpacing(8)
        self._control_line_a = QHBoxLayout()
        self._control_line_a.setSpacing(8)
        self._control_line_b = QHBoxLayout()
        self._control_line_b.setSpacing(8)
        self._control_box.addLayout(self._control_line_a)
        self._control_box.addLayout(self._control_line_b)
        for button in (self._language, self._theme, self._mode_button, self._run_all, self._stop_all):
            button.setSizePolicy(
                QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Fixed
            )
        self._control_rows = 0
        self._lay_out_controls(rows=1)

        self._header = header
        self._header_rows = 0
        self._lay_out_header(rows=1)
        return header

    def _lay_out_controls(self, *, rows: int) -> None:
        """Status and the four controls, on one line or two."""
        if rows == self._control_rows:
            return
        self._control_rows = rows

        for line in (self._control_line_a, self._control_line_b):
            while line.count():
                item = line.takeAt(0)
                if item.widget() is not None:
                    item.widget().setParent(self._controls)

        self._control_line_a.addWidget(self._overall)
        self._control_line_a.addStretch(1)
        self._control_line_a.addWidget(self._language)
        self._control_line_a.addWidget(self._theme)
        self._control_line_a.addWidget(self._mode_button)

        target = self._control_line_a if rows == 1 else self._control_line_b
        if rows == 2:
            # The actions get a line of their own, where they are big enough to
            # hit and cannot be pushed out by the status word growing.
            self._control_line_b.addStretch(1)
        target.addWidget(self._run_all)
        target.addWidget(self._stop_all)

        for widget in (
            self._overall,
            self._language,
            self._theme,
            self._mode_button,
            self._run_all,
            self._stop_all,
        ):
            widget.show()

    def _lay_out_header(self, *, rows: int) -> None:
        if rows == self._header_rows:
            return
        self._header_rows = rows

        self._header.removeWidget(self._titles)
        self._header.removeWidget(self._controls)
        if rows == 1:
            self._header.addWidget(self._titles, 0, 0)
            self._header.addWidget(self._controls, 0, 1)
            self._header.setColumnStretch(0, 1)
            self._header.setColumnStretch(1, 0)
        else:
            self._header.addWidget(self._titles, 0, 0)
            self._header.addWidget(self._controls, 1, 0)
            self._header.setColumnStretch(0, 1)
            self._header.setColumnStretch(1, 0)

    def _full_controls_width(self) -> int:
        """How wide the control row would be with its labels written out.

        Computed from font metrics rather than from the widgets, so it does not
        depend on which mode they are currently in -- reading their sizeHint
        while they are compact would say the compact row fits and flip straight
        back, which is an oscillation, not a layout.
        """
        dark = theme.current().name == "dark"
        labels = [
            i18n.language_name(i18n.current()),
            t("pref.toLight") if dark else t("pref.toDark"),
            f"▶  {t('app.runAll')}",
            f"■  {t('app.stopAll')}",
        ]
        metrics = self._run_all.fontMetrics()
        # 28px is the QSS horizontal padding plus border; 8px is the row spacing.
        total = sum(metrics.horizontalAdvance(text) + 28 for text in labels)
        total += 8 * len(labels)
        total += self._overall.sizeHint().width()
        return total

    def _set_compact_controls(self, compact: bool) -> None:
        """Shorten the two preference buttons when the row is tight.

        A language code and a single glyph carry the same meaning as the full
        words at a third of the width, and losing them entirely would leave
        somebody stuck in a language they cannot read.
        """
        if compact == getattr(self, "_compact", None):
            return
        self._compact = compact
        self.retranslate()

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

    # ------------------------------------------------- theme and language --

    def restyle(self) -> None:
        """Re-apply every stylesheet from the current palette."""
        self.setStyleSheet(theme.window_qss())
        p = theme.current()
        self._heading.setStyleSheet(f"color: {p.text};")
        self._subtitle.setStyleSheet(f"color: {p.text_faint};")
        self._language.setStyleSheet(theme.ghost_button_qss())
        self._language.setIcon(icons.globe(p.text_muted))
        self._theme.setStyleSheet(theme.ghost_button_qss())
        # The button names its DESTINATION, so it shows the icon of the mode it
        # will give you -- a sun while dark, a moon while light. Showing the
        # current mode's icon is the same ambiguity the label avoids.
        self._theme.setIcon(
            icons.sun(p.text_muted)
            if theme.current().name == "dark"
            else icons.moon(p.text_muted)
        )
        self._run_all.setStyleSheet(theme.primary_button_qss())
        self._run_all.setIcon(icons.play(p.on_accent))
        self._stop_all.setStyleSheet(theme.danger_button_qss())
        self._stop_all.setIcon(icons.stop(p.invalid))

        for button in (
            self._language,
            self._theme,
            self._run_all,
            self._stop_all,
        ):
            button.setIconSize(QSize(16, 16))
        self._network.restyle()
        self._logs.restyle()
        for card in self._cards.values():
            card.restyle()
        self._refresh_overall()

    def retranslate(self) -> None:
        self._subtitle.setText(t("app.subtitle"))
        dark = theme.current().name == "dark"

        # THE ICON CARRIES THE MEANING WHEN THE LABEL CANNOT.
        #
        # Compact mode used to substitute a Unicode glyph for the words, which
        # relied on whatever the system font had for U+25B6 and rendered at a
        # different weight to everything around it. The icon is drawn to the
        # same conventions as every other mark here, and the tooltip carries
        # the word that no longer fits -- so nothing is lost, only shortened.
        if getattr(self, "_compact", False):
            self._language.setText(i18n.current().upper())
            self._theme.setText("")
            # Compact keeps the mode WORD, not an icon. Which mode this is in
            # decides what gets run at a conference, and it is the one control
            # here whose state is not visible anywhere else on the window.
            self._mode_button.setText(t(f"mode.{self._mode}"))
            self._run_all.setText("")
            self._stop_all.setText("")
        else:
            self._language.setText(i18n.language_name(i18n.current()))
            self._theme.setText(t("pref.toLight") if dark else t("pref.toDark"))
            self._mode_button.setText(t("mode.button", mode=t(f"mode.{self._mode}")))
            self._run_all.setText(t("app.runAll"))
            self._stop_all.setText(t("app.stopAll"))

        # Tooltips always, not only when compact: a control that has room for
        # its label still benefits from one, and it means the compact path is
        # not the only place the word exists.
        self._language.setToolTip(t("pref.language"))
        self._theme.setToolTip(t("pref.toLight") if dark else t("pref.toDark"))
        self._mode_button.setToolTip(t("mode.tip"))
        self._run_all.setToolTip(t("app.runAll"))
        self._stop_all.setToolTip(t("app.stopAll"))
        self._network.retranslate()
        self._logs.retranslate()
        for card in self._cards.values():
            card.retranslate()
        self._refresh_overall()

    def _toggle_theme(self) -> None:
        nxt = "light" if theme.current().name == "dark" else "dark"
        theme.set_palette(nxt)
        i18n.settings().setValue("theme", nxt)
        # restyle first: it repaints the icons from the new palette, and
        # retranslate then sets the labels and tooltips that go beside them.
        self.restyle()
        self.retranslate()

    def _set_language(self, code: str) -> None:
        i18n.set_locale(code)
        self.retranslate()

    def _toggle_mode(self) -> None:
        """Swap between the dev server and the built app.

        REFUSED WHILE ANYTHING IS RUNNING, and that is not timidity. The mode
        decides the command, so switching under a live service would leave the
        launcher holding a pid it no longer knows how to describe: the card
        would claim `next start` over a running `next dev`, and Stop would be
        aimed at a process started by a command that is no longer on file.
        Stopping first costs one click and keeps the two honest.
        """
        running = [
            t(self._specs[key].name_key)
            for key in self._specs
            if self._registry[key].is_active
        ]
        if running:
            QMessageBox.information(
                self,
                t("dlg.modeBusy"),
                t("dlg.modeBusyBody", services="\n  ".join(running)),
            )
            return

        self._mode = Mode.PROD if self._mode == Mode.DEV else Mode.DEV
        i18n.settings().setValue("mode", self._mode)

        # The specs carry the command, so they are rebuilt and handed to the
        # processes that will run them. The registry keeps its objects: their
        # signals are already wired to the cards.
        self._specs = {spec.key: spec for spec in service_specs(self._mode)}
        for key, spec in self._specs.items():
            self._registry[key].spec = spec
        self._orchestrator.set_specs(self._specs)

        self._logs.app(
            t("msg.modeChanged", mode=t(f"mode.{self._mode}"))
        )
        if self._mode == Mode.PROD:
            self._logs.app(t("msg.modeProdHint"))
        self.restyle()
        self.retranslate()

    # -------------------------------------------------------------- actions --

    def _flash_busy(self) -> None:
        """Acknowledge a click that starts something slow.

        See CLICK_FEEDBACK_MS: this is a receipt for the press, not a measure of
        the work. `restoreOverrideCursor` is scheduled rather than paired with a
        matching call at completion because completion may never arrive -- a
        service can fail to start -- and a wait cursor with no owner is the one
        thing worse than none at all.
        """
        QApplication.setOverrideCursor(Qt.CursorShape.BusyCursor)
        QTimer.singleShot(CLICK_FEEDBACK_MS, QApplication.restoreOverrideCursor)

    def _on_refresh_network(self) -> None:
        self._lan_ip = detect_lan_ip()
        self._network.set_address(self._lan_ip)
        self._logs.app(t("msg.networkRedetected", ip=self._lan_ip))

    def _on_run_all(self) -> None:
        include_scanner = self._cards["scanner"].include_in_run_all

        report = preflight.run(include_scanner=include_scanner, mode=self._mode)
        self._logs.app(preflight.format_report(report))

        if not report.ok:
            self._show_preflight_failure(report)
            return

        self._flash_busy()
        self._lan_ip = report.lan_ip
        self._network.set_address(self._lan_ip)
        self._run_all.setEnabled(False)
        self._orchestrator.start_all(self._lan_ip, include_scanner=include_scanner)

    def _show_preflight_failure(self, report: preflight.Report) -> None:
        """The refusal, plus a way out of the one failure that has a way out.

        A BUSY PORT IS THE ONLY PREFLIGHT FAILURE A PERSON CAN FIX FROM HERE,
        and until now the dialog did not even say which process held it. It
        still refuses to free anything on its own -- `preflight.port_check`
        deliberately reports rather than acts -- but reporting a pid and an
        image name with no button beside it just moves Task Manager into the
        operator's head at the worst moment of the day.

        Nothing is killed by showing this. The button opens a second dialog
        that names the process, and only a click there kills anything.
        """
        first = report.failures[0]

        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Critical)
        box.setWindowTitle(t("dlg.cannotStart"))
        box.setText(first.label)
        box.setInformativeText(f"{first.detail}\n\n{t('dlg.nothingStarted')}")

        # One button per busy port we can actually name an owner for. A port
        # that is busy with no identifiable holder gets no button: there is
        # nothing to offer to stop.
        freeable = {}
        for check in report.failures:
            if check.port is not None and check.owners:
                button = box.addButton(
                    t("dlg.freePort", port=check.port),
                    QMessageBox.ButtonRole.ActionRole,
                )
                freeable[button] = check

        box.addButton(QMessageBox.StandardButton.Close)
        box.exec()

        chosen = freeable.get(box.clickedButton())
        if chosen is not None:
            self._free_port(chosen)

    def _free_port(self, check: preflight.Check) -> None:
        """Kill the named holders of one port, and only on an explicit yes.

        THE PIDS COME FROM THE CHECK, NOT FROM A FRESH LOOKUP. Between the
        preflight and this click the port may have changed hands, and killing
        whatever holds it *now* would kill a process nobody was shown and
        nobody agreed to.
        """
        port = check.port
        assert port is not None  # only port checks reach here

        who = "\n".join(f"  {owner}" for owner in check.owners)
        answer = QMessageBox.question(
            self,
            t("dlg.freePortTitle", port=port),
            t("dlg.freePortBody", who=who),
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Cancel,  # never the default
        )
        if answer is not QMessageBox.StandardButton.Yes:
            return

        # EVERY KILL IS LOGGED, with what was killed and what came back. This
        # is the one place the launcher stops something it did not start, so
        # the log is the only record that it happened at all.
        self._logs.app(t("msg.freeingPort", port=port, who=", ".join(str(o) for o in check.owners)))
        for owner in check.owners:
            result = kill_tree(int(owner.pid))
            if result.ok:
                self._logs.app(f"  {owner}: {result.message or 'stopped'}")
            else:
                self._logs.app(
                    t(
                        "msg.portKillFailed",
                        who=str(owner),
                        reason=result.message or f"exit code {result.returncode}",
                    )
                )

        self._logs.app(
            t("msg.portFreed", port=port)
            if not port_in_use(port)
            else t("msg.portStillHeld", port=port)
        )

    def _on_stop_all(self) -> None:
        self._flash_busy()
        self._orchestrator.cancel()
        self._registry.stop_all()
        self._run_all.setEnabled(True)

    def _on_start_one(self, key: str) -> None:
        """Starting one service by hand still waits for readiness properly.

        AND, IN PRODUCTION, STILL REFUSES AN APP THAT WAS NEVER BUILT. Run All
        gets a full preflight; a single Start never did, which is exactly the
        button somebody presses after editing and rebuilding one app. Without
        this the card flicks RUNNING, drops to ERROR, and the log's last line
        before the error reads "Ready in 341ms".
        """
        spec = self._specs[key]

        if self._mode == Mode.PROD and key in ("dashboard", "screen"):
            built = preflight.build_check(t(spec.name_key), spec.directory)
            if not built.ok:
                QMessageBox.warning(self, t("dlg.notBuilt"), built.detail)
                self._logs.app(built.detail)
                return

        self._flash_busy()
        self._logs.app(t("msg.starting", name=t(spec.name_key)))
        self._registry[key].start(service_environment(key, self._lan_ip))

        from launcher import ReadinessProbe, probe_for

        probe = probe_for(spec, self._lan_ip)
        if probe is None:
            return

        readiness = ReadinessProbe(probe, self)
        readiness.ready.connect(self._on_single_ready)
        readiness.timed_out.connect(self._on_single_timeout)
        readiness.start()

    def _on_single_ready(self, key: str) -> None:
        self._registry[key].mark_ready()
        self._logs.app(t("msg.isReady", name=t(self._specs[key].name_key)))

    def _on_single_timeout(self, key: str) -> None:
        from config import READY_TIMEOUT_MS

        self._logs.app(
            t(
                "msg.timedOut",
                name=t(self._specs[key].name_key),
                seconds=READY_TIMEOUT_MS.get(key, 0) // 1000,
            )
        )

    def _on_stop_one(self, key: str) -> None:
        self._flash_busy()
        self._registry[key].stop()

    def _on_open_one(self, key: str) -> None:
        spec = self._specs[key]
        if spec.port is not None:
            self._on_open_browser(key, f"http://{self._lan_ip}:{spec.port}")

    def _on_open_browser(self, key: str, url: str) -> None:
        self._logs.app(f"{t(self._specs[key].name_key)}: {url}")
        webbrowser.open(url)

    # -------------------------------------------------------------- signals --

    def _on_state_changed(self, key: str, state: State) -> None:
        self._cards[key].set_state(state)
        self._refresh_overall()

    def _on_unexpected_exit(self, key: str, code: int) -> None:
        name = t(self._specs[key].name_key)
        self._logs.app(f"{name} — exit code {code}. See the {name} tab.")
        self._run_all.setEnabled(True)

    def _on_run_all_finished(self, ok: bool) -> None:
        self._run_all.setEnabled(True)
        if not ok:
            self._logs.app(t("msg.notReady"))
        else:
            self._logs.app(t("msg.allRunning"))

    def _refresh_overall(self) -> None:
        """ONLINE / PARTIAL / OFFLINE, from the states rather than a flag."""
        colours = theme.state_colours()
        states = [self._registry[key].state for key in self._specs]
        required = [
            self._registry[key].state
            for key, spec in self._specs.items()
            if not spec.optional
        ]

        if all(state is State.READY for state in required):
            word, colour = t("app.online"), colours[State.READY]
        elif any(state is State.ERROR for state in states):
            word, colour = t("app.partial"), colours[State.ERROR]
        elif any(
            state in (State.STARTING, State.RUNNING, State.READY, State.STOPPING)
            for state in states
        ):
            word, colour = t("app.partial"), colours[State.STARTING]
        else:
            word, colour = t("app.offline"), colours[State.STOPPED]

        self._overall.setText(
            f'<span style="color:{colour}; font-size:15px;">●</span>&nbsp;'
            f'<span style="color:{colour}; font-weight:700; '
            f'letter-spacing:1px;">{word}</span>'
        )

    # ----------------------------------------------------------------- exit --

    def closeEvent(self, event) -> None:  # noqa: N802  (Qt naming)
        """Never leave orphaned services behind.

        A control centre that exits while uvicorn and two Next servers keep
        running is worse than one that never started them: the ports stay held,
        the next launch fails its preflight, and nothing on screen explains why.
        """
        running = [
            t(self._specs[k].name_key)
            for k in self._specs
            if self._registry[k].is_active
        ]

        if running:
            answer = QMessageBox.question(
                self,
                t("app.stopAll"),
                "\n  ".join(running),
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
    app.setOrganizationName(i18n.ORGANISATION)

    window = ControlCenter()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
