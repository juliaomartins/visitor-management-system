/**
 * Where the server is, from the phone's point of view.
 *
 * A native app has no origin to infer this from — unlike the lobby screen, which
 * is served BY the server and can just look at its own URL. So the phone stores
 * an address, and that address has to survive the server's IP moving.
 *
 * Kept in SecureStore beside the device token on a phone. On web there is no
 * SecureStore at all, so it falls back to localStorage -- see `store` below for
 * why that is acceptable here and is NOT acceptable for the device token.
 *
 * TWO ADDRESSES, TWO KEYS, and the split matters. `vms.server.manual` is a
 * deliberate human decision made in Settings. `vms.server.origin` is whatever
 * the failover last found to work on its own. If they shared a key an automatic
 * probe would silently overwrite a choice somebody made on purpose, and the app
 * would quietly talk to a different server than the one shown on screen.
 *
 * NOTE: unpairing clears the device token, the device name and the kind -- it
 * does NOT clear either address. A phone handed back still knows where the
 * server was. That is deliberate for an event where phones are re-paired all
 * day, but it is worth knowing before one leaves the building.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * One tiny store, two backends.
 *
 * SecureStore has no web build -- its module is literally `export default {}`,
 * so `SecureStore.setItemAsync` on web is not a function and throws. The reads
 * below were already wrapped in try/catch and quietly returned null; the WRITES
 * were not, which is why typing a server address in the browser crashed with
 * `ExpoSecureStore.default.setValueWithKeyAsync is not a function` rather than
 * failing gracefully. Guarding every path is half the fix.
 *
 * THE OTHER HALF IS localStorage, AND ONLY FOR THIS. A server address is not a
 * credential: it is the IP already showing in the browser's own URL bar, listed
 * on the control centre's network card, and handed out by `/api/v1/health`
 * without authentication. Writing it down grants nobody anything.
 *
 * THE DEVICE TOKEN IS A DIFFERENT MATTER AND MUST NOT COME HERE. That one is a
 * working credential, and the Security rules in CLAUDE.md forbid localStorage
 * for exactly that reason. Where a web build would keep it is still an open
 * decision -- do not resolve it by copying this pattern.
 */
const store = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      // A locked-down browser, a private window, or a reset keychain. The app
      // still works; it simply does not remember the address.
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      /* not remembered, but the address is still in use for this session */
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      /* nothing to undo */
    }
  },
};

/*
  A CHANGE OF ADDRESS HAS TO REACH THE CLIENT, NOT JUST THE DISK.

  Settings used to write the manual address and navigate back, and that was the
  whole of it. But the address the app actually sends requests to is a module
  variable in `api/client.ts`, and its only writer was `useServer`, which
  resolves once on mount. Coming back from Settings does not remount the screen
  underneath -- it was never unmounted -- so nothing re-read the new address.

  The result was a server address that needed entering twice: the first attempt
  saved correctly and then failed against the OLD address, and the second worked
  only because something else had remounted in between. Worse, the status dot
  probed storage rather than the client, so it went green for an address the app
  was not using.

  So a write announces itself, and whoever holds the resolved address listens.
*/
type OriginListener = () => void;

const listeners = new Set<OriginListener>();

/** Returns its own unsubscribe, for a `useEffect` cleanup. */
export function subscribeToOriginChange(listener: OriginListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announceOriginChange(): void {
  // Copied before iterating: a listener may unsubscribe itself as it runs.
  for (const listener of [...listeners]) listener();
}

/** What the failover last found to work by itself. */
const SERVER_KEY = "vms.server.origin";

/** What a person deliberately typed in Settings. Outranks everything. */
const MANUAL_KEY = "vms.server.manual";

/** The address baked in at build time. A default, not a truth. */
export const BUILD_DEFAULT_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  "",
);

const DEFAULT_PORT = "8000";

/**
 * Accept what a guard would actually type on a phone keyboard.
 *
 * "10.101.196.41", "10.101.196.41:8000" and "http://10.101.196.41:8000/" all mean
 * the same thing to the person typing them, so they mean the same thing here.
 * Insisting on a scheme is a way of being right that helps nobody at a door.
 */
export function normaliseOrigin(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  // React Native's URL is incomplete on some engines; parse by hand.
  const match = /^(https?):\/\/([^/:\s]+)(?::(\d+))?$/i.exec(withScheme);
  if (!match) return "";

  const [, scheme, host, port] = match;
  return `${scheme.toLowerCase()}://${host}:${port ?? DEFAULT_PORT}`;
}

export async function getStoredOrigin(): Promise<string | null> {
  return store.get(SERVER_KEY);
}

export async function storeOrigin(origin: string): Promise<void> {
  const normalised = normaliseOrigin(origin);
  if (!normalised) return;
  await store.set(SERVER_KEY, normalised);
}

/**
 * The manual override.
 *
 * Read on every candidate resolution, so a change in Settings takes effect on
 * the next probe without restarting the app.
 */
export async function getManualOrigin(): Promise<string | null> {
  return store.get(MANUAL_KEY);
}

export async function storeManualOrigin(origin: string): Promise<void> {
  const normalised = normaliseOrigin(origin);
  if (!normalised) return;
  await store.set(MANUAL_KEY, normalised);
  announceOriginChange();
}

/** Hands control back to the built-in default and the failover. */
export async function clearManualOrigin(): Promise<void> {
  await store.remove(MANUAL_KEY);
  announceOriginChange();
}

export async function clearStoredOrigin(): Promise<void> {
  await store.remove(SERVER_KEY);
  announceOriginChange();
}

/**
 * Addresses to try, best first.
 *
 * A stored address beats the build default because it is the most recent human
 * decision — somebody stood at this phone and typed it. The build default is the
 * fallback for a phone that has never been told otherwise.
 */
export async function candidateOrigins(): Promise<string[]> {
  /*
    A MANUAL ADDRESS IS THE ONLY CANDIDATE, not merely the first one.

    Falling through to the default after a manual address failed would send
    requests to a different server than the one Settings is showing -- so the
    screen would say one thing and the scans would go somewhere else. Better to
    fail visibly against the address somebody chose.
  */
  const manual = await getManualOrigin();
  if (manual) {
    const normalised = normaliseOrigin(manual);
    if (normalised) return [normalised];
  }

  const stored = await getStoredOrigin();
  const candidates = [stored, BUILD_DEFAULT_ORIGIN]
    .filter((value): value is string => Boolean(value))
    .map(normaliseOrigin)
    .filter(Boolean);

  return [...new Set(candidates)];
}
