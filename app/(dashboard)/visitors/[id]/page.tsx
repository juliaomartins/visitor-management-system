"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { PHOTO_ASPECT } from "@/components/visitors/PhotoUpload";
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
  valid: { label: "Valid", className: "bg-accent/10 text-accent" },
  duplicate: { label: "Duplicate", className: "bg-rule text-ink-700" },
  revoked: { label: "Revoked", className: "bg-revoked-soft text-revoked" },
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
    return <p className="serial text-xs text-ink-500">Loading…</p>;
  }

  if (isError || !visitor) {
    return (
      <div className="rounded-lg border border-rule bg-card px-6 py-16 text-center">
        <p className="font-medium text-revoked">Could not load this visitor</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">
          {error instanceof ApiError
            ? error.message
            : "They may have been deleted. Check the visitor list."}
        </p>
        <Link
          href="/visitors"
          className="mt-5 inline-block text-sm text-accent hover:underline"
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

  return (
    <div className="max-w-4xl">
      <Link href="/visitors" className="text-sm text-ink-500 hover:text-ink-900">
        ← All visitors
      </Link>

      <div className="mt-5 grid gap-8 sm:grid-cols-[auto_1fr]">
        <div
          className="cutmarks h-fit shrink-0"
          style={
            visitor.category === "vip"
              ? ({ "--cutmark-color": "var(--color-vip)" } as React.CSSProperties)
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visitor.photo}
            alt={`Badge photo of ${visitor.full_name}`}
            className={`w-48 max-w-full object-cover ${revoked ? "opacity-40 grayscale" : ""}`}
            style={{ aspectRatio: PHOTO_ASPECT }}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              {visitor.full_name}
            </h2>
            {visitor.category === "vip" ? (
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

          <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <Detail label="Badge serial" value={visitor.badge_serial} mono />
            <Detail
              label="Badge state"
              value={revoked ? "Revoked" : "Active"}
              tone={revoked ? "revoked" : undefined}
            />
            <Detail label="Country" value={visitor.country} />
            <Detail label="Organisation" value={visitor.organization || "—"} />
            <Detail label="Registered" value={formatDateTime(visitor.created_at)} />
            <Detail label="Arrivals" value={String(arrivals.length)} mono />
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/visitors/${visitor.id}/edit`}
              className="rounded-md border border-rule px-3.5 py-2.5 text-sm text-ink-700 hover:border-rule-strong hover:text-ink-900"
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
              className="rounded-md border border-vip/50 px-3.5 py-2.5 text-sm text-vip transition-colors hover:bg-vip-soft focus-visible:ring-2 focus-visible:ring-vip focus-visible:outline-none"
            >
              Reissue &amp; print badge
            </button>

            {revoked ? null : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="ml-auto rounded-md border border-revoked/40 px-3.5 py-2.5 text-sm text-revoked hover:bg-revoked-soft focus-visible:ring-2 focus-visible:ring-revoked focus-visible:outline-none"
              >
                Revoke badge
              </button>
            )}
          </div>

          <p className="mt-2 max-w-lg text-xs text-ink-500">
            Reissuing prints a new card and kills the old one — badge tokens are
            stored only as a hash, so an issued card can never be reprinted. Collect
            the old card when you hand over the new one.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h3 className="text-sm font-semibold tracking-tight text-ink-900">
          Scan history
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          Every time this badge was presented, including the times it was refused.
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-rule bg-card">
          {scans.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-ink-500">
              This badge has not been scanned yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left">
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
    <tr className="border-b border-rule last:border-0">
      <td className="serial px-4 py-3 text-xs text-ink-500">#{scan.id}</td>
      <td className="px-4 py-3 whitespace-nowrap text-ink-900">
        {formatDateTime(scan.scanned_at)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`serial rounded px-2 py-1 text-[11px] font-medium ${style.className}`}
        >
          {style.label}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-700">{scan.device_name}</td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium text-ink-500">{children}</th>
  );
}

function Detail({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "revoked";
}) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd
        className={`mt-0.5 ${mono ? "serial" : ""} ${
          tone === "revoked" ? "text-revoked" : "text-ink-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
