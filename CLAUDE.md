# VMS — Visitor Management System

Event badge system for ~250 visitors, running on a closed LAN behind one router.

**The event:** Díli Regional Cooperative Conference and Ministerial Dialogue 2026,
Díli, 2–3 October 2026. Two organisers (RDTL and SECoop) plus the event mark; all
three appear on the dashboard, the lobby screen and the scanner splash. That is why
the palette and the plume motif are sampled from the supplied logos rather than
chosen — see `lib/theme.ts` in the screen and `app/globals.css` in the dashboard.

**Flow:** admin registers visitor → prints ID card with QR → guard scans with phone →
lobby screen shows welcome with photo, name, country.

This is NOT an office visitor system. There are no appointments, no hosts, no approval
workflow, no check-out. Badges are printed in advance and stay valid for the event. A
scan is simply an arrival event.

---

## Monorepo layout

```
vms/
├── CLAUDE.md               this file
├── .venv/                  shared Python venv (gitignored)
├── vms-backend/            Django + DRF + Channels + PostgreSQL
├── vms-dashboard/          Next.js — admin
├── vms-scanner/            React Native + Expo — guard
├── vms-screen/             Next.js — lobby display
├── vms-desktop/            PySide6 — the control centre that starts the rest
└── vms-contracts/          generated TypeScript types (OpenAPI → TS)
```

Frontends consume contracts by relative path:
`"@vms/contracts": "file:../vms-contracts"` — no submodule, no npm publishing.

### THE THREE FRONTENDS WERE THEIR OWN GIT REPOSITORIES, AND WERE MERGED IN

`vms-dashboard/`, `vms-screen/` and `vms-scanner/` each used to contain a `.git`
of their own. They were *not* submodules — no gitlink, no `.gitmodules` — so from
the root repository they looked like untracked directories and their contents
were invisible to it. A push from the root would have sent the backend, the
contracts and the desktop app and **none of the three frontends**, silently,
because as far as the root repo was concerned there was never anything there.

They are now one repository. Each was merged with `git read-tree --prefix=`
against a `-s ours` merge, which grafts the app's tree in at its folder while
leaving the working tree untouched — so `node_modules` survived and nothing had
to be reinstalled.

**All 623 commits are reachable from `HEAD` and every one of them is pushed.**
But be precise about what that gives you:

```bash
git log --oneline                      # 623 commits, frontends included
git show 2bc9385                       # a dashboard commit, intact
git log --oneline -- vms-dashboard/    # only 1 — the merge
```

The last line is not a bug and not fixable without rewriting history. Those
commits were made *inside* the dashboard repo, so their paths are
`app/(auth)/login/page.tsx`, not `vms-dashboard/app/(auth)/login/page.tsx`. Git
filters by path, and the old paths do not carry the prefix. The commits are all
there; only path-scoped log cannot associate them.

To read a frontend's own history, filter by the pre-merge path instead:

```bash
git log --oneline -- 'app/(auth)/login/page.tsx'
```

The three merge commits claim `git log -- vms-dashboard/` reads the real
history. **That claim is wrong** — it was written before the behaviour was
checked. This paragraph is the accurate one.

Backups of the three original repositories were taken as `git bundle` files
before the merge. They are not in this repo; if the pre-merge history is ever
needed as a standalone thing, that is where it is.

---

## Stack

| Part | Tech |
|---|---|
| Backend | Django, DRF, djangorestframework-simplejwt, **Django Channels**, PostgreSQL |
| Channel layer | `InMemoryChannelLayer` — **no Redis** |
| Background jobs | none — **no Celery** |
| Dashboard | TypeScript, Next.js 16 (App Router), Tailwind v4, TanStack Query, `qrcode`, `react-image-crop` |
| Scanner | TypeScript, React Native, Expo SDK 57, expo-router, expo-camera, expo-sqlite, reanimated |
| Screen | TypeScript, Next.js 16, Tailwind v4, GSAP |
| Desktop | Python, **PySide6** (Qt 6), packaged with PyInstaller |
| Badge PDF | **ReportLab** + qrcode — pure Python, no native libraries |
| Spreadsheets | openpyxl — the roster and the credential export |
| Schema | drf-spectacular → openapi.yaml → openapi-typescript |
| Languages | English, Portuguese, Tetun — hand-rolled, generated dictionaries, no i18n library |

Pinned versions live in `vms-backend/requirements.txt` and each frontend's
`package.json`. Django is 6.1 and Next is 16.3.2 at the time of writing; read the
files rather than trusting this line.

**Dashboard type is Plus Jakarta Sans (display), Inter (body) and JetBrains Mono.**
All three are self-hosted by `next/font`, which matters on a machine with no
internet. The printed card uses ReportLab's built-in Helvetica and Courier, so the
card is close to the preview but not identical — see the badge section.

---

## HARD CONSTRAINTS — do not "fix" these

**1. The backend runs as ONE process. Always.**

```bash
uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 1
```

`InMemoryChannelLayer` stores group membership in a Python dict inside the process. With
multiple workers, a scan handled by worker 2 never reaches a screen connected to worker 1
— and it fails *intermittently*, the worst kind of bug at a live event. Never add
`--workers N`. Never use gunicorn with multiple workers.

**2. No Docker. Postgres is installed natively. No Redis, no Celery, no containers.**

Deliberate for a 250-visitor LAN event on one machine. Postgres runs as a native
service on the server; there is no `docker-compose.yml` and there should not be one.
Do not introduce any of these without being asked.

**3. The QR contains an opaque DERIVED token — never a bare ID.**

```python
raw = hmac_sha256(BADGE_TOKEN_SECRET, f"{visitor.id}:{visitor.token_version}")
visitor.token_hash = sha256(raw.encode()).hexdigest()   # what the scan looks up
```

If the QR held the visitor id, anyone who saw a badge — or a dashboard URL, which
already contains that id — would hold a working credential forever. The HMAC keeps
the QR unguessable while making it **reproducible**, which is the point: the same
card can be reprinted and shown on screen for the life of the event.

This replaced a random `secrets.token_urlsafe(32)` that was stored only as a digest.
That was safe but irrecoverable, so a card could never be reprinted and printing a
second sheet silently revoked the first — indistinguishable, at the desk, from the
QR expiring.

`BADGE_TOKEN_SECRET` is now a crown jewel: leaking it makes every badge mintable,
and changing it invalidates every printed card at once. It is deliberately separate
from `SECRET_KEY` so that rotating Django's key does not void 250 badges.

