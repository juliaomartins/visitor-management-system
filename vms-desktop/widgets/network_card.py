"""The LAN address, and the URLs that follow from it.

This card exists because the single most common LAN failure is invisible: a
phone told `localhost` reaches itself, and the error it shows says nothing
about that. Putting the real address on screen, with the URLs spelled out, lets
somebody read one to a colleague or type it into a phone without guessing.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
)

from config import service_urls
from network import is_lan_address
from widgets.theme import (
    AMBER,
    CARD_QSS,
    GHOST_BUTTON_QSS,
    TEXT,
    TEXT_FAINT,
    subtle,
    title,
)


class NetworkCard(QFrame):
    refresh_requested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("networkCard")
        self.setStyleSheet(CARD_QSS)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 14, 16, 14)
        outer.setSpacing(6)

        header = QHBoxLayout()
        header.addWidget(title("Network"))
        header.addStretch(1)

        refresh = QPushButton("Refresh")
        refresh.setStyleSheet(GHOST_BUTTON_QSS)
        # DHCP moves the server. CLAUDE.md records this happening once already,
        # so the address is re-readable rather than read once at launch.
        refresh.setToolTip("Re-detect the LAN address (it changes with DHCP)")
        refresh.clicked.connect(self.refresh_requested)
        header.addWidget(refresh)
        outer.addLayout(header)

        self._ip = QLabel()
        self._ip.setTextFormat(Qt.TextFormat.RichText)
        self._ip.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        outer.addWidget(self._ip)

        self._warning = subtle("")
        self._warning.setWordWrap(True)
        outer.addWidget(self._warning)

        outer.addSpacing(6)

        self._grid = QGridLayout()
        self._grid.setHorizontalSpacing(14)
        self._grid.setVerticalSpacing(3)
        outer.addLayout(self._grid)

        outer.addSpacing(8)
        firewall = subtle(
            "LAN access needs Windows Firewall to permit ports 8000, 3000 and "
            "3001. No firewall rule is changed automatically."
        )
        firewall.setWordWrap(True)
        outer.addWidget(firewall)

    def set_address(self, lan_ip: str) -> None:
        self._ip.setText(
            f'<span style="color:{TEXT_FAINT};">LAN IP</span>&nbsp;&nbsp;'
            f'<span style="color:{TEXT}; font-size:20px; font-weight:600;'
            f' font-family:Consolas,monospace;">{lan_ip}</span>'
        )

        if is_lan_address(lan_ip):
            self._warning.setText("")
            self._warning.hide()
        else:
            self._warning.show()
            self._warning.setStyleSheet(f"color: {AMBER};")
            self._warning.setText(
                "No LAN address found. Everything will work on this machine, "
                "but phones and the lobby screen will not be able to reach it."
            )

        while self._grid.count():
            item = self._grid.takeAt(0)
            if item.widget() is not None:
                item.widget().deleteLater()

        for row, (label, url) in enumerate(service_urls(lan_ip)):
            name = QLabel(label)
            name.setStyleSheet(f"color: {TEXT_FAINT};")
            value = QLabel(url)
            value.setStyleSheet(f"color: {TEXT}; font-family: Consolas, monospace;")
            value.setTextInteractionFlags(
                Qt.TextInteractionFlag.TextSelectableByMouse
            )
            self._grid.addWidget(name, row, 0, Qt.AlignmentFlag.AlignRight)
            self._grid.addWidget(value, row, 1)
