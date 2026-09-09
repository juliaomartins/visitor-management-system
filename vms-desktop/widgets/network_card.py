"""The LAN address, and the URLs that follow from it.

This card exists because the single most common LAN failure is invisible: a
phone told `localhost` reaches itself, and the error it shows says nothing
about that. Putting the real address on screen, with the URLs spelled out, lets
somebody read one to a colleague or type it into a phone without guessing.
"""

from __future__ import annotations

from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtWidgets import (
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
)

from config import service_urls
from i18n import t
from network import is_lan_address
from widgets import icons, theme
from widgets.theme import subtle, title


#: Below this the longest URL (the ws:// one) no longer fits beside its label.
STACK_BELOW = 470


class NetworkCard(QFrame):
    refresh_requested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("networkCard")
        self._lan_ip = ""
        self._stacked: bool | None = None
        self._urls: list[tuple[str, str]] = []
        # URL labels are rebuilt on every address change, so they are kept here
        # for the theme switch to find rather than re-derived from the layout.
        self._url_labels: list[tuple[QLabel, QLabel]] = []

        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 10, 16, 12)
        outer.setSpacing(4)

        header = QHBoxLayout()
        self._title = title("")
        header.addWidget(self._title)
        header.addStretch(1)

        # DHCP moves the server. CLAUDE.md records this happening once already,
        # so the address is re-readable rather than read once at launch.
        self._refresh = QPushButton()
        self._refresh.clicked.connect(self.refresh_requested)
        header.addWidget(self._refresh)
        outer.addLayout(header)

        self._ip = QLabel()
        self._ip.setTextFormat(Qt.TextFormat.RichText)
        self._ip.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        outer.addWidget(self._ip)

        self._warning = subtle("")
        self._warning.setWordWrap(True)
        outer.addWidget(self._warning)

        self._grid = QGridLayout()
        self._grid.setHorizontalSpacing(14)
        self._grid.setVerticalSpacing(3)
        # The label column keeps its natural width; the URL column takes
        # whatever is left. Without this the grid divides the width evenly and
        # a long URL is clipped on a narrow screen while the labels sit in
        # space they do not need.
        self._grid.setColumnStretch(0, 0)
        self._grid.setColumnStretch(1, 1)
        outer.addLayout(self._grid)

        # THE FIREWALL NOTE IS ADVICE, NOT STATE, so it is written to the
        # application log once at startup rather than given forty permanent
        # pixels here. On a 1280x720 laptop those pixels are the difference
        # between seeing the log viewer and not.

    def retranslate(self) -> None:
        self._title.setText(t("net.title"))
        self._refresh.setText(t("net.refresh"))
        self._refresh.setToolTip(t("net.refreshTip"))
        if self._lan_ip:
            self.set_address(self._lan_ip)

    def restyle(self) -> None:
        self.setStyleSheet(theme.card_qss())
        self._refresh.setStyleSheet(theme.ghost_button_qss())
        self._refresh.setIcon(icons.refresh(theme.current().text_muted))
        self._refresh.setIconSize(QSize(16, 16))
        theme.restyle_labels(self)
        if self._lan_ip:
            self.set_address(self._lan_ip)

    def set_address(self, lan_ip: str) -> None:
        self._lan_ip = lan_ip
        p = theme.current()
        self._ip.setText(
            f'<span style="color:{p.text_faint};">{t("net.lanIp")}</span>'
            f'&nbsp;&nbsp;'
            f'<span style="color:{p.text}; font-size:20px; font-weight:600;'
            f' font-family:Consolas,monospace;">{lan_ip}</span>'
        )

        if is_lan_address(lan_ip):
            self._warning.setText("")
            self._warning.hide()
        else:
            self._warning.show()
            self._warning.setStyleSheet(f"color: {p.amber};")
            self._warning.setText(t("net.noLan"))

        while self._grid.count():
            item = self._grid.takeAt(0)
            if item.widget() is not None:
                item.widget().deleteLater()

        self._url_labels.clear()
        self._urls = service_urls(lan_ip)
        for row, (key, url) in enumerate(self._urls):
            name = QLabel(t(key))
            name.setStyleSheet(f"color: {p.text_faint};")
            value = QLabel(url)
            value.setStyleSheet(
                f"color: {p.text}; font-family: Consolas, monospace;"
            )
            value.setTextInteractionFlags(
                Qt.TextInteractionFlag.TextSelectableByMouse
            )
            self._url_labels.append((name, value))
        self._stacked = None
        self._lay_out_urls(stacked=self.width() < STACK_BELOW)

    def _lay_out_urls(self, *, stacked: bool) -> None:
        """Label beside the URL, or above it when there is no room for both.

        A NARROW CARD MUST NOT CLIP THE ADDRESS. Reading the address aloud, or
        typing it into a phone, is the entire reason this card exists -- an
        elided "http://10.101.196.41:800..." is worse than useless, because it
        looks like an address. Below the threshold the label moves above and the
        URL gets the full width instead.
        """
        if stacked == self._stacked:
            return
        self._stacked = stacked

        for name, value in self._url_labels:
            self._grid.removeWidget(name)
            self._grid.removeWidget(value)

        for index, (name, value) in enumerate(self._url_labels):
            if stacked:
                name.setAlignment(Qt.AlignmentFlag.AlignLeft)
                self._grid.addWidget(name, index * 2, 0, 1, 2)
                self._grid.addWidget(value, index * 2 + 1, 0, 1, 2)
            else:
                name.setAlignment(
                    Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
                )
                self._grid.addWidget(name, index, 0)
                self._grid.addWidget(value, index, 1)

    def resizeEvent(self, event):  # noqa: N802  (Qt naming)
        super().resizeEvent(event)
        if self._url_labels:
            self._lay_out_urls(stacked=event.size().width() < STACK_BELOW)
