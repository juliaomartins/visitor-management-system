"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeMeta,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/locales";

/**
 * The active language, and the hook every screen reads it through.
 *
 * WHY THIS IS NOT SHAPED LIKE `lib/theme.ts`. The theme is a class name: the
 * server can render light, a pre-paint script can flip it, and nothing about
 * the markup changes. A language changes the markup itself. If the server
 * guessed English and the browser wanted Tetum, React would hydrate over a full
 * page of the wrong words, report a mismatch, and the desk would watch the
 * interface change language a beat after every navigation.
 *
 * So the locale is read from a cookie by the root layout — a server component —
 * and handed down as `initial`. The first byte the browser receives is already
 * in the right language. The store below exists only so that CHANGING the
 * language re-renders without a round trip.
 */
const listeners = new Set<() => void>();

/** Null until someone switches. Until then the server's value is the truth. */
let chosen: Locale | null = null;

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/**
 * Switch language, and remember it.
 *
 * The cookie is what makes the next server render agree with this one. Setting
 * `<html lang>` here matters for more than tidiness: it is what a screen reader
 * consults to choose a voice, and a Tetum page announced by an English
 * synthesiser is unusable rather than merely wrong.
 */
export function setLocale(next: Locale): void {
  chosen = next;

  try {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // A browser refusing cookies still gets the language for this session; it
    // simply reverts on the next full load. Failing the switch would be worse.
  }

  document.documentElement.lang = localeMeta(next).html;
  for (const notify of listeners) notify();
}

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  initial,
  children,
}: {
  /** Read from the cookie by the server, so the first paint is correct. */
  initial: Locale;
  children: ReactNode;
}) {
  const locale = useSyncExternalStore(
    subscribe,
    () => chosen ?? initial,
    () => initial,
  );

  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The translator. `t("visitors.title")`, or `t("nav.silentDevices", { count })`. */
export function useT(): (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string {
  const locale = useLocale();
  return useCallback(
    (key, params) => translate(locale, key, params),
    [locale],
  );
}

/**
 * Dates and numbers in the active language.
 *
 * EVERY FORMAT IS NUMERIC, in all three languages. That is not laziness about
 * month names — it is the only way Tetum can be formatted at all. No browser
 * ships CLDR data for it, so Tetum borrows `pt-PT` (see `lib/locales/index.ts`),
 * and a written-out month would come back in Portuguese inside an otherwise
 * Tetum screen. Numeric also matches how Timor-Leste writes a date: 02/10/2026,
 * and a 24-hour clock, which removes the AM/PM the old `dateStyle: "medium"`
 * was producing.
 *
 * The one date that does NOT come through here is the "Registered" line on the
 * badge preview. That mirrors what ReportLab prints on the physical card, which
 * is English and fixed — the preview exists to show the card, so it has to lie
 * about the language rather than about the print.
 */
export function useFormat() {
  const locale = useLocale();

  return useMemo(() => {
    const tag = localeMeta(locale).intl;

    const date = new Intl.DateTimeFormat(tag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const time = new Intl.DateTimeFormat(tag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dateTime = new Intl.DateTimeFormat(tag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const number = new Intl.NumberFormat(tag);

    const parse = (value: string | number | Date) =>
      value instanceof Date ? value : new Date(value);

    return {
      date: (value: string | number | Date) => date.format(parse(value)),
      time: (value: string | number | Date) => time.format(parse(value)),
      dateTime: (value: string | number | Date) => dateTime.format(parse(value)),
      number: (value: number) => number.format(value),
    };
  }, [locale]);
}