**The QR is issued once, at registration, and nothing in the dashboard changes it.**

`rotate_badge_token()` is still the only function that can — it bumps
`token_version` — and `POST /api/v1/badges/reissue` still calls it. But no client
calls that endpoint any more: the wrapper was removed from `vms-dashboard/lib/badges.ts`
and the "Replace badge" button with it, because a control that silently re-mints a
credential does not belong next to one that prints it. Printing, exporting and
editing all leave the token alone.

A badge therefore stays valid from registration until the visitor is **deactivated**
or **deleted**, and both of those are reversible in the sense that matters: the token
is never touched, so activating a visitor puts the card already in their hand back to
work with nothing to reprint. `classify()` in `apps/scans/services.py` reads
`is_active` at scan time rather than anything baked into the code.

If you ever need rotation back in the UI, put it behind its own confirmation and say
plainly that every card already printed for that visitor stops scanning.

**4. The scanner app has no login — but the API is not open.**

Devices pair once with a 6-character code from the dashboard, then store a permanent
device token in `expo-secure-store`. After pairing, the app opens straight to the camera
forever. Do not add a login screen. Do not make `/scans` public.

**5. `group_send` goes inside `transaction.on_commit`.** Otherwise a rolled-back scan
still broadcasts, and the screen shows a visitor who isn't in the database.

**6. The screen uses BOTH WebSocket and polling.** See the real-time section. Do not
remove the polling endpoint "because we have WebSocket now".

**7. Apps live in an `apps/` package**, so every `apps.py` needs the full dotted path:
`name = "apps.visitors"`. Without it, `makemigrations` silently ignores the app.

**8. `vms-contracts/src/schema.d.ts` is generated. Never hand-edit it.** Regenerate from
the backend. Nothing hand-written goes in that package — no helpers, no formatters.

**9. LAN uses `http://`, not `https://`.** An HTTPS page cannot open a `ws://` socket —
browsers block it as mixed content, and certs for a LAN IP aren't worth the fight inside
a closed network.

---

## Real-time architecture (Django Channels)

The lobby screen uses **WebSocket for speed and polling for recovery**. Both. This is
intentional, not leftover from an earlier design.

```
Guard scans QR
  → POST /api/v1/scans                    (HTTP, device token)
  → validate token → write ScanEvent row
  → transaction.on_commit → group_send("lobby_screens", ...)
  → ScreenConsumer pushes JSON over WS
  → screen renders welcome card           (~200ms)

Screen reconnects after any drop or server restart
  → GET /api/v1/screen/feed?since=<last_id>
  → backfills missed events, dedupe by id
```

`InMemoryChannelLayer` has no queue behind it. Restart the server and every group
membership is gone, along with any scan during those seconds. The backfill is ~15 lines
and removes that entire failure class.

`ScanEvent.id` is a `BigAutoField` and serves as the monotonic `event_id`.

### Files that make up this layer

```
vms-backend/
├── config/
│   ├── settings/base.py         daphne first in INSTALLED_APPS, CHANNEL_LAYERS
│   └── asgi.py                  ProtocolTypeRouter: http + websocket
└── apps/
    ├── devices/middleware.py    DeviceAuthMiddleware (WebSocket auth)
    └── scans/
        ├── routing.py           ws/screen/
        ├── consumers.py         ScreenConsumer
        ├── services.py          log_valid_scan() → group_send
        └── views.py             ScanView, ScreenFeedView
```

### settings/base.py

```python
INSTALLED_APPS = [
    "daphne",                    # MUST be first, before staticfiles
    "channels",
    "django.contrib.admin",
    ...
    "rest_framework",
    "drf_spectacular",
    "apps.accounts", "apps.visitors", "apps.badges",
    "apps.devices", "apps.scans", "apps.reports",
]

ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}
```

### config/asgi.py

```python
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django_asgi_app = get_asgi_application()      # MUST run before any model import

from channels.routing import ProtocolTypeRouter, URLRouter
from apps.devices.middleware import DeviceAuthMiddleware
from apps.scans.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": DeviceAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
```

Import order matters. `get_asgi_application()` before model imports, or you get
`AppRegistryNotReady`.

### apps/scans/routing.py

```python
from django.urls import path
from .consumers import ScreenConsumer

websocket_urlpatterns = [
    path("ws/screen/", ScreenConsumer.as_asgi()),
]
```

### apps/scans/consumers.py

```python
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ScreenConsumer(AsyncJsonWebsocketConsumer):
    group_name = "lobby_screens"

    async def connect(self):
        device = self.scope.get("device")
        if not device or device.kind != "screen":
            return await self.close(code=4401)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def visitor_arrived(self, event):        # "visitor.arrived" → visitor_arrived
        await self.send_json(event["payload"])
```

Dots in the `type` become underscores in the method name. A mismatch fails **silently** —
no error anywhere. This is the most common cause of "events aren't arriving".

### apps/devices/middleware.py

```python
from urllib.parse import parse_qs
from channels.db import database_sync_to_async

class DeviceAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        qs = parse_qs(scope.get("query_string", b"").decode())
        token = (qs.get("token") or [None])[0]
        scope["device"] = await self._get(token) if token else None
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get(self, token):
        from .models import Device
        return Device.objects.filter(
            token_hash=hash_token(token), is_active=True).first()
```

The browser `WebSocket` API cannot set headers, so the device token goes in the query
string. Keep it out of access logs.

### apps/scans/services.py — the publish

```python
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

def log_valid_scan(visitor, device, scanned_at):
    scan = ScanEvent.objects.create(
        visitor=visitor, device=device, scanned_at=scanned_at, result="valid")

    payload = ScreenEventSerializer(scan).data
    transaction.on_commit(lambda: async_to_sync(get_channel_layer().group_send)(
        "lobby_screens",
        {"type": "visitor.arrived", "payload": payload},
    ))
    return scan
```

### vms-screen/hooks/useArrivalFeed.ts

```typescript
const connect = () => {
  const ws = new WebSocket(`${WS_URL}/ws/screen/?token=${token}`);

  ws.onopen = async () => {
    setConnected(true);
    const res = await fetch(`${API_URL}/api/v1/screen/feed?since=${lastId.current}`, {
      headers: { Authorization: `Device ${token}` },
    });
    if (res.ok) (await res.json()).events.forEach(add);   // backfill
  };

  ws.onmessage = (e) => add(JSON.parse(e.data));
  ws.onclose = () => { setConnected(false); setTimeout(connect, 2000); };
};
```

`add()` dedupes by `id`, so an event arriving on both paths is harmless.
Reconnect re-runs `onopen`, which re-runs the backfill automatically.

