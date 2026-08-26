/**
 * Two transports, on purpose.
 *
 * WEBSOCKET goes DIRECT to the backend. Next.js does not proxy `ws://` upgrade
 * requests through `rewrites()` — the upgrade is dropped and the socket never
 * opens — so the browser must dial the backend itself. WebSockets are not subject
 * to CORS, so nothing blocks this.
 *
 * HTTP goes through the Next rewrite, same-origin, whenever the resolved server
 * is the host that served this page. A cross-origin fetch carrying an
 * `Authorization` header triggers a CORS preflight, and the backend answers with
 * no CORS headers at all — `django-cors-headers` is deliberately not installed
 * (CLAUDE.md, Dashboard). Through the rewrite it is first-party and there is no
 * preflight.
 *
 * In the deployment this system is built for, those are the same machine: the
 * server runs Postgres, uvicorn AND the screen's Next process, and the kiosk
 * browser loads the page from it. So the page's own hostname IS the backend's,
 * and the screen reconfigures itself when that address changes.
 *
 * A manual override pointing at a DIFFERENT machine is honoured for the socket —
 * live arrivals keep working — but the backfill would then need CORS on the
 * backend. `usingProxy()` reports which case we are in so the UI can say so.
 *
 * Visitor photos are the exception to both: `photo_url` arrives absolute, built
 * from the backend's MEDIA_BASE_URL, and an `<img>` is not CORS-restricted.
 */
import type { components } from "@vms/contracts";

import { BUILD_DEFAULT_ORIGIN, normaliseOrigin } from "@/lib/server";

export type ScreenEvent = components["schemas"]["ScreenEvent"];
export type ScreenFeed = components["schemas"]["ScreenFeed"];
export type DevicePaired = components["schemas"]["DevicePaired"];

export { BUILD_DEFAULT_ORIGIN };

const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when HTTP can go same-origin through the rewrite rather than direct. */
export function usingProxy(origin: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return new URL(normaliseOrigin(origin)).hostname === window.location.hostname;
  } catch {
    return true;
  }
}

/** Same-origin path when the rewrite can carry it, absolute URL when it cannot. */
function httpBase(origin: string): string {
  return usingProxy(origin) ? "" : normaliseOrigin(origin);
}

/** `ws://` for `http://`, `wss://` for `https://` — the LAN runs the former. */
export function feedSocketUrl(origin: string, deviceToken: string): string {
  const resolved = normaliseOrigin(origin) || BUILD_DEFAULT_ORIGIN;
  const scheme = resolved.startsWith("https://") ? "wss://" : "ws://";
  const host = resolved.replace(/^https?:\/\//, "");
  // The browser WebSocket API cannot set headers, so the token rides in the query
  // string. Keep it out of access logs.
  return `${scheme}${host}/ws/screen/?token=${encodeURIComponent(deviceToken)}`;
}

async function request<T>(
  url: string,
  init: RequestInit & { deviceToken?: string } = {},
): Promise<T> {
  const { deviceToken, headers, ...rest } = init;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(deviceToken ? { Authorization: `Device ${deviceToken}` } : {}),
        ...headers,
      },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const detail =
        body && typeof body === "object" && typeof body.detail === "string"
          ? body.detail
          : Array.isArray(body?.code)
            ? String(body.code[0])
            : `The server returned ${response.status}.`;
      throw new ApiError(detail, response.status);
    }

    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Everything the screen missed while it was not listening.
 *
 * Run on every `onopen`, not only the first. `InMemoryChannelLayer` has no queue
 * behind it: restart the backend and every group membership is gone along with
 * anything sent in those seconds. This is what closes that hole, and it is why
 * both paths exist (CLAUDE.md constraint #6).
 */
export async function fetchFeed(
  origin: string,
  since: number,
  deviceToken: string,
): Promise<ScreenFeed> {
  return request<ScreenFeed>(
    `${httpBase(origin)}/api/v1/screen/feed?since=${since}`,
    { deviceToken },
  );
}

export async function pairScreen(
  origin: string,
  code: string,
  name: string,
): Promise<DevicePaired> {
  return request<DevicePaired>(`${httpBase(origin)}/api/v1/devices/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name }),
  });
}

/** Codes are drawn from an alphabet with no 0, O, 1 or I. */
export const CODE_LENGTH = 6;

export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}
