"use client";

import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/visitors";
import { DEFAULT_LOCALE, translate } from "@/lib/locales";
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

  // Real per-hour magnitudes for the sparklines, or nothing at all.
  const hours = summary?.by_hour ?? [];
  const arrivalSpark = hours.map((bucket) => bucket.valid);
  const refusedSpark = hours.map((bucket) => bucket.refused);

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("overview.registered")}
          value={registered ?? "—"}
          note={
            vips === undefined
              ? undefined
              : t("overview.vipCount", { count: vips })
          }
        />
        <StatTile
          label={t("overview.arrivedToday")}
          value={arrived}
          note={
            registered
              ? t("overview.arrivedNote", {
                  percent: Math.round((arrived / registered) * 100),
                })
              : undefined
          }
          tone="good"
          spark={arrivalSpark}
        />
        <StatTile
          label={t("overview.refusedAtDoor")}
          value={refused}
          note={
            summary
              ? t(
                  summary.by_result.duplicate === 1
                    ? "overview.duplicateOne"
                    : "overview.duplicateMany",
                  { count: summary.by_result.duplicate },
                )
              : undefined
          }
          tone={refused > 0 ? "alert" : "plain"}
          spark={refusedSpark}
        />
        <StatTile
          label={t("overview.doorsReporting")}
          value={
            online === undefined
              ? "—"
              : `${online}/${devices?.length ?? 0}`
          }
          note={
            silent > 0
              ? t("overview.silentCount", { count: silent })
              : t("overview.allCheckedIn")
          }
          tone={silent > 0 ? "warn" : "good"}
        />
      </div>

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
