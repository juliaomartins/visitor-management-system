"use client";

import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { EntryChart } from "@/components/reports/EntryChart";
import { EntryTable } from "@/components/reports/EntryTable";
import { Recap } from "@/components/reports/Recap";
import {
  downloadEntriesExport,
  REPORT_FORMATS,
  todayISO,
  useEntryReport,
  type ReportFilters,
  type ReportFormat,
} from "@/lib/reports";
import { ApiError } from "@/lib/visitors";

/**
 * The entrance report: attendance record and security audit, one page.
 *
 * RECAP FIRST, LOG LAST. The findings, the load per door and the people who never
 * arrived come before the table, because a table answers "what happened" and
 * almost nobody opening this page wants to start there. The raw rows are still
 * underneath for anyone checking the arithmetic.
 *
 * The result filter defaults to nothing, so refusals are in the first view rather
 * than behind a toggle. Someone opening this after an incident should not have to
 * know which control reveals the thing they came to find.
 *
 * Three exports, and they are genuinely different things rather than the same
 * table in three wrappers: the PDF is the written report, the workbook is the
 * figures to pivot, the CSV is the raw log.
 */
const RESULTS = [
  { value: "", label: "All outcomes" },
  { value: "valid", label: "Valid" },
  { value: "duplicate", label: "Duplicate" },
  { value: "revoked", label: "Revoked" },
  { value: "invalid", label: "Invalid" },
];

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "normal", label: "Normal" },
  { value: "vip", label: "VIP" },
];

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    from: todayISO(),
    to: todayISO(),
  }));
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isPending, isError, error } = useEntryReport(filters);
  const summary = data?.summary;
  const refused = (summary?.by_result.invalid ?? 0) + (summary?.by_result.revoked ?? 0);

  useSetPageMeta({
    title: "Entrance log",
    subtitle: summary
      ? refused > 0
        ? `${refused} refused at the door`
        : "No badges refused in this range"
      : "Arrivals and refusals",
    count: summary?.total,
  });

  const update = (patch: Partial<ReportFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  async function exportAs(format: ReportFormat) {
    setExporting(format);
    setExportError(null);
    try {
      await downloadEntriesExport(filters, format);
    } catch (cause) {
      setExportError(
        cause instanceof ApiError ? cause.message : "The export could not be saved.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Filters in one row above the data, as a group. */}
      <div className="card flex flex-wrap items-end gap-3 p-4 sm:p-5">
        <Field label="From">
          <input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(event) => update({ from: event.target.value })}
            className="field"
          />
        </Field>

        <Field label="To">
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(event) => update({ to: event.target.value })}
            className="field"
          />
        </Field>

        <Field label="Outcome">
          <Select
            value={filters.result ?? ""}
            options={RESULTS}
            onChange={(value) => update({ result: value || undefined })}
          />
        </Field>

        <Field label="Category">
          <Select
            value={filters.category ?? ""}
            options={CATEGORIES}
            onChange={(value) => update({ category: value || undefined })}
          />
        </Field>

        <Field label="Country">
          <input
            type="search"
            value={filters.country ?? ""}
            onChange={(event) => update({ country: event.target.value || undefined })}
            placeholder="Any"
            className="field w-36"
          />
        </Field>

      </div>

      {/*
        Three formats, each labelled with the job it does. A row of buttons
        reading "PDF / Excel / CSV" makes somebody guess which one they want; the
        hint under each says it, so nobody exports the wrong thing and opens it
        to find out.
      */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-[1.05rem] text-ink">Download this report</h2>
          <p className="mono text-xs text-ink-3">
            {filters.from === filters.to
              ? filters.from
              : `${filters.from} → ${filters.to}`}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-ink-3">
          Whatever the filters above are set to, exactly as shown.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {REPORT_FORMATS.map((option) => (
            <button
              key={option.format}
              type="button"
              onClick={() => exportAs(option.format)}
              disabled={exporting !== null || !data}
              className="card cursor-pointer p-4 text-left transition-colors hover:border-accent disabled:cursor-default disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-ink">
                {exporting === option.format ? "Preparing…" : option.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-3">
                {option.hint}
              </span>
            </button>
          ))}
        </div>

        {exportError ? (
          <p role="alert" className="mt-3 text-sm text-revoked">
            {exportError}
          </p>
        ) : null}
      </div>

      {data ? <Recap report={data} /> : null}

      <section className="card">
        {isPending ? (
          <p className="mono px-6 py-12 text-center text-xs text-ink-3">Loading…</p>
        ) : isError ? (
          <div className="px-6 py-12 text-center">
            <p className="display text-lg text-revoked">Could not load the log</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
              {error instanceof ApiError
                ? error.message
                : "The request failed before it reached the server."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
              <h2 className="display text-[1.05rem] text-ink">
                Every badge presented
              </h2>
              <p className="text-xs text-ink-3">
                The rows behind the figures above, refusals included
              </p>
            </div>

            <EntryChart buckets={data.summary.by_hour} />
            <div className="border-t border-line">
              <EntryTable entries={data.entries} />
            </div>
            <p className="border-t border-line px-6 py-3 text-xs text-ink-3">
              Times shown in {data.timezone}.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="field"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
