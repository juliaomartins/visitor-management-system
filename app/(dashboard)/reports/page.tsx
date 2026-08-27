"use client";

import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { EntryChart } from "@/components/reports/EntryChart";
import { EntryTable } from "@/components/reports/EntryTable";
import {
  downloadEntriesCsv,
  todayISO,
  useEntryReport,
  type ReportFilters,
} from "@/lib/reports";
import { ApiError } from "@/lib/visitors";

/**
 * The entrance log: attendance record and security audit, one page.
 *
 * The result filter defaults to nothing, so refusals are in the first view rather
 * than behind a toggle. Someone opening this after an incident should not have to
 * know which control reveals the thing they came to find.
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
  const [exporting, setExporting] = useState(false);
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

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadEntriesCsv(filters);
    } catch (cause) {
      setExportError(
        cause instanceof ApiError ? cause.message : "The export could not be saved.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Filters in one row above the data, as a group. */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(event) => update({ from: event.target.value })}
            className="rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:border-ink"
          />
        </Field>

        <Field label="To">
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(event) => update({ to: event.target.value })}
            className="rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:border-ink"
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
            className="w-36 rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-ink"
          />
        </Field>

        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || !data}
          className="ml-auto rounded-md border border-line px-3.5 py-2 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {exportError ? (
        <p role="alert" className="text-sm text-revoked">
          {exportError}
        </p>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Scans" value={summary.total} />
          <Stat label="People" value={summary.unique_visitors} />
          <Stat label="Duplicates" value={summary.by_result.duplicate} />
          <Stat
            label="Refused"
            value={refused}
            // The one number on this page that should catch an eye passing over it.
            tone={refused > 0 ? "alert" : undefined}
          />
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-card">
        {isPending ? (
          <p className="mono px-6 py-12 text-center text-xs text-ink-3">Loading…</p>
        ) : isError ? (
          <div className="px-6 py-12 text-center">
            <p className="display text-lg font-semibold text-revoked">Could not load the log</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
              {error instanceof ApiError
                ? error.message
                : "The request failed before it reached the server."}
            </p>
          </div>
        ) : (
          <>
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
      className="rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:border-ink"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "alert";
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        tone === "alert" ? "border-revoked/40 bg-revoked-soft" : "border-line bg-card"
      }`}
    >
      <p className="text-xs text-ink-3">{label}</p>
      <p
        className={`mono mt-1 text-2xl font-semibold tabular-nums ${
          tone === "alert" ? "text-revoked" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
