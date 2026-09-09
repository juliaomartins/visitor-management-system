import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadLocale, saveLocale } from "@/storage/locale";
import {
  DEFAULT_LOCALE,
  translate,
  type Locale,
  type MessageKey,
} from "@/locales";

/**
 * The active language, shaped like `session.tsx` next door.
 *
 * A CONTEXT, NOT A MODULE STORE. The two web apps read their locale from a
 * cookie during server rendering; a native app has no server render and no
 * cookie, so the read is asynchronous and the app has to wait for it. That is
 * the same shape the keystore read already has, so this follows the same
 * pattern rather than inventing a second one.
 *
 * `ready` is what the root layout gates on. Without it the first frame would be
 * English and the second would be Tetun — on a phone that is a visible flicker
 * every cold start, and the launch animation is already covering that window
 * for the keystore, so waiting here is free.
 */
type LocaleState = {
  locale: Locale;
  /** False until the keystore has answered. The launch screen holds on this. */
  ready: boolean;
  setLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadLocale().then((stored) => {
      if (cancelled) return;
      setLocaleState(stored);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    // Applied immediately, persisted in the background. A guard who taps a
    // language should see it change now, not after a keystore round trip.
    setLocaleState(next);
    void saveLocale(next);
  }, []);

  const value = useMemo(
    () => ({ locale, ready, setLocale }),
    [locale, ready, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function useLocaleState(): LocaleState {
  const state = useContext(LocaleContext);
  if (!state) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return state;
}

export function useLocale(): LocaleState {
  return useLocaleState();
}

/** The translator. `t("verdict.valid.headline")`. */
export function useT(): (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string {
  const { locale } = useLocaleState();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/**
 * A message with nodes dropped into its placeholders.
 *
 * For the two sentences that set `ipconfig` in mono inside running text.
 * Splitting them into "before" and "after" halves would fix English word order
 * into every translation -- Portuguese puts the command at the end of the
 * clause, Tetun somewhere else again -- so the whole sentence stays one
 * translatable message and this splits the TRANSLATED string.
 *
 * The pieces are returned as an array, which React Native renders inside a
 * <Text> exactly as the web renders it inside a <p>.
 */
export function useRichT(): (
  key: MessageKey,
  nodes: Record<string, ReactNode>,
) => ReactNode {
  const { locale } = useLocaleState();

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
