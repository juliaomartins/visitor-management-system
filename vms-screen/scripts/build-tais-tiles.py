"""
Build the tais wave tiles the lobby screen actually loads.

    ..\\..\\.venv\\Scripts\\python.exe scripts/build-tais-tiles.py

    art/tais-wave-{1,2}.svg   ->   public/brand/tais-wave-{1,2}.webp

THE SOURCES ARE NOT SERVABLE AS THEY ARE. Each supplied `.svg` is a 1983x793
PNG carried inside an `<image href="data:image/png;base64,...">` wrapper --
2.7MB and 2.4MB, base64, which is a third larger than the bytes it encodes and
cannot be decoded progressively. Five megabytes in front of the first paint of
a wall panel is the whole of the reason this script exists. They live in `art/`
rather than `public/` so Next never copies them into the build.

THE OUTPUT IS A MIRRORED TILE, AND THAT IS THE POINT OF THE SCRIPT.

The artwork is 2.5:1. The band it has to fill along the foot of a 1920x1080
wall is nearer 7:1, so one copy cannot span the screen without either a 3x
horizontal stretch -- which flattens the diamonds of a real weave into lozenges
-- or repeating. Repeating the frame as-is puts its left edge (cloth at y=90)
against its right edge (cloth at y=207) and the crest jumps 117px at every
join.

So each tile is the frame followed by its own mirror image. The last column of
the mirror is the first column of the frame, so the tile repeats against itself
with no discontinuity at all, and the seam inside it is a fold rather than a
tear. A cross-faded seam was tried first and is worse: overlapping a weave with
its own reflection smears both into a double exposure. The mirror is also the
honest choice for the subject -- tais motifs are symmetric.

The one visible consequence is that the crest meets itself at a peak on every
seam. On the wall that reads as a fold in draped cloth, which is what it is.

Both tiles keep the full 1983x793 frame, transparent rows included, so the two
layers share ONE aspect ratio and `components/TaisWave.tsx` can hold a single
constant instead of one per file. WebP costs nothing for empty rows.
"""

from __future__ import annotations

import base64
import re
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parent / "art"
OUT = HERE.parent / "public" / "brand"

# Lossy with a lossless alpha channel. The weave is photographic and survives
# quality 78 at any size this is ever drawn; the alpha is the wave's silhouette
# and every artefact in it lands on the crest, which is the one edge the eye is
# actually following.
QUALITY = 78
ALPHA_QUALITY = 100

_DATA_URI = re.compile(r'href="data:image/png;base64,([^"]+)"')


def extract(svg: Path) -> Image.Image:
    """The PNG out of the wrapper. There is exactly one per file."""
    match = _DATA_URI.search(svg.read_text(encoding="utf-8"))
    if not match:
        raise SystemExit(f"{svg.name}: no embedded PNG -- was it re-exported?")
    import io

    return Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert("RGBA")


def bleed(image: Image.Image) -> Image.Image:
    """
    Push the cloth's colour outward under its own transparent edge.

    A browser scaling this tile samples RGB from pixels whose alpha is zero. If
    those carry black -- and an exported PNG generally does -- every crest picks
    up a dark fringe that looks like a printing error at five metres and is
    invisible at 100%. Two dilation passes are enough: nothing samples further
    than a pixel or two out.
    """
    from PIL import ImageFilter

    rgb, alpha = image.convert("RGB"), image.getchannel("A")
    for _ in range(2):
        grown = rgb.filter(ImageFilter.MaxFilter(3))
        rgb = Image.composite(rgb, grown, alpha.point(lambda v: 255 if v > 8 else 0))
    return Image.merge("RGBA", (*rgb.split(), alpha))


def tile(image: Image.Image) -> Image.Image:
    """frame + its mirror, so the result repeats against itself seamlessly."""
    out = Image.new("RGBA", (image.width * 2, image.height), (0, 0, 0, 0))
    out.paste(image, (0, 0))
    out.paste(image.transpose(Image.FLIP_LEFT_RIGHT), (image.width, 0))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for index in (1, 2):
        source = ART / f"tais-wave-{index}.svg"
        target = OUT / f"tais-wave-{index}.webp"

        built = tile(bleed(extract(source)))
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
            f"{source.stat().st_size / 1024:.0f}KB -> {target.stat().st_size / 1024:.0f}KB"
        )
        print(f"    aspect {built.width}/{built.height} = {built.width / built.height:.4f}")


if __name__ == "__main__":
    main()
