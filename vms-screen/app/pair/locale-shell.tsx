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
    /*
      THIS ELEMENT IS ALSO THE PAIRING ROUTE'S SCROLL CONTAINER, and the kiosk
      rules are lifted here and nowhere else.

      `globals.css` gives `html, body` `overflow: hidden`, `cursor: none` and
      `user-select: none`. All three are right for the wall — a lobby display
      must never scroll, show a pointer, or highlight a name someone brushed —
      and all three were wrong here: the Pair button fell below the fold with no
      way to reach it, an installer with a mouse could not see what they were
      clicking, and a server address could not be selected to copy.

      Scrolling this element rather than `body` keeps the wall's rule intact:
      `/` never mounts this shell, so it stays locked exactly as before.
      `scrollbar-gutter: stable` reserves the bar's width up front, so the layout
      does not jump sideways the moment a short window starts to need it.
    */
    <div
      lang={localeMeta(useLocale()).html}
      className="scrollbar-gutter-stable h-full cursor-auto overflow-y-auto overscroll-contain select-text"
    >
      {children}
    </div>
  );
}
