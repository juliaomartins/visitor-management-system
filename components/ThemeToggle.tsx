"use client";

import { useT } from "@/lib/i18n";
import { setTheme, useTheme } from "@/lib/theme";

/**
 * The theme control, sized for a wall rather than a desk.
 *
 * DELIBERATELY QUIET. Nobody in the lobby should be drawn to it; the only person
 * who ever presses it is staff, standing at the panel during setup. So it sits
 * with the connection dot in the corner, holds a low opacity until hovered or
 * focused, and never animates. A control that pulses on a welcome screen is
 * competing with the visitor's name.
 *
 * It is still a real button with a real label, because "the small grey square in
 * the corner" is not something you can tell a colleague over the phone.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const t = useT();
  const next = theme === "dark" ? "light" : "dark";
  // One message per destination rather than "Switch to" glued to an adjective:
  // the adjective agrees with a noun that is not in the fragment.
  const label = t(next === "dark" ? "theme.toDark" : "theme.toLight");

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="fixed bottom-[clamp(0.6rem,1.6vh,1.4rem)] left-[clamp(0.6rem,1.6vw,1.4rem)] z-50 flex h-[clamp(28px,3vh,44px)] w-[clamp(28px,3vh,44px)] items-center justify-center rounded-full bg-stage-raised/70 text-ink-faint opacity-35 ring-1 ring-edge backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-expo focus-visible:outline-none"
    >
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="h-1/2 w-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
      >
        {theme === "dark" ? (
          <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.6" />
            <path d="M10 1.8v1.6M10 16.6v1.6M18.2 10h-1.6M3.4 10H1.8M15.8 4.2l-1.1 1.1M5.3 14.7l-1.1 1.1M15.8 15.8l-1.1-1.1M5.3 5.3 4.2 4.2" />
          </>
        )}
      </svg>
    </button>
  );
}
