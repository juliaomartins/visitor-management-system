"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { downloadBadgeCard } from "@/lib/badges";
import { ApiError, type VisitorIssued } from "@/lib/visitors";

/**
 * The one and only sight of a badge token.
 *
 * The backend stores a SHA-256 digest and nothing else, so this string exists in
 * exactly two places: this screen, and whatever the registrar does with it next.
 * Navigating away destroys it, and the badge can then never be printed — the
 * visitor has to be registered again from scratch.
 *
 * That is why registering does not redirect on success. The registrar leaves this
 * screen deliberately, having printed the badge, not because a router decided the
 * job was finished.
 *
 * Phase 5 replaces the print button below with a server-rendered PDF and an A4
 * bulk sheet. Until then this is a real, working badge.
 */

/**
 * The QR carries the raw token STRING and nothing else — no JSON, no envelope,
 * no id (CLAUDE.md constraint #3). The scanner posts exactly what it reads, so
 * anything wrapped around the token would have to be unwrapped by every reader
 * that ever touches a badge.
 *
 * Error correction M: a badge picks up scuffs and lanyard creases, and M recovers
 * ~15% while keeping the modules large enough to read across a doorway.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  color: { dark: "#000000", light: "#ffffff" },
};

export function BadgeTokenReceipt({
  visitor,
  onRegisterAnother,
}: {
  visitor: VisitorIssued;
  onRegisterAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const screenQr = useRef<HTMLCanvasElement | null>(null);
  const printQr = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const targets: [HTMLCanvasElement | null, number][] = [
      [screenQr.current, 208],
      // Rendered large and scaled down by CSS, so the print stays crisp at 20 mm.
      [printQr.current, 320],
    ];

    Promise.all(
      targets.map(([canvas, width]) =>
        canvas
          ? QRCode.toCanvas(canvas, visitor.badge_token, { ...QR_OPTIONS, width })
          : Promise.resolve(),
      ),
    ).catch(() => setQrFailed(true));
  }, [visitor.badge_token]);

  /**
   * The one moment a badge PDF costs nothing.
   *
   * This screen still holds the raw token, so the server can draw the QR without
   * issuing a new one. Once this page is gone, every later print is a reissue
   * that kills the card in the visitor's hand.
   */
  async function savePdf() {
    setSaving(true);
    setPdfError(null);
    try {
      await downloadBadgeCard(visitor.badge_token, visitor.badge_serial);
    } catch (cause) {
      setPdfError(
        cause instanceof ApiError ? cause.message : "The badge could not be rendered.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(visitor.badge_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the token is selectable either way.
      setCopied(false);
    }
  }

  const vip = visitor.category === "vip";

  return (
    <div className="max-w-2xl">
      <div className="rounded-lg border border-vip bg-vip-soft px-6 py-6">
        <p className="mono text-[11px] uppercase text-vip">Print this now</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {visitor.full_name} is registered
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          The badge below is the only copy. The token behind the QR is stored as a
          hash, so once you leave this page it cannot be recovered — you would have
          to register {visitor.full_name} again.
        </p>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <div className="rounded-md border border-vip/40 bg-card p-3">
            <canvas
              ref={screenQr}
              className="block h-52 w-52"
              role="img"
              aria-label={`QR code for badge ${visitor.badge_serial}`}
            />
          </div>

          <div className="min-w-56 flex-1 space-y-3">
            <div>
              <p className="text-xs text-ink-3">Badge token</p>
              <code className="mono mt-1 block overflow-x-auto rounded border border-vip/40 bg-card px-3 py-2 text-xs text-ink">
                {visitor.badge_token}
              </code>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePdf}
                disabled={saving}
                className="rounded-md bg-ink px-3.5 py-2.5 text-sm font-medium text-white hover:bg-graphite-800 disabled:opacity-70"
              >
                {saving ? "Rendering…" : "Download badge PDF"}
              </button>
              {/* Kept alongside the PDF: this one needs nothing but a browser, so
                  it still works if the server cannot render. */}
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-vip/40 px-3.5 py-2.5 text-sm text-ink-2 hover:text-ink"
              >
                Print from browser
              </button>
              <button
                type="button"
                onClick={copy}
                className="rounded-md border border-vip/40 px-3.5 py-2.5 text-sm text-ink-2 hover:text-ink"
              >
                {copied ? "Copied" : "Copy token"}
              </button>
            </div>

            {pdfError ? (
              <p role="alert" className="text-xs text-revoked">
                {pdfError}
              </p>
            ) : null}

            {qrFailed ? (
              <p role="alert" className="text-xs text-revoked">
                The QR code could not be drawn. Copy the token and print the badge
                from another machine rather than issuing a card without a code.
              </p>
            ) : null}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {copied ? "Badge token copied to the clipboard." : ""}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <Row label="Badge mono" value={visitor.badge_serial} mono />
        <Row label="Country" value={visitor.country} />
        <Row label="Category" value={vip ? "VIP" : "Normal"} />
      </dl>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-graphite-800"
        >
          Register another visitor
        </button>
        <Link
          href={`/visitors/${visitor.id}`}
          className="rounded-md border border-line px-3.5 py-2.5 text-sm text-ink-2 hover:border-line-strong hover:text-ink"
        >
          Open {visitor.full_name}
        </Link>
        <Link
          href="/visitors"
          className="px-2 py-2.5 text-sm text-ink-3 hover:text-ink"
        >
          Back to all visitors
        </Link>
      </div>

      {/*
        The badge itself. Parked off-screen rather than hidden, so the photo is
        actually fetched — see the #badge-print rules in globals.css. Sized in
        millimetres because this is a physical object, not a layout.
      */}
      <div id="badge-print" aria-hidden="true">
        <div
          style={{
            width: "85.6mm",
            height: "54mm",
            boxSizing: "border-box",
            padding: "3.5mm",
            display: "flex",
            gap: "3mm",
            alignItems: "stretch",
            background: "#ffffff",
            color: "#000000",
            fontFamily: "var(--font-bricolage), sans-serif",
            borderLeft: vip ? "3mm solid #a16207" : "3mm solid #17212b",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visitor.photo}
            alt=""
            style={{
              width: "24mm",
              height: "32mm",
              objectFit: "cover",
              alignSelf: "flex-start",
            }}
          />

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {vip ? (
              <span
                style={{
                  fontSize: "2.6mm",
                  fontWeight: 800,
                  letterSpacing: "0.6mm",
                  color: "#a16207",
                }}
              >
                VIP
              </span>
            ) : null}

            <span
              style={{
                fontSize: "4.6mm",
                fontWeight: 800,
                lineHeight: 1.1,
                marginTop: "0.5mm",
                overflowWrap: "anywhere",
              }}
            >
              {visitor.full_name}
            </span>

            <span style={{ fontSize: "3.4mm", marginTop: "1mm" }}>
              {visitor.country}
            </span>

            {visitor.organization ? (
              <span style={{ fontSize: "2.8mm", marginTop: "0.5mm", color: "#4a5560" }}>
                {visitor.organization}
              </span>
            ) : null}

            <span
              style={{
                marginTop: "auto",
                fontSize: "3mm",
                fontWeight: 600,
                letterSpacing: "0.3mm",
                fontFamily: "var(--font-jetbrains), monospace",
              }}
            >
              {visitor.badge_serial}
            </span>
          </div>

          <canvas
            ref={printQr}
            style={{ width: "20mm", height: "20mm", alignSelf: "flex-end" }}
          />
        </div>
      </div>
    </div>
  );
}

function Row({
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
      <dd className={`mt-0.5 text-ink ${mono ? "mono" : ""}`}>{value}</dd>
    </div>
  );
}
