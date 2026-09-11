import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";

import { THEME_BOOTSTRAP } from "@/lib/theme";
import { WALL } from "@/lib/wall-copy";
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
 * The tab title. English, like the wall it titles.
 *
 * This used to be read from the locale cookie, which made the layout `async`
 * and the whole document language-dependent. Only `/pair` is translated now,
 * and a pairing screen does not need its own tab name.
 */
export const metadata: Metadata = {
  title: WALL.title,
  description: WALL.description,
};

/** Kiosk: fill the panel, no pinch-zoom, no browser UI to reveal. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b1016",
};

/**
 * THE DOCUMENT IS ENGLISH, AND ONLY `/pair` DEPARTS FROM THAT.
 *
 * This layout used to be `async` so it could read the locale cookie and set the
 * language for the whole app. The wall is English now, so it reads nothing and
 * declares `lang="en"` outright. `app/pair/layout.tsx` still reads the cookie
 * and still has to, for the reason this comment used to give: text that arrives
 * in one language and hydrates into another is a React mismatch.
 *
 * `lang` on a nested element wins for everything inside it, so the pairing
 * screen labels its own subtree and a screen reader picks the right voice there
 * without the wall ever claiming to be anything but English.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
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
        {children}
      </body>
    </html>
  );
}
