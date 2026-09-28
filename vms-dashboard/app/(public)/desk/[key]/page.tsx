import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeskFlow } from "@/components/desk/DeskFlow";

/**
 * The walk-in desk, at a path nobody publishes.
 *
 * THE KEY IS OBSCURITY, NOT THE LOCK, and it is worth being exact about which
 * is which. The lock is the paired desk token: the backend refuses both desk
 * routes without one, and an admin revokes it from `/devices`. The key keeps
 * the page from being found by someone walking the dashboard's routes, and it
 * keeps it out of search and crawlers (`robots` below, and no link anywhere in
 * the app points at it).
 *
 * WHAT IT DOES NOT DO is hide the page from somebody watching the LAN. The
 * event runs on plain http (CLAUDE.md constraint #9), so a key in a URL crosses
 * the air in clear text, as does the pairing code and the token itself. That is
 * why this page can reach exactly two routes and why neither of them can read a
 * visitor back.
 *
 * A short key is refused outright, so `/desk/test` is a 404 rather than a form:
 * the links the dashboard hands out are 24 characters.
 */
const MIN_KEY_LENGTH = 16;

export const metadata: Metadata = {
  title: "Walk-in desk — DRCC 2026",
  robots: { index: false, follow: false },
};

export default async function DeskPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (key.length < MIN_KEY_LENGTH) notFound();

  return (
    <div className="public-light min-h-dvh">
      <DeskFlow />
    </div>
  );
}
