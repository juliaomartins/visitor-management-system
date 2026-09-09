"use client";

import { useMemo, useState } from "react";

import { BadgeCard } from "@/components/badge-card";
import { ReissueDialog } from "@/components/badges/ReissueDialog";
import { useSetPageMeta } from "@/components/page-meta";
import {
  downloadCredentialExport,
  downloadReissuedSheet,
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
 * NOTHING HERE CHANGES A QR. Badge tokens are derived from the visitor, so every
 * sheet and every export carries the code already on the printed card. A visitor
 * can be reprinted on the morning and again at the door and the result is
 * identical, which makes this an event-day tool rather than a setup-only one.
 *
 * Deactivating a visitor does not change what prints here either -- the sheet
 * always carries their real QR. What stops at the door is the scan, not the
 * code.
 */
export default function BadgesPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  /*
    Only the export asks. Printing changes nothing now, so a confirmation there
    would be a dialog whose honest text is "this is safe, continue?".
  */
  const [confirming, setConfirming] = useState<"export" | null>(null);

  /*
    THIS PAGE ASKS FOR REAL BADGE TOKENS, AND THE CARDS BELOW DRAW REAL QR CODES.

    It used to show an empty frame, because the list endpoint withheld
    `badge_token` on the principle that one request should not hand back 250
    working credentials. The principle survives -- the field is still opt-in, and
    every other list call goes without it -- but it does not apply here. The
    print queue exists to catch what a sheet of nine will get wrong before the
    paper is spent, and the QR is the one part of a badge nobody can check by
    eye. A frame saying "on the printed card" verifies nothing.

    Nor is much given away: the .xlsx button a few pixels up already hands the
    same admin the same codes in a file they can carry out of the building. What
    changes here is convenience, not exposure.
  */
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.visitors({ badges: true }),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors", {
        // The whole point of this page is seeing what will print, and the QR is
        // the half of a badge nobody can check by eye. See the comment above.
        params: { query: { with_tokens: true } },
        signal,
      });
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
            Printing is safe to repeat
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Every sheet carries each visitor&apos;s existing QR, so a card can be
            reprinted as often as you need and the ones already handed out keep
            working. To stop a lost card, deactivate that visitor on their own
            page &mdash; the QR itself never changes, so activating them again
            puts the same card back to work.
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

          {/* Straight to the file. Printing redraws the QR already on the
              card, so there is nothing to warn about and nothing to undo. */}
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={async () => {
              setPending(true);
              setError(undefined);
              try {
                await downloadReissuedSheet([...selected]);
                setSelected(new Set());
              } catch (cause) {
                setError(
                  cause instanceof ApiError
                    ? cause.message
                    : "The sheet could not be produced.",
                );
              } finally {
                setPending(false);
              }
            }}
            className="btn btn-primary disabled:opacity-40"
          >
            Print {selected.size || ""}
          </button>

          {/*
            The spreadsheet a card producer actually needs. No longer destructive:
            badge tokens are derived from the visitor, so the QR written into this
            file is the one already on the printed card. Exporting twice produces
            two identical, working files.
          */}
          <button
            type="button"
            onClick={() => setConfirming("export")}
            disabled={selected.size === 0}
            className="btn btn-ghost disabled:opacity-40"
          >
            Export .xlsx
          </button>

          {/*
            "Reissue & show QR" USED TO LIVE HERE AND IT HAD TO GO.

            It called `POST /badges/reissue`, the rotation endpoint -- so simply
            looking at somebody's QR would have replaced their badge and killed
            the card in their hand. The dashboard no longer calls that endpoint
            from anywhere; a badge is issued once and stays valid until the
            visitor is deactivated or deleted.

            Nothing is lost. Each visitor's live QR is on their own page, and
            both the sheet and the .xlsx carry the real code.
          */}
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
                token={visitor.badge_token}
              />
            </li>
          ))}
        </ul>
      )}

      <ReissueDialog
        open={confirming !== null}
        count={selected.size}
        pending={pending}
        error={error}
        onConfirm={async () => {
          setPending(true);
          setError(undefined);
          try {
            await downloadCredentialExport([...selected]);
            setSelected(new Set());
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
  /** The badge's real code, from `?with_tokens=true`. Draws a scannable QR. */
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
        {checked ? "On the sheet" : "Not printing"}
      </span>
    </label>
  );
}
