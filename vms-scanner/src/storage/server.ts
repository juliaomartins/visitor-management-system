/**
 * Where the server is, from the phone's point of view.
 *
 * A native app has no origin to infer this from — unlike the lobby screen, which
 * is served BY the server and can just look at its own URL. So the phone stores
 * an address, and that address has to survive the server's IP moving.
 *
 * Kept in SecureStore beside the device token rather than in a separate store.
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
import * as SecureStore from "expo-secure-store";

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
  try {
    return await SecureStore.getItemAsync(SERVER_KEY);
  } catch {
    return null;
  }
}

export async function storeOrigin(origin: string): Promise<void> {
  const normalised = normaliseOrigin(origin);
  if (!normalised) return;
  await SecureStore.setItemAsync(SERVER_KEY, normalised);
}

/**
 * The manual override.
 *
 * Read on every candidate resolution, so a change in Settings takes effect on
 * the next probe without restarting the app.
 */
export async function getManualOrigin(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(MANUAL_KEY);
  } catch {
    return null;
  }
}

export async function storeManualOrigin(origin: string): Promise<void> {
  const normalised = normaliseOrigin(origin);
  if (!normalised) return;
  await SecureStore.setItemAsync(MANUAL_KEY, normalised);
}

/** Hands control back to the built-in default and the failover. */
export async function clearManualOrigin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MANUAL_KEY);
  } catch {
    /* nothing to undo */
  }
}

export async function clearStoredOrigin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SERVER_KEY);
  } catch {
    /* nothing to undo */
  }
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
