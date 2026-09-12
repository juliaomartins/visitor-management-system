"""The icon set, drawn rather than installed.

SAME CALL THE DASHBOARD MADE. `components/sidebar.tsx` and
`components/visitors/RowContextMenu.tsx` draw their glyphs inline instead of
pulling an icon package, because a dependency for a dozen shapes is a
dependency to install on a machine that is offline by event day. These follow
the same conventions — a 24-unit box, no fill unless the shape means "solid",
a 1.7 stroke in the caller's colour, round caps — so a button here and a nav
item in the dashboard look like siblings.

PAINTED, NOT SVG FILES, for two reasons that matter more than taste:

* They take a colour. A QIcon loaded from a file is a fixed set of pixels, so a
  theme switch would need a second copy of every file and a lookup to choose
  between them. These are redrawn from the live palette instead, which is why
  `restyle()` can simply ask for them again.

* They are drawn at the device pixel ratio. This machine runs at 1.5, and a
  16px bitmap scaled up to 24 physical pixels is visibly soft next to crisp
  text. Painting into a pixmap that already knows its ratio keeps the strokes
  sharp at any scaling.
"""

from __future__ import annotations

from PySide6.QtCore import QPointF, QRectF, Qt
from PySide6.QtGui import (
    QColor,
    QGuiApplication,
    QIcon,
    QPainter,
    QPainterPath,
    QPen,
    QPixmap,
)

#: Everything below is drawn in this coordinate space and scaled at the end.
BOX = 24.0

STROKE = 1.7


def screen_ratio() -> float:
    """The display's pixel ratio, or 1.0 before there is a screen to ask.

    Read per icon rather than cached: a window dragged to a second monitor with
    different scaling gets redrawn icons on its next restyle, and a cached value
    from start-up would keep it soft for the rest of the session.
    """
    screen = QGuiApplication.primaryScreen()
    return float(screen.devicePixelRatio()) if screen is not None else 1.0


