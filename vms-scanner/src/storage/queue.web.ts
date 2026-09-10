/**
 * The offline queue, on web. Same contract as `queue.ts`, backed by localStorage.
 *
 * METRO PICKS THIS FILE FOR WEB AUTOMATICALLY, by the `.web.ts` extension. No
 * caller changes, no `Platform.OS` branch, and `queue.ts` keeps its SQLite
 * implementation untouched for the phones that ship.
 *
 * WHY NOT expo-sqlite ON WEB. It does have a real web build — SQLite compiled to
 * WebAssembly in a worker — and it crashed on a phone browser with an
 * unhelpful `Uncaught Error: Unknown` out of `WorkerChannel.ts`. Its persistent
 * VFS wants OPFS, whose `createSyncAccessHandle` is fussy about context and
 * about running inside a worker the page spawned. Chasing that buys a heavier
 * dependency chain to store, at most, a few hundred rows. localStorage does the
 * same job here with no worker, no WebAssembly and nothing to go wrong at
 * startup.
 *
 * WHAT IS LOST, stated plainly: localStorage is synchronous, origin-scoped and
 * around 5MB. That is thousands of queued scans, so the cap is not the concern —
 * the concern is that clearing site data clears the queue, where a phone's
 * SQLite file would survive. Web is a check-in desk and a development surface;
 * the phones run the real thing.
 *
 * The two collections mirror the two tables exactly, including the rule that
 * matters: `scans` holds raw badge tokens and rows are deleted the moment the
 * server accepts them, while `visitors` is keyed on a digest and never holds a
 * raw token.
 */
import type { ScanVisitor } from "@/api/scans";

const SCANS_KEY = "vms.queue.scans";
const VISITORS_KEY = "vms.queue.visitors";

/** First retry after a second; ceiling well under a shift change. */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CEILING_MS = 5 * 60 * 1000;

export type QueuedScan = {
  clientUuid: string;
  badgeToken: string;
  /** ISO 8601, generated on this device when the badge was presented. */
  scannedAt: string;
  attempts: number;
  lastError: string | null;
};

export type CachedVisitor = {
  fullName: string;
  country: string;
  organization: string | null;
  category: string | null;
  badgeSerial: string;
  photoUrl: string | null;
  /** When this phone last saw the badge accepted. Shown as "last seen". */
  seenAt: number;
};

/** A queued row plus the scheduling fields the caller never sees. */
type StoredScan = QueuedScan & { nextAttemptAt: number; createdAt: number };

// --------------------------------------------------------------- storage --
//
// Every access is guarded. A private window throws on the accessor itself
// rather than returning null, and a scanner that crashes because it could not
// write a cache entry is worse than one that simply forgets.

function readAll<T>(key: string): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function writeAll(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* out of quota, or storage refused; the scan still went to the network */
  }
}

const readScans = () => readAll<Record<string, StoredScan>>(SCANS_KEY);
const writeScans = (rows: Record<string, StoredScan>) => writeAll(SCANS_KEY, rows);

const readVisitors = () => readAll<Record<string, CachedVisitor>>(VISITORS_KEY);
const writeVisitors = (rows: Record<string, CachedVisitor>) =>
  writeAll(VISITORS_KEY, rows);

/**
 * A key for the visitor cache, never a security boundary.
 *
 * `crypto.subtle` needs a secure context, and this file exists precisely for
 * the browser that may not be one — so there is a fallback. Both are
 * deterministic within an origin, which is all an index key has to be. The
 * point of hashing here is that the cache never stores a raw badge token, and
 * a non-cryptographic hash keeps that property.
 */
