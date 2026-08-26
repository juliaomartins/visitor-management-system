"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

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

  useSetPageMeta({
    title: "Visitors",
    subtitle: "Everyone registered for the event",
    count: data ? visitors.length : undefined,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="visitor-search" className="sr-only">
            Search visitors
          </label>
          <input
            id="visitor-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, organisation, country or badge serial"
            className="w-full rounded-md border border-rule-strong bg-card px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by category"
          className="flex rounded-md border border-rule-strong bg-card p-0.5"
        >
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={category === tab.value}
              onClick={() => setCategory(tab.value)}
              className={`rounded px-3.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                category === tab.value
                  ? "bg-ink-900 font-medium text-white"
                  : "text-ink-700 hover:text-ink-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Link
          href="/visitors/new"
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-pressed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Register visitor
        </Link>
      </div>

      <div
        aria-live="polite"
        className={`serial mt-3 text-[11px] text-ink-500 transition-opacity ${
          isFetching && !isPending ? "opacity-100" : "opacity-0"
        }`}
      >
        Refreshing…
      </div>

      <div className="mt-1 overflow-hidden rounded-lg border border-rule bg-card">
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
              debouncedSearch || category !== "all"
                ? "No one matches those filters"
                : "No visitors registered yet"
            }
            body={
              debouncedSearch || category !== "all"
                ? "Try a shorter search, or widen the category."
                : "Register the first visitor to issue a badge."
            }
          />
        ) : (
          <ul>
            {visitors.map((visitor, index) => (
              <VisitorRow
                key={visitor.id}
                visitor={visitor}
                first={index === 0}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VisitorRow({ visitor, first }: { visitor: Visitor; first: boolean }) {
  const vip = visitor.category === "vip";
  const revoked = !visitor.is_active;

  return (
    <li className={first ? "" : "border-t border-rule"}>
      <Link
        href={`/visitors/${visitor.id}`}
        className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
      >
        {/* Card aspect, cut marks and all — the badge this person will wear. */}
        <div
          className="cutmarks shrink-0"
          style={
            vip
              ? ({ "--cutmark-color": "var(--color-vip)" } as CSSProperties)
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visitor.photo}
            alt=""
            width={54}
            height={72}
            className={`h-18 w-[54px] object-cover ${revoked ? "opacity-40 grayscale" : ""}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-medium ${revoked ? "text-ink-500" : "text-ink-900"}`}
          >
            {visitor.full_name}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {[visitor.organization, visitor.country]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <p
          className={`serial hidden shrink-0 text-xs sm:block ${
            revoked ? "text-ink-500 line-through" : "text-ink-700"
          }`}
        >
          {visitor.badge_serial}
        </p>

        <div className="flex w-28 shrink-0 justify-end gap-1.5">
          {vip ? (
            <span className="serial rounded bg-vip-soft px-2 py-1 text-[11px] font-medium text-vip">
              VIP
            </span>
          ) : null}
          {revoked ? (
            <span className="serial rounded bg-revoked-soft px-2 py-1 text-[11px] font-medium text-revoked">
              REVOKED
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <li
          key={row}
          className={`flex items-center gap-5 px-5 py-4 ${row === 0 ? "" : "border-t border-rule"}`}
        >
          <div className="h-18 w-[54px] shrink-0 animate-pulse bg-rule" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-44 animate-pulse rounded bg-rule" />
            <div className="h-3 w-64 animate-pulse rounded bg-rule" />
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
}: {
  heading: string;
  body: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p
        className={`font-medium ${tone === "error" ? "text-revoked" : "text-ink-900"}`}
      >
        {heading}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">{body}</p>
    </div>
  );
}
