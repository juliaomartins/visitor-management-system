# VMS — Visitor Management System

Event badge system for ~250 visitors, running on a closed LAN behind one router.

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
└── vms-contracts/          generated TypeScript types (OpenAPI → TS)
```

Frontends consume contracts by relative path:
`"@vms/contracts": "file:../vms-contracts"` — no submodule, no npm publishing.

---

## Stack

| Part | Tech |
|---|---|
| Backend | Django, DRF, djangorestframework-simplejwt, **Django Channels**, PostgreSQL |
| Channel layer | `InMemoryChannelLayer` — **no Redis** |
| Background jobs | none — **no Celery** |
| Dashboard | TypeScript, Next.js (App Router), TailwindCSS, TanStack Query |
| Scanner | TypeScript, React Native, Expo, expo-router, expo-camera, expo-sqlite |
| Screen | TypeScript, Next.js, TailwindCSS |
| Badge PDF | **ReportLab** + qrcode — pure Python, no native libraries |
| Schema | drf-spectacular → openapi.yaml → openapi-typescript |

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

**3. The QR contains an opaque random token — never an ID.**

```python
raw = secrets.token_urlsafe(32)                        # printed in the QR
visitor.token_hash = sha256(raw.encode()).hexdigest()  # only this is stored
```

If the QR held `{"id": 42}`, anyone could photograph a badge, edit it to 43, print it,
and enter as another guest. The raw token exists only on the printed card — **generate
the PDF at creation time**, it cannot be recovered afterwards. Reprinting a lost card
means issuing a new token and revoking the old one.

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

### vms-screen/src/hooks/useArrivalFeed.ts

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
    is_active     = BooleanField(default=True)              # revoke lost cards

class ScanEvent(BaseModel):
    id          = BigAutoField(primary_key=True)            # this is your event_id
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

---

## API surface

```
POST   /api/v1/auth/token                    admin login           → JWT pair
POST   /api/v1/auth/token/refresh
POST   /api/v1/auth/token/blacklist

GET    /api/v1/visitors                      list/filter/search    [admin]
POST   /api/v1/visitors                      register              [admin]
GET    /api/v1/visitors/{id}                 detail + scan history [admin]
PATCH  /api/v1/visitors/{id}                 edit                  [admin]
DELETE /api/v1/visitors/{id}                 soft delete           [admin]
POST   /api/v1/visitors/{id}/revoke          kill a lost badge     [admin]
GET    /api/v1/visitors/{id}/badge           single card PDF       [admin]
POST   /api/v1/badges/bulk                   A4 sheet PDF          [admin]

POST   /api/v1/devices/pairing-code          generate setup code   [admin]
GET    /api/v1/devices                       list paired devices   [admin]
POST   /api/v1/devices/{id}/revoke           kill a lost phone     [admin]
POST   /api/v1/devices/pair                  redeem setup code     [public, throttled]

POST   /api/v1/scans                         guard scans a badge   [scanner device]
GET    /api/v1/screen/feed?since={id}        reconnect backfill    [screen device]

WS     /ws/screen/?token=<device_token>      live push             [screen device]

GET    /api/v1/reports/entries?from=&to=     entrance log          [admin]
GET    /api/v1/reports/entries.csv           export                [admin]
```

`/scans` returns `200` with a `result` field for bad badges, not `4xx`. A revoked badge
is a business outcome, not an HTTP error — it keeps the app's error handling clean.

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
│   └── settings/{base,dev,prod,test}.py
└── apps/
    ├── common/     BaseModel, permissions, throttling, hash_token(), storage
    ├── accounts/   User + simplejwt views. Admins only.
    ├── visitors/   Visitor CRUD, issue_badge_token(), revoke_badge()
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

Login, visitor CRUD (normal + VIP), photo upload, badge print queue, device pairing
codes, entrance reports.

- Route groups: `(auth)/login`, `(dashboard)/*` behind the guard.
- All API types from `@vms/contracts`. Never hand-write a type mirroring a serializer.
- TanStack Query for server state. No global store for API data.

**Visitor photos are 3:4 portrait, 600 × 800 — NOT the card aspect.**

The CR80 card is 85.6 × 54 mm landscape, but the photo is a portrait region inside
it, the way a passport photo sits on an ID card. These two get confused constantly.
`PHOTO_ASPECT` in `components/visitors/PhotoUpload.tsx` is the single source of
truth; the crop happens in the browser so the server stores one canonical image.

**Registration does not redirect on success.**

`POST /visitors` returns the raw badge token once. Only its digest is stored, so
navigating away destroys the one copy and the badge can never be printed — the
visitor would have to be registered again. Success therefore replaces the form with
the token receipt, and the registrar leaves deliberately. Do not "fix" this by
routing to the detail page. Phase 5 makes it moot: the PDF will carry the token
straight into a QR and no human will ever see it.

**The dashboard proxies `/api` and `/media` to the backend** via rewrites in
`next.config.ts`, so every browser request is same-origin.

`django-cors-headers` is deliberately not installed. The proxy removes the need for
it: no preflight on the `Authorization` header, the refresh cookie is first-party,
and DRF's absolute photo URLs (built from the `Host` header) resolve. Set
`VMS_BACKEND_ORIGIN` to the server's LAN address. Note `CORS_ALLOW_ALL_ORIGINS` in
`settings/dev.py` is inert while the package is absent.

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

Deliberately the smallest app. Two pages: the display, and one-time pairing. No router
beyond that, no state library, no auth UI.

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

There is no pytest suite yet, and `pytest` is not installed. Do not paste `pytest` into a
terminal expecting it to prove anything. Verification today is `manage.py check`,
`makemigrations --check --dry-run`, and exercising the API against a throwaway SQLite
database. If a suite is added, it belongs behind `settings/test.py`.

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
| 0 | Models, serializers, openapi.yaml, contracts codegen | NOT STARTED |
| 1a | Auth (JWT + refresh cookie), visitor CRUD + filters, token issue/revoke | DONE |
| 1b | `/scans`, `/screen/feed`, device pairing + device auth, throttling | DONE |
| 2 | Channels: asgi.py, consumer, routing, WS device middleware | DONE |
| 3a | Dashboard: login, visitor CRUD, photo upload | NOT STARTED |
| 3b | Scanner: pairing, camera, offline queue | NOT STARTED |
| 4 | Lobby screen: WS hook + backfill + welcome card | NOT STARTED |
| 5 | Badge PDF templates + bulk A4 print | NOT STARTED |
| 6 | Reports + CSV export | NOT STARTED |
| 7 | LAN dress rehearsal — real phones, real printed cards | NOT STARTED |

**Update this table as phases complete.** It is how context carries between sessions.

Ordering rationale, so it isn't rearranged:

- **Channels is phase 2, not 1.** Prove the flow works by polling first. Then the
  WebSocket is an enhancement on a path already known to be correct. Build both at once
  and a missing scan gives no signal about which half broke.
- **Badges are phase 5.** The card design changes the moment someone holds a printed one
  next to a real lanyard. Building early means designing twice.
- **The offline queue belongs in 3b**, not later.
- **Phase 7 is not optional.** Print 20 real cards, use two real phones, run the real
  router. Every problem you'll have on the day surfaces there.
