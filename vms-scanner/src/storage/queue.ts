/**
 * The offline queue. Local write first, network second — always.
 *
 * The router at an event will hiccup. When it does, a guard must not be left
 * holding a phone that lost a scan, so every read of a badge is committed to
 * SQLite before a request is attempted, and only removed once the server has
 * confirmed it. A scan that never syncs is still a scan that happened, and it
 * will still be in the entrance report when the network returns.
 *
 * Two tables:
 *
 *   scan_queue     what has not been accepted by the server yet
 *   visitor_cache  identities learned from this phone's own successful scans
 *
 * `scan_queue` holds raw badge tokens, because replaying a scan means re-sending
 * the token the QR carried. That is unavoidable, and it is why rows are deleted
 * the moment the server accepts them rather than kept as a local history.
 * `visitor_cache` never holds a raw token — it is keyed on the SHA-256 digest, so
 * an emptied queue leaves no badge tokens on the phone at all.
 */
import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

import type { ScanVisitor } from "@/api/scans";

const DATABASE = "vms-scanner.db";

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

let database: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  database = await SQLite.openDatabaseAsync(DATABASE);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS scan_queue (
      client_uuid     TEXT PRIMARY KEY NOT NULL,
      badge_token     TEXT NOT NULL,
      scanned_at      TEXT NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      created_at      INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS scan_queue_due
      ON scan_queue (next_attempt_at);

    CREATE TABLE IF NOT EXISTS visitor_cache (
      token_sha    TEXT PRIMARY KEY NOT NULL,
      full_name    TEXT NOT NULL,
      country      TEXT NOT NULL,
      organization TEXT,
      category     TEXT,
      badge_serial TEXT NOT NULL,
      photo_url    TEXT,
      seen_at      INTEGER NOT NULL
    );
  `);

  return database;
}

/** Call once at startup so the first scan is not waiting on a schema migration. */
export async function initQueue(): Promise<void> {
  await db();
}

async function digest(badgeToken: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, badgeToken);
}

/**
 * Record a scan locally. Returns the row, including the id the server will one
 * day use to recognise a replay.
 */
export async function enqueueScan(
  badgeToken: string,
  scannedAt: Date = new Date(),
): Promise<QueuedScan> {
  const handle = await db();
  const clientUuid = Crypto.randomUUID();

  await handle.runAsync(
    `INSERT INTO scan_queue
       (client_uuid, badge_token, scanned_at, attempts, next_attempt_at, created_at)
     VALUES (?, ?, ?, 0, 0, ?)`,
    clientUuid,
    badgeToken,
    scannedAt.toISOString(),
    Date.now(),
  );

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
  const handle = await db();
  const rows = await handle.getAllAsync<{
    client_uuid: string;
    badge_token: string;
    scanned_at: string;
    attempts: number;
    last_error: string | null;
  }>(
    `SELECT client_uuid, badge_token, scanned_at, attempts, last_error
       FROM scan_queue
      WHERE next_attempt_at <= ?
      ORDER BY scanned_at ASC
      LIMIT ?`,
    Date.now(),
    limit,
  );

  return rows.map((row) => ({
    clientUuid: row.client_uuid,
    badgeToken: row.badge_token,
    scannedAt: row.scanned_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

/** The server has it. Drop the row, and with it the raw token. */
export async function markSynced(clientUuid: string): Promise<void> {
  const handle = await db();
  await handle.runAsync(`DELETE FROM scan_queue WHERE client_uuid = ?`, clientUuid);
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
  const handle = await db();
  const row = await handle.getFirstAsync<{ attempts: number }>(
    `SELECT attempts FROM scan_queue WHERE client_uuid = ?`,
    clientUuid,
  );
  const attempts = (row?.attempts ?? 0) + 1;

  await handle.runAsync(
    `UPDATE scan_queue
        SET attempts = ?, next_attempt_at = ?, last_error = ?
      WHERE client_uuid = ?`,
    attempts,
    Date.now() + backoffFor(attempts),
    error.slice(0, 300),
    clientUuid,
  );
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
  const handle = await db();
  await handle.runAsync(`DELETE FROM scan_queue WHERE client_uuid = ?`, clientUuid);
}

export async function pendingCount(): Promise<number> {
  const handle = await db();
  const row = await handle.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM scan_queue`,
  );
  return row?.count ?? 0;
}

/** The oldest unsynced scan, for telling the guard how far behind the phone is. */
export async function oldestPendingAt(): Promise<string | null> {
  const handle = await db();
  const row = await handle.getFirstAsync<{ scanned_at: string }>(
    `SELECT scanned_at FROM scan_queue ORDER BY scanned_at ASC LIMIT 1`,
  );
  return row?.scanned_at ?? null;
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
  const handle = await db();
  await handle.runAsync(
    `INSERT INTO visitor_cache
       (token_sha, full_name, country, organization, category, badge_serial, photo_url, seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(token_sha) DO UPDATE SET
       full_name = excluded.full_name,
       country = excluded.country,
       organization = excluded.organization,
       category = excluded.category,
       badge_serial = excluded.badge_serial,
       photo_url = excluded.photo_url,
       seen_at = excluded.seen_at`,
    await digest(badgeToken),
    visitor.full_name,
    visitor.country,
    visitor.organization ?? null,
    visitor.category ?? null,
    visitor.badge_serial,
    visitor.photo_url ?? null,
    Date.now(),
  );
}

export async function lookupCachedVisitor(
  badgeToken: string,
): Promise<CachedVisitor | null> {
  const handle = await db();
  const row = await handle.getFirstAsync<{
    full_name: string;
    country: string;
    organization: string | null;
    category: string | null;
    badge_serial: string;
    photo_url: string | null;
    seen_at: number;
  }>(`SELECT * FROM visitor_cache WHERE token_sha = ?`, await digest(badgeToken));

  if (!row) return null;

  return {
    fullName: row.full_name,
    country: row.country,
    organization: row.organization,
    category: row.category,
    badgeSerial: row.badge_serial,
    photoUrl: row.photo_url,
    seenAt: row.seen_at,
  };
}

/** Called on unpair. A phone handed back must not carry the guest list home. */
export async function clearAll(): Promise<void> {
  const handle = await db();
  await handle.execAsync(`DELETE FROM scan_queue; DELETE FROM visitor_cache;`);
}
