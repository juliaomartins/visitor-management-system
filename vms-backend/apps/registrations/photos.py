"""Server-side checks on a photo uploaded by the public.

INDEPENDENT OF THE BROWSER. The public form downscales and face-checks before it
uploads, but the endpoint is reachable without the form, so nothing the browser
did is trusted here. Every photo is decoded and RE-ENCODED: what is stored is a
JPEG this server wrote, not the bytes that arrived.

Re-encoding is the point, not a size optimisation. It drops EXIF (a phone photo's
GPS position among it), ICC profiles, comments and anything appended after the
image data -- a polyglot file that is a valid JPEG and also something else stops
being the something else.

The limits, and why:

    MAX_UPLOAD_BYTES   5 MB     a phone camera original is 2-4 MB; the form sends
                                ~200 KB after downscaling, so 5 MB only matters
                                when the browser's downscale did not run
    MAX_SIDE           8000 px  larger than any phone sensor in use
    MAX_PIXELS         40 MP    checked from the header BEFORE decoding, so a
                                small file that decodes to a huge bitmap (a
                                decompression bomb) is refused without being
                                decoded
    MIN_SIDE           225 px   19 mm at 300 dpi -- the print floor the badge
                                cropper already enforces (CLAUDE.md)
    formats            JPEG, PNG, WebP, read from the file itself; one frame only

THE DECLARED CONTENT TYPE IS NOT WHAT THE CLIENT SENT by the time this runs.
DRF's `ImageField` validates through Django's, whose `to_python` overwrites
`upload.content_type` with the MIME type Pillow detects from the bytes. So the
content-type check below is a check on the real format -- a PNG sent as
`application/octet-stream` passes, and a text file sent as `image/jpeg` never
reaches here at all. It is kept for any caller that hands in an upload directly.
    output             JPEG q88, long side <= 1200 px, sRGB, no metadata
"""

import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_SIDE = 8000
MAX_PIXELS = 40_000_000
MIN_SIDE = 225
OUTPUT_LONG_SIDE = 1200
OUTPUT_QUALITY = 88


class PhotoRejected(ValueError):
    """The upload is not a photo this endpoint will store. The message is shown."""


def sanitise_photo(upload) -> ContentFile:
    """Validate an uploaded photo and return a freshly encoded JPEG of it."""
    if upload.size > MAX_UPLOAD_BYTES:
        raise PhotoRejected("The photo is larger than 5 MB.")

    declared = (getattr(upload, "content_type", "") or "").lower()
    if declared not in ALLOWED_FORMATS.values():
        raise PhotoRejected("The photo must be a JPEG, PNG or WebP image.")

    # Header only: `Image.open` is lazy, so size and format are known before a
    # single pixel is decoded.
    upload.seek(0)
    try:
        with Image.open(upload) as probe:
            actual = probe.format
            width, height = probe.size
            frames = getattr(probe, "n_frames", 1)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise PhotoRejected("The file is not a readable image.") from error

    if actual not in ALLOWED_FORMATS:
        raise PhotoRejected("The photo must be a JPEG, PNG or WebP image.")
    if width > MAX_SIDE or height > MAX_SIDE or width * height > MAX_PIXELS:
        raise PhotoRejected("The photo's dimensions are too large.")
    if frames > 1:
        raise PhotoRejected("Animated images are not accepted.")
    if min(width, height) < MIN_SIDE:
        raise PhotoRejected(
            f"The photo is too small to print; it needs at least {MIN_SIDE} px on each side."
        )

    upload.seek(0)
    try:
        with Image.open(upload) as source:
            source.load()
            image = ImageOps.exif_transpose(source)
            image = _flatten(image)
            image.thumbnail((OUTPUT_LONG_SIDE, OUTPUT_LONG_SIDE), Image.LANCZOS)

            buffer = io.BytesIO()
            # No `exif=` and no `icc_profile=`: neither is carried over.
            image.save(buffer, format="JPEG", quality=OUTPUT_QUALITY, optimize=True)
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise PhotoRejected("The file is not a readable image.") from error

    return ContentFile(buffer.getvalue(), name="photo.jpg")


def _flatten(image: Image.Image) -> Image.Image:
    """RGB on white. Transparency would otherwise turn black in a JPEG."""
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        ground = Image.new("RGB", rgba.size, (255, 255, 255))
        ground.paste(rgba, mask=rgba.getchannel("A"))
        return ground
    return image.convert("RGB")
