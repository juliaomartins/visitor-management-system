"use client";

import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/visitors";
import { DEFAULT_LOCALE, translate } from "@/lib/locales";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ArrivalHero } from "@/components/dashboard/ArrivalHero";
import { ArrivalsCurve } from "@/components/dashboard/ArrivalsCurve";
import { OutcomeSplit } from "@/components/dashboard/OutcomeSplit";
import { RecentArrivals } from "@/components/dashboard/RecentArrivals";
import { StatStrip, type StatCell } from "@/components/dashboard/StatStrip";
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
 * So it answers exactly those, in that order, and nothing else. Every number
 * here is fetched, not derived from a guess — there are no versus-last-week
 * deltas, because this system holds one event and there is no last week to
 * compare against.
 *
 * IT HAS A HIERARCHY NOW, AND IT DID NOT BEFORE. The page used to open with
 * four identical cards, so "Registered" carried exactly as much weight as
 * "Arrived" and the first thing anyone saw was a grid of widgets. One figure is
 * large — how many of the people we registered are actually in the building —
 * and everything else is a quiet band beneath it.
 */
export default function DashboardPage() {
  const t = useT();
  const today = todayISO();
  const report = useEntryReport({ from: today, to: today });

  const { data: visitors } = useQuery({
    queryKey: queryKeys.visitors({ overview: true }),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors", { signal });
      if (error) {
        throw new ApiError(
          translate(DEFAULT_LOCALE, "badges.loadFailed"),
          {},
          "badges.loadFailed",
        );
      }
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

  /*
    The busiest hour, which is the one figure the curve below cannot state
    exactly. Reduce rather than sort: sorting would copy the array to read one
    value out of it.
  */
  const hours = summary?.by_hour ?? [];
  const busiest = hours.reduce<(typeof hours)[number] | null>(
    (best, bucket) => (best === null || bucket.total > best.total ? bucket : best),
    null,
  );

  /*
    The supporting band. Doors is a link because it is the only one of these a
    reader can act on — a quiet door needs somebody to walk over and look at a
    phone, and the subtitle already tells them so.
  */
  const cells: StatCell[] = [
    {
      key: "refused",
      label: t("overview.refusedAtDoor"),
      value: summary ? refused : "—",
      /*
        The breakdown, which is the question a security review actually asks: a
        revoked badge is somebody whose registration was switched off, an
        invalid one is a code that resolves to nobody at all. Composed from the
        two outcome words rather than written as a message because it is a data
        label, not a sentence -- there is no grammar here to get wrong in
        Portuguese or Tetun, only two nouns and two numbers.

        This is also the figure that was wrong until today. It is
        `revoked + invalid`, and both came back as 1 whatever the day held.
      */
      note: summary
        ? `${summary.by_result.revoked} ${t("scan.revoked")} · ${
            summary.by_result.invalid
          } ${t("scan.invalid")}`
        : undefined,
      tone: refused > 0 ? "alert" : "plain",
    },
    {
      key: "duplicates",
      label: t("overview.duplicates"),
      value: summary ? summary.by_result.duplicate : "—",
      // Says what a duplicate IS. The count is already the figure above it, and
      // printing it twice in two different phrasings only invites the reader to
      // check whether they match.
      note: t("overview.duplicatesNote"),
    },
    {
      key: "doors",
      label: t("overview.doorsReporting"),
      value:
        online === undefined ? "—" : `${online}/${devices?.length ?? 0}`,
      note:
        silent > 0
          ? t("overview.silentCount", { count: silent })
          : t("overview.allCheckedIn"),
      tone: silent > 0 ? "warn" : "good",
      href: "/devices",
    },
    {
      key: "peak",
      label: t("overview.peakHour"),
      value: busiest
        ? `${String(new Date(busiest.hour).getHours()).padStart(2, "0")}:00`
        : "—",
      note: busiest
        ? t(
            busiest.total === 1
              ? "overview.scanCountOne"
              : "overview.scanCountMany",
            { count: busiest.total },
          )
        : undefined,
    },
  ];

  useSetPageMeta({
    title: t("nav.dashboard"),
    subtitle:
      silent > 0
        ? t(silent === 1 ? "overview.silentOne" : "overview.silentMany", {
            count: silent,
          })
        : t("overview.subtitleQuiet"),
  });

  return (
    <div className="space-y-5">
      <ArrivalHero
        arrived={arrived}
        registered={registered}
        vips={vips}
        scans={summary?.total}
      />

      <StatStrip cells={cells} />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
            <div>
              <h2 className="display text-[1.05rem] text-ink">
                {t("overview.arrivalsByHour")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">
                {t("overview.arrivalsByHourNote")}
              </p>
            </div>
            {summary ? (
              <p className="mono text-xs text-ink-3">
                {t(
                  summary.total === 1
                    ? "overview.scanCountOne"
                    : "overview.scanCountMany",
                  { count: summary.total },
                )}
              </p>
            ) : null}
          </div>

          {report.isPending ? (
            <p className="mono px-5 py-20 text-center text-xs text-ink-3">
              {t("common.loading")}
            </p>
          ) : report.isError ? (
            <p className="px-5 py-20 text-center text-sm text-revoked">
              {t("error.reportLoad")}
            </p>
          ) : (
            <ArrivalsCurve buckets={summary?.by_hour ?? []} />
          )}
        </section>

        <section className="card">
          <div className="px-5 pt-5 pb-3">
            <h2 className="display text-[1.05rem] text-ink">
              {t("overview.outcomeSplit")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              {t("overview.outcomeSplitNote")}
            </p>
          </div>

          {summary ? (
            <OutcomeSplit summary={summary} />
          ) : (
            <p className="mono px-5 py-20 text-center text-xs text-ink-3">
              {t("common.loading")}
            </p>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
          <div>
            <h2 className="display text-[1.05rem] text-ink">
              {t("overview.recentScans")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              {t("overview.recentScansNote")}
            </p>
          </div>
          <Link
            href="/visitors/new"
            className="btn btn-primary"
          >
            {t("visitors.register")}
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
