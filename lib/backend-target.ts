/**
 * Where the proxy sends a request, decided PER REQUEST.
 *
 * This exists because a `rewrites()` destination is a boot-time constant. The
 * screen already resolves the backend at runtime — it probes candidates and
 * prefers its own hostname — but a static rewrite could not follow any of that,
 * so HTTP kept going to whatever address happened to be in `.env` when the Next
 * process started. When the server's IP moved, the WebSocket followed and the
 * HTTP calls did not, and the failure surfaced as "could not reach <address>"
 * naming an address that was, in fact, perfectly reachable.
 *
 * Server-side only. Never import this from a client component.
 */
const ENV_ORIGIN = (
  process.env.NEXT_PUBLIC_VMS_BACKEND_ORIGIN ?? "http://localhost:8000"
).replace(/\/$/, "");

/** The port uvicorn listens on; the screen itself is served from another. */
export const BACKEND_PORT = (() => {
  try {
    return new URL(ENV_ORIGIN).port || "8000";
  } catch {
    return "8000";
  }
})();

/**
 * The header the browser uses to say "this is the backend I just probed live".
 *
 * It is a hint from the page, not a command: `isLanTarget` still has to agree.
 */
export const TARGET_HEADER = "x-vms-backend";

function parse(input: string): URL | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.port) url.port = BACKEND_PORT;
    return url;
  } catch {
    return null;
  }
}

/**
 * Is this an address on our own network?
 *
 * The proxy forwards whatever the page asks it to, which without a check is an
 * open relay sitting on the event LAN. The system only ever talks to a backend
 * on the same closed network, so anything routable on the public internet is
 * refused — the restriction costs nothing here and closes the hole.
 */
export function isLanTarget(url: URL): boolean {
  const host = url.hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) {
    return true;
  }
  if (host === "::1" || host === "[::1]") return true;

  const octets = host.split(".");
  if (octets.length === 4 && octets.every((part) => /^\d{1,3}$/.test(part))) {
    const [a, b] = octets.map(Number);
    if (octets.some((part) => Number(part) > 255)) return false;

    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true; // link-local
    return false;
  }

  // A bare NetBIOS/mDNS name with no dots is a LAN name by construction.
  return !host.includes(".");
}

/**
 * Resolve the backend for one incoming request, best source first.
 *
 *   1. The address the page probed and confirmed a VMS backend answered at.
 *      It is the freshest fact anyone has, and it is already verified.
 *   2. The host that served this page. In the deployment this system is built
 *      for, the server runs Postgres, uvicorn AND this Next process, so the
 *      screen follows the server's IP for free.
 *   3. The build-time default, which is stale the moment DHCP moves.
 */
export function resolveBackendTarget(headers: Headers): string {
  const requested = headers.get(TARGET_HEADER);
  if (requested) {
    const url = parse(requested);
    if (url && isLanTarget(url)) return url.origin;
  }

  const host = headers.get("host");
  if (host) {
    const hostname = host.split(":")[0];
    const url = parse(`${hostname}:${BACKEND_PORT}`);
    if (url && isLanTarget(url)) return url.origin;
  }

  return ENV_ORIGIN;
}
