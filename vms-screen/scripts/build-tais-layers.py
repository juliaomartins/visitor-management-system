r"""
Build the two tais layers the lobby screen actually loads.

    ..\..\.venv\Scripts\python.exe scripts/build-tais-layers.py

    art/tais.png            ->   public/brand/tais-drape.webp
    art/tais-wave-2.svg     ->   public/brand/tais-ribbon.webp

THE SOURCES ARE NOT SERVABLE AS THEY ARE. `art/tais.png` is 2MB of RGBA PNG,
and `tais-wave-2.svg` is worse -- a 1983x793 PNG carried inside an
`<image href="data:image/png;base64,...">` wrapper, so 2.4MB encoding 1.8MB,
undecodable progressively. Five megabytes in front of the first paint of a wall
panel is the whole of the reason this script exists. Both live in `art/` rather
than `public/` so Next never copies them into the build.

`art/tais.png` IS THE REFERENCE PHOTOGRAPH, and it is the drape exactly as
supplied: three pieces of handwoven cloth, each with its piped and stitched
red hem, sagging together into one broad curve. It is byte-identical to the PNG
embedded in `art/tais-wave-1.svg`, which is left in place as the original
delivery but is no longer read by anything.

THERE IS NO MIRRORING HERE ANY MORE, AND THAT IS THE POINT OF THIS REWRITE.

The previous script emitted `frame + its own mirror` so the result could tile
across the foot of the screen. It tiled honestly -- the seam really was
invisible -- but the band it tiled into was 213px tall at 1080p, which put
3.6 copies of the wave across a 1920 panel and turned one broad sag into a row
of repeating chevrons. The artwork is a photograph of a single draped cloth;
repeating it is the one thing guaranteed to stop it reading as one.

So each layer is now emitted once, at its native 1983x793, and
`components/TaisWave.tsx` draws exactly one copy of each across the viewport.
The horizontal stretch that costs is real and it is bounded -- see the note on
`--tais-band` in `app/globals.css`, which sizes the band precisely to hold it
near 1.66x on every 16:9 panel.
"""

from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ART = HERE.parent / "art"
OUT = HERE.parent / "public" / "brand"

# Lossy with a lossless alpha channel. The weave is photographic and survives
# quality 82 at any size this is ever drawn; the alpha is the cloth's silhouette
# and every artefact in it lands on the hem, which is the one edge the eye is
# actually following. 82 rather than the old 78 because a single copy is now
# stretched across the whole panel instead of tiled at a fifth the size, so each
# source pixel covers roughly four times the wall.
QUALITY = 82
ALPHA_QUALITY = 100

_DATA_URI = re.compile(r'href="data:image/png;base64,([^"]+)"')


def load(source: Path) -> Image.Image:
    """The artwork, whether it arrived as a PNG or wrapped in an SVG."""
    if source.suffix == ".png":
        return Image.open(source).convert("RGBA")

    match = _DATA_URI.search(source.read_text(encoding="utf-8"))
    if not match:
        raise SystemExit(f"{source.name}: no embedded PNG -- was it re-exported?")
    return Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert("RGBA")


def bleed(image: Image.Image) -> Image.Image:
    """
    Push the cloth's colour outward under its own transparent edge.

    A browser scaling this layer samples RGB from pixels whose alpha is zero. If
    those carry black -- and an exported PNG generally does -- every hem picks
    up a dark fringe that looks like a printing error at five metres and is
    invisible at 100%. It matters more now than it did when this was a tile:
    the drape is stretched to roughly 1.66x its own width, so the sampler
    reaches further outside the silhouette than it used to.

    Three dilation passes rather than two, for that reason.
    """
    rgb, alpha = image.convert("RGB"), image.getchannel("A")
    solid = alpha.point(lambda v: 255 if v > 8 else 0)
    for _ in range(3):
        grown = rgb.filter(ImageFilter.MaxFilter(3))
        rgb = Image.composite(rgb, grown, solid)
    return Image.merge("RGBA", (*rgb.split(), alpha))


LAYERS = (("tais.png", "tais-drape.webp"), ("tais-wave-2.svg", "tais-ribbon.webp"))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for source_name, target_name in LAYERS:
        source, target = ART / source_name, OUT / target_name

        built = bleed(load(source))
        built.save(
            target,
            format="webp",
            quality=QUALITY,
            alpha_quality=ALPHA_QUALITY,
            method=6,
        )

        print(
            f"{source.name} -> {target.name}  "
            f"{built.width}x{built.height}  "
            f"{source.stat().st_size / 1024:.0f}KB -> {target.stat().st_size / 1024:.0f}KB  "
            f"aspect {built.width / built.height:.4f}"
        )


if __name__ == "__main__":
    main()
