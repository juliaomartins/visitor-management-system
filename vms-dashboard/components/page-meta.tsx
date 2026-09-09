"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lets a page fill in the topbar the layout owns.
 *
 * The layout renders the chrome, but only the page knows how many records came
 * back. Passing the count down would mean fetching it twice — once for the table
 * and once for the header — and two subscriptions can briefly disagree. This way
 * there is one query and one number.
 */
export type PageMeta = {
  title: string;
  subtitle?: string;
  count?: number;
};

type Store = {
  meta: PageMeta;
  setMeta: (meta: PageMeta) => void;
};

const PageMetaContext = createContext<Store | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PageMeta>({ title: "" });
  const value = useMemo(() => ({ meta, setMeta }), [meta]);

  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>;
}

export function usePageMeta(): PageMeta {
  const store = useContext(PageMetaContext);
  if (!store) throw new Error("usePageMeta must be used inside PageMetaProvider");
  return store.meta;
}

/** Called by a page to publish its heading and record count. */
export function useSetPageMeta(meta: PageMeta): void {
  const store = useContext(PageMetaContext);
  if (!store) throw new Error("useSetPageMeta must be used inside PageMetaProvider");

  const { setMeta } = store;
  const { title, subtitle, count } = meta;

  useEffect(() => {
    setMeta({ title, subtitle, count });
  }, [setMeta, title, subtitle, count]);
}
