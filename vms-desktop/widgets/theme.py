"""The look of the control centre, in one place, and switchable at runtime.

TWO PALETTES, ONE SET OF ROLES. Every colour below is named for the job it does
— `surface`, `text_muted`, `border` — never for what it looks like. That is what
lets a light and a dark palette be swapped under the same stylesheets without a
single widget knowing which one is active.

DARK IS THE DEFAULT, AND NOT AS A FASHION. This window sits open on a server
machine beside a lobby for the length of an event, often in a dim room, and a
wall of white is a lamp pointed at the person reading it. Light exists for the
real case of setting the machine up under office lighting, so it is an explicit
choice and it is remembered.

The dark palette is the scanner's, sampled from the event artwork and already
contrast-checked against a near-black ground — reusing it means the control
centre looks like part of VMS rather than a tool that wandered in.

STYLESHEETS ARE FUNCTIONS, NOT CONSTANTS. They used to be module-level strings,
which meant they were built once at import against whatever palette happened to
be current and could never change again. Calling them means a theme switch is a
re-render rather than a restart.
"""

from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtGui import QFont
from PySide6.QtWidgets import QLabel

from services import State


@dataclass(frozen=True)
class Palette:
    name: str
    background: str
    surface: str
    surface_raised: str
    border: str
    text: str
    text_muted: str
    text_faint: str
    accent: str
    accent_hover: str
    accent_pressed: str
    on_accent: str
    valid: str
    invalid: str
    amber: str


DARK = Palette(
    name="dark",
    background="#0B1016",
    surface="#141B24",
    surface_raised="#1F2833",
    border="#26313F",
    text="#F4F8FB",
    text_muted="#A8B6C4",
    text_faint="#75838F",
    accent="#3372FF",
    accent_hover="#4A83FF",
    accent_pressed="#1F4FC0",
    on_accent="#FFFFFF",
    valid="#00B050",
    invalid="#F24141",
    amber="#FCB400",
)

#: Light is NOT the dark palette inverted.
#:
#: A straight inversion gives mid-greys that are legible on neither ground, and
#: it turns the state colours into pastels that fail against white. These are
#: chosen against a paper ground: the accent darkens so it holds its contrast on
#: white, and `valid`/`invalid`/`amber` darken with it for the same reason. The
#: amber in particular cannot stay at #FCB400 on white — it drops to roughly
#: 1.9:1 and stops being readable text.
LIGHT = Palette(
    name="light",
    background="#F4F6F9",
    surface="#FFFFFF",
    surface_raised="#EDF1F6",
    border="#D3DCE6",
    text="#101823",
    text_muted="#48586B",
    text_faint="#6C7C8E",
    accent="#1F5AE0",
    accent_hover="#2C6BF5",
    accent_pressed="#17429F",
    on_accent="#FFFFFF",
    valid="#07773A",
    invalid="#C4232B",
    amber="#8A5A00",
)

PALETTES = {"dark": DARK, "light": LIGHT}

_current: Palette = DARK


def current() -> Palette:
    return _current


def set_palette(name: str) -> Palette:
    global _current
    _current = PALETTES.get(name, DARK)
    return _current


def state_colours() -> dict[State, str]:
    """One colour per state.

    READY is the only green: `RUNNING` deliberately is not, because "the process
    exists" and "it can serve a request" are different claims and the UI must
    not blur them.
    """
    p = _current
    return {
        State.STOPPED: p.text_faint,
        State.STARTING: p.amber,
        State.RUNNING: p.amber,
        State.READY: p.valid,
        State.STOPPING: p.amber,
        State.ERROR: p.invalid,
    }


