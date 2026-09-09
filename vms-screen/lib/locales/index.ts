import { en, type MessageKey, type Messages } from "./en";
import { pt } from "./pt";
import { tet } from "./tet";

/**
 * The locale set for the lobby screen, and the pure helpers around it.
 *
 * NO "use client" HERE. The root layout is a server component and has to know
 * the language before it renders anything — see `lib/i18n.tsx` for why a wall
 * panel in particular cannot correct its language after the fact.
 */
export type Locale = "en" | "pt" | "tet";

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The cookie the choice lives in.
 *
 * A cookie, not localStorage — which is what the theme next door uses. The
 * theme is a class the server can guess wrong and a pre-paint script can fix.
 * The language is the text itself, and on a wall-sized panel a hydration swap
 * is a room-sized flicker of the wrong words. A cookie is the one browser
 * preference the server can read while rendering.
 */
export const LOCALE_COOKIE = "vms.screen.locale";

/** A year. The screen is set up once and left alone. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DICTIONARIES: Record<Locale, Messages> = { en, pt, tet };

/**
 * How each language names itself, and the tag `Intl` knows it by.
 *
 * The labels are in their own language, always: someone who has landed in a
 * language they cannot read needs to find their way out.
 *
 * `intl` is not the code. No browser ships CLDR data for Tetum, so
 * `Intl.DateTimeFormat("tet")` quietly falls back to the host machine's locale
 * — which on a kiosk is whatever Windows was installed as. Tetum borrows
 * `pt-PT` for formatting only.
 */
export const LOCALES: {
  code: Locale;
  label: string;
  short: string;
  intl: string;
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

/**
 * "Next", "2nd", "3rd" — the queue positions, per language.
 *
 * ENGLISH ORDINALS ARE A LANGUAGE FEATURE, NOT A NUMBER FORMAT. The queue used
 * a hand-written st/nd/rd/th table, which is correct English and wrong
 * everywhere else: Portuguese writes 2.º, and Tetun does not mark ordinals on
 * the numeral at all. `Intl.PluralRules` knows the English rule, so English
 * asks it rather than keeping the table.
 */
export function ordinal(locale: Locale, n: number): string {
  if (locale === "tet") return String(n);
  if (locale === "pt") return `${n}.º`;

  const suffix = { one: "st", two: "nd", few: "rd", other: "th" };
  const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(n);
  return `${n}${suffix[rule as keyof typeof suffix] ?? "th"}`;
}

export type { MessageKey, Messages };
