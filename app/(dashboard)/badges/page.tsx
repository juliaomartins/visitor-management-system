"use client";

import { useMemo, useState } from "react";

import { BadgeCard } from "@/components/badge-card";
import { ReissueDialog } from "@/components/badges/ReissueDialog";
import { useSetPageMeta } from "@/components/page-meta";
import {
  downloadCredentialExport,
  downloadReissuedSheet,
  reissueBadges,
} from "@/lib/badges";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { type Visitor } from "@/lib/api";
import { ApiError } from "@/lib/visitors";
import { useQuery } from "@tanstack/react-query";

/** The backend lays nine portrait cards on an A4 sheet, 3 across by 3 down. */
const PER_SHEET = 9;

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
  const [confirming, setConfirming] = useState<
    "print" | "export" | "qr" | null
  >(null);

  /*
    Raw tokens for the cards shown on this page, keyed by visitor.

    On screen only. They arrive from a reissue and are never stored, so a refresh
    drops them and every card goes back to an empty QR frame — which is exactly
    what the server can prove about them.
  */
  const [tokens, setTokens] = useState<Record<string, string>>({});
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
    subtitle: "Nine to an A4 sheet, with cut marks",
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
    visitors.length > 0 &&
    visitors.every((visitor) => selected.has(visitor.id));
  const sheets = Math.ceil(selected.size / PER_SHEET);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Amber, because on this page amber means the same thing it means on a
          card: this is the VIP-band colour, and here it warns that confirming
          replaces real cards. */}
      <div className="flex gap-4 rounded-xl bg-vip-soft px-6 py-5">
        <span aria-hidden className="mt-px text-lg text-vip">
          &#9888;
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            Printing from here issues new badges
          </p>
          <p className="mt-1 text-sm text-ink-2">
            A badge token is stored only as a hash, so an already-printed card
            can never be reprinted — only replaced. Every visitor on a sheet
            gets a new QR, and their existing card stops working immediately.
          </p>
        </div>
      </div>

      <div className="card mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, organisation, country or serial"
            className="field min-w-56 flex-1"
          />

          <button
            type="button"
            onClick={() =>
              setSelected(
                allShown ? new Set() : new Set(visitors.map((v) => v.id)),
              )
            }
            disabled={visitors.length === 0}
            className="btn btn-ghost disabled:opacity-60"
          >
            {allShown ? "Clear selection" : `Select all ${visitors.length}`}
          </button>

          <button
            type="button"
            onClick={() => setConfirming("print")}
            disabled={selected.size === 0}
            className="btn btn-primary disabled:opacity-40"
          >
            Reissue &amp; print {selected.size || ""}
          </button>

          {/*
            The spreadsheet a card producer actually needs. Same destructive
            reissue as the print sheet — it has to be, since the server keeps only
            a digest of each token and cannot put a working QR in a file any other
            way.
          */}
          <button
            type="button"
            onClick={() => setConfirming("export")}
            disabled={selected.size === 0}
            className="btn btn-ghost disabled:opacity-40"
          >
            Reissue &amp; export .xlsx
          </button>

          {/* Draws the real code onto the cards below, which means minting it. */}
          <button
            type="button"
            onClick={() => setConfirming("qr")}
            disabled={selected.size === 0}
            className="btn btn-ghost disabled:opacity-40"
          >
            Reissue &amp; show QR
          </button>
        </div>

        <p
          aria-live="polite"
          className={`mono mt-3 h-4 text-[11px] transition-opacity ${
            selected.size > 0 ? "text-ink-2 opacity-100" : "opacity-0"
          }`}
        >
          {selected.size} selected · {sheets}{" "}
          {sheets === 1 ? "sheet" : "sheets"} of A4
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
        <ul className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visitors.map((visitor) => (
            <li key={visitor.id}>
              <SelectableCard
                visitor={visitor}
                checked={selected.has(visitor.id)}
                onToggle={() => toggle(visitor.id)}
                token={tokens[visitor.id]}
              />
            </li>
          ))}
        </ul>
      )}

      <ReissueDialog
        open={confirming !== null}
        count={selected.size}
        output={confirming === "export" ? "spreadsheet" : "sheet"}
        pending={pending}
        error={error}
        onConfirm={async () => {
          setPending(true);
          setError(undefined);
          try {
            if (confirming === "export") {
              await downloadCredentialExport([...selected]);
              setSelected(new Set());
            } else if (confirming === "qr") {
              const issued = await reissueBadges([...selected]);
              setTokens((current) => {
                const next = { ...current };
                for (const badge of issued)
                  next[badge.visitor_id] = badge.token;
                return next;
              });
              // The selection stays: these are the cards now showing a live QR.
            } else {
              await downloadReissuedSheet([...selected]);
              setSelected(new Set());
            }
            setConfirming(null);
          } catch (cause) {
            setError(
              cause instanceof ApiError
                ? cause.message
                : "The file could not be produced.",
            );
          } finally {
            setPending(false);
          }
        }}
        onCancel={() => {
          if (!pending) {
            setConfirming(null);
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
  token,
}: {
  visitor: Visitor;
  checked: boolean;
  onToggle: () => void;
  /** Present only after a reissue on this page. Draws the real QR. */
  token?: string;
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
        className={`relative rounded-xl p-2.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
          checked ? "bg-accent" : "bg-card group-hover:bg-card-2"
        }`}
      >
        <BadgeCard visitor={visitor} width="100%" detail token={token} />

        {/* Selection is stated, not implied by a tint — the same reason every
            status in this app carries its word. */}
        <span
          aria-hidden
          className={`mono absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-graphite-950 text-xs font-bold text-white transition-opacity ${
            checked ? "opacity-100" : "opacity-0"
          }`}
        >
          &#10003;
        </span>
      </div>

      <span className="mono mt-2 block px-1 text-[11px] text-ink-3">
        {token
          ? "QR live · on screen only"
          : checked
            ? "On the sheet"
            : "Not printing"}
      </span>
    </label>
  );
}