def window_qss() -> str:
    p = _current
    return f"""
QWidget {{
    background: {p.background};
    color: {p.text};
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 13px;
}}
QScrollArea, QScrollArea > QWidget > QWidget {{ background: transparent; }}
QScrollBar:vertical {{
    background: transparent;
    width: 10px;
    margin: 0;
}}
QScrollBar::handle:vertical {{
    background: {p.border};
    border-radius: 5px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{ background: {p.text_faint}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{ background: none; }}
QScrollBar:horizontal {{
    background: transparent;
    height: 10px;
    margin: 0;
}}
QScrollBar::handle:horizontal {{
    background: {p.border};
    border-radius: 5px;
    min-width: 30px;
}}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{ width: 0; }}
QTabWidget::pane {{
    border: 1px solid {p.border};
    border-radius: 10px;
    background: {p.surface};
}}
QTabBar::tab {{
    background: transparent;
    color: {p.text_faint};
    padding: 7px 14px;
    margin-right: 2px;
    border-radius: 7px;
}}
QTabBar::tab:selected {{
    background: {p.surface_raised};
    color: {p.text};
}}
QCheckBox {{ color: {p.text_muted}; }}
QToolTip {{
    background: {p.surface_raised};
    color: {p.text};
    border: 1px solid {p.border};
    padding: 4px 6px;
}}
QMenu {{
    background: {p.surface};
    color: {p.text};
    border: 1px solid {p.border};
    padding: 4px;
}}
QMenu::item {{ padding: 6px 22px 6px 12px; border-radius: 6px; }}
QMenu::item:selected {{ background: {p.surface_raised}; }}
"""


def card_qss() -> str:
    p = _current
    return f"""
QFrame#serviceCard, QFrame#networkCard {{
    background: {p.surface};
    border: 1px solid {p.border};
    border-radius: 12px;
}}
"""


def primary_button_qss() -> str:
    p = _current
    return f"""
QPushButton {{
    background: {p.accent};
    color: {p.on_accent};
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-weight: 600;
}}
QPushButton:hover  {{ background: {p.accent_hover}; }}
QPushButton:pressed{{ background: {p.accent_pressed}; }}
QPushButton:disabled {{ background: {p.surface_raised}; color: {p.text_faint}; }}
"""


def ghost_button_qss() -> str:
    p = _current
    return f"""
QPushButton {{
    background: transparent;
    color: {p.text_muted};
    border: 1px solid {p.border};
    border-radius: 8px;
    padding: 7px 14px;
}}
QPushButton:hover {{ border-color: {p.text_faint}; color: {p.text}; }}
QPushButton:disabled {{ color: {p.text_faint}; border-color: {p.surface_raised}; }}
"""


def danger_button_qss() -> str:
    p = _current
    return f"""
QPushButton {{
    background: transparent;
    color: {p.invalid};
    border: 1px solid {p.invalid};
    border-radius: 8px;
    padding: 7px 14px;
    font-weight: 600;
}}
QPushButton:hover {{ background: rgba(196, 35, 43, 0.12); }}
QPushButton:disabled {{ color: {p.text_faint}; border-color: {p.surface_raised}; }}
"""


def log_qss() -> str:
    p = _current
    return f"""
QPlainTextEdit {{
    background: {p.background};
    color: {p.text_muted};
    border: none;
    padding: 10px;
    font-family: "Cascadia Mono", "Consolas", monospace;
    font-size: 12px;
}}
"""


def progress_qss() -> str:
    """A thin indeterminate bar. No text: the state word above already says it."""
    p = _current
    return f"""
QProgressBar {{
    background: {p.surface_raised};
    border: none;
    border-radius: 2px;
    max-height: 4px;
    min-height: 4px;
}}
QProgressBar::chunk {{ background: {p.accent}; border-radius: 2px; }}
"""


# ------------------------------------------------------------------ labels --
#
# These carry a role so a theme switch can find them again. Setting a stylesheet
# at construction was fine while there was one palette; with two, a label that
# has forgotten which role it plays cannot be recoloured.


def _roled(text: str, role: str) -> QLabel:
    label = QLabel(text)
    label.setProperty("role", role)
    return label


def title(text: str) -> QLabel:
    label = _roled(text, "title")
    font = label.font()
    font.setPointSize(11)
    font.setWeight(QFont.Weight.DemiBold)
    label.setFont(font)
    return label


def subtle(text: str) -> QLabel:
    return _roled(text, "subtle")


def muted(text: str) -> QLabel:
    return _roled(text, "muted")


def restyle_labels(root) -> None:
    """Recolour every roled label under `root` for the current palette."""
    p = _current
    colours = {"title": p.text, "subtle": p.text_faint, "muted": p.text_muted}
    for label in root.findChildren(QLabel):
        role = label.property("role")
        if role in colours:
            label.setStyleSheet(f"color: {colours[role]};")
