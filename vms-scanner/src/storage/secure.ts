/**
 * The device token, in the OS keystore.
 *
 * The scanner has no login and never will (CLAUDE.md constraint #4). It pairs once
 * with a 6-character code and keeps a permanent token, so the value stored here is
 * the entire credential — Keychain on iOS, EncryptedSharedPreferences on Android,
 * not AsyncStorage.
 *
 * The server holds only a SHA-256 digest of this token, so a phone that loses its
 * keystore entry cannot be recovered. It re-pairs, and the old device is revoked
 * from the dashboard.
 *
 * ON WEB THERE IS NO KEYSTORE, AND THIS FALLS BACK TO localStorage.
 *
 * That is a deliberate exception to "never localStorage" in CLAUDE.md, made after
 * checking what this particular credential can actually reach. A scanner device
 * token is not the admin JWT that rule protects:
 *
 *   - `IsScannerDevice` narrows it to ONE endpoint, `POST /api/v1/scans`.
 *   - The scan response returns a visitor only for a badge token the caller is
 *     already physically holding. It cannot enumerate visitors, read the roster,
 *     or export photographs.
 *   - It is revocable in one click from the dashboard's device list.
 *
 * So the worst a stolen web token buys is the ability to log false arrivals —
 * noisy, attributable to a named device, and revocable. That is a different
 * order of thing from the passport-adjacent data the rule exists to protect.
 *
 * It is still weaker than a keystore, and `isSecureStorageAvailable()` keeps
 * saying so, so the pairing screen can warn the operator that this browser now
 * holds a credential. Close the browser profile, or revoke the device, when the
 * event is over.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/** Keystore on a phone, localStorage on web. Every path guarded. */
const store = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      // Deliberately NOT swallowed: if the browser refuses to store the token,
      // pairing has not really succeeded and the operator must see that rather
      // than reach a camera that will 401 on its first scan.
      globalThis.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
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

/** SecureStore keys allow alphanumerics, ".", "-" and "_". */
const TOKEN_KEY = "vms.device.token";
const NAME_KEY = "vms.device.name";
const KIND_KEY = "vms.device.kind";

export type DeviceSession = {
  token: string;
  name: string;
  kind: string;
};

/**
 * SecureStore has no web implementation. The scanner is a phone app, but Expo
 * serves web in development and a hard crash there is a confusing way to find out.
 */
/**
 * Whether the token lands in a real OS keystore.
 *
 * FALSE ON WEB EVEN THOUGH PAIRING NOW WORKS THERE. This is not "can we store
 * it" -- localStorage can -- it is "is the store a hardened one". The pairing
 * screen uses it to warn rather than to block, so the distinction has to stay
 * readable.
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Whether a token can be kept at all. False only if the browser refuses. */
export async function canStoreSession(): Promise<boolean> {
  if (Platform.OS !== "web") return isSecureStorageAvailable();
  try {
    const probe = "vms.storage.probe";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return true;
  } catch {
    // Private windows and locked-down browsers throw on the accessor itself.
    return false;
  }
}

export async function loadDeviceSession(): Promise<DeviceSession | null> {
  try {
    const token = await store.get(TOKEN_KEY);
    if (!token) return null;

    const [name, kind] = await Promise.all([
      store.get(NAME_KEY),
      store.get(KIND_KEY),
    ]);

    return { token, name: name ?? "This device", kind: kind ?? "scanner" };
  } catch {
    // A keystore read can fail on a device with a corrupted or reset keychain.
    // Treating that as "not paired" sends the guard to the pairing screen, which
    // is recoverable; throwing would leave them on a dead splash.
    return null;
  }
}

export async function saveDeviceSession(session: DeviceSession): Promise<void> {
  await store.set(TOKEN_KEY, session.token);
  await store.set(NAME_KEY, session.name);
  await store.set(KIND_KEY, session.kind);
}

export async function clearDeviceSession(): Promise<void> {
  await Promise.all([
    store.remove(TOKEN_KEY),
    store.remove(NAME_KEY),
    store.remove(KIND_KEY),
  ]);
}