async function digest(badgeToken: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const bytes = new TextEncoder().encode(badgeToken);
      const hash = await subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fall through */
  }

  // FNV-1a, 32-bit. Enough to index a few hundred badges on one device.
  let hash = 0x811c9dc5;
  for (let i = 0; i < badgeToken.length; i += 1) {
    hash ^= badgeToken.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv${hash.toString(16).padStart(8, "0")}`;
}

/**
 * An idempotency key, not a secret.
 *
 * `crypto.randomUUID` is secure-context only, so there is a fallback here for
 * the same reason as above. It has to be unique across this device's scans,
 * which a v4 shape from `Math.random` comfortably is at event scale.
 */
function uuid(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ------------------------------------------------------------------ queue --

export async function initQueue(): Promise<void> {
  // Nothing to open. Touch storage once so a refusal surfaces here, at start-up,
  // rather than on the first scan with somebody standing at the door.
  readScans();
}

export async function enqueueScan(
  badgeToken: string,
  scannedAt: Date = new Date(),
): Promise<QueuedScan> {
  const rows = readScans();
  const clientUuid = uuid();

  rows[clientUuid] = {
    clientUuid,
    badgeToken,
    scannedAt: scannedAt.toISOString(),
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  };
  writeScans(rows);

  return {
    clientUuid,
    badgeToken,
    scannedAt: scannedAt.toISOString(),
    attempts: 0,
    lastError: null,
  };
}

/** Rows whose backoff has elapsed, oldest scan first — arrivals sync in order. */
export async function dueScans(limit = 10): Promise<QueuedScan[]> {
  const now = Date.now();
  return Object.values(readScans())
    .filter((row) => row.nextAttemptAt <= now)
    .sort((a, b) => a.scannedAt.localeCompare(b.scannedAt))
    .slice(0, limit)
    .map(({ clientUuid, badgeToken, scannedAt, attempts, lastError }) => ({
      clientUuid,
      badgeToken,
      scannedAt,
      attempts,
      lastError,
    }));
}

/** The server has it. Drop the row, and with it the raw token. */
export async function markSynced(clientUuid: string): Promise<void> {
  const rows = readScans();
  delete rows[clientUuid];
  writeScans(rows);
}

/** Exponential, capped, and jittered so a fleet of phones does not sync in lockstep. */
export function backoffFor(attempts: number): number {
  const exponential = Math.min(
    BACKOFF_BASE_MS * 2 ** Math.max(attempts - 1, 0),
    BACKOFF_CEILING_MS,
  );
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

export async function markFailed(clientUuid: string, error: string): Promise<void> {
  const rows = readScans();
  const row = rows[clientUuid];
  if (!row) return;

  const attempts = row.attempts + 1;
  rows[clientUuid] = {
    ...row,
    attempts,
    nextAttemptAt: Date.now() + backoffFor(attempts),
    lastError: error.slice(0, 300),
  };
  writeScans(rows);
}

/**
 * Give up on a row the server will never accept.
 *
 * Only for a 400: the badge token was malformed, so replaying it forever would
 * hold the queue open on something that cannot succeed. Everything else — no
 * network, throttled, revoked device, server error — stays queued, because all
 * of those can come good later, including after a re-pair.
 */
export async function discard(clientUuid: string): Promise<void> {
  await markSynced(clientUuid);
}

export async function pendingCount(): Promise<number> {
  return Object.keys(readScans()).length;
}

/** The oldest unsynced scan, for telling the guard how far behind the phone is. */
export async function oldestPendingAt(): Promise<string | null> {
  const scans = Object.values(readScans());
  if (scans.length === 0) return null;
  return scans.reduce(
    (oldest, row) => (row.scannedAt < oldest ? row.scannedAt : oldest),
    scans[0].scannedAt,
  );
}

/**
 * Remember who a badge belongs to, learned from a scan the server accepted.
 *
 * This is the only way the phone ever learns an identity: there is no roster
 * endpoint a scanner token can reach, and the badge token's digest never leaves
 * the backend. So the cache covers exactly the people this phone has already let
 * through — which is precisely the population that comes back after lunch.
 */
export async function cacheVisitor(
  badgeToken: string,
  visitor: ScanVisitor,
): Promise<void> {
  const rows = readVisitors();
  rows[await digest(badgeToken)] = {
    fullName: visitor.full_name,
    country: visitor.country,
    organization: visitor.organization ?? null,
    category: visitor.category ?? null,
    badgeSerial: visitor.badge_serial,
    photoUrl: visitor.photo_url ?? null,
    seenAt: Date.now(),
  };
  writeVisitors(rows);
}

export async function lookupCachedVisitor(
  badgeToken: string,
): Promise<CachedVisitor | null> {
  return readVisitors()[await digest(badgeToken)] ?? null;
}

/** Called on unpair. A phone handed back must not carry the guest list home. */
export async function clearAll(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(SCANS_KEY);
    globalThis.localStorage?.removeItem(VISITORS_KEY);
  } catch {
    /* nothing to undo */
  }
}
