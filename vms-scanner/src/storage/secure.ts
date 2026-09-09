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
 */
import * as SecureStore from "expo-secure-store";

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
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function loadDeviceSession(): Promise<DeviceSession | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;

    const [name, kind] = await Promise.all([
      SecureStore.getItemAsync(NAME_KEY),
      SecureStore.getItemAsync(KIND_KEY),
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
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(NAME_KEY, session.name);
  await SecureStore.setItemAsync(KIND_KEY, session.kind);
}

export async function clearDeviceSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(NAME_KEY),
    SecureStore.deleteItemAsync(KIND_KEY),
  ]);
}
