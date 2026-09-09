"""Two levels of log, in one tabbed panel.

APPLICATION vs TERMINAL, and the distinction is the point. The Application tab
is the story — "Backend is ready", "Dashboard did not answer in 180s" — written
for somebody who wants to know whether they can open the doors. The per-service
tabs are the raw stdout/stderr, unedited, for the moment that story is not
enough.

Nothing is filtered out of the terminal tabs. A launcher that swallows a
traceback to keep its own log tidy is hiding the one thing worth reading.
"""

from __future__ import annotations

from datetime import datetime

from PySide6.QtWidgets import (
    QHBoxLayout,
    QPlainTextEdit,
    QPushButton,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from widgets.theme import GHOST_BUTTON_QSS, LOG_QSS

#: Lines kept per tab. A Next dev server is chatty and an event runs all day;
#: without a cap the widget grows until scrolling stutters. Qt drops the oldest
#: lines for us, which is the right end to lose.
MAX_LINES = 5_000


class _Pane(QPlainTextEdit):
    def __init__(self) -> None:
        super().__init__()
        self.setReadOnly(True)
        self.setMaximumBlockCount(MAX_LINES)
        self.setStyleSheet(LOG_QSS)
        # Wrapping a stack trace makes it unreadable; a horizontal scrollbar is
        # the lesser evil in a terminal view.
        self.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)


class LogViewer(QWidget):
    """One tab for the application log, one per service, plus Everything."""

    def __init__(self, service_keys: list[str], service_names: dict[str, str], parent=None) -> None:
        super().__init__(parent)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        self._tabs = QTabWidget()
        self._panes: dict[str, _Pane] = {}

        for key, label in [("app", "Application"), ("all", "All output")]:
            pane = _Pane()
            self._panes[key] = pane
            self._tabs.addTab(pane, label)

        for key in service_keys:
            pane = _Pane()
            self._panes[key] = pane
            self._tabs.addTab(pane, service_names.get(key, key.title()))

        layout.addWidget(self._tabs)

        controls = QHBoxLayout()
        controls.addStretch(1)

        copy = QPushButton("Copy tab")
        copy.setStyleSheet(GHOST_BUTTON_QSS)
        copy.clicked.connect(self._copy_current)
        controls.addWidget(copy)

        clear = QPushButton("Clear tab")
        clear.setStyleSheet(GHOST_BUTTON_QSS)
        clear.clicked.connect(self._clear_current)
        controls.addWidget(clear)

        layout.addLayout(controls)

    # ------------------------------------------------------------- writing --

    def app(self, message: str) -> None:
        """A lifecycle line, timestamped, in the Application tab."""
        stamp = datetime.now().strftime("%H:%M:%S")
        for line in message.rstrip().splitlines() or [""]:
            self._append("app", f"[{stamp}] {line}")

    def service(self, key: str, text: str) -> None:
        """Raw child output. Goes to its own tab and to All output.

        Prefixed in the combined tab only: the per-service tab is already
        unambiguous, and repeating the name on every line there would push the
        actual output off the right of a narrow window.
        """
        for line in text.splitlines():
            self._append(key, line)
            self._append("all", f"[{key.upper()}] {line}")

    def _append(self, key: str, line: str) -> None:
        pane = self._panes.get(key)
        if pane is None:
            return

        # Follow the tail only when the reader is already at it. Someone who
        # has scrolled up is reading something, and yanking them back to the
        # bottom on the next line of output is the classic log-viewer sin.
        bar = pane.verticalScrollBar()
        at_bottom = bar.value() >= bar.maximum() - 4
        pane.appendPlainText(line)
        if at_bottom:
            bar.setValue(bar.maximum())

    # ------------------------------------------------------------ controls --

    def _current_pane(self) -> _Pane:
        return self._tabs.currentWidget()  # type: ignore[return-value]

    def _clear_current(self) -> None:
        self._current_pane().clear()

    def _copy_current(self) -> None:
        pane = self._current_pane()
        pane.selectAll()
        pane.copy()
        cursor = pane.textCursor()
        cursor.clearSelection()
        pane.setTextCursor(cursor)
