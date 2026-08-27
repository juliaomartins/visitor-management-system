/**
 * Two transports, on purpose.
 *
 * WEBSOCKET goes DIRECT to the backend. Next.js does not proxy `ws://` upgrade
 * requests — the upgrade is dropped and the socket never opens — so the browser
 * must dial the backend itself. WebSockets are not subject to CORS, so nothing
 * blocks this.
 *
 * HTTP goes through this app's own `/api` route handler, ALWAYS. Same-origin
 * means no CORS preflight, which matters because `POST /devices/pair` sends a
 * JSON content type and the feed sends `Authorization` — both preflight when
 * cross-origin, and the backend answers preflights with nothing at all
 * (`django-cors-headers` is deliberately not installed; CLAUDE.md).
 *
 * The request carries the origin the page PROBED AND VERIFIED in a header, and
 * the route handler forwards there. That is what makes the two transports agree:
 * previously HTTP went through a `rewrites()` destination frozen at boot, so
 * when the server's IP moved the socket followed and HTTP did not — and the
 * error message named the address the page had resolved rather than the one the
 * request was actually sent to.
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

/**
 * The header that tells the proxy which backend this page verified.
 *
 * Must match TARGET_HEADER in lib/backend-target.ts.
 */
const TARGET_HEADER = "x-vms-backend";

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
  init: RequestInit & { deviceToken?: string; backendOrigin?: string } = {},
): Promise<T> {
  const { deviceToken, backendOrigin, headers, ...rest } = init;
  const target = backendOrigin ? normaliseOrigin(backendOrigin) : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(deviceToken ? { Authorization: `Device ${deviceToken}` } : {}),
        ...(target ? { [TARGET_HEADER]: target } : {}),
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
  return request<ScreenFeed>(`/api/v1/screen/feed?since=${since}`, {
    deviceToken,
    backendOrigin: origin,
  });
}

export async function pairScreen(
  origin: string,
  code: string,
  name: string,
): Promise<DevicePaired> {
  return request<DevicePaired>("/api/v1/devices/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name }),
    backendOrigin: origin,
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
