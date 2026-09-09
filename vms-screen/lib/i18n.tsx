"use client";

import {
  createContext,
  Fragment,
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
  ordinal,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/locales";

/**
 * The active language for the lobby panel.
 *
 * WHY THIS IS NOT SHAPED LIKE `lib/theme.ts`, which sits next to it. The theme
 * is a class name: the server renders dark, a pre-paint script can flip it, and
 * the markup never changes. A language IS the markup. If the server guessed
 * English and the kiosk wanted Tetun, React would hydrate over the whole panel
 * and swap every word — on a wall-sized display, in front of the people it is
 * meant to be welcoming.
 *
 * So the locale is read from a cookie by the root layout, a server component,
 * and handed down. The store below exists only so that changing the language
 * during setup re-renders without a reload.
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
 * The cookie is what makes the next server render agree with this one — which
 * matters more here than on a laptop, because a kiosk browser reloads on its
 * own after a power cut and nobody is standing there to fix it.
 */
export function setLocale(next: Locale): void {
  chosen = next;

  try {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // A locked-down kiosk browser still gets the language for this session.
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

/** The translator. `t("welcome.greeting")`. */
export function useT(): (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string {
  const locale = useLocale();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/**
 * A message with React nodes dropped into its placeholders.
 *
 * For the one sentence on this app that wraps a value in markup — the server
 * hint, which sets `http://` apart. Splitting it into halves would fix English
 * word order into every translation.
 */
export function useRichT(): (
  key: MessageKey,
  nodes: Record<string, ReactNode>,
) => ReactNode {
  const locale = useLocale();

  return useCallback(
    (key, nodes) => {
      const parts = translate(locale, key).split(/(\{\w+\})/g);

      return parts.map((part, index) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        return (
          <Fragment key={index}>
            {name && name in nodes ? nodes[name] : part}
          </Fragment>
        );
      });
    },
    [locale],
  );
}

/**
 * The clock, the date, and queue positions, in the active language.
 *
 * THE CLOCK IS THE REASON THIS EXISTS. `IdleScreen` renders a wall-sized time
 * and a date beneath it; both were coming from the host machine's locale, so a
 * kiosk installed as en-US showed an American date under a Tetun greeting.
 *
 * Tetum borrows pt-PT (see `lib/locales/index.ts`), and the date is numeric so
 * no Portuguese month name lands on a Tetun wall.
 */
export function useFormat() {
  const locale = useLocale();

  return useMemo(() => {
    const tag = localeMeta(locale).intl;

    const time = new Intl.DateTimeFormat(tag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const date = new Intl.DateTimeFormat(tag, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return {
      time: (value: Date) => time.format(value),
      date: (value: Date) => date.format(value),
      /** "Next" is a message; "2nd" is a language rule. See `ordinal`. */
      ordinal: (n: number) => ordinal(locale, n),
    };
  }, [locale]);
}
