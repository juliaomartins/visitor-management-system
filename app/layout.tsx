import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Archivo for everything a person reads, IBM Plex Mono for everything a machine
 * issued — badge serials, device tokens, counts. next/font self-hosts both at
 * build time, which matters: the event runs on a closed LAN with no route to
 * Google's CDN.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
