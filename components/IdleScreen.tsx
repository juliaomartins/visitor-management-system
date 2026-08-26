"use client";

import { useEffect, useState } from "react";

/**
 * What the wall shows for most of the day.
 *
 * Between arrival waves this is on screen for tens of minutes at a time, so it is
 * quiet on purpose: no logo animation, no rotating tips, nothing that draws the
 * eye of someone waiting nearby. A clock, because a lobby display that shows the
 * time is useful even when it has nothing to announce, and because a ticking
 * clock is how staff across the room can tell the machine has not frozen.
 *
 * It also stops the panel burning in — the clock moves, and it is the only bright
 * element.
 */
export function IdleScreen({ waiting }: { waiting: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  // Client only: a server-rendered time hydrates mismatched. The first read is
  // deferred to its own task rather than run in the effect body, so mounting does
  // not cascade a second render before the browser has painted the first.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[2vh]">
      <p
        suppressHydrationWarning
        className="text-[clamp(4rem,12vw,11rem)] leading-none font-bold tracking-tight text-ink tabular-nums"
      >
        {now
          ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : " "}
      </p>

      <p className="text-[clamp(1.25rem,2.2vw,2.25rem)] font-medium tracking-[0.28em] text-ink-faint uppercase">
        {waiting ? "Waiting for arrivals" : "Welcome"}
      </p>
    </div>
  );
}
