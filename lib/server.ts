/**
 * Finding the server.
 *
 * The backend's address is DHCP unless someone reserved it, and when it moves
 * every symptom is indirect: the socket reconnects forever and nobody on the
 * floor knows why. So the address is not one hardcoded string — it is a list of
 * candidates, probed in order, with a manual override that sticks.
 *
 * Candidates, best first:
 *
 *   1. An address someone typed in on this machine. It is the most recent human
 *      decision, so it wins over everything.
 *   2. This page's own hostname. The screen is SERVED BY the same machine that
 *      runs the backend, so whatever host loaded this page is almost always the
 *      server — which means the screen usually reconfigures itself for free when
 *      the server's IP changes.
 *   3. NEXT_PUBLIC_VMS_BACKEND_ORIGIN from the build. A sensible default, and
 *      stale the moment DHCP moves.
 *
 * Only when all of them fail does the screen ask a person, and then it remembers.
 */
const OVERRIDE_KEY = "vms.screen.server-origin";

/** A probe has to be quick: it runs before the screen can show anything useful. */
const PROBE_TIMEOUT_MS = 2500;

export const BUILD_DEFAULT_ORIGIN = (
  process.env.NEXT_PUBLIC_VMS_BACKEND_ORIGIN ?? "http://localhost:8000"
).replace(/\/$/, "");

/** The port the backend listens on; the screen itself is served from another. */
const BACKEND_PORT = (() => {
  try {
    return new URL(BUILD_DEFAULT_ORIGIN).port || "8000";
  } catch {
    return "8000";
  }
})();

export function getOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export function setOverride(origin: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OVERRIDE_KEY, normaliseOrigin(origin));
  } catch {
    // A kiosk with storage disabled still works for this session.
  }
}

export function clearOverride(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* nothing to undo */
  }
}

/**
 * Accept what a person would actually type.
 *
 * "10.101.196.41", "10.101.196.41:8000" and "http://10.101.196.41:8000/" all mean
 * the same thing to someone standing at a kiosk, so they all mean the same thing
 * here. Refusing a bare IP because it lacks a scheme is a way of being right that
 * helps nobody.
 */
export function normaliseOrigin(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withScheme);
    // A bare host means the backend port, not the page's port.
    if (!url.port) url.port = BACKEND_PORT;
    return `${url.protocol}//${url.hostname}:${url.port}`;
  } catch {
    return "";
  }
}

/** The address this page was served from, pointed at the backend's port. */
export function originFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname } = window.location;
  if (!hostname) return null;
  return `${protocol}//${hostname}:${BACKEND_PORT}`;
}

export function candidateOrigins(): string[] {
  const candidates = [getOverride(), originFromLocation(), BUILD_DEFAULT_ORIGIN]
    .filter((value): value is string => Boolean(value))
    .map((value) => normaliseOrigin(value))
    .filter(Boolean);

  return [...new Set(candidates)];
}

export type ProbeResult = { origin: string; lanIp: string | null };

/**
 * Is a VMS backend answering at this address?
 *
 * `service: "vms"` is checked, not just the status code, so the screen cannot
 * attach itself to some other machine that happens to answer on port 8000.
 */
export async function probe(origin: string): Promise<ProbeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${origin}/api/v1/health`, {
      signal: controller.signal,
      // The probe is cross-origin and unauthenticated, so no preflight is
      // triggered and CORS never enters into it.
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = await response.json();
    if (body?.service !== "vms") return null;

    return { origin, lanIp: typeof body.lan_ip === "string" ? body.lan_ip : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Try each candidate in order. Returns the first live server, or null. */
export async function resolveServer(): Promise<ProbeResult | null> {
  for (const origin of candidateOrigins()) {
    const result = await probe(origin);
    if (result) return result;
  }
  return null;
}
