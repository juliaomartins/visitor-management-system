import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Three faces, three jobs, and no overlap.
 *
 * Bricolage Grotesque appears on page titles and visitor names only — it has the
 * squared, institutional cut of accreditation signage, and it would be exhausting
 * anywhere else. Inter does all the reading. JetBrains Mono is reserved for
 * machine-issued strings: serials, pairing codes, tokens, timestamps.
 *
 * next/font self-hosts all three at build time, which matters: the event runs on a
 * closed LAN with no route to Google's CDN.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
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
  title: "VMS — Visitor Management",
  description: "Event badge registration and arrivals, on the local network.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
