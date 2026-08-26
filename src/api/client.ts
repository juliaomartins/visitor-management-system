/**
 * The API client. One header, one timeout, no library.
 *
 * Types come from `@vms/contracts` as type-only imports, so they are erased at
 * build time and Metro never has to resolve the package across the workspace
 * symlink. The runtime is plain `fetch`, which buys two things this app needs:
 * an explicit timeout, and full control over retries when the offline queue
 * lands in part 2.
 *
 * Auth is `Authorization: Device <token>` — a permanent token from pairing, not
 * a session. There is no login and no refresh.
 */
import type { paths } from "@vms/contracts";

import { BUILD_DEFAULT_ORIGIN, normaliseOrigin } from "@/storage/server";

/**
 * The server's address, resolved at runtime — not a constant.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at BUILD time, so a phone built last week
 * carries last week's IP and cannot be corrected without a rebuild. That is no
 * good on a network where DHCP moves the server. So the build value is only the
 * first candidate: `src/storage/server.ts` keeps whatever was last confirmed to
 * work, and the pairing screen can accept a new one typed by hand.
 *
 * Must be a LAN address either way. `localhost` on a phone is the phone, not the
 * server, and that failure reads as "the network is down".
 */
let apiOrigin = BUILD_DEFAULT_ORIGIN;

export function getApiOrigin(): string {
  return apiOrigin;
}

/** Called once at startup with the resolved address, and again if it changes. */
export function setApiOrigin(origin: string): void {
  apiOrigin = normaliseOrigin(origin) || origin;
}

/**
 * Long enough for a congested event router, short enough that a guard is not
 * left holding a spinner while a queue of visitors builds behind the door.
 */
const TIMEOUT_MS = 10_000;

/** Probes run while a person waits, so they fail fast rather than politely. */
const PROBE_TIMEOUT_MS = 2500;

let deviceToken: string | null = null;

/** Called by the session provider on load, after pairing, and on unpair. */
export function setDeviceToken(token: string | null): void {
  deviceToken = token;
}

export function getDeviceToken(): string | null {
  return deviceToken;
}

/** DRF returns `{ field: ["message"] }` on a 400. */
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: FieldErrors = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** No server was reached at all — the distinction the offline queue will act on. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function describe(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const payload = body as Record<string, unknown>;

    if (typeof payload.detail === "string") {
      return new ApiError(payload.detail, status);
    }

    const fields: FieldErrors = {};
    for (const [key, value] of Object.entries(payload)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
      else if (typeof value === "string") fields[key] = [value];
    }
    if (Object.keys(fields).length > 0) {
      const first = Object.values(fields)[0]?.[0];
      return new ApiError(first ?? "That request was rejected.", status, fields);
    }
  }

  if (status === 429) {
    return new ApiError("Too many attempts. Wait a minute and try again.", status);
  }
  return new ApiError(`The server returned ${status}.`, status);
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  /** Pairing is the one call made before a token exists. */
  authenticated?: boolean;
  signal?: AbortSignal;
};

export async function request<T>(
  path: keyof paths | (string & {}),
  { method = "GET", body, authenticated = true, signal }: RequestOptions = {},
): Promise<T> {
  const origin = getApiOrigin();
  if (!origin) {
    throw new NetworkError(
      "No server address is set. Enter the server's IP on the pairing screen.",
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (authenticated) {
    if (!deviceToken) {
      throw new ApiError("This device is not paired.", 401);
    }
    headers.Authorization = `Device ${deviceToken}`;
  }

  // AbortSignal.timeout() is not in every Hermes build; compose it by hand.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError(
      controller.signal.aborted
        ? "The server did not answer. Check the phone is on the event Wi-Fi."
        : `Could not reach ${origin}.`,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) throw describe(response.status, payload);
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}


/** What `GET /api/v1/health` answers. Public, tiny, and names the service. */
export type Health = { service: string; status: string; lan_ip?: string };

/**
 * Is a VMS backend answering at this address?
 *
 * Checks `service: "vms"` rather than just the status code, so the phone cannot
 * attach itself to some other machine that happens to answer on port 8000.
 *
 * Its own short timeout: a probe runs while somebody waits, and a phone trying
 * four dead addresses at ten seconds each has given up on the person, not the
 * network.
 */
export async function probeServer(origin: string): Promise<Health | null> {
  const normalised = normaliseOrigin(origin);
  if (!normalised) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalised}/api/v1/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as Health;
    return body?.service === "vms" ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
