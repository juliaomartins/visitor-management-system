"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { BadgeCard } from "@/components/badge-card";
import { useSetPageMeta } from "@/components/page-meta";
import { ReissueDialog } from "@/components/badges/ReissueDialog";
import { RevokeDialog } from "@/components/visitors/RevokeDialog";
import { downloadReissuedSheet } from "@/lib/badges";
import {
  ApiError,
  useRevokeVisitor,
  useVisitor,
  type ScanEvent,
  type ScanResult,
} from "@/lib/visitors";

const RESULT_STYLES: Record<ScanResult, { label: string; className: string }> = {
  valid: { label: "Valid", className: "bg-valid-soft text-valid" },
  duplicate: { label: "Duplicate", className: "bg-line text-ink-2" },
  revoked: { label: "Revoked", className: "bg-vip-soft text-vip" },
  invalid: { label: "Invalid", className: "bg-revoked-soft text-revoked" },
};

export default function VisitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: visitor, isPending, isError, error } = useVisitor(id);
  const revoke = useRevokeVisitor(id);
  const [confirming, setConfirming] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [reissuePending, setReissuePending] = useState(false);
  const [reissueError, setReissueError] = useState<string | undefined>();

  useSetPageMeta({
    title: visitor?.full_name ?? "Visitor",
    subtitle: visitor ? visitor.badge_serial : undefined,
  });

  if (isPending) {
    return <p className="mono text-xs text-ink-3">Loading…</p>;
  }

  if (isError || !visitor) {
    return (
      <div className="rounded-lg border border-line bg-card px-6 py-16 text-center">
        <p className="display text-lg font-semibold text-revoked">
          Could not load this visitor
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">
          {error instanceof ApiError
            ? error.message
            : "They may have been deleted. Check the visitor list."}
        </p>
        <Link
          href="/visitors"
          className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
        >
          Back to all visitors
        </Link>
      </div>
    );
  }

  const revoked = !visitor.is_active;

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

      <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/*
          The badge itself, at reading size and true proportion. Everything on it
          — name, country, organisation, serial, the VIP band — is shown here as
          it will print, so a name that overflows or a photo cropped badly is
          caught before fifty cards come off the printer.
        */}
        <div>
          <BadgeCard visitor={visitor} width="100%" detail />
          <p className="mono mt-3 text-[11px] text-ink-3">
            CR80 · 85.6 × 54 mm · as it prints
          </p>
        </div>

        <div className="min-w-0">
          <p
            className={`mono text-[11px] font-bold tracking-[0.22em] uppercase ${
              revoked ? "text-revoked" : "text-valid"
            }`}
          >
            {revoked ? "Revoked" : "Active"}
          </p>
          <h2 className="display mt-1 text-2xl font-bold text-ink">
            {revoked ? "This badge is dead" : "This badge opens the door"}
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            {revoked
              ? "The next scan of it shows red. Reissue to print a working replacement."
              : "Any paired scanner will accept it and the lobby screen will welcome them."}
          </p>

          {/* Only what the card does not already say. Name, country, organisation
              and serial are printed on it, an arm's length to the left. */}
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <Detail label="Registered" value={formatDateTime(visitor.created_at)} />
            <Detail label="Arrivals" value={String(arrivals.length)} mono />
            <Detail
              label="Last arrival"
              value={lastArrival ? formatDateTime(lastArrival) : "Not yet"}
            />
            <Detail label="Scans logged" value={String(scans.length)} mono />
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/visitors/${visitor.id}/edit`}
              className="rounded-md border border-line px-3.5 py-2.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Edit details
            </Link>

            {/*
              Not "download" — there is nothing to download. The raw token behind
              this visitor's QR was never stored, so the server cannot redraw the
              card it issued; it can only issue a new one. The label says so, and
              the dialog spells out the consequence.
            */}
            <button
              type="button"
              onClick={() => setReissuing(true)}
              className="rounded-md border border-vip/50 px-3.5 py-2.5 text-sm text-vip transition-colors hover:bg-vip-soft"
            >
              Reissue &amp; print badge
            </button>

            {revoked ? null : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded-md border border-revoked/40 px-3.5 py-2.5 text-sm text-revoked transition-colors hover:bg-revoked-soft"
              >
                Revoke badge
              </button>
            )}
          </div>

          <p className="mt-3 max-w-lg text-xs leading-relaxed text-ink-3">
            Reissuing prints a new card and kills the old one — badge tokens are
            stored only as a hash, so an issued card can never be reprinted.
            Collect the old card when you hand over the new one.
          </p>
        </div>
      </div>

      <section className="mt-12">
        <h3 className="display text-lg font-semibold text-ink">Scan history</h3>
        <p className="mt-1 text-sm text-ink-3">
          Every time this badge was presented, including the times it was refused.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-card">
          {scans.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-ink-3">
              This badge has not been scanned yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <Th>Event</Th>
                    <Th>Scanned at</Th>
                    <Th>Result</Th>
                    <Th>Device</Th>
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

      <ReissueDialog
        open={reissuing}
        count={1}
        name={visitor.full_name}
        pending={reissuePending}
        error={reissueError}
        onConfirm={async () => {
          setReissuePending(true);
          setReissueError(undefined);
          try {
            await downloadReissuedSheet([visitor.id]);
            setReissuing(false);
          } catch (cause) {
            setReissueError(
              cause instanceof ApiError
                ? cause.message
                : "The badge could not be rendered.",
            );
          } finally {
            setReissuePending(false);
          }
        }}
        onCancel={() => {
          if (!reissuePending) {
            setReissuing(false);
            setReissueError(undefined);
          }
        }}
      />

      <RevokeDialog
        open={confirming}
        visitorName={visitor.full_name}
        badgeSerial={visitor.badge_serial}
        pending={revoke.isPending}
        error={revoke.error instanceof ApiError ? revoke.error.message : undefined}
        onConfirm={() =>
          revoke.mutate(undefined, { onSuccess: () => setConfirming(false) })
        }
        onCancel={() => {
          if (!revoke.isPending) {
            setConfirming(false);
            revoke.reset();
          }
        }}
      />
    </div>
  );
}

function ScanRow({ scan }: { scan: ScanEvent }) {
  const style = RESULT_STYLES[scan.result];

  return (
    <tr className="border-b border-line last:border-0">
      <td className="mono px-4 py-3 text-xs text-ink-3">#{scan.id}</td>
      <td className="px-4 py-3 whitespace-nowrap text-ink">
        {formatDateTime(scan.scanned_at)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`mono rounded px-2 py-1 text-[11px] font-bold tracking-wide uppercase ${style.className}`}
        >
          {style.label}
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
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "mono" : ""}`}>{value}</dd>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
