/**
 * The chosen language, kept beside the device token.
 *
 * SECURE STORE, NOT BECAUSE A LANGUAGE IS A SECRET. It is not. It is here
 * because it is the only key-value store this app already has: the scanner
 * deliberately ships no AsyncStorage, and the event server is an offline LAN
 * where adding a dependency is a trip to find internet rather than an install.
 * A preference in the keystore costs nothing and adds no package.
 *
 * The consequence worth knowing: unpairing does NOT clear this, exactly as it
 * does not clear the server address. A phone handed to the next guard keeps the
 * language it was set to, which is the right default at a door where phones
 * change hands all day.
 */
import * as SecureStore from "expo-secure-store";

import { normaliseLocale, type Locale } from "@/locales";

/** SecureStore keys allow alphanumerics, ".", "-" and "_". */
const LOCALE_KEY = "vms.locale";

/**
 * Read the stored language, or the default.
 *
 * Never throws. SecureStore has no web implementation and a locked device can
 * refuse a read; either way the app opens in English rather than not at all.
 */
export async function loadLocale(): Promise<Locale> {
  try {
    return normaliseLocale(await SecureStore.getItemAsync(LOCALE_KEY));
  } catch {
    return normaliseLocale(null);
  }
}

/** Remember the language. A failure costs the preference, not the switch. */
export async function saveLocale(locale: Locale): Promise<void> {
  try {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  } catch {
    // The choice still holds for this session; it simply is not remembered.
  }
}
