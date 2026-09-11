import { cookies } from "next/headers";

import { LanguageToggle } from "@/components/LanguageToggle";
import { LocaleProvider } from "@/lib/i18n";
import { LOCALE_COOKIE, normaliseLocale } from "@/lib/locales";

import { LocaleShell } from "./locale-shell";

/**
 * The only translated part of this app.
 *
 * THE PROVIDER LIVES HERE RATHER THAN IN THE ROOT LAYOUT, AND THAT ONE MOVE IS
 * WHAT MAKES THE WALL ENGLISH.
 *
 * `LocaleContext` is created with `"en"` as its default, so any component that
 * calls `useT()` outside a provider resolves English on its own. Scoping the
 * provider to this route therefore needs no flag, no branch and no second copy
 * of anything: `/` renders English because nothing above it supplies a locale,
 * and `/pair` renders the installer's language because this does.
 *
 * `components/ServerSetup.tsx` is the case that makes it worth doing this way
 * rather than with a prop. It appears on BOTH routes — the wall shows it when
 * it cannot find the server, and pairing shows it before the code field. One
 * component, translated during setup and English on the wall, with nothing in
 * the component aware of the difference.
 *
 * STILL A SERVER READ, STILL A COOKIE. The stakes are lower here than they were
 * on the wall — a pairing screen flickering through a hydration swap is seen by
 * one installer, not a lobby — but the fix costs nothing and the alternative is
 * a React mismatch on every load of this page.
 */
export default async function PairLayout({ children }: LayoutProps<"/pair">) {
  const locale = normaliseLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    /*
      `LocaleShell` puts `lang` on a wrapper rather than on <html>, which stays
      "en" for the wall. The nearest ancestor's `lang` is what a screen reader
      consults, so this labels the pairing screen correctly without the document
      lying about the language of everything else — and it is a client component
      so the attribute follows a live switch. See the note in that file.
    */
    <LocaleProvider initial={locale}>
      <LocaleShell>
        {children}

        {/*
          Mounted by the layout rather than the page, because `PairPage` has two
          returns — the server-address form when it cannot find the backend, and
          the code field when it can. An installer who is stuck on the first one
          is exactly the person most likely to need a different language, so the
          control has to survive both.
        */}
        <LanguageToggle />
      </LocaleShell>
    </LocaleProvider>
  );
}
