"use client";

import { setTheme, useTheme } from "@/lib/theme";

/**
 * One button, two states, and it says which one it will give you.
 *
 * Not a three-way light/dark/system control. System is already the opening guess
 * in `lib/theme.ts`; exposing it as a third position asks the registrar to hold a
 * concept they do not need at a desk with a queue in front of it. The label names
 * the destination — "Dark" switches to dark — because a control that names its
 * current state is ambiguous the moment you look away from the screen.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex items-center gap-2 rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        compact ? "h-9 w-9 justify-center" : "h-9 px-3"
      }`}
    >
      <Glyph dark={theme === "dark"} />
      {compact ? null : (
        <span className="text-xs font-medium capitalize">{next}</span>
      )}
    </button>
  );
}

/**
 * Sun and moon, drawn rather than pulled from an icon set.
 *
 * `suppressHydrationWarning` is not used and is not needed: the store's server
 * snapshot is light, and the head script has already set the class, so the only
 * thing that can differ is this glyph for one frame. Rendering both paths and
 * hiding one would cost more than it saves.
 */
function Glyph({ dark }: { dark: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      {dark ? (
        <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" />
      ) : (
        <>
          <circle cx="10" cy="10" r="3.6" />
          <path d="M10 1.8v1.6M10 16.6v1.6M18.2 10h-1.6M3.4 10H1.8M15.8 4.2l-1.1 1.1M5.3 14.7l-1.1 1.1M15.8 15.8l-1.1-1.1M5.3 5.3 4.2 4.2" />
        </>
      )}
    </svg>
  );
}
