"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

  useSetPageMeta({
    title: "Visitors",
    subtitle: "Everyone registered for the event",
    count: data ? visitors.length : undefined,
  });

  return (
    <div className="mx-auto max-w-5xl">
      {/* The controls stay put while the sheet scrolls under them — this list
          runs to 250 rows and the search box should never be scrolled away. */}
      <div className="sticky top-0 z-10 -mx-8 bg-paper/90 px-8 pt-1 pb-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
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
              className="w-full rounded-md border border-line-strong bg-card py-2.5 pr-10 pl-3.5 text-sm text-ink transition-colors placeholder:text-ink-3 focus:border-ink"
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
            className="flex rounded-md border border-line-strong bg-card p-0.5"
          >
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={category === tab.value}
                onClick={() => setCategory(tab.value)}
                className={`rounded px-3.5 py-2 text-sm transition-colors ${
                  category === tab.value
                    ? "bg-ink font-medium text-white"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link
            href="/visitors/new"
            className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-graphite-800"
          >
            Register visitor
          </Link>
        </div>

        <p
          aria-live="polite"
          className={`mono mt-2 h-3 text-[11px] text-ink-3 transition-opacity ${
            isFetching && !isPending ? "opacity-100" : "opacity-0"
          }`}
        >
          Refreshing…
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-card">
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
                <Link
                  href="/visitors/new"
                  className="mt-5 inline-block rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-graphite-800"
                >
                  Register visitor
                </Link>
              )
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
    <li className={first ? "" : "border-t border-line"}>
      <Link
        href={`/visitors/${visitor.id}`}
        className="group flex items-center gap-5 px-5 py-3.5 transition-colors hover:bg-paper focus-visible:bg-paper"
      >
        {/* A fragment of the card, not a generic avatar: the photo in its true
            badge crop with the edge band still attached. Amber means VIP here
            exactly as it does on the printed card. */}
        <div className="flex shrink-0 overflow-hidden rounded-[2px] ring-1 ring-line-strong">
          <div
            className={`w-1.5 ${vip ? "bg-vip" : "bg-graphite-900"} ${
              revoked ? "opacity-40" : ""
            }`}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visitor.photo}
            alt=""
            width={54}
            height={72}
            className={`h-18 w-[54px] bg-line object-cover ${
              revoked ? "opacity-40 grayscale" : ""
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`display truncate text-[15px] font-semibold ${
              revoked ? "text-ink-3" : "text-ink"
            }`}
          >
            {visitor.full_name}
          </p>
          <p className="mt-1 truncate text-sm text-ink-3">
            {[visitor.organization, visitor.country].filter(Boolean).join(" · ")}
          </p>
        </div>

        <p
          className={`mono hidden shrink-0 text-xs sm:block ${
            revoked ? "text-ink-3 line-through" : "text-ink-2"
          }`}
        >
          {visitor.badge_serial}
        </p>

        <div className="flex w-28 shrink-0 justify-end gap-1.5">
          {vip ? (
            <span className="mono rounded bg-vip-soft px-2 py-1 text-[11px] font-medium text-vip">
              VIP
            </span>
          ) : null}
          {revoked ? (
            <span className="mono rounded bg-revoked-soft px-2 py-1 text-[11px] font-medium text-revoked">
              REVOKED
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
    <ul aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <li
          key={row}
          className={`flex items-center gap-5 px-5 py-3.5 ${
            row === 0 ? "" : "border-t border-line"
          }`}
        >
          <div className="h-18 w-[60px] shrink-0 animate-pulse rounded-[2px] bg-line" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-44 animate-pulse rounded bg-line" />
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
    <div className="px-6 py-20 text-center">
      <p
        className={`display text-lg font-semibold ${
          tone === "error" ? "text-revoked" : "text-ink"
        }`}
      >
        {heading}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">{body}</p>
      {action}
    </div>
  );
}
