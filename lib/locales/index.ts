import { en, type MessageKey, type Messages } from "./en";
import { pt } from "./pt";
import { tet } from "./tet";

/**
 * The locale set, and the pure helpers around it.
 *
 * NO "use client" HERE ON PURPOSE. The root layout is a server component and has
 * to know the locale before it renders a single character — see the note in
 * `lib/i18n.tsx` about why the language cannot be applied on the client the way
 * the theme is. Everything in this file is a plain value or a pure function, so
 * both sides can import it.
 */
export type Locale = "en" | "pt" | "tet";

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The cookie the choice lives in.
 *
 * A cookie rather than localStorage, which is what the theme uses. The theme is
 * a CSS class the server can guess wrong and a pre-paint script can correct; the
 * language is the text itself, and a server that guesses wrong sends a whole
 * page of English to be replaced during hydration. React calls that a mismatch
 * and the registrar sees a flash of the wrong language on every navigation. A
 * cookie is the one browser preference the server can read while rendering.
 *
 * It holds a language code and nothing else — no session meaning, nothing worth
 * protecting — so it is deliberately readable by the client script that writes
 * it.
 */
export const LOCALE_COOKIE = "vms.locale";

/** A year: long enough that the desk never re-picks, short enough to expire. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DICTIONARIES: Record<Locale, Messages> = { en, pt, tet };

/**
 * How each language names itself, and the tag `Intl` knows it by.
 *
 * THE LABELS ARE IN THEIR OWN LANGUAGE, always. Someone who has landed in a
 * language they cannot read needs to find their way out, and "Portuguese" is no
 * help to a reader who only knows to look for "Português".
 *
 * `intl` is not the same as the code. There is no CLDR data for Tetum in any
 * browser, so `new Intl.DateTimeFormat("tet")` silently falls back to the
 * browser's own locale — which is how a Tetum console ends up printing American
 * dates. Timor-Leste writes dates the Portuguese way, so Tetum borrows
 * `pt-PT` for formatting only, and every format below is numeric so no
 * Portuguese month name ever appears in a Tetum screen.
 */
export const LOCALES: {
  code: Locale;
  /** The language's name for itself. */
  label: string;
  /** A short tag for the compact switcher. */
  short: string;
  /** What `Intl` should be handed. */
  intl: string;
  /** What goes in `<html lang>`. */
  html: string;
}[] = [
  { code: "en", label: "English", short: "EN", intl: "en-GB", html: "en" },
  { code: "pt", label: "Português", short: "PT", intl: "pt-PT", html: "pt" },
  { code: "tet", label: "Tetun", short: "TET", intl: "pt-PT", html: "tet" },
];

export function localeMeta(locale: Locale) {
  return LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];
}

/** Anything that is not one of the three becomes the default, never a crash. */
export function normaliseLocale(value: string | undefined | null): Locale {
  return value === "en" || value === "pt" || value === "tet"
    ? value
    : DEFAULT_LOCALE;
}

/**
 * Look a message up and fill its placeholders.
 *
 * A missing key cannot happen — `Messages` makes it a compile error — so this
 * does not carry a runtime fallback chain that would only ever hide a bug.
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