Send a ping every 30s — idle sockets get dropped, and mornings have quiet stretches
between arrival waves.

---

## Data model

```python
class Visitor(BaseModel):
    full_name     = CharField(max_length=200)
    country       = CharField(max_length=100)
    organization  = CharField(max_length=200, blank=True)
    photo         = ImageField(upload_to="visitors/")
    category      = CharField(choices=[("normal","Normal"), ("vip","VIP")])
    badge_serial  = CharField(max_length=20, unique=True)   # human-readable, printed
    token_hash    = CharField(max_length=64, unique=True, db_index=True)
    token_version = PositiveIntegerField(default=1)         # only rotation bumps it
    is_active     = BooleanField(default=True)              # deactivate / activate
    deleted_at    = DateTimeField(null=True, db_index=True) # soft delete

class ScanEvent(TimeStampedModel):
    id          = BigAutoField(primary_key=True)            # this is your event_id
    client_uuid = UUIDField(null=True, unique=True)         # the scanner's idempotency key
    visitor     = ForeignKey(Visitor, null=True, on_delete=PROTECT)
    device      = ForeignKey("devices.Device", on_delete=PROTECT)
    scanned_at  = DateTimeField(db_index=True)
    result      = CharField(choices=["valid","invalid","revoked","duplicate"])

class Device(BaseModel):
    name         = CharField(max_length=100)
    kind         = CharField(choices=[("scanner","Scanner"), ("screen","Screen")])
    token_hash   = CharField(max_length=64, unique=True, db_index=True)
    is_active    = BooleanField(default=True)
    last_seen_at = DateTimeField(null=True)

class PairingCode(BaseModel):
    code       = CharField(max_length=8, unique=True)
    kind       = CharField(choices=[("scanner","Scanner"), ("screen","Screen")])
    expires_at = DateTimeField()
    used_at    = DateTimeField(null=True)

class User(AbstractUser):    # admins only
    pass
```

`ScanEvent` logs invalid attempts too, with `visitor` null. One table gives you both the
entrance report and the security audit.

`client_uuid` is generated on the phone before the row leaves it, so the offline queue
can retry a scan without producing two arrivals when the first attempt actually landed
and only the response was lost.

**`visitor` is nullable for a second reason now.** A permanent delete detaches the
visitor's scans (`visitor = None`) rather than deleting them, so the entrance log keeps
its totals and timestamps while losing the identity. Deleting the rows instead would
quietly shrink the security log — see `purge_visitor` in `apps/visitors/services.py`.

Three states, and they are not the same thing:

| State | Set by | Badge scans? | On the visitor list? | Reversible |
|---|---|---|---|---|
| active | registration | yes | yes | — |
| deactivated | `POST /visitors/{id}/deactivate` | no, logs `revoked` | yes, marked | yes, `/activate` |
| soft-deleted | `DELETE /visitors/{id}` | no, logs `revoked` | no | by hand only |
| purged | `DELETE /visitors/{id}/permanent` | row is gone | no | **never** |

---

## API surface

```
POST   /api/v1/auth/token                    admin login           → JWT pair
POST   /api/v1/auth/token/refresh
POST   /api/v1/auth/token/blacklist

GET    /api/v1/health                        LAN address + liveness

GET    /api/v1/visitors                      list/filter/search    [admin]
       ?category= &is_active= &country= &search= &ordering=
       ?with_tokens=true                     adds `badge_token` to every row
POST   /api/v1/visitors                      register              [admin]
GET    /api/v1/visitors/{id}                 detail + scans + token[admin]
PATCH  /api/v1/visitors/{id}                 edit                  [admin]
DELETE /api/v1/visitors/{id}                 soft delete           [admin]
POST   /api/v1/visitors/{id}/deactivate      badge stops scanning  [admin]
POST   /api/v1/visitors/{id}/activate        badge scans again     [admin]
DELETE /api/v1/visitors/{id}/permanent       erase for good        [admin]

POST   /api/v1/badges/card                   one card PDF, from a raw token
POST   /api/v1/badges/reissue-sheet          A4 sheet PDF. Non-destructive.
GET    /api/v1/badges/roster.xlsx            the roster, no credentials
POST   /api/v1/badges/export                 .xlsx WITH working QR codes
POST   /api/v1/badges/reissue                ROTATES TOKENS. No client calls it.

POST   /api/v1/devices/pairing-code          generate setup code   [admin]
GET    /api/v1/devices                       list paired devices   [admin]
POST   /api/v1/devices/{id}/revoke           kill a lost phone     [admin]
POST   /api/v1/devices/pair                  redeem setup code     [public, throttled]

POST   /api/v1/scans                         guard scans a badge   [scanner device]
GET    /api/v1/screen/feed?since={id}        reconnect backfill    [screen device]

WS     /ws/screen/?token=<device_token>      live push             [screen device]

GET    /api/v1/reports/entries?from=&to=     entrance log          [admin]
GET    /api/v1/reports/entries.csv           export                [admin]
GET    /api/v1/reports/entries.xlsx          export                [admin]
GET    /api/v1/reports/entries.pdf           export                [admin]
```

**Route names drifted from this document once already.** `POST /visitors/{id}/revoke`,
`GET /visitors/{id}/badge` and `POST /badges/bulk` were all documented here and none of
them existed. If you are unsure, ask the URLconf rather than this list:

```powershell
..\.venv\Scripts\python.exe manage.py spectacular --file openapi.yaml
```

and read the paths, or `curl http://<server>:8000/api/v1/schema/` against the running
process — which also tells you whether it has your latest code loaded.

`/scans` returns `200` with a `result` field for bad badges, not `4xx`. A deactivated
badge is a business outcome, not an HTTP error — it keeps the app's error handling clean.
The `result` value is still `revoked`; the enum is what the scanner and the reports are
built on, and renaming it would be a schema change for a word.

**`with_tokens` is opt-in and every other list call goes without it.** A badge token is
a working credential, so the flag turns one request into a set of usable badges. The
print queue asks for it because it draws the real QR on every card and a frame saying
"on the printed card" verifies nothing. The `.xlsx` export already hands the same admin
the same codes, so the boundary it crosses is convenience, not secrecy — but do not
sprinkle it onto other callers for tidiness.

Only `/devices/pair` is reachable without a token.

---

## Security

- Access token in memory only. Refresh token in an httpOnly cookie. **Never localStorage**
  — this app holds every visitor's photo and passport-adjacent data.
