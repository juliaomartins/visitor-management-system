"use client";

import { useMemo, useState } from "react";

import { BadgeCard } from "@/components/badge-card";
import { ReissueDialog } from "@/components/badges/ReissueDialog";
import { useSetPageMeta } from "@/components/page-meta";
import { downloadReissuedSheet } from "@/lib/badges";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { type Visitor } from "@/lib/api";
import { ApiError } from "@/lib/visitors";
import { useQuery } from "@tanstack/react-query";

/** The backend lays ten cards on an A4 sheet. */
const PER_SHEET = 10;

/**
 * The print queue, shown as the sheet it produces.
 *
 * Picking names off a list tells you nothing about what comes out of the printer.
 * Picking cards does: the photo crop, the length of a name, the amber band on a
 * VIP, all visible before the paper is spent.
 *
 * Everything here reissues, and the page says so above the fold rather than in a
 * footnote — printing a sheet of twenty invalidates twenty cards that may already
 * be around twenty necks. That makes it a setup-morning tool, not an event-day
 * one. On the day, the free print is the one on the registration receipt, which
 * still holds the raw token.
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
      [
        visitor.full_name,
        visitor.country,
        visitor.organization,
        visitor.badge_serial,
      ]
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

  const allShown =
    visitors.length > 0 && visitors.every((visitor) => selected.has(visitor.id));
  const sheets = Math.ceil(selected.size / PER_SHEET);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Amber, because on this page amber means the same thing it means on a
          card: this is the VIP-band colour, and here it warns that confirming
          replaces real cards. */}
      <div className="flex gap-4 rounded-lg border border-vip/40 bg-vip-soft px-5 py-4">
        <span aria-hidden className="mt-px text-lg text-vip">
          &#9888;
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            Printing from here issues new badges
          </p>
          <p className="mt-1 text-sm text-ink-2">
            A badge token is stored only as a hash, so an already-printed card can
            never be reprinted — only replaced. Every visitor on a sheet gets a new
            QR, and their existing card stops working immediately.
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-10 -mx-8 mt-5 bg-paper/90 px-8 pt-1 pb-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, organisation, country or serial"
            className="min-w-56 flex-1 rounded-md border border-line-strong bg-card px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-3 focus:border-ink"
          />

          <button
            type="button"
            onClick={() =>
              setSelected(
                allShown ? new Set() : new Set(visitors.map((v) => v.id)),
              )
            }
            disabled={visitors.length === 0}
            className="rounded-md border border-line px-3.5 py-2.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
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

        <p
          aria-live="polite"
          className={`mono mt-2 h-4 text-[11px] transition-opacity ${
            selected.size > 0 ? "text-ink-2 opacity-100" : "opacity-0"
          }`}
        >
          {selected.size} selected · {sheets} {sheets === 1 ? "sheet" : "sheets"}{" "}
          of A4
        </p>
      </div>

      {isPending ? (
        <p className="mono py-16 text-center text-xs text-ink-3">Loading…</p>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-revoked">
          Could not load visitors.
        </p>
      ) : visitors.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No visitors match that search.
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {visitors.map((visitor) => (
            <li key={visitor.id}>
              <SelectableCard
                visitor={visitor}
                checked={selected.has(visitor.id)}
                onToggle={() => toggle(visitor.id)}
              />
            </li>
          ))}
        </ul>
      )}

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

function SelectableCard({
  visitor,
  checked,
  onToggle,
}: {
  visitor: Visitor;
  checked: boolean;
  onToggle: () => void;
}) {
  // A real checkbox, hidden but focusable: this is a multi-select, and a button
  // pretending to be one loses the semantics screen readers and the keyboard
  // already understand. The whole card is the hit target.
  return (
    <label className="group block cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="peer sr-only"
      />

      <div
        className={`relative rounded-[5px] p-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
          checked ? "bg-ink" : "bg-transparent group-hover:bg-line"
        }`}
      >
        <BadgeCard visitor={visitor} width="100%" detail />

        {/* Selection is stated, not implied by a tint — the same reason every
            status in this app carries its word. */}
        <span
          aria-hidden
          className={`mono absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white transition-opacity ${
            checked ? "opacity-100" : "opacity-0"
          }`}
        >
          &#10003;
        </span>
      </div>

      <span className="mono mt-2 block text-[11px] text-ink-3">
        {checked ? "On the sheet" : "Not printing"}
      </span>
    </label>
  );
}
