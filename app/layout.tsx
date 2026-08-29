import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { Providers } from "./providers";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
