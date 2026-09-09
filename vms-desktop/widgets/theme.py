"""The look of the control centre, in one place.

DARK, AND NOT AS A FASHION. This window sits open on a server machine beside a
lobby for the length of an event, often in a dim room. It also has to be
readable at a glance from a step away, which is why the state words are set at
weight 600 and the log is monospace.

The palette is the scanner's, sampled from the event artwork and already
contrast-checked against a near-black ground — reusing it means the control
centre looks like part of VMS rather than a tool that wandered in.
"""

from __future__ import annotations

from PySide6.QtGui import QFont
from PySide6.QtWidgets import QLabel

from services import State

BACKGROUND = "#0B1016"
SURFACE = "#141B24"
SURFACE_RAISED = "#1F2833"
BORDER = "#26313F"

TEXT = "#F4F8FB"
TEXT_MUTED = "#A8B6C4"
TEXT_FAINT = "#75838F"

ACCENT = "#3372FF"
ACCENT_PRESSED = "#1F4FC0"

VALID = "#00B050"
INVALID = "#F24141"
AMBER = "#FCB400"

#: One colour per state. READY is the only green: RUNNING deliberately is not,
#: because "the process exists" and "it can serve a request" are different
#: claims and the UI should not blur them.
STATE_COLOURS = {
    State.STOPPED: TEXT_FAINT,
    State.STARTING: AMBER,
    State.RUNNING: AMBER,
    State.READY: VALID,
    State.STOPPING: AMBER,
    State.ERROR: INVALID,
}

WINDOW_QSS = f"""
QWidget {{
    background: {BACKGROUND};
    color: {TEXT};
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 13px;
}}
QScrollBar:vertical {{
    background: {BACKGROUND};
    width: 10px;
    margin: 0;
}}
QScrollBar::handle:vertical {{
    background: {BORDER};
    border-radius: 5px;
    min-height: 30px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QTabWidget::pane {{
    border: 1px solid {BORDER};
    border-radius: 10px;
    background: {SURFACE};
}}
QTabBar::tab {{
    background: transparent;
    color: {TEXT_FAINT};
    padding: 7px 14px;
    margin-right: 2px;
    border-radius: 7px;
}}
QTabBar::tab:selected {{
    background: {SURFACE_RAISED};
    color: {TEXT};
}}
QCheckBox {{ color: {TEXT_MUTED}; }}
"""

CARD_QSS = f"""
QFrame#serviceCard, QFrame#networkCard {{
    background: {SURFACE};
    border: 1px solid {BORDER};
    border-radius: 12px;
}}
"""

PRIMARY_BUTTON_QSS = f"""
QPushButton {{
    background: {ACCENT};
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 7px 16px;
    font-weight: 600;
}}
QPushButton:hover  {{ background: #4A83FF; }}
QPushButton:pressed{{ background: {ACCENT_PRESSED}; }}
QPushButton:disabled {{ background: {SURFACE_RAISED}; color: {TEXT_FAINT}; }}
"""

GHOST_BUTTON_QSS = f"""
QPushButton {{
    background: transparent;
    color: {TEXT_MUTED};
    border: 1px solid {BORDER};
    border-radius: 8px;
    padding: 7px 16px;
}}
QPushButton:hover {{ border-color: {TEXT_FAINT}; color: {TEXT}; }}
QPushButton:disabled {{ color: {TEXT_FAINT}; border-color: {SURFACE_RAISED}; }}
"""

DANGER_BUTTON_QSS = f"""
QPushButton {{
    background: transparent;
    color: {INVALID};
    border: 1px solid {INVALID};
    border-radius: 8px;
    padding: 7px 16px;
    font-weight: 600;
}}
QPushButton:hover {{ background: rgba(242, 65, 65, 0.12); }}
QPushButton:disabled {{ color: {TEXT_FAINT}; border-color: {SURFACE_RAISED}; }}
"""

LOG_QSS = f"""
QPlainTextEdit {{
    background: {BACKGROUND};
    color: {TEXT_MUTED};
    border: none;
    padding: 10px;
    font-family: "Cascadia Mono", "Consolas", monospace;
    font-size: 12px;
}}
"""


def title(text: str) -> QLabel:
    label = QLabel(text)
    font = label.font()
    font.setPointSize(11)
    font.setWeight(QFont.Weight.DemiBold)
    label.setFont(font)
    return label


def subtle(text: str) -> QLabel:
    label = QLabel(text)
    label.setStyleSheet(f"color: {TEXT_FAINT};")
    return label


def muted(text: str) -> QLabel:
    label = QLabel(text)
    label.setStyleSheet(f"color: {TEXT_MUTED};")
    return label
