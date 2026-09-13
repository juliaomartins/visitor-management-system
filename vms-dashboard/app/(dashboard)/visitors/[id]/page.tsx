"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { BadgeCard } from "@/components/badge-card";
import { useSetPageMeta } from "@/components/page-meta";
import { DeactivateDialog } from "@/components/visitors/DeactivateDialog";
import { PurgeDialog } from "@/components/visitors/PurgeDialog";
import {
  BanIcon,
  CheckCircleIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/visitors/RowContextMenu";
import { useErrorText, useFormat, useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import {
  useActivateVisitor,
  useDeactivateVisitor,
  usePurgeVisitor,
  useVisitor,
  type ScanEvent,
  type ScanResult,
} from "@/lib/visitors";

/*
  Keys, not words -- a module constant again.

  `revoked` keeps its own message rather than borrowing the "deactivated" one.
  It is a backend enum that CLAUDE.md deliberately did not rename when the UI
  moved from "revoke" to "deactivate", and quietly relabelling it here would
  make this table disagree with the reports about what the same row is called.
*/
const RESULT_STYLES: Record<
  ScanResult,
  { labelKey: MessageKey; className: string }
> = {
  valid: { labelKey: "scan.valid", className: "bg-valid-soft text-valid" },
  duplicate: { labelKey: "scan.duplicate", className: "bg-line text-ink-2" },
  revoked: {
    labelKey: "scan.revoked",
    className: "bg-graphite-950 text-white",
  },
  invalid: {
    labelKey: "scan.invalid",
    className: "bg-revoked-soft text-revoked",
  },
};

export default function VisitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const format = useFormat();
  const errorText = useErrorText();
  const { data: visitor, isPending, isError, error } = useVisitor(id);
  const deactivate = useDeactivateVisitor(id);
  const activate = useActivateVisitor(id);
  const purge = usePurgeVisitor(id);
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  /*
    THE QR IS ISSUED ONCE, AT REGISTRATION, AND NOTHING HERE CHANGES IT.

    `visitor.badge_token` is derived from the visitor's id and token version, so
    it is the same string every time it is read. There is no local copy to keep
    in sync, and no code path on this page can mint a different one -- the card
    already in somebody's hand stays scannable for the life of the event.
  */

  useSetPageMeta({
    title: visitor?.full_name ?? t("visitor.fallbackTitle"),
    subtitle: visitor ? visitor.badge_serial : undefined,
  });

  if (isPending) {
    return <p className="mono text-xs text-ink-3">{t("common.loading")}</p>;
  }

  if (isError || !visitor) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="display text-lg text-revoked">
          {t("visitor.notFound")}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">
          {errorText(error, "visitor.notFoundBody")}
        </p>
        <Link
          href="/visitors"
          className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
        >
          {t("visitor.backToAll")}
        </Link>
      </div>
    );
  }

  const inactive = !visitor.is_active;

  // Read once, defaulted once. A cache entry written by a mutation whose response
  // does not carry the scan history would otherwise crash this page rather than
  // simply showing it empty for the moment before the refetch lands — which is
  // exactly what used to happen after saving an edit.
  const scans = visitor.scan_events ?? [];
  const arrivals = scans.filter((scan) => scan.result === "valid");
  const lastArrival = arrivals.reduce<string | null>(
    (latest, scan) =>
      latest === null || scan.scanned_at > latest ? scan.scanned_at : latest,
    null,
  );

  return (
    <div className="max-w-4xl">
      <Link
        href="/visitors"
        className="text-sm text-ink-3 transition-colors hover:text-ink"
      >
        ← All visitors
      </Link>

      <div className="card mt-4 grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-10">
        {/*
          The badge itself, at reading size and true proportion. Everything on it
          — name, country, organisation, serial, the VIP band — is shown here as
          it will print, so a name that overflows or a photo cropped badly is
          caught before fifty cards come off the printer.
        */}
        <div className="card p-4 sm:p-5">
          {/* The QR is simply here now. The token is derived from the visitor,
              so this is the same code that is on the printed card and it can be
              shown, reprinted or photographed any number of times. */}
          <BadgeCard
            visitor={visitor}
            width="100%"
            detail
            token={visitor.badge_token}
          />
          <p className="mono mt-3 text-[11px] text-ink-3">
            CR80 · 54 × 85.6 mm · as it prints
          </p>


        </div>

        <div className="min-w-0">
          <p
            className={`mono text-[11px] font-bold tracking-[0.22em] uppercase ${
              inactive ? "text-revoked" : "text-valid"
            }`}
          >
            {t(
              inactive
                ? "visitors.status.deactivated"
                : "visitor.status.active",
            )}
          </p>
          <h2 className="display mt-1.5 text-3xl text-ink">
            {inactive
              ? t("visitor.headingOff")
              : t("visitor.headingActive")}
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            {inactive
              ? t("visitor.subOff")
              : t("visitor.subActive")}
          </p>

          {/* Only what the card does not already say. Name, country, organisation
              and serial are printed on it, an arm's length to the left. */}
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Detail
              label={t("visitor.registered")}
              value={format.dateTime(visitor.created_at)}
            />
            <Detail
              label={t("visitor.arrivals")}
              value={String(arrivals.length)}
              mono
            />
            <Detail
              label={t("visitor.lastArrival")}
              value={
                lastArrival ? format.dateTime(lastArrival) : t("visitor.notYet")
              }
            />
            <Detail
              label={t("visitor.scansLogged")}
              value={String(scans.length)}
              mono
            />
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {/*
              The same glyphs as the right-click menu on /visitors, so an action
              looks the same wherever it is offered. They are aria-hidden inside
              the icon components; the label stays the accessible name.
            */}
            <Link
              href={`/visitors/${visitor.id}/edit`}
              className="btn btn-ghost"
            >
              <PencilIcon />
              {t("visitors.menu.edit")}
            </Link>

            {/*
              "REPLACE BADGE" WAS HERE AND IS DELIBERATELY GONE.

              It called `POST /badges/reissue`, the rotation endpoint, which
              bumps `token_version` and re-derives the hash -- the only thing in
              the system that can change a QR. A badge is issued once at
              registration and stays valid until the visitor is revoked or
              deleted, so a control that quietly re-mints it does not belong on
              this page. A lost card is handled by revoking it, below.
            */}

            {inactive ? (
              <button
                type="button"
                onClick={() => activate.mutate()}
                disabled={activate.isPending}
                className="btn btn-ghost text-valid hover:text-valid disabled:opacity-60"
              >
                <CheckCircleIcon />
                {activate.isPending
                  ? t("visitor.activating")
                  : t("visitors.menu.activate")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn btn-ghost text-revoked hover:text-revoked"
              >
                <BanIcon />
                {t("visitors.menu.deactivate")}
              </button>
            )}

            {/*
              Set apart from the pair above, because it is not their third
              sibling. Those two toggle a boolean; this one destroys a row and a
              photograph. The divider and the position are the only cue a
              registrar gets before the dialog, so they earn their place.
            */}
            <span aria-hidden className="h-5 w-px bg-line" />

            {/*
              RED BY ITS OWN COMPONENT CLASS, NOT BY `text-revoked`. This button
              used to say `btn btn-ghost text-ink-3 hover:text-revoked` and was
              never red: `.btn-ghost` is unlayered CSS in globals.css while
              Tailwind utilities live in `@layer utilities`, and unlayered
              declarations win the cascade whatever their specificity. So its
              colour came from `.btn-ghost` alone. `.btn-danger-ghost` sits
              beside `.btn-ghost`, unlayered too, so its colour actually applies.
            */}
            <button
              type="button"
              onClick={() => setPurging(true)}
              className="btn btn-danger-ghost"
            >
              <TrashIcon />
              {t("visitors.menu.delete")}
            </button>
          </div>

          <p className="mt-3 max-w-lg text-xs leading-relaxed text-ink-3">
            {t("visitor.qrNote")}
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h3 className="display text-lg text-ink">
          {t("visitor.scanHistory")}
        </h3>
        <p className="mt-1 text-sm text-ink-3">
          {t("visitor.scanHistoryBody")}
        </p>

        <div className="card mt-4 overflow-hidden">
          {scans.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-ink-3">
              {t("visitor.noScans")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <Th>{t("visitor.col.event")}</Th>
                    <Th>{t("visitor.col.scannedAt")}</Th>
                    <Th>{t("visitor.col.result")}</Th>
                    <Th>{t("visitor.col.device")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <ScanRow key={scan.id} scan={scan} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <DeactivateDialog
        open={confirming}
        visitorName={visitor.full_name}
        badgeSerial={visitor.badge_serial}
        pending={deactivate.isPending}
        error={
          deactivate.error
            ? errorText(deactivate.error, "error.visitorDeactivate")
            : undefined
        }
        onConfirm={() =>
          deactivate.mutate(undefined, {
            onSuccess: () => setConfirming(false),
          })
        }
        onCancel={() => {
          if (!deactivate.isPending) {
            setConfirming(false);
            deactivate.reset();
          }
        }}
      />

      <PurgeDialog
        open={purging}
        visitorName={visitor.full_name}
        badgeSerial={visitor.badge_serial}
        scanCount={scans.length}
        pending={purge.isPending}
        error={
          purge.error ? errorText(purge.error, "error.visitorDelete") : undefined
        }
        onConfirm={() =>
          purge.mutate(undefined, {
            // This page is about to 404 on its own id, so leave before it can.
            onSuccess: () => router.replace("/visitors"),
          })
        }
        onCancel={() => {
          if (!purge.isPending) {
            setPurging(false);
            purge.reset();
          }
        }}
      />

    </div>
  );
}

function ScanRow({ scan }: { scan: ScanEvent }) {
  const t = useT();
  const format = useFormat();
  const style = RESULT_STYLES[scan.result];

  return (
    <tr className="border-b border-line last:border-0">
      <td className="mono px-4 py-3 text-xs text-ink-3">#{scan.id}</td>
      <td className="px-4 py-3 whitespace-nowrap text-ink">
        {format.dateTime(scan.scanned_at)}
      </td>
      <td className="px-4 py-3">
        <span className={`pill-status ${style.className}`}>
          {t(style.labelKey)}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-2">{scan.device_name}</td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium text-ink-3">{children}</th>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="card px-4 py-3.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "mono" : "display text-lg"}`}>
        {value}
      </dd>
    </div>
  );
}
