"use client";

import { useT } from "@/lib/i18n";

/**
 * The one figure anyone shown this dashboard actually wants: how many of the
 * people we registered have walked through a door.
 *
 * WHY THIS IS NOT A FOURTH TILE. The page used to open with four identical
 * cards -- registered, arrived, refused, doors -- each with its own sparkline,
 * which gave "Registered" exactly as much weight as "Arrived" and read as a
 * grid of widgets rather than a designed surface. Four equal cards is also the
 * most generic thing a dashboard can be. So one number is large, everything
 * else gets quieter, and the page has a hierarchy.
 *
 * There is still no versus-last-week delta here. This system holds ONE event;
 * there is no last week, and inventing one would be a lie in the place people
 * look first. The relationship is real instead: this number inside another one.
 *
 * The warp stripes on the meter are the only ornament, and they are CSS rather
 * than the lobby screen's photographed tais -- a 300KB photograph for a band
 * behind a progress bar is not a trade worth making on a machine that is
 * offline by event day.
 *
 * THE FIGURE DOES NOT COUNT UP, AND IT DID UNTIL IT WAS PHOTOGRAPHED.
 *
 * A requestAnimationFrame count-up renders a number that is briefly WRONG, and
 * headless screenshots caught it at 0 in one frame and 75 in another where the
 * truth was 220. Everything that captures or throttles a page does the same:
 * Chrome throttles rAF in a background tab, which this app already documents
 * for the kiosk, and a stalled first frame would leave the headline reading
 * zero on a full hall.
 *
 * So the number is always the number, and the ceremony is a CSS rise on the
 * block that holds it -- declarative, degrades to plain visible text, and
 * incapable of displaying a value that is not true. `.vms-rise` is in
 * `globals.css` behind a reduced-motion guard.
 */
export function ArrivalHero({
  arrived,
  registered,
  vips,
  scans,
}: {
  arrived: number;
  /** Undefined while the visitor list is still loading. */
  registered?: number;
  vips?: number;
  /** Every badge presented today, refusals included. */
  scans?: number;
}) {
  const t = useT();

  const share =
    registered && registered > 0
      ? Math.min(Math.round((arrived / registered) * 100), 100)
      : null;

  return (
    <section className="card relative overflow-hidden p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium tracking-wide text-ink-3">
            {t("overview.arrivedToday")}
          </h2>

          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {/*
              Fluid rather than a breakpoint ladder: this is the one element
              whose whole job is to be large, and `clamp` keeps it large on a
              1920 panel without overflowing a 400px phone. `tabular-nums`
              because it animates -- proportional digits would jitter the
              width on every frame of the count-up.
            */}
            <p
              className="display vms-rise leading-[0.85] font-semibold text-ink tabular-nums"
              style={{ fontSize: "clamp(3.25rem, 11vw, 7.5rem)" }}
            >
              {arrived}
            </p>

            {registered === undefined ? null : (
              <p className="text-base text-ink-2">
                {t("overview.ofRegistered", { count: registered })}
                {vips ? (
                  <span className="text-ink-3">
                    {" · "}
                    {t("overview.vipCount", { count: vips })}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </div>

        {share === null ? null : (
          <p
            className="display shrink-0 text-3xl leading-none text-valid tabular-nums"
            aria-hidden
          >
            {share}%
          </p>
        )}
      </div>

      {share === null ? null : (
        <div
          className="mt-6"
          role="progressbar"
          aria-valuenow={arrived}
          aria-valuemin={0}
          aria-valuemax={registered}
          aria-label={t("overview.arrivedToday")}
        >
          <div className="h-3 overflow-hidden rounded-full bg-card-2">
            {/*
              Warp stripes: a nod to the tais the lobby screen carries, drawn
              rather than photographed. 3px on 6px, so it reads as weave at arm's
              length and as a solid bar from across a room -- which is the only
              distance the percentage matters from.
            */}
            <div
              className="h-full rounded-full bg-valid transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: `${share}%`,
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.22) 0 1px, transparent 1px 6px)",
              }}
            />
          </div>
        </div>
      )}

      {scans === undefined ? null : (
        <p className="mono mt-3 text-[11px] text-ink-3">
          {t(scans === 1 ? "overview.scanCountOne" : "overview.scanCountMany", {
            count: scans,
          })}
        </p>
      )}
    </section>
  );
}
