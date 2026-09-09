import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";

import { Providers } from "./providers";
import { LOCALE_COOKIE, localeMeta, normaliseLocale } from "@/lib/locales";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

/**
 * Three faces, three jobs, and no overlap.
 *
 * Inter does all the reading — labels, table cells, body copy — and nobody should
 * notice it. Plus Jakarta Sans is a touch warmer and carries the headings and the
 * big figures, which is the whole reason it is here: a number should feel spoken,
 * not typed. JetBrains Mono is reserved for machine-issued strings — serials,
 * pairing codes, timestamps.
 *
 * next/font self-hosts all three at build time, which matters: the event runs on a
 * closed LAN with no route to Google's CDN.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DRCC 2026 — Accreditation",
  description: "Event badge registration and arrivals, on the local network.",
};

/**
 * Async because the language is read here, on the server, before anything
 * renders.
 *
 * The theme can be corrected after the fact by a script in the head; the
 * language cannot. Text that arrives in English and turns into Tetum during
 * hydration is a React mismatch and a visible flicker on every navigation, so
 * the cookie is read up front and the very first byte is already in the right
 * language. `lib/locales/index.ts` explains why it is a cookie and not
 * localStorage.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = normaliseLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={localeMeta(locale).html}
      /*
        THE THEME SCRIPT BELOW EDITS THIS ELEMENT'S CLASS BEFORE REACT HYDRATES,
        which is the whole point of it -- it has to beat the first paint or a
        dark-mode user gets a white flash. The consequence is that the client's
        `className` legitimately differs from the server's, and React reports it
        as a hydration mismatch on every page load.

        `suppressHydrationWarning` applies to this element only, one level deep,
        so a genuine mismatch anywhere inside the app is still reported. Removing
        it does not fix anything; it just brings the warning back.
      */
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        {/*
          Runs before the first paint. Without it the server's light markup
          paints, React hydrates, and only then does the class land -- a white
          flash on every navigation for anyone working in dark mode. It reads
          one localStorage key and sets one class; nothing else belongs here.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
