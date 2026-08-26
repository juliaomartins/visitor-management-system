import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

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
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="h-full font-display antialiased">{children}</body>
    </html>
  );
}