- simplejwt: 15-minute access, rotating refresh, blacklist after rotation.
- Rate limit `/api/v1/scans` to 30/min per device. A real guard does ~10.
- Rate limit `/api/v1/devices/pair` to 5/hour per IP.
- Visitor photos via signed, expiring URLs — not a public `/media/` directory.
- Screen device tokens are read-only, scoped to one endpoint and one WS path. Assume
  extraction; the screen is physically accessible.
- Log every admin CRUD action on `Visitor` with actor and timestamp.
- Suppress a repeat of the same visitor within 60s on the screen, but still log it as
  `duplicate`.

---

## Backend structure

```
vms-backend/
├── config/
│   ├── urls.py
│   ├── asgi.py                 THE entry point
│   ├── wsgi.py                 kept for manage.py only
│   └── settings/{base,dev}.py  NO prod.py, NO test.py — see Tests
└── apps/
    ├── common/     BaseModel, permissions, throttling, hash_token(), storage
    ├── accounts/   User + simplejwt views. Admins only.
    ├── visitors/   Visitor CRUD, issue_badge_token(), activate/deactivate, purge
    ├── badges/     ReportLab PDF. NO MODELS, no templates — it draws.
    ├── devices/    Device, PairingCode, authentication.py (HTTP), middleware.py (WS)
    ├── scans/      ScanEvent, consumers.py, routing.py, services.py, views.py
    └── reports/    Aggregation + CSV export. NO MODELS.
```

`badges/` and `reports/` have no models on purpose — they read from `visitors` and
`scans`. This stops `visitors/views.py` absorbing every feature.

Business logic lives in `services.py`. Views stay thin.

**Badges are drawn with ReportLab, not rendered from HTML.**

WeasyPrint was the original choice and could not run: it reaches Pango and Cairo
through GTK, native libraries that are not installable with pip and are absent on
the Windows server this event runs on. The result was a badge feature that
returned 503 on the only machine that mattered. ReportLab is pure Python and
renders identically everywhere, so `apps/badges/services.py` holds explicit
millimetre geometry instead of CSS. Do not reintroduce an HTML renderer without
first checking it runs on the server, not just on a developer's machine.

Fonts are ReportLab's built-in Helvetica and Courier — vector, always present, no
font file to ship. The dashboard's on-screen badge uses Archivo and IBM Plex Mono,
so the printed card is close but not identical. That is the price of never
depending on a font being installed.

Card geometry is CR80 **portrait**, 54 × 85.6 mm — the same blank stood on its
end, because a lanyard holds a card by a slot in its short edge. Top to bottom: a
12 mm punch guide for the slot, geometric corner motifs, a 19 mm circular photo
(amber ring for VIP), the name in caps, a role line, `Registered` and `Country`
rows, the serial in mono, and a 14 mm QR at the foot.

Bulk print lays **9 cards on an A4 sheet**, 3 across by 3 down, with cut marks in
the margins at every grid line. **A run of exactly one comes back as a single
54 × 85.6 mm page instead of a sheet** — one card in the corner of A4 wastes the
other eight slots and is useless to a card printer, and the registration desk
prints one badge far more often than nine.

`apps/badges/services.py` holds the geometry as millimetre constants, and
`components/badge-card.tsx` in the dashboard mirrors it in `cqw` so the on-screen
preview and the PDF cannot drift apart.

---

## Dashboard (vms-dashboard)

Login, visitor CRUD (normal + VIP), photo upload with crop, badge print queue, device
pairing codes, entrance reports, and an overview page.

```
app/(auth)/login
app/(dashboard)/dashboard          overview: arrivals curve, outcome split, recent
app/(dashboard)/visitors           list — right-click a row for actions
app/(dashboard)/visitors/new       register + badge receipt
app/(dashboard)/visitors/[id]      detail: live QR, scan history, lifecycle buttons
app/(dashboard)/visitors/[id]/edit
app/(dashboard)/badges             print queue, nine to a sheet, real QR on every card
app/(dashboard)/devices            pairing codes + paired device list
app/(dashboard)/reports            entrance log + CSV/XLSX/PDF export
```

- Route groups: `(auth)/login`, `(dashboard)/*` behind the guard.
- All API types from `@vms/contracts`. Never hand-write a type mirroring a serializer.
- TanStack Query for server state. No global store for API data.

**Dark mode is class-based, not `prefers-color-scheme`.** `@custom-variant dark
(&:where(.dark, .dark *))` in `globals.css`, toggled by `components/theme-toggle.tsx`.
The registration desk chooses; the lobby's ambient light is not the OS's business. A
small inline bootstrap script in `app/layout.tsx` sets the class before first paint, so
`<html>` carries `suppressHydrationWarning` — without it React reports a mismatch on
every load.

**Right-click a visitor row for Edit / Deactivate (or Activate) / Delete permanently.**
`components/visitors/RowContextMenu.tsx`. It replaces the browser's own menu on those
rows, so "open in new tab" is gone there — a deliberate trade, because the alternative
is a navigation to the visitor and back for every small change. The Menu key and
Shift+F10 open it too, since the row's link is focusable; those report no pointer
position, so they anchor to the row's box instead of the window corner.

**Visitor photos are 3:4 portrait, 600 × 800 — and the printed photo is a CIRCLE.**

`lib/badge-geometry.ts` is the single source of truth and it derives everything from
the same millimetres `apps/badges/services.py` prints with. `PHOTO_ASPECT` moved there
from `PhotoUpload.tsx`; do not reintroduce a second copy.

The trap is that these are three different shapes and they get confused constantly:

| Thing | Shape | Where |
|---|---|---|
| the CR80 card | 54 × 85.6 mm portrait | `CARD_W, CARD_H` |
| the stored photo | 3:4 portrait, 600 × 800 | `PHOTO_ASPECT`, `OUTPUT_WIDTH` |
| the printed photo | a 19 mm **circle** | `clip.circle(...)` in services.py |

The card and the lobby screen both clip the stored 3:4 image to a circle, so a crop
that looks right as a rectangle can still lose a chin. `PhotoCropper.tsx` draws the
circle over the crop for that reason, and warns below `MIN_OUTPUT_WIDTH` — 225px, which
is 19 mm at 300dpi — rather than silently upscaling.

The crop happens in the browser so the server stores one canonical image. **Image data
stays in memory and object URLs. Never localStorage** — a shared registration laptop
must not keep visitors' photographs after the event.

**Registration does not redirect on success.**

