"use client";

import { useLocale } from "@/lib/i18n";
import { localeMeta } from "@/lib/locales";

/**
 * The element that declares what language the pairing screen is in.
 *
 * WHY THIS IS A CLIENT COMPONENT AND NOT A `lang` ON THE LAYOUT'S OWN DIV.
 * `app/pair/layout.tsx` is a server component: it reads the cookie once, at
 * request time, and does not re-render when someone presses the language
 * control. A `lang` written there would be correct on load and then quietly
 * stale for the rest of the session — right in the one case it exists for,
 * which is somebody switching because they cannot read the current language.
 *
 * Reading `useLocale()` here instead means the attribute follows the switch in
 * the same render as the words do.
 *
 * IT IS ALSO WHY `setLocale` NO LONGER TOUCHES `document.documentElement.lang`.
 * That worked when the whole app shared one language. It does not now: `<html>`
 * is `lang="en"` for the wall, and `PairPage` navigates to `/` the moment
 * pairing succeeds — so a switch to Tetun on the way in would have left the
 * lobby display labelled Tetun in the DOM, announcing English words in a
 * Tetun voice to anyone using a screen reader.
 */
export function LocaleShell({ children }: { children: React.ReactNode }) {
  return (
    <div lang={localeMeta(useLocale()).html} className="h-full">
      {children}
    </div>
  );
}
