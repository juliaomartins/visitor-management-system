"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { usePageMeta } from "@/components/page-meta";
import { logout } from "@/lib/auth";

/**
 * The page's name, its size, and the time.
 *
 * The clock is not decoration. Everything this app does is measured against
 * "doors open at nine" — an arrival is early or late, a badge is printed in time
 * or it is not — and a wall clock is the one thing a registration desk always has
 * and a laptop screen usually hides. It also proves the page is live: a frozen
 * clock is a frozen tab.
 */
export function Topbar() {
  const router = useRouter();
  const { title, subtitle, count } = usePageMeta();
  const [signingOut, setSigningOut] = useState(false);
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );

    // Deferred to its own task rather than run in the effect body, so mounting
    // does not cascade a second render before the first has painted.
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 20_000);

    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  }

  return (
    <header className="flex items-baseline gap-5 border-b border-line bg-card px-8 pt-7 pb-5">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className="display truncate text-[1.75rem] leading-none font-bold text-ink">
            {title}
          </h1>
          {count !== undefined ? (
            <span className="mono shrink-0 text-[0.8rem] text-ink-3">{count}</span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-1.5 truncate text-sm text-ink-2">{subtitle}</p>
        ) : null}
      </div>

      <div className="ml-auto flex shrink-0 items-baseline gap-5">
        <p
          suppressHydrationWarning
          className="mono text-[0.95rem] font-medium text-ink"
          aria-label="Local time"
        >
          {clock ?? "--:--"}
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-sm text-ink-3 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
