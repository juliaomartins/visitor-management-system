"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { LocaleProvider } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import { makeQueryClient } from "@/lib/query-client";

/**
 * One QueryClient per browser session, created inside state so a Fast Refresh or
 * a re-render never swaps the cache out from under an in-flight query.
 */
export function Providers({
  children,
  locale,
}: {
  children: ReactNode;
  /** Read from the cookie by the root layout, so the server renders in it. */
  locale: Locale;
}) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initial={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}
