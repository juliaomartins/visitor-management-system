"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ArrivalsCurve } from "@/components/dashboard/ArrivalsCurve";
import { OutcomeSplit } from "@/components/dashboard/OutcomeSplit";
import { RecentArrivals } from "@/components/dashboard/RecentArrivals";
import { StatTile } from "@/components/dashboard/StatTile";
import { useSetPageMeta } from "@/components/page-meta";
import { api } from "@/lib/api";
import { isSilent, useDevices, useNow } from "@/lib/devices";
import { queryKeys } from "@/lib/query-client";
import { todayISO, useEntryReport } from "@/lib/reports";

/**
 * The room, at a glance.
 *
 * This page did not exist before, and its absence was the real gap in the last
 * design: signing in dropped you straight into a list of 250 names with no way to
 * know whether the doors were busy, whether anything had been refused, or whether
 * a phone had stopped reporting. Every one of those questions had to be answered
 * by opening a different page and reading a table.
 *
 * So it answers exactly those, in that order, and nothing else. Four figures, the
 * shape of the day, how the scans divided, and the last badges presented. Every
 * number here is fetched, not derived from a guess — there are no
 * versus-last-week deltas, because this system holds one event and there is no
 * last week to compare against.
 */
export default function DashboardPage() {
  const today = todayISO();
  const report = useEntryReport({ from: today, to: today });

  const { data: visitors } = useQuery({
    queryKey: queryKeys.visitors({ overview: true }),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors", { signal });
      if (error) throw new Error("The visitor list could not be loaded.");
      return data;
    },
  });

  const { data: devices } = useDevices();
  const now = useNow();

  const summary = report.data?.summary;
  const registered = visitors?.length;
  const vips = visitors?.filter((visitor) => visitor.category === "vip").length;

  const arrived = summary?.unique_visitors ?? 0;
  const refused =
    (summary?.by_result.invalid ?? 0) + (summary?.by_result.revoked ?? 0);

  const online = devices?.filter((device) => !isSilent(device, now)).length;
  const silent = devices?.filter((device) => isSilent(device, now)).length ?? 0;

  // Real per-hour magnitudes for the sparklines, or nothing at all.
  const hours = summary?.by_hour ?? [];
  const arrivalSpark = hours.map((bucket) => bucket.valid);
  const refusedSpark = hours.map((bucket) => bucket.refused);

  useSetPageMeta({
    title: "Dashboard",
    subtitle:
      silent > 0
        ? `${silent} ${silent === 1 ? "door has" : "doors have"} gone quiet — check Devices`
        : "Today's arrivals across every door",
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Registered"
          value={registered ?? "—"}
          note={vips === undefined ? undefined : `${vips} VIP`}
        />
        <StatTile
          label="Arrived today"
          value={arrived}
          note={
            registered
              ? `${Math.round((arrived / registered) * 100)}% of those registered`
              : undefined
          }
          tone="good"
          spark={arrivalSpark}
        />
        <StatTile
          label="Refused at the door"
          value={refused}
          note={
            summary
              ? `${summary.by_result.duplicate} duplicate ${
                  summary.by_result.duplicate === 1 ? "scan" : "scans"
                } not counted`
              : undefined
          }
          tone={refused > 0 ? "alert" : "plain"}
          spark={refusedSpark}
        />
        <StatTile
          label="Doors reporting"
          value={
            online === undefined ? "—" : `${online}/${devices?.length ?? 0}`
          }
          note={silent > 0 ? `${silent} silent` : "All checked in recently"}
          tone={silent > 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
            <div>
              <h2 className="display text-[1.05rem] text-ink">Arrivals by hour</h2>
              <p className="mt-0.5 text-xs text-ink-3">
                Every badge presented today, plotted where it happened
              </p>
            </div>
            {summary ? (
              <p className="mono text-xs text-ink-3">
                {summary.total} {summary.total === 1 ? "scan" : "scans"}
              </p>
            ) : null}
          </div>

          {report.isPending ? (
            <p className="mono px-5 py-20 text-center text-xs text-ink-3">
              Loading…
            </p>
          ) : report.isError ? (
            <p className="px-5 py-20 text-center text-sm text-revoked">
              The entrance log could not be loaded.
            </p>
          ) : (
            <ArrivalsCurve buckets={summary?.by_hour ?? []} />
          )}
        </section>

        <section className="card">
          <div className="px-5 pt-5 pb-3">
            <h2 className="display text-[1.05rem] text-ink">Outcome split</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              How today&rsquo;s scans divided
            </p>
          </div>

          {summary ? (
            <OutcomeSplit summary={summary} />
          ) : (
            <p className="mono px-5 py-20 text-center text-xs text-ink-3">
              Loading…
            </p>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
          <div>
            <h2 className="display text-[1.05rem] text-ink">Recent scans</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Newest first, refusals included
            </p>
          </div>
          <Link
            href="/visitors/new"
            className="btn btn-primary"
          >
            Register visitor
          </Link>
        </div>

        {report.isPending ? (
          <p className="mono px-5 py-16 text-center text-xs text-ink-3">
            Loading…
          </p>
        ) : (
          <RecentArrivals entries={(report.data?.entries ?? []).slice(0, 8)} />
        )}
      </section>
    </div>
  );
}
