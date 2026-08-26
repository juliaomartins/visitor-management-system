/**
 * The screen's device token, in localStorage.
 *
 * localStorage and not a cookie, and deliberately not the httpOnly refresh-token
 * treatment the dashboard gets: this is a kiosk, not a user session. Nobody signs
 * in and nobody signs out. A machine in a corner of a lobby is switched on in the
 * morning and must come straight back up on the display, including after a power
 * cut, which rules out anything scoped to a browser session.
 *
 * The token this holds is read-only by design — it reaches exactly one HTTP
 * endpoint and one WebSocket path, both of which only ever hand back arrivals
 * already on public display. CLAUDE.md says to assume it gets extracted; the
 * screen is physically accessible and this is the containment, not the secrecy.
 */
const STORAGE_KEY = "vms.screen.device-token";

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode, or storage disabled by policy on a locked-down kiosk.
    return null;
  }
}

export function setDeviceToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearDeviceToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — a token that cannot be cleared is revoked from the
    // dashboard instead.
  }
}