`POST /visitors` returns the badge token, and success replaces the form with the
token receipt rather than navigating away — so the registrar prints the card while
the visitor is still standing there, and the next registration starts from a clean
form rather than from somebody's detail page.

THE ORIGINAL REASON IS GONE and the behaviour is kept for the workflow alone.
Tokens used to be irrecoverable, so leaving this page destroyed the only copy and
the badge could never be printed. Tokens are derived now: `GET /visitors/{id}`
returns `badge_token`, and the card can be reprinted at any time from the
visitor's page. Losing the receipt costs nothing.

**The dashboard proxies `/api` and `/media` to the backend** via rewrites in
`next.config.ts`, so every browser request is same-origin: no preflight on the
`Authorization` header, the refresh cookie is first-party, and DRF's absolute photo
URLs (built from the `Host` header) resolve. Set `VMS_BACKEND_ORIGIN` to the server's
LAN address.

**`django-cors-headers` IS installed, and this document said the opposite for a long
time.** It is in `requirements.txt`, in `INSTALLED_APPS`, and first in `MIDDLEWARE`,
with `CORS_ALLOW_ALL_ORIGINS = True` set in **`settings/base.py`** — not just dev. So
the backend answers every origin with `Access-Control-Allow-Origin: *`.

`CORS_ALLOW_CREDENTIALS` is unset, so the refresh cookie cannot be read cross-origin and
the practical exposure on a closed LAN is small. It is still wider than intended: the
proxy exists precisely so no origin but the dashboard needs to reach the API, and a
leaked access token is readable from any web page rather than none. **Decide
deliberately** — either drop the package and the settings, or narrow it to
`CORS_ALLOWED_ORIGINS` — and correct this paragraph when you do.

**The route guard reads a `vms_session` hint cookie, not the refresh token.**

The refresh cookie is httpOnly and path-scoped to `/api/v1/auth`, so the browser
never sends it on a navigation to `/visitors` — `proxy.ts` cannot see it. The hint
holds no token and grants nothing; it exists so an unauthenticated visitor lands on
the sign-in page instead of watching an empty table fail. The real boundary is the
backend rejecting any request without a valid bearer token.

---

## Scanner (vms-scanner)

**Three screens only:** `pair.tsx` (one time), `scanner.tsx` (the only screen a guard
ever sees), `settings.tsx`. If this app grows past that, the feature belongs in the
dashboard.

`src/app/index.tsx` is a fourth route file and is not a fourth screen: it is a single
`<Redirect>` to `/scanner` or `/pair` depending on the keystore, so that decision is
made in one place instead of racing between screens.

`components/LaunchScreen.tsx` holds the branded launch animation — reanimated, sequence
ending at 520ms with a 770ms fallback release, and every value starts at its resting
state under reduced-motion. The root layout holds until **both** the animation has
finished and the keystore has answered — never one or the other, or the app flashes the
pairing screen at a phone that is already paired. The native splash in `app.json` is
transparent in every theme so the two do not fight.

- No login screen, ever. Pair once, store the device token in expo-secure-store, then
  open straight to the camera.
- **Offline SQLite queue is required in v1.** Every scan writes locally first, then syncs
  with backoff, sending its own `scanned_at`. Retrofitting means rewriting every network
  call, and the router will hiccup on event day.
- Debounce the camera — one QR in frame must not fire repeated requests.
- Haptics and sound matter more than the UI. Guards watch the visitor's face, not the
  phone. Green valid / red invalid / amber revoked, with distinct sounds.
- High-contrast theme; used near doorways in variable light.

---

## Screen (vms-screen)

Deliberately the smallest app. Two pages: the display (`app/page.tsx`) and one-time
pairing (`app/pair/page.tsx`). No router beyond that, no state library, no auth UI.

**There is no `src/` here.** `app/`, `components/`, `hooks/` and `lib/` sit at the
package root — the opposite of `vms-scanner`, where everything is under `src/`.

- WebSocket + backfill as described above.
- **`/api/*` is a route handler, not a `rewrites()` entry.** A rewrite destination
  is fixed when the Next process boots, so it could not follow the backend when
  DHCP moved it: the socket reconnected to the new address while every HTTP call
  kept going to the old one, and the error named the address the page had
  resolved rather than the one actually contacted. `app/api/[...path]/route.ts`
  resolves the target per request — the origin the page probed and verified
  (sent in `x-vms-backend`), else the host that served the page, else the env
  default — and only ever forwards to a private/LAN address. Same-origin, so
  the `Authorization` header and the JSON pairing POST never trigger a preflight
  the backend cannot answer. Do not put the `/api` rewrite back.
- Design for 3–5 metre viewing distance: name 72px minimum, photo 400px tall.
- VIP category gets a distinct visual treatment.
- `ConnectionDot` in a corner so staff can see the feed is alive.
- Runs in kiosk mode over `http://`.
- `EventSplash` shows the event mark and both organiser seals while the hall is quiet;
  `IdleScreen` takes over between arrival waves. GSAP drives them — `useGSAP`, SplitText
  and Physics2D, all free tier.
- `FitText` auto-fits names and organisations. It exists because a 40-character name at
  a fixed 72px overflows a 1366×768 screen, and the lobby display is the one surface
  nobody can fix during the event.

---

## Languages (all three frontends)

**English, Portuguese and Tetun.** Portuguese and Tetun are Timor-Leste's
official languages; English is the conference's working language. Every frontend
carries all three, and each one owns its own dictionary — there is no shared i18n
package, because `vms-contracts` is generated and nothing hand-written goes in it.

| App | Dictionaries | Engine | Persisted in |
|---|---|---|---|
| `vms-dashboard` | `lib/locales/{en,pt,tet}.ts` — 365 keys | `lib/i18n.tsx` | cookie `vms.locale` |
| `vms-screen` | `lib/locales/{en,pt,tet}.ts` — 29 keys | `lib/i18n.tsx` | cookie `vms.screen.locale` |
| `vms-scanner` | `src/locales/{en,pt,tet}.ts` — 72 keys | `src/i18n.tsx` | SecureStore `vms.locale` |
| `vms-desktop` | `locales/{en,pt,tet}.py` — 53 keys | `i18n.py` | `QSettings` (registry) |

The desktop app uses **no `QTranslator` and no gettext**. Qt's own machinery
wants `.ts` sources compiled to `.qm` by `lrelease` — a build step, a binary
artefact and a toolchain dependency for 53 strings — and `tr()` keys on the
English text, so every rewording silently orphans its translations. That is
precisely what a generated key table exists to prevent.

