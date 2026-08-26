"""Seed a demo event: one admin, two devices, five visitors.

    python manage.py seed_demo

Everything this prints is unrecoverable. Device tokens and badge tokens are
stored only as SHA-256 digests (CLAUDE.md constraint #3), so this output is the
single copy — the same reason the badge PDF has to be generated at creation time.
Copy it somewhere before closing the terminal, or run the command again and get a
fresh set.

Devices are created through the real pairing flow rather than by inserting rows,
so a seeded device is indistinguishable from one an admin paired by hand.
"""

import io

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image, ImageDraw, ImageFont

from apps.devices import services as device_services
from apps.devices.models import DeviceKind
from apps.visitors import services as visitor_services
from apps.visitors.models import VisitorCategory

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin12345!"
ADMIN_EMAIL = "admin@example.invalid"

# Portrait, roughly the aspect the card templates will want in phase 5.
PHOTO_SIZE = (600, 800)

DEMO_VISITORS = [
    ("Ada Lovelace", "England", "Analytical Engine Co.", VisitorCategory.VIP, "#7c3aed"),
    ("Grace Hopper", "USA", "US Navy", VisitorCategory.VIP, "#0f766e"),
    ("Alan Turing", "England", "Bletchley Park", VisitorCategory.NORMAL, "#b45309"),
    ("Katherine Johnson", "USA", "NASA", VisitorCategory.NORMAL, "#be123c"),
    ("Tim Berners-Lee", "England", "CERN", VisitorCategory.NORMAL, "#1d4ed8"),
]


def initials(full_name: str) -> str:
    return "".join(part[0] for part in full_name.split() if part)[:2].upper()


def placeholder_photo(full_name: str, colour: str) -> ContentFile:
    """A flat colour tile with the visitor's initials.

    Real photos arrive from the dashboard's cropper. This exists so the lobby
    screen has something to render at 400px tall during a dress rehearsal.
    """
    image = Image.new("RGB", PHOTO_SIZE, colour)
    draw = ImageDraw.Draw(image)

    try:
        font = ImageFont.load_default(size=260)
    except TypeError:  # Pillow < 10.1 has no sized default font
        font = ImageFont.load_default()

    text = initials(full_name)
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(
        ((PHOTO_SIZE[0] - box[2] + box[0]) / 2, (PHOTO_SIZE[1] - box[3] + box[1]) / 2),
        text,
        fill="#ffffff",
        font=font,
    )

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    slug = full_name.lower().replace(" ", "-")
    return ContentFile(buffer.getvalue(), name=f"{slug}.png")


def pair_device(kind: str, name: str) -> tuple[object, str]:
    """Mint a pairing code and redeem it immediately, exactly as a device would."""
    code = device_services.create_pairing_code(kind)
    return device_services.redeem_pairing_code(code.code, name=name)


class Command(BaseCommand):
    help = "Create a demo admin, a screen, a scanner and five visitors."

    def handle(self, *args, **options):
        User = get_user_model()

        with transaction.atomic():
            admin, created = User.objects.get_or_create(
                username=ADMIN_USERNAME,
                defaults={
                    "email": ADMIN_EMAIL,
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
            admin.set_password(ADMIN_PASSWORD)
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()

            screen, screen_token = pair_device(DeviceKind.SCREEN, "Lobby screen")
            scanner, scanner_token = pair_device(DeviceKind.SCANNER, "Front door")

            issued = []
            for full_name, country, organization, category, colour in DEMO_VISITORS:
                visitor, badge_token = visitor_services.register_visitor(
                    {
                        "full_name": full_name,
                        "country": country,
                        "organization": organization,
                        "category": category,
                        "photo": placeholder_photo(full_name, colour),
                    },
                    actor=admin,
                )
                issued.append((visitor, badge_token))

        self._report(admin, created, screen, screen_token, scanner, scanner_token, issued)

    def _report(self, admin, created, screen, screen_token, scanner, scanner_token, issued):
        out = self.stdout
        bold, ok, warn = self.style.MIGRATE_HEADING, self.style.SUCCESS, self.style.WARNING

        out.write("")
        out.write(bold("Admin"))
        out.write(f"  username  {ADMIN_USERNAME}")
        out.write(f"  password  {ADMIN_PASSWORD}")
        out.write("  " + ("created" if created else "already existed - password reset"))

        out.write("")
        out.write(bold("Device tokens  (Authorization: Device <token>)"))
        for device, token in ((screen, screen_token), (scanner, scanner_token)):
            out.write(f"  {device.kind:<8} {device.name}")
            out.write(ok(f"           {token}"))

        out.write("")
        out.write(bold("Badge tokens  (the value printed into the QR)"))
        for visitor, token in issued:
            flag = "VIP" if visitor.category == VisitorCategory.VIP else "   "
            out.write(f"  {flag} {visitor.badge_serial}  {visitor.full_name}")
            out.write(ok(f"       {token}"))

        out.write("")
        out.write(warn("None of the above can be recovered - only digests are stored."))
        out.write("")
        out.write(bold("Try it"))
        out.write(
            f"  curl -X POST http://localhost:8000/api/v1/scans "
            f'-H "Authorization: Device {scanner_token}" '
            f'-H "Content-Type: application/json" '
            f"-d '{{\"token\": \"{issued[0][1]}\"}}'"
        )
        out.write(f"  scripts/smoke_screen.html#{screen_token}")
        out.write("")
