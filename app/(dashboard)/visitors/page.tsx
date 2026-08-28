"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { downloadRoster } from "@/lib/badges";

import { useSetPageMeta } from "@/components/page-meta";
import { api, type Visitor, type VisitorCategory } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

type CategoryFilter = VisitorCategory | "all";

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "normal", label: "Normal" },
  { value: "vip", label: "VIP" },
];

/** Long enough to finish typing a surname, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 250;

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export default function VisitorsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const debouncedSearch = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // At a registration desk this list is searched far more than it is read, and
  // the hand is on the keyboard between guests. "/" puts the cursor in the box
  // from anywhere on the page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const query = useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(category === "all" ? {} : { category }),
    }),
    [debouncedSearch, category],
  );

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: queryKeys.visitors(query),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors", {
        params: { query },
        signal,
      });
      if (error) throw new Error("The server rejected that request.");
      return data;
    },
  });

  const visitors = data ?? [];
  const filtered = Boolean(debouncedSearch) || category !== "all";

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportRoster() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadRoster();
    } catch {
      setExportError("The roster could not be exported.");
    } finally {
      setExporting(false);
    }
  }

  useSetPageMeta({
    title: "Visitors",
    subtitle: "Everyone registered for the event",
    count: data ? visitors.length : undefined,
  });

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="visitor-search" className="sr-only">
            Search visitors
          </label>
          <input
            id="visitor-search"
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("");
            }}
            placeholder="Name, organisation, country or badge serial"
            className="field pr-10"
          />
          <kbd
            aria-hidden
            className="mono pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3"
          >
            /
          </kbd>
        </div>

        <div
          role="group"
          aria-label="Filter by category"
          className="flex rounded-lg bg-card-2 p-1"
        >
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={category === tab.value}
              onClick={() => setCategory(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                category === tab.value
                  ? "bg-card font-medium text-ink shadow-sm"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reads only — no badge is reissued and no card stops working, so this
            is safe to run mid-event. It carries no QR column; the server cannot
            produce one for a card it has already printed. */}
        <button
          type="button"
          onClick={exportRoster}
          disabled={exporting || visitors.length === 0}
          className="btn btn-ghost disabled:opacity-60"
          title="Spreadsheet of everyone registered. Nothing is reissued."
        >
          {exporting ? "Exporting…" : "Export .xlsx"}
        </button>

        <Link href="/visitors/new" className="btn btn-primary">
          Register visitor
        </Link>
      </div>

      {exportError ? (
        <p role="alert" className="px-4 pt-3 text-sm text-revoked">
          {exportError}
        </p>
      ) : null}

      <p
        aria-live="polite"
        className={`mono px-4 pt-2 text-[11px] text-ink-3 transition-opacity ${
          isFetching && !isPending ? "opacity-100" : "opacity-0"
        }`}
      >
        Refreshing…
      </p>

      <div className="p-2 pt-1 sm:p-3 sm:pt-1">
        {isPending ? (
          <SkeletonRows />
        ) : isError ? (
          <Notice
            heading="Could not load visitors"
            body={
              error instanceof Error
                ? error.message
                : "The request failed before it reached the server."
            }
            tone="error"
          />
        ) : visitors.length === 0 ? (
          <Notice
            heading={
              filtered ? "No one matches those filters" : "No visitors yet"
            }
            body={
              filtered
                ? "Try a shorter search, or widen the category."
                : "Register the first visitor to issue a badge."
            }
            action={
              filtered ? undefined : (
                <Link href="/visitors/new" className="btn btn-primary mt-6">
                  Register visitor
                </Link>
              )
            }
          />
        ) : (
          <ul className="space-y-1">
            {visitors.map((visitor) => (
              <VisitorRow key={visitor.id} visitor={visitor} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VisitorRow({ visitor }: { visitor: Visitor }) {
  const vip = visitor.category === "vip";
  const revoked = !visitor.is_active;

  return (
    <li>
      <Link
        href={`/visitors/${visitor.id}`}
        className="group flex items-center gap-4 rounded-lg p-2.5 transition-colors hover:bg-card-2"
      >
        {/* A fragment of the card, not a generic avatar: the photo in its true
            badge crop with the edge band still attached. Amber means VIP here
            exactly as it does on the printed card. */}
        <div className="flex shrink-0 overflow-hidden rounded-md">
          <div
            className={`w-1 ${vip ? "bg-vip" : "bg-graphite-950"} ${
              revoked ? "opacity-40" : ""
            }`}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visitor.photo}
            alt=""
            width={42}
            height={56}
            className={`h-14 w-[42px] bg-line object-cover ${
              revoked ? "opacity-40 grayscale" : ""
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-medium ${revoked ? "text-ink-3" : "text-ink"}`}
          >
            {visitor.full_name}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-3">
            {[visitor.organization, visitor.country]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <p
          className={`mono hidden shrink-0 text-xs sm:block ${
            revoked ? "text-ink-3 line-through" : "text-ink-2"
          }`}
        >
          {visitor.badge_serial}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          {vip ? (
            <span className="pill-status bg-vip-soft text-vip">VIP</span>
          ) : null}
          {revoked ? (
            <span className="pill-status bg-revoked-soft text-revoked">
              Revoked
            </span>
          ) : null}
        </div>

        <span
          aria-hidden
          className="hidden shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
        >
          &rarr;
        </span>
      </Link>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul aria-hidden="true" className="space-y-1">
      {[0, 1, 2, 3, 4].map((row) => (
        <li key={row} className="flex items-center gap-4 p-2.5">
          <div className="h-14 w-[46px] shrink-0 animate-pulse rounded-md bg-line" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3.5 w-44 animate-pulse rounded bg-line" />
            <div className="h-3 w-64 animate-pulse rounded bg-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Notice({
  heading,
  body,
  tone = "neutral",
  action,
}: {
  heading: string;
  body: string;
  tone?: "neutral" | "error";
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p
        className={`display text-lg ${
          tone === "error" ? "text-revoked" : "text-ink"
        }`}
      >
        {heading}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">{body}</p>
      {action}
    </div>
  );
}