**No i18n library.** About 120 lines per app, against three packages and an
install on a machine that is offline by event day. The engine is a typed
dictionary, a `useT()` hook, and a `translate()` that fills `{name}` placeholders.

**1. The dictionaries are GENERATED, and they are pure ASCII.**

```bash
python scripts/generate-locales.py      # the three frontends
python scripts/generate_locales.py      # vms-desktop (underscore, it is Python)
```

All three languages come from one table in that script, so a missing translation
cannot be introduced by hand — and `Messages = Record<MessageKey, string>` makes
one a compile error. Non-ASCII is emitted as `\uXXXX` escapes.

**That escaping is not fussiness.** The first version of these files was written
through a shell heredoc on the Windows dev machine and came back with the accents
mojibaked — `Secções` as `Sec??es`. It typechecked, it rendered, and it was only
visible by decoding the bytes. **Do not hand-edit the `.ts` files**; edit the
generator and re-run it.

**2. The two web apps read the locale on the SERVER. This is the load-bearing
decision.**

The theme is a CSS class: the server can guess wrong and a pre-paint script
corrects it. A language is the markup itself. If the server rendered English and
the browser wanted Tetun, React would hydrate over the whole page and swap every
word — a mismatch, and on the lobby wall a room-sized flicker. So the locale
lives in a cookie, the root layout (`async`, `cookies()`) reads it, and the first
byte is already right. `<html lang>` is set from it, which is what a screen
reader consults to choose a voice.

The scanner has no server render and no cookie, so it reads SecureStore
asynchronously and the launch screen holds until that lands — the same gate the
device token already uses.

**3. Tetum has no CLDR data in any browser.** `Intl.DateTimeFormat("tet")`
silently falls back to the host locale, which on a kiosk is whatever Windows was
installed as. Tetum borrows `pt-PT` for formatting only, and every date format is
numeric so no Portuguese month name lands in a Tetun screen. That also gives
dd/mm/yyyy and a 24-hour clock throughout, which is how Timor-Leste writes a date.

**4. Grammar is not assembled from fragments.** Plurals are one message per form
(Portuguese conjugates, Tetun does not inflect the noun); English ordinals come
from `Intl.PluralRules` while Portuguese writes `2.º`; elapsed time is
`Intl.RelativeTimeFormat`, not a hand-rolled ladder. Where a sentence wraps a
value in markup, `useRichT` splits the TRANSLATED string on its placeholders so
the value lands wherever that language puts it — never a "before" and "after"
half glued around it, which can only ever produce English word order wearing a
translation.

### What is deliberately NOT translated

- **The printed badge.** `apps/badges/services.py` draws the card in English, so
  `components/badge-card.tsx` keeps "Registered", "Country" and "VIP GUEST" in
  English too. The preview exists to show what comes out of the printer, and
  translating it would make it lie about the card — a registrar would check a
  Tetun preview and hand over an English badge. Only the deactivated overlay and
  the empty QR frame, which never reach paper, follow the interface.
- **The report narrative.** `apps/reports/services.py` composes those sentences
  so the PDF and the dashboard panel say the same words. There is no key to look
  up, only prose. Making the report multilingual is a change to that service and
  the PDF it writes.
- **Backend error messages.** DRF's `detail` strings arrive in English and are
  shown as sent. Errors the frontends write themselves carry a `MessageKey`
  instead, resolved at the point of display — see `useErrorText`.
- **Device names and the conference title.** `SCREEN_NAME` is data the backend
  stores and the dashboard lists; translating it would give one wall three names
  depending on which language it happened to be in when somebody paired it. The
  event's official title is not ours to translate either.

**Where the switcher lives:** the dashboard topbar *and* its sign-in page (the
one screen reachable without a session); the lobby screen's bottom-left corner
beside the theme toggle; the scanner's pairing screen (its first screen) and its
settings.

**The Tetun wants a native read.** It is careful — INL orthography, loanwords
spelled the Tetun way (`akreditasaun`, `relatóriu`, `ekrán`) rather than the
Portuguese way — but Tetun has real regional variation, and the event's own staff
can check it faster than any dictionary. Corrections are one line in the
generator plus a re-run.

---

## Desktop control centre (vms-desktop)

A PySide6 window that **starts the other four services and watches them**. It is
an orchestration layer and nothing else: it holds no visitor data, speaks no
part of the VMS API beyond one unauthenticated health probe, and could be
deleted tomorrow without changing how VMS works.

It exists because event-day startup was four terminals in the right order, and
the person opening the doors is not always the person who built this.

```
vms-desktop/
├── main.py                 the window; wires signals and paints, nothing more
├── config.py               EVERY path, port and command, in one place
├── network.py              LAN address detection
├── preflight.py            venv / node / npm / ports / directories
├── services.py             QProcess lifecycle, one model for all four
├── launcher.py             Run All sequencing and readiness probes
├── i18n.py                 the translator; QSettings keeps the choice
├── locales/{en,pt,tet}.py  GENERATED — see the languages section
├── scripts/generate_locales.py
├── widgets/                theme, icons, service card, network card, log viewer
├── selftest.py             the non-GUI layers
├── guitest.py              the Qt layers, driven offscreen
└── VMS Control Center.spec PyInstaller, onedir, windowed
```

**Three rules it must keep.**

1. **STARTED IS NOT READY, and the two are never conflated.** `services.py`
   reports `RUNNING` when the OS has a process and nothing more; only a
   readiness probe over the network may promote that to `READY`, and only
   `READY` enables the Open button. A uvicorn that dies on a bad database
   password is `RUNNING` for about two seconds, and opening a browser at it is
   how somebody meets a connection error and concludes the app is broken.

2. **It never blocks the GUI thread.** `QProcess`, not `subprocess`; `QTimer`,
   never `time.sleep`. The children run for the length of a conference.

3. **It reads the repository rather than duplicating it.** Commands come from
   CLAUDE.md and each project's `package.json` — including `--workers 1`, which
   is here for the reason in the hard constraints. The health probe is the
   backend's existing `/api/v1/health`. No new endpoint was added for it.

**LAN configuration is passed as process environment, never written to `.env`.**
The variable names are the ones the repository already uses —
`VMS_BACKEND_ORIGIN`, `NEXT_PUBLIC_VMS_BACKEND_ORIGIN`, `EXPO_PUBLIC_API_URL` —
and a variable that lives only as long as the child cannot go stale on disk, which
is exactly what the `.env` convention below is protecting against.

