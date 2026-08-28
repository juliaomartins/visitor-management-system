---
description: Audit one VMS sub-project against CLAUDE.md and the failure modes this system actually has.
---

Audit the sub-project at $ARGUMENTS.

READ-ONLY. Do not modify any file. Do not start, stop or restart the backend,
the dev servers, or Postgres — the user runs those. Read-only probes are fine
(`curl /api/v1/health`, `netstat`, `git log`, reading files).

Read the root `CLAUDE.md` first. Every numbered constraint there is a hard rule,
not a preference. A finding that contradicts one of them is a CORRECTNESS bug
regardless of how clean the code looks.

## The layout

| Path | What | Repo |
|---|---|---|
| `vms-backend/` | Django + DRF + Channels, single process | root |
| `vms-contracts/` | generated TS types — `schema.d.ts` is NEVER hand-edited | root |
| `vms-dashboard/` | Next.js admin | its own git repo |
| `vms-screen/` | Next.js lobby display | its own git repo |
| `vms-scanner/` | Expo guard app | its own git repo |

## Check these first — they are what actually breaks here

Every one of these has bitten this project. Look for them by name.

**Backend**
- `group_send` outside `transaction.on_commit` (constraint #5).
- A consumer handler whose name does not match its message `type` with dots
  turned into underscores. This fails SILENTLY — no error anywhere.
- Anything that would break under `--workers 1` + `InMemoryChannelLayer`, or
  any suggestion of adding workers, Redis, Celery or Docker (#1, #2).
- Photo URLs built from `request.build_absolute_uri()` instead of
  `MEDIA_BASE_URL`. The WS push has no request, so this silently diverges the
  two feed paths — they must stay byte-identical.
- `.values(...).distinct()` on a queryset that inherited an `order_by`. Django
  puts ORDER BY columns into SELECT DISTINCT, so iteration returns duplicates
  while `.count()` looks correct. Call `.order_by()` first.
- Hour bucketing without the event timezone (`Asia/Dili`). Wrong-zone buckets
  are silently wrong, never loud.
- Any code path that claims to recover or re-display an existing badge QR. Only
  `sha256(token)` is stored (#3) — the raw token cannot be recovered, only
  reissued, and reissuing kills the card in someone's hand.
- Serializer changed without regenerating: run `./scripts/check_contracts.sh`
  from the repo root and report drift as a finding.

**Screen and scanner**
- Reconnect logic that cannot tell a revoked token from an unreachable server.
  A rejected WebSocket handshake reaches the browser as close code 1006, NOT the
  code the server named — only an already-open socket delivers a custom code.
  HTTP is the reliable revocation signal.
- Backfill missing on reconnect, or `/screen/feed` removed "because we have
  WebSocket" (#6).
- Any hardcoded LAN IP in source. Addresses are probed at runtime; `.env` holds
  a last-resort default only, and a committed IP is a documented lie.
- Scanner: a login screen, or any auth other than the paired device token (#4).
- Scanner: offline queue writes that are not idempotent on `client_uuid`, or a
  path that clears the queue on revocation — queued scans must survive and sync
  after re-pairing.

**Dashboard**
- Hand-written types that mirror a serializer instead of importing from
  `@vms/contracts`.
- The refresh token anywhere other than an httpOnly cookie; access token in
  `localStorage`.
- Code that assumes a field the running backend may not send yet. There is no
  `--reload`, so the backend is routinely one build behind the frontend; a
  missing field must degrade, not throw.

## What counts as a finding

Order by severity, worst first. For each: **file:line**, what is wrong, the
concrete failure it produces, and how risky the fix is.

Say plainly which findings you VERIFIED (ran something, traced the call path)
and which are INSPECTION ONLY. Do not present a suspicion as a fact — on this
project, reading the code has repeatedly disagreed with what the running system
does.

Group as:

**CORRECTNESS** — CLAUDE.md violations, bugs, unhandled failure modes; especially
reconnect, idempotency, partial writes, and behaviour after a backend restart.

**SECURITY** — auth, token handling, secrets, input validation, what a stolen
device token or a leaked export can do.

**MAINTAINABILITY** — duplication, functions doing too much, unclear names,
missing error handling, dead code.

Skip anything the project's own tooling already catches — but know what that is:
`vms-dashboard`, `vms-screen` and `vms-scanner` each have ESLint and strict
TypeScript, so skip type errors and React-hook violations there. **`vms-backend`
has no ruff or black configured** despite CLAUDE.md naming them, so Python style
and lint-class bugs there are in scope and worth reporting.

There is no test suite. Do not suggest running `pytest`; verification here is
`manage.py check`, `makemigrations --check --dry-run`, `check_contracts.sh`, and
reading the code.

If the sub-project is clean in a category, say so in one line rather than
inventing filler.