def _icon(draw, colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Run `draw(painter)` in a 24-unit box and hand back an icon."""
    if ratio is None:
        ratio = screen_ratio()
    pixels = max(1, int(round(size * ratio)))

    pixmap = QPixmap(pixels, pixels)
    pixmap.setDevicePixelRatio(ratio)
    pixmap.fill(Qt.GlobalColor.transparent)

    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    # SCALE BY THE LOGICAL SIZE, NOT THE PIXEL COUNT.
    #
    # A QPainter on a pixmap that carries a device pixel ratio already works in
    # logical coordinates -- Qt has applied the ratio itself. Scaling by the
    # physical pixel count on top of that multiplies the two, so at 1.5 the
    # 24-unit box was drawn 1.69x too large and every icon came out as its own
    # top-left corner. It looked like a cropping bug and was an arithmetic one.
    painter.scale(size / BOX, size / BOX)

    pen = QPen(QColor(colour))
    pen.setWidthF(STROKE)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    painter.setPen(pen)
    painter.setBrush(Qt.BrushStyle.NoBrush)

    draw(painter, QColor(colour))
    painter.end()

    return QIcon(pixmap)


# --------------------------------------------------------------- controls --


def play(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Start. SOLID, because it is the button being reached for."""

    def draw(p: QPainter, c: QColor) -> None:
        path = QPainterPath()
        path.moveTo(8.5, 5.6)
        path.lineTo(18.4, 12.0)
        path.lineTo(8.5, 18.4)
        path.closeSubpath()
        p.setPen(Qt.PenStyle.NoPen)
        p.fillPath(path, c)

    return _icon(draw, colour, size, ratio)


def stop(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Stop. Solid too: the pair reads as one control with two states."""

    def draw(p: QPainter, c: QColor) -> None:
        path = QPainterPath()
        path.addRoundedRect(QRectF(7.0, 7.0, 10.0, 10.0), 1.6, 1.6)
        p.setPen(Qt.PenStyle.NoPen)
        p.fillPath(path, c)

    return _icon(draw, colour, size, ratio)


def external(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Open in a browser. The arrow leaves the box, which is the whole idea."""

    def draw(p: QPainter, _c: QColor) -> None:
        path = QPainterPath()
        # Three sides plus a gap where the arrow crosses out.
        path.moveTo(14.0, 5.2)
        path.lineTo(6.0, 5.2)
        path.lineTo(6.0, 18.4)
        path.lineTo(18.8, 18.4)
        path.lineTo(18.8, 11.0)
        p.drawPath(path)

        arrow = QPainterPath()
        arrow.moveTo(11.4, 13.0)
        arrow.lineTo(19.2, 5.2)
        p.drawPath(arrow)

        head = QPainterPath()
        head.moveTo(13.6, 5.2)
        head.lineTo(19.2, 5.2)
        head.lineTo(19.2, 10.8)
        p.drawPath(head)

    return _icon(draw, colour, size, ratio)


def refresh(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Re-detect. An arc with a head, not a full ring: a closed circle reads
    as "loading" and this is a thing you press."""

    def draw(p: QPainter, _c: QColor) -> None:
        arc = QPainterPath()
        arc.arcMoveTo(QRectF(4.6, 4.6, 14.8, 14.8), 60.0)
        arc.arcTo(QRectF(4.6, 4.6, 14.8, 14.8), 60.0, 280.0)
        p.drawPath(arc)

        head = QPainterPath()
        head.moveTo(12.6, 3.0)
        head.lineTo(16.6, 6.3)
        head.lineTo(12.4, 8.6)
        p.drawPath(head)

    return _icon(draw, colour, size, ratio)


def copy(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, _c: QColor) -> None:
        back = QPainterPath()
        back.addRoundedRect(QRectF(4.6, 4.6, 11.0, 13.0), 2.2, 2.2)
        p.drawPath(back)

        front = QPainterPath()
        front.addRoundedRect(QRectF(8.4, 8.4, 11.0, 11.0), 2.2, 2.2)
        p.drawPath(front)

    return _icon(draw, colour, size, ratio)


def trash(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, _c: QColor) -> None:
        path = QPainterPath()
        path.moveTo(4.6, 6.6)
        path.lineTo(19.4, 6.6)
        p.drawPath(path)

        lid = QPainterPath()
        lid.moveTo(9.6, 6.6)
        lid.lineTo(9.6, 4.9)
        lid.lineTo(14.4, 4.9)
        lid.lineTo(14.4, 6.6)
        p.drawPath(lid)

        body = QPainterPath()
        body.moveTo(6.6, 6.6)
        body.lineTo(7.5, 19.2)
        body.lineTo(16.5, 19.2)
        body.lineTo(17.4, 6.6)
        p.drawPath(body)

    return _icon(draw, colour, size, ratio)


# ------------------------------------------------------------ preferences --


def sun(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, _c: QColor) -> None:
        core = QPainterPath()
        core.addEllipse(QPointF(12.0, 12.0), 4.0, 4.0)
        p.drawPath(core)

        rays = QPainterPath()
        for x1, y1, x2, y2 in (
            (12.0, 2.6, 12.0, 4.6),
            (12.0, 19.4, 12.0, 21.4),
            (2.6, 12.0, 4.6, 12.0),
            (19.4, 12.0, 21.4, 12.0),
            (5.6, 5.6, 7.0, 7.0),
            (17.0, 17.0, 18.4, 18.4),
            (18.4, 5.6, 17.0, 7.0),
            (7.0, 17.0, 5.6, 18.4),
        ):
            rays.moveTo(x1, y1)
            rays.lineTo(x2, y2)
        p.drawPath(rays)

    return _icon(draw, colour, size, ratio)


def moon(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, _c: QColor) -> None:
        path = QPainterPath()
        path.moveTo(19.4, 14.9)
        path.cubicTo(17.6, 15.6, 15.5, 15.3, 13.9, 14.0)
        path.cubicTo(11.6, 12.2, 11.2, 8.9, 12.9, 6.6)
        path.cubicTo(8.6, 6.9, 5.4, 10.6, 5.9, 14.9)
        path.cubicTo(6.4, 19.1, 10.2, 22.1, 14.4, 21.6)
        path.cubicTo(16.8, 21.3, 18.8, 19.8, 19.9, 17.8)
        p.drawPath(path)

    return _icon(draw, colour, size, ratio)


def globe(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, _c: QColor) -> None:
        ring = QPainterPath()
        ring.addEllipse(QPointF(12.0, 12.0), 8.2, 8.2)
        p.drawPath(ring)

        equator = QPainterPath()
        equator.moveTo(3.8, 12.0)
        equator.lineTo(20.2, 12.0)
        p.drawPath(equator)

        meridian = QPainterPath()
        meridian.moveTo(12.0, 3.8)
        meridian.cubicTo(16.4, 8.2, 16.4, 15.8, 12.0, 20.2)
        meridian.cubicTo(7.6, 15.8, 7.6, 8.2, 12.0, 3.8)
        p.drawPath(meridian)

    return _icon(draw, colour, size, ratio)


# ------------------------------------------------------------------ mode --
#
# SOURCE OR ARTIFACT, which is what the two modes actually are here. Development
# runs `next dev`, which compiles source as it serves; production runs
# `next start`, which serves a bundle `npm run build` already made. Angle
# brackets and a sealed carton say that. A rocket and a wrench -- the pair these
# always become -- would say "live" and "tinkering", which is a mood rather than
# a mechanism, and would not tell anybody that production needs a build first.


def code(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Development: source, compiled as it is served.

    Two chevrons and no slash between them. The slash is the third stroke in a
    16px box and it is the one that closes up first -- at this size the mark
    reads as a solid blob with it and as brackets without it.
    """

    def draw(p: QPainter, _c: QColor) -> None:
        left = QPainterPath()
        left.moveTo(9.4, 7.0)
        left.lineTo(4.4, 12.0)
        left.lineTo(9.4, 17.0)
        p.drawPath(left)

        right = QPainterPath()
        right.moveTo(14.6, 7.0)
        right.lineTo(19.6, 12.0)
        right.lineTo(14.6, 17.0)
        p.drawPath(right)

    return _icon(draw, colour, size, ratio)


def package(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    """Production: a built bundle, sealed and served as it is.

    ISOMETRIC, AND THE FLAT VERSION WAS WRONG. This was first drawn as a carton
    seen face on -- a rounded rectangle with a lid seam -- on the reasoning that
    an isometric cube at 16px would collapse into three near-parallel lines.
    Rendered side by side with the rest of the set, that is not what happened:
    the flat carton was nearly indistinguishable from `browser`, which sits on
    the Dashboard card two inches away, so one silhouette carried two meanings.
    The cube collides with nothing here and keeps its shape at 16.

    Hexagon silhouette, a Y join for the three visible faces.
    """

    def draw(p: QPainter, _c: QColor) -> None:
        hexagon = QPainterPath()
        hexagon.moveTo(12.0, 3.4)
        hexagon.lineTo(20.0, 7.9)
        hexagon.lineTo(20.0, 16.1)
        hexagon.lineTo(12.0, 20.6)
        hexagon.lineTo(4.0, 16.1)
        hexagon.lineTo(4.0, 7.9)
        hexagon.closeSubpath()
        p.drawPath(hexagon)

        top = QPainterPath()
        top.moveTo(4.0, 7.9)
        top.lineTo(12.0, 12.4)
        top.lineTo(20.0, 7.9)
        p.drawPath(top)

        spine = QPainterPath()
        spine.moveTo(12.0, 12.4)
        spine.lineTo(12.0, 20.6)
        p.drawPath(spine)

    return _icon(draw, colour, size, ratio)


# --------------------------------------------------------------- services --
#
# One mark per service, so a card is recognisable before the name is read. They
# are deliberately literal — a rack, a browser window, a wall display, a phone —
# because this is a panel somebody glances at, not a place to be clever.


def server(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, c: QColor) -> None:
        for top in (4.8, 13.0):
            unit = QPainterPath()
            unit.addRoundedRect(QRectF(3.6, top, 16.8, 6.2), 1.8, 1.8)
            p.drawPath(unit)

            lamp = QPainterPath()
            lamp.addEllipse(QPointF(7.2, top + 3.1), 1.05, 1.05)
            p.fillPath(lamp, c)

    return _icon(draw, colour, size, ratio)


def browser(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, c: QColor) -> None:
        frame = QPainterPath()
        frame.addRoundedRect(QRectF(3.4, 4.6, 17.2, 14.8), 2.4, 2.4)
        p.drawPath(frame)

        bar = QPainterPath()
        bar.moveTo(3.4, 9.2)
        bar.lineTo(20.6, 9.2)
        p.drawPath(bar)

        for x in (6.4, 9.0):
            dot = QPainterPath()
            dot.addEllipse(QPointF(x, 6.9), 0.85, 0.85)
            p.fillPath(dot, c)

    return _icon(draw, colour, size, ratio)


def monitor(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, _c: QColor) -> None:
        panel = QPainterPath()
        panel.addRoundedRect(QRectF(2.8, 4.6, 18.4, 11.6), 2.2, 2.2)
        p.drawPath(panel)

        stand = QPainterPath()
        stand.moveTo(12.0, 16.2)
        stand.lineTo(12.0, 19.2)
        stand.moveTo(8.2, 19.4)
        stand.lineTo(15.8, 19.4)
        p.drawPath(stand)

    return _icon(draw, colour, size, ratio)


def phone(colour: str, size: int = 16, ratio: float | None = None) -> QIcon:
    def draw(p: QPainter, c: QColor) -> None:
        body = QPainterPath()
        body.addRoundedRect(QRectF(7.0, 3.2, 10.0, 17.6), 2.4, 2.4)
        p.drawPath(body)

        button = QPainterPath()
        button.addEllipse(QPointF(12.0, 17.9), 0.9, 0.9)
        p.fillPath(button, c)

    return _icon(draw, colour, size, ratio)


#: Which mark belongs to which service. Unknown keys get no icon rather than a
#: wrong one -- a card with a blank where the mark goes is honest; a card
#: wearing the server's rack because it happened to be first is not.
SERVICE_ICONS = {
    "backend": server,
    "dashboard": browser,
    "screen": monitor,
    "scanner": phone,
}


def for_service(key: str):
    return SERVICE_ICONS.get(key)