**The window has to survive being made small**, and that took three passes to get
right. The panels sit in a splitter over a scroll area; the service cards reflow
between 4, 2 and 1 columns; the header drops its controls onto a second row and
then shortens their labels to a code and an icon. Every one of those decisions is
**measured, not a pixel threshold** — the widths are asked of the widgets, because
a number tuned on English clips Portuguese, and a number tuned before the buttons
had icons clips them afterwards.

**Icons are painted, not shipped as files** (`widgets/icons.py`), the same call
the dashboard made. They take a colour, so a theme switch redraws them; and they
are drawn at the device pixel ratio, because this machine runs at 1.5 where a
16px bitmap stretched to 24 physical pixels is visibly soft.

```powershell
..\.venv\Scripts\python.exe main.py                       # from source
..\.venv\Scripts\python.exe selftest.py                   # no display needed
..\.venv\Scripts\python.exe guitest.py                    # offscreen Qt
..\.venv\Scripts\pyinstaller.exe --noconfirm --clean "VMS Control Center.spec"
```

`dist/VMS Control Center/VMS Control Center.exe` is ~113MB and **gitignored**. It
is rebuilt from the `.spec` in one command; the spec is the source.

**PySide6 and PyInstaller are the only two packages this adds**, and they are in
`vms-desktop/requirements.txt` rather than the backend's.

---

## Contracts (vms-contracts)

```
vms-contracts/
├── package.json            "@vms/contracts"
├── openapi.yaml            copied from backend
├── scripts/generate.sh
└── src/
    ├── schema.d.ts         GENERATED — never hand-edit
    ├── client.ts           openapi-fetch wrapper
    └── index.ts
```

```bash
cp ../vms-backend/openapi.yaml ./openapi.yaml
npx openapi-typescript ./openapi.yaml -o ./src/schema.d.ts
```

After **any** serializer change: regenerate `openapi.yaml`, then regenerate contracts.
CI should fail if `openapi.yaml` is stale (`git diff --exit-code openapi.yaml`).

---

## Commands

**Windows is the daily driver, and Windows is what the event server runs.** Commands are
given Windows-first; the macOS/Linux form follows where it differs.

### Activating the venv — or not bothering

| Shell | Command |
|---|---|
| Windows PowerShell | `..\.venv\Scripts\Activate.ps1` |
| Windows cmd | `..\.venv\Scripts\activate.bat` |
| Git Bash on Windows | `source ../.venv/Scripts/activate` |
| macOS / Linux | `source ../.venv/bin/activate` |

If PowerShell answers *"running scripts is disabled on this system"*, do not go changing
the execution policy — just call the interpreter by path. It needs no activation and it
cannot pick up the wrong Python:

```powershell
..\.venv\Scripts\python.exe manage.py migrate
```

That form works from any shell on any OS and is the safest thing to paste into a
half-remembered terminal at an event.

### Backend — from `vms-backend/`

```powershell
# Windows
..\.venv\Scripts\python.exe manage.py migrate          # postgres is a native service, already up
..\.venv\Scripts\python.exe manage.py seed_demo        # admin, two devices, five visitors
..\.venv\Scripts\python.exe -m uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 1
..\.venv\Scripts\python.exe manage.py spectacular --file openapi.yaml
```

```bash
# macOS / Linux, with the venv active
python manage.py migrate
python manage.py seed_demo
uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 1
python manage.py spectacular --file openapi.yaml
```

`--host 0.0.0.0` is not optional. Bound to `127.0.0.1` the server is invisible to every
phone and screen on the LAN, and the failure reads as "the network is down".

**uvicorn needs a WebSocket implementation installed, or it silently refuses every
upgrade.**

```bash
pip install websockets       # or wsproto
```

Without one, `--ws auto` resolves to `none` and uvicorn answers `/ws/screen/` with a
**404 before the request ever reaches Django**. The lobby screen then reconnects forever,
`ScreenConsumer.connect()` never runs, and the device's `last_seen_at` stays null. Nothing
in the Channels code is involved, so nothing logs an error — and `WebsocketCommunicator`
tests pass, because they call the ASGI app directly and never touch uvicorn's protocol
layer. This cost an afternoon once; do not let it cost another.

On Windows, `pip install "uvicorn[standard]"` is fine too — `uvloop` is skipped there and
you get `websockets` and `httptools` without it.

### Tests

There is no pytest suite yet, `pytest` is not installed, and there is no
`config/settings/test.py`. Do not paste `pytest` into a terminal expecting it to prove
anything. Verification today is `manage.py check`, `makemigrations --check --dry-run`,
and exercising the API against a throwaway SQLite database.

**Point `DJANGO_SETTINGS_MODULE` at a separate settings module. Never swap
`connections.databases` at runtime.** The runtime swap does not take effect once Django
has read its configuration, and a probe written that way silently wrote three visitors,
fourteen scan events and a device into the live event database. A throwaway module is
four lines, and it belongs outside the repo:

```python
from config.settings.dev import *          # noqa: F403
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3",
                         "NAME": "<scratch>/probe.sqlite3"}}
MEDIA_ROOT = "<scratch>/media"
```

Then assert it took, before touching anything:

```python
db = settings.DATABASES["default"]
assert db["ENGINE"].endswith("sqlite3"), f"REFUSING: engine is {db['ENGINE']}"
```

If a real suite is added it belongs behind `settings/test.py`, which would need writing.

### Contracts

`scripts/generate.sh` and `scripts/check_contracts.sh` are bash. On Windows run them from
**Git Bash**, not PowerShell:

```bash
cd vms-contracts && ./scripts/generate.sh
./scripts/check_contracts.sh                 # from the repo root, before every commit
```

`check_contracts.sh` finds the venv on either layout — `Scripts/python.exe` or
`bin/python` — so it needs no activation.

### Frontends

```bash
cd vms-dashboard && npm run dev     # http://<lan-ip>:3000
cd vms-screen    && npm run dev -- --port 3001
cd vms-scanner   && npx expo start -c
```

The `-c` on Expo matters after any `.env` change: `EXPO_PUBLIC_*` is inlined at bundle
time, so without clearing the cache the phone keeps using the previous server address.

Formatting: `black` + `ruff` on the backend, strict TypeScript on the frontends.

---

## Conventions

### Run `./scripts/check_contracts.sh` before every commit

```bash
./scripts/check_contracts.sh
```

It regenerates all three generated artifacts and exits non-zero if any of them
moved:

| File | Generated by |
|---|---|
| `vms-backend/openapi.yaml` | `manage.py spectacular` |
| `vms-contracts/openapi.yaml` | copied from the backend |
| `vms-contracts/src/schema.d.ts` | `openapi-typescript` |

