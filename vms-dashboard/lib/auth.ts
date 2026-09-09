/**
 * Admin session.
 *
 * The access token lives in a module variable and nowhere else — not
 * localStorage, not sessionStorage, not a readable cookie. This app holds every
 * visitor's photo and passport-adjacent data, so a token sitting in storage that
 * any script on the page can read is not a trade worth making.
 *
 * The refresh token is never visible to this file at all. The backend sets it as
 * an httpOnly cookie scoped to `/api/v1/auth`, and because the dashboard proxies
 * to the backend (see next.config.ts) it travels as a first-party cookie the
 * browser attaches on its own.
 *
 * A memory-only access token means a page reload starts with nothing. That is
 * what `restoreSession()` is for: it spends the cookie once on mount to get a
 * fresh access token back.
 */

/**
 * A cookie the route guard can actually see.
 *
 * The refresh cookie is path-scoped to `/api/v1/auth`, so the browser does not
 * send it when navigating to `/visitors` — proxy.ts would be blind. This
 * carries no token and grants nothing; it is a routing hint, so the guard can
 * redirect without a round trip. The real boundary is the backend rejecting a
 * request that arrives without a valid bearer token.
 */
import {
  DEFAULT_LOCALE,
  translate,
  type MessageKey,
} from "@/lib/locales";

const SESSION_HINT = "vms_session";

let accessToken: string | null = null;
let inFlightRefresh: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

function setSessionHint(active: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = active
    ? `${SESSION_HINT}=1; path=/; max-age=86400; SameSite=Lax`
    : `${SESSION_HINT}=; path=/; max-age=0; SameSite=Lax`;
}

function adopt(token: string | null): void {
  accessToken = token;
  setSessionHint(Boolean(token));
}

export function clearSession(): void {
  adopt(null);
}

/** Raw fetch, deliberately: the typed client's 401 handler would recurse here. */
async function postAuth(path: string, body: unknown): Promise<Response> {
  return fetch(`/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export class LoginError extends Error {
  constructor(
    message: string,
    /**
     * Set when the sentence is ours; absent when the backend supplied it.
     *
     * This is thrown from a plain async function with no React around it, so it
     * cannot translate itself. `useErrorText` resolves the key where it is
     * displayed, which is the only place that knows the current language.
     */
    readonly key?: MessageKey,
  ) {
    super(message);
  }
}

export async function login(username: string, password: string): Promise<void> {
  const response = await postAuth("token", { username, password });

  if (!response.ok) {
    // The backend distinguishes a wrong password from a non-admin account.
    const detail = await response
      .json()
      .then((body) => body?.detail as string | undefined)
      .catch(() => undefined);

    // The backend's own wording wins when it sent one: it distinguishes a wrong
    // password from a non-admin account, and that detail is worth more than a
    // translated generality.
    if (detail) throw new LoginError(detail);

    const key: MessageKey =
      response.status === 401 ? "login.badCredentials" : "login.failedStatus";

    // `message` stays English for logs and stack traces; `key` is what the
    // screen actually renders.
    throw new LoginError(
      translate(DEFAULT_LOCALE, key, { status: response.status }),
      key,
    );
  }

  const { access } = (await response.json()) as { access: string };
  adopt(access);
}

/**
 * Trade the refresh cookie for a new access token.
 *
 * Single-flight: several queries can hit 401 in the same tick, and they must not
 * each spend the cookie. Rotation is on, so the second call would present a token
 * the first one already blacklisted.
 */
export function refreshAccessToken(): Promise<boolean> {
  inFlightRefresh ??= (async () => {
    try {
      const response = await postAuth("token/refresh", {});
      if (!response.ok) {
        clearSession();
        return false;
      }
      const { access } = (await response.json()) as { access: string };
      adopt(access);
      return true;
    } catch {
      // A network failure is not proof the session is dead — leave it alone and
      // let the caller surface the error.
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

/** Called once when the dashboard shell mounts, and after any hard reload. */
export async function restoreSession(): Promise<boolean> {
  if (accessToken) return true;
  return refreshAccessToken();
}

/**
 * Guarantee a token before a write.
 *
 * GETs recover on their own — the client retries them after a refresh. A request
 * with a body cannot be replayed once it has been sent, so mutations ask first.
 */
export async function ensureAccessToken(): Promise<boolean> {
  return accessToken ? true : refreshAccessToken();
}

export async function logout(): Promise<void> {
  try {
    await postAuth("token/blacklist", {});
  } finally {
    clearSession();
  }
}
