"use client";

import { useMemo, useState } from "react";

import { ReissueDialog } from "@/components/badges/ReissueDialog";
import { useSetPageMeta } from "@/components/page-meta";
import { downloadReissuedSheet } from "@/lib/badges";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { type Visitor } from "@/lib/api";
import { ApiError } from "@/lib/visitors";
import { useQuery } from "@tanstack/react-query";

/**
 * The print queue.
 *
 * Ten badges to an A4 sheet with cut marks. Everything on this page reissues, and
 * the page says so above the fold rather than in a footnote — printing a sheet of
 * twenty invalidates twenty cards that may already be around twenty necks.
 *
 * That makes it a setup-morning tool, not an event-day one. On the day, the free
 * print is the one on the registration receipt, which still holds the raw token.
 */
export default function BadgesPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.visitors({ badges: true }),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors", { signal });
      if (error) throw new ApiError("The visitor list could not be loaded.");
      return data;
    },
  });

  const visitors = useMemo(() => {
    const all = data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((visitor) =>
      [visitor.full_name, visitor.country, visitor.organization, visitor.badge_serial]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [data, search]);

  useSetPageMeta({
    title: "Badge printing",
    subtitle: "Ten to an A4 sheet, with cut marks",
    count: selected.size || undefined,
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShown = visitors.length > 0 && visitors.every((v) => selected.has(v.id));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-lg border border-vip bg-vip-soft px-5 py-4">
        <p className="text-sm font-semibold text-ink-900">
          Printing from here issues new badges
        </p>
        <p className="mt-1 text-sm text-ink-700">
          A badge token is stored only as a hash, so an already-printed card can
          never be reprinted — only replaced. Every visitor on a sheet gets a new
          QR, and their existing card stops working immediately.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, organisation, country or serial"
          className="min-w-56 flex-1 rounded-md border border-rule-strong bg-card px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
        />

        <button
          type="button"
          onClick={() =>
            setSelected(allShown ? new Set() : new Set(visitors.map((v) => v.id)))
          }
          disabled={visitors.length === 0}
          className="rounded-md border border-rule px-3.5 py-2.5 text-sm text-ink-700 hover:border-rule-strong hover:text-ink-900 disabled:opacity-60"
        >
          {allShown ? "Clear selection" : `Select all ${visitors.length}`}
        </button>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={selected.size === 0}
          className="rounded-md bg-vip px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Reissue &amp; print {selected.size || ""}
        </button>
      </div>

      {selected.size > 0 ? (
        <p className="text-xs text-ink-500">
          {selected.size} selected —{" "}
          {Math.ceil(selected.size / 10)}{" "}
          {Math.ceil(selected.size / 10) === 1 ? "sheet" : "sheets"} of A4.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-rule bg-card">
        {isPending ? (
          <p className="serial px-6 py-12 text-center text-xs text-ink-500">Loading…</p>
        ) : isError ? (
          <p className="px-6 py-12 text-center text-sm text-revoked">
            Could not load visitors.
          </p>
        ) : visitors.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-500">
            No visitors match that search.
          </p>
        ) : (
          <ul>
            {visitors.map((visitor, index) => (
              <Row
                key={visitor.id}
                visitor={visitor}
                first={index === 0}
                checked={selected.has(visitor.id)}
                onToggle={() => toggle(visitor.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <ReissueDialog
        open={confirming}
        count={selected.size}
        pending={pending}
        error={error}
        onConfirm={async () => {
          setPending(true);
          setError(undefined);
          try {
            await downloadReissuedSheet([...selected]);
            setConfirming(false);
            setSelected(new Set());
          } catch (cause) {
            setError(
              cause instanceof ApiError
                ? cause.message
                : "The sheet could not be rendered.",
            );
          } finally {
            setPending(false);
          }
        }}
        onCancel={() => {
          if (!pending) {
            setConfirming(false);
            setError(undefined);
          }
        }}
      />
    </div>
  );
}

function Row({
  visitor,
  first,
  checked,
  onToggle,
}: {
  visitor: Visitor;
  first: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={first ? "" : "border-t border-rule"}>
      <label className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-paper">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 accent-accent"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink-900">
            {visitor.full_name}
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-500">
            {[visitor.organization, visitor.country].filter(Boolean).join(" · ")}
          </span>
        </span>

        {visitor.category === "vip" ? (
          <span className="serial rounded bg-vip-soft px-2 py-1 text-[11px] font-medium text-vip">
            VIP
          </span>
        ) : null}

        {visitor.is_active ? null : (
          <span className="serial rounded bg-revoked-soft px-2 py-1 text-[11px] font-medium text-revoked">
            REVOKED
          </span>
        )}

        <span className="serial hidden shrink-0 text-xs text-ink-700 sm:block">
          {visitor.badge_serial}
        </span>
      </label>
    </li>
  );
}
