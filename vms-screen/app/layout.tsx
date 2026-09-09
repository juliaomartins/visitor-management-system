import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";

import { cookies } from "next/headers";

import { LocaleProvider } from "@/lib/i18n";
import {
  LOCALE_COOKIE,
  localeMeta,
  normaliseLocale,
  translate,
} from "@/lib/locales";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

/**
 * Archivo, matching the dashboard, and self-hosted at build time by next/font —
 * the event runs on a closed LAN with no route to Google's CDN.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Instrument Serif, italic, for the single word "Welcome".
 *
 * The greeting and the information should not be set in the same voice. One
 * weight, one style, one word — anything more and it stops being a flourish and
 * starts being a second typeface to manage.
 */
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

/**
 * The tab title, in the panel's language.
 *
 * Nobody in the lobby sees this — but the person setting three kiosks up from
 * one laptop sees three tabs, and they are easier to tell apart in the language
 * each screen is actually showing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = normaliseLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return {
    title: translate(locale, "meta.title"),
    description: translate(locale, "meta.description"),
  };
}

/** Kiosk: fill the panel, no pinch-zoom, no browser UI to reveal. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b1016",
};

/**
 * Async because the language is read here, on the server, before anything
 * renders.
 *
 * The theme can be corrected after the fact by a script in the head. The
 * language cannot: text that arrives in English and turns into Tetun during
 * hydration is a React mismatch and, on a wall-sized panel, a room-sized
 * flicker of the wrong words.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = normaliseLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={localeMeta(locale).html}
      /*
        The theme script below edits this element's class before React hydrates
        -- deliberately, so a light-mode operator never sees a full-wall white
        strobe. The client class therefore differs from the server's by design,
        and React would report that as a mismatch on every load.

        This applies to this element only, one level deep, so a real mismatch
        anywhere inside the app is still reported.
      */
      suppressHydrationWarning
      className={`${archivo.variable} ${instrument.variable} h-full`}
    >
      <head>
        {/*
          Runs before the first paint. The server renders dark, so only a
          light-mode operator would see a flash -- but on a wall-sized panel that
          flash is a full-screen white strobe, which is worth four lines of
          blocking script to avoid.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="h-full font-display antialiased">
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
