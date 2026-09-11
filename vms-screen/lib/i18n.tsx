"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/locales";

/**
 * The active language for the PAIRING screen. Nothing else in this app has one.
 *
 * The wall is English and its words are constants in `lib/wall-copy.ts`. What
 * remains translated is setup: the language control, the pairing form and
 * finding the server. `app/pair/layout.tsx` is the only place that mounts the
 * provider below — see the note there for why scoping it is all it takes.
 *
 * WHY THIS IS NOT SHAPED LIKE `lib/theme.ts`, which sits next to it. The theme
 * is a class name: the server renders dark, a pre-paint script can flip it, and
 * the markup never changes. A language IS the markup, so text that arrives in
 * one language and hydrates into another is a React mismatch over the whole
 * screen.
 *
 * So the locale is read from a cookie by the pair layout, a server component,
 * and handed down. The store below exists only so that changing the language
 * during setup re-renders without a reload.
 *
 * `useFormat` used to live at the bottom of this file — a clock, a date and
 * queue ordinals in the active language. Every one of its callers was on the
 * wall, so it moved to `wallFormat` in `lib/wall-copy.ts` and is pinned to
 * en-GB there.
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
 * The cookie is what makes the next server render agree with this one, and it
 * outlives the setup session on purpose: an installer who comes back to `/pair`
 * — or unpairs and sets the machine up again — lands in the language they
 * chose. The wall ignores the cookie entirely.
 *
 * THIS NO LONGER WRITES `document.documentElement.lang`, and must not. `<html>`
 * is `lang="en"` for the wall now, and this page navigates to `/` as soon as
 * pairing succeeds — so relabelling the document here would follow the operator
 * onto the lobby display. `app/pair/locale-shell.tsx` owns the attribute, on a
 * wrapper, where it belongs to this route alone.
 */
export function setLocale(next: Locale): void {
  chosen = next;

  try {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // A locked-down kiosk browser still gets the language for this session.
  }

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

/** The translator. `t("pair.title")`. */
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
