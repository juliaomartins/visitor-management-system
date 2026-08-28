import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";

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

export const metadata: Metadata = {
  title: "Arrivals",
  description: "Lobby arrivals display.",
};

/** Kiosk: fill the panel, no pinch-zoom, no browser UI to reveal. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable} h-full`}>
      <body className="h-full font-display antialiased">{children}</body>
    </html>
  );
}
