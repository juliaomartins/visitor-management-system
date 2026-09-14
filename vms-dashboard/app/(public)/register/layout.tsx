import type { Metadata } from "next";

/**
 * The public registration page's own shell: no sidebar, no session, always light.
 *
 * Outside the `(dashboard)` group, and let through by `proxy.ts`, so it renders
 * for a phone with no session at all. `.public-light` pins the light palette on
 * this subtree -- see globals.css for why a QR page must not follow dark mode.
 */
export const metadata: Metadata = {
  title: "Register — DRCC 2026",
  description: "Register yourself for the Díli Regional Cooperative Conference.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-light min-h-screen">{children}</div>;
}