A stale schema does not fail loudly. The frontends keep compiling against types
the backend no longer serves, and it surfaces at runtime as a 404 on a renamed
route or an `undefined` where a field used to be — far from the serializer edit
that caused it. The check turns that into a failed command at commit time.

It compares the working tree against the index, so staging a regenerated file
counts as up to date. When it fails, the files in your tree are already correct;
stage them and commit.

CI should run the same script. It replaces the narrower
`git diff --exit-code openapi.yaml`, which only ever caught half the problem.

### `.env` is per machine, `.env.example` is committed

Every device on the LAN points at the server by IP, so each machine sets its own
`.env` and `.env` is gitignored — a committed IP is wrong for everyone except the
person who committed it, and it fails as "the network is down" rather than as a
bad address. `.env.example` carries a neutral placeholder and is tracked.

**Do not write the current IP into this file.** It has already moved once
(192.168.0.63 → 10.101.196.41) and a documented address is a documented lie the
moment DHCP hands out a new one. Ask the machine instead: `ipconfig` on Windows,
`ipconfig getifaddr en0` on macOS, or `GET /api/v1/health`, which reports the LAN
address the server believes it has.

Three files carry it, and only these three:

| File | Setting |
|---|---|
| `vms-backend/.env` | `VMS_MEDIA_BASE_URL` — leave UNSET; auto-detected at startup |
| `vms-scanner/.env` | `EXPO_PUBLIC_API_URL` — a default only; the app probes and can be told a new one |
| `vms-screen/.env` | `NEXT_PUBLIC_VMS_BACKEND_ORIGIN` — last resort only; the screen probes at runtime |

`vms-dashboard` needs no `.env` at all: it defaults to `localhost:8000` and proxies
server-side, so it follows the server for free as long as both run on one machine.

### `vms-scanner` imports `@vms/contracts` type-only

The scanner uses `import type` and plain `fetch`. **Do not add `openapi-fetch`
there.** It resolves only from `vms-contracts/node_modules`, so using it at
runtime makes the app depend on Metro following the workspace symlink, which it
does not do reliably. A type-only import is erased at build time, so Metro never
resolves the package at all — and hand-rolled `fetch` is what the offline queue
needs anyway, for its own timeout and retry control.

### `src/app/` is the expo-router root in `vms-scanner`

**Do not create a root-level `app/`.** Two candidate route roots is ambiguous,
and `tsconfig` maps `@/*` to `./src/*`, so the whole app is under `src/`.

---

## LAN deployment

```
Router 192.168.1.1
  ├── 192.168.1.50   server: postgres + uvicorn :8000
  ├── 192.168.1.51   lobby screen (browser, kiosk mode)
  ├── dhcp           admin laptop → dashboard
  └── dhcp           guard phones → Expo app
```

- **Static IP or DHCP reservation for the server.** If it changes, every paired device
  breaks and you re-pair during the event.
- `chromium --kiosk --incognito http://192.168.1.50:3000`, OS display sleep disabled.
  Chrome throttles timers and can suspend sockets in background tabs.
- `proxy_read_timeout 3600s` if nginx is in front — the default 60s kills idle sockets.
- **Test on the actual router first.** Some consumer routers enable wireless client
  isolation by default, which alone stops the phones reaching the server.

---

## Build order and current state

| Phase | Work | Status |
|---|---|---|
| 0 | Models, serializers, openapi.yaml, contracts codegen | DONE |
| 1a | Auth (JWT + refresh cookie), visitor CRUD + filters, token issue | DONE |
| 1b | `/scans`, `/screen/feed`, device pairing + device auth, throttling | DONE |
| 2 | Channels: asgi.py, consumer, routing, WS device middleware | DONE |
| 3a | Dashboard: login, visitor CRUD, photo upload | DONE |
| 3b | Scanner: pairing, camera, offline queue | DONE |
| 4 | Lobby screen: WS hook + backfill + welcome card | DONE |
| 5 | Badge PDF templates + bulk A4 print | DONE |
| 6 | Reports + CSV export (also XLSX and PDF) | DONE |
| 7 | **LAN dress rehearsal — real phones, real printed cards** | **NOT STARTED** |

Done since the table was first written, and not in it:

- Branding across all three frontends — event mark plus the two organiser seals,
  palette sampled from the supplied logos, dark mode with a toggle on dashboard
  and screen.
- Derived badge tokens replacing random ones, so a card can be reprinted; the
  permanent-QR rule that follows from it.
- Visitor lifecycle: deactivate, activate, permanent delete.
- Photo cropper with face detection and a print-resolution floor.
- Scanner launch screen (native splash + animation, gated on the keystore).
- Reports: XLSX and PDF exports beside the CSV.
- English / Portuguese / Tetun across all three frontends, and the desktop app.
- `vms-desktop`, the PySide6 control centre, packaged as a Windows executable.

**Update this table as phases complete.** It is how context carries between sessions.

**Phase 7 is the only thing left, and it is the one that matters.** The event is
2–3 October 2026. Nothing in this system has yet been run on the real router, with
real phones, against cards off a real printer.

Ordering rationale, so it isn't rearranged:

- **Channels is phase 2, not 1.** Prove the flow works by polling first. Then the
  WebSocket is an enhancement on a path already known to be correct. Build both at once
  and a missing scan gives no signal about which half broke.
- **Badges are phase 5.** The card design changes the moment someone holds a printed one
  next to a real lanyard. Building early means designing twice.
- **The offline queue belongs in 3b**, not later.
- **Phase 7 is not optional.** Print 20 real cards, use two real phones, run the real
  router. Every problem you'll have on the day surfaces there.

---

## Things this document got wrong before

Kept as a list because each one cost time, and because a confident wrong line in here
is worse than no line at all.

- `POST /visitors/{id}/revoke`, `GET /visitors/{id}/badge` and `POST /badges/bulk`
  were documented and never existed.
- `django-cors-headers` was described as "deliberately not installed". It is
  installed and active.
- `PHOTO_ASPECT` was said to live in `PhotoUpload.tsx`. It lives in
  `lib/badge-geometry.ts`.
- The dashboard's fonts were given as Archivo and IBM Plex Mono. They are Plus
  Jakarta Sans, Inter and JetBrains Mono.
- `vms-screen/src/hooks/...` — the screen has no `src/`.
- `config/settings/{base,dev,prod,test}.py` — only `base.py` and `dev.py` exist.

**When you change a route, a serializer or a filename, change this file in the same
commit.** Everything above was true once.
