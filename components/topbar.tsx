"use client";

import { ThemeToggle } from "@/components/theme-toggle";

import { useEffect, useState } from "react";

import { usePageMeta } from "@/components/page-meta";

/**
 * The page's name, its size, and the time. Nothing else.
 *
 * A global search box and a notification bell used to sit here. Both are gone.
 * The search duplicated the one already on the visitor list a few pixels below
 * it — which was the only place a result could land anyway — and the bell
 * repeated the amber dot the rail already shows on Devices. A second control for
 * a job the page already does is not a feature; it is a thing to keep in sync.
 *
 * The clock stays because it duplicates nothing. Everything this app does is
 * measured against "doors open at nine", and a stopped clock is also the cheapest
 * possible proof that the tab has frozen.
 */
export function Topbar() {
  const { title, subtitle, count } = usePageMeta();
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
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

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/85 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="display truncate text-[1.35rem] leading-tight text-ink">
              {title}
            </h1>
            {count !== undefined ? (
              <span className="pill-status shrink-0 bg-card-2 text-ink-2">
                {count}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-sm text-ink-3">{subtitle}</p>
          ) : null}
        </div>

        <p
          suppressHydrationWarning
          className="mono hidden shrink-0 text-sm font-medium text-ink sm:block"
          aria-label="Local time"
        >
          {clock ?? "--:--"}
        </p>

        {/* Next to the clock rather than buried in a settings page: the reason
            anyone reaches for it is the room they are sitting in, and that
            changes during the day. */}
        <ThemeToggle compact />
      </div>
    </header>
  );
}
