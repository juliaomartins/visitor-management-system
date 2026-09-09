import { en, type MessageKey, type Messages } from "./en";
import { pt } from "./pt";
import { tet } from "./tet";

/**
 * The locale set for the scanner, and the pure helpers around it.
 *
 * No React and no storage in this file — it is imported by the provider, by the
 * offline queue's error paths, and by anything else that needs a word without
 * being a component.
 */
export type Locale = "en" | "pt" | "tet";

export const DEFAULT_LOCALE: Locale = "en";

export const DICTIONARIES: Record<Locale, Messages> = { en, pt, tet };

/**
 * How each language names itself.
 *
 * THE LABELS ARE IN THEIR OWN LANGUAGE, always. A guard handed a phone left in
 * a language they cannot read is looking for the word they recognise.
 *
 * No flags. Flags are countries, not languages, and there is no flag that means
 * Tetum without also meaning something political.
 */
export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "pt", label: "Português", short: "PT" },
  { code: "tet", label: "Tetun", short: "TET" },
];

/** Anything that is not one of the three becomes the default, never a crash. */
export function normaliseLocale(value: string | undefined | null): Locale {
  return value === "en" || value === "pt" || value === "tet"
    ? value
    : DEFAULT_LOCALE;
}

/**
 * Look a message up and fill its placeholders.
 *
 * A missing key cannot happen — `Messages` makes it a compile error — so there
 * is no runtime fallback chain here to hide one.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const message = DICTIONARIES[locale][key];
  if (!params) return message;

  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export type { MessageKey, Messages };
