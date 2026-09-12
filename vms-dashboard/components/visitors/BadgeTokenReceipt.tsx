"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import {
  QR_ERROR_CORRECTION,
  QR_LOGO_PAD,
  QR_LOGO_PLATE_FRACTION,
  QR_LOGO_SRC,
} from "@/lib/badge-geometry";
import { downloadBadgeCard } from "@/lib/badges";
import { useT } from "@/lib/i18n";
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
 * Error correction M, with the event mark composited into the middle. The mark
 * is drawn OVER the finished code and is not encoded into it, so the string a
 * scanner reads is unchanged — this receipt prints the same credential it always
 * did. The level stayed at M deliberately; the argument is at
 * `QR_ERROR_CORRECTION` in `lib/badge-geometry.ts`, and both numbers mirror
 * `apps/badges/services.py` so the receipt and the PDF cannot drift.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: QR_ERROR_CORRECTION,
  margin: 1,
  color: { dark: "#000000", light: "#ffffff" },
};

/**
 * The event mark, decoded once per page rather than once per canvas.
 *
 * Two canvases render on this screen and both want the same bitmap. A module
 * promise also means a second registration reuses the decode instead of going
 * back to the browser cache.
 */
let markRequest: Promise<HTMLImageElement> | null = null;

function eventMark(): Promise<HTMLImageElement> {
  markRequest ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("event mark did not load"));
    image.src = QR_LOGO_SRC;
  });
  return markRequest;
}

/**
 * Paint the white plate and the mark onto a QR that `toCanvas` has finished.
 *
 * The plate is filled rather than relying on the artwork's own background: the
 * PNG is transparent around a thin gold ring, and modules surviving behind that
 * ring read as speckle a decoder has to guess at instead of an erasure it can
 * simply repair.
 */
async function drawEventMark(canvas: HTMLCanvasElement) {
  const mark = await eventMark();
  const context = canvas.getContext("2d");
  if (!context) return;

  const plate = canvas.width * QR_LOGO_PLATE_FRACTION;
  const left = (canvas.width - plate) / 2;
  const top = (canvas.height - plate) / 2;

  context.fillStyle = "#ffffff";
  context.fillRect(left, top, plate, plate);

  // `contain`, not `cover`: the artwork is 3:2 and cropping it to a square would
  // cut the plumes off the mark.
  const inner = plate / QR_LOGO_PAD;
  const scale = Math.min(inner / mark.width, inner / mark.height);
  const width = mark.width * scale;
  const height = mark.height * scale;
  context.drawImage(
    mark,
    left + (plate - width) / 2,
    top + (plate - height) / 2,
    width,
    height,
  );
}

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

    let live = true;

    Promise.all(
      targets.map(async ([canvas, width]) => {
        if (!canvas) return;
        await QRCode.toCanvas(canvas, visitor.badge_token, {
          ...QR_OPTIONS,
          width,
        });
        if (!live) return;
        /*
          The mark is decoration and the code is the credential, so a mark that
          fails to load must not report the QR as failed. Swallowing it here
          leaves a working, scannable badge with no logo on it -- which is what
          the card looked like a week ago -- instead of blanking a QR the
          registrar needs to print right now.
        */
        await drawEventMark(canvas).catch(() => {});
      }),
    ).catch(() => {
      if (live) setQrFailed(true);
    });

    return () => {
      live = false;
    };
  }, [visitor.badge_token]);

  /**
   * Print the card while the visitor is still at the desk.
   *
   * Nothing about this print is special any more, and that is the point. The
   * token is derived, so leaving this page costs nothing: the same QR can be
   * redrawn from the visitor's own page, from the A4 sheet or from the .xlsx,
   * for the life of the event. It is here because printing now, in front of the
   * person it belongs to, is simply the fastest way to work a queue.
   */
  async function savePdf() {
    setSaving(true);
    setPdfError(null);
    try {
      await downloadBadgeCard(visitor.badge_token, visitor.badge_serial);
    } catch (cause) {
      setPdfError(
        cause instanceof ApiError
          ? cause.message
          : t("receipt.renderFailed"),
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

  const t = useT();
  const vip = visitor.category === "vip";

  return (
    <div className="max-w-2xl">
      {/*
        THIS PANEL USED TO BE A WARNING AND IS NOW A RECEIPT.

        It said the badge was "the only copy" and that leaving the page would
        lose it forever. That was true when tokens were random and stored only as
        a digest. They are derived from the visitor now, so this QR can be
        redrawn from the visitor's page any time for the life of the event —
        printing it twice is free and produces the identical code.

        Keeping the old alarm would have trained registrars to fear a navigation
        that costs nothing, which is worse than saying nothing at all.
      */}
      <div className="rounded-2xl border border-valid bg-valid-soft px-6 py-6">
        <p className="mono text-[11px] uppercase text-valid">
          {t("receipt.badgeIssued")}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {t("receipt.registered", { name: visitor.full_name })}
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          {t("receipt.permanent", { name: visitor.full_name })}
        </p>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <div className="rounded-2xl bg-card p-4">
            <canvas
              ref={screenQr}
              className="block h-52 w-52"
              role="img"
              aria-label={t("receipt.qrAlt", {
                serial: visitor.badge_serial,
              })}
            />
          </div>

          <div className="min-w-56 flex-1 space-y-3">
            <div>
              <p className="text-xs text-ink-3">{t("receipt.badgeToken")}</p>
              <code className="mono mt-1 block overflow-x-auto rounded-xl bg-card-2 px-3 py-2.5 text-xs text-ink">
                {visitor.badge_token}
              </code>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePdf}
                disabled={saving}
                className="btn btn-primary disabled:opacity-70"
              >
                {saving
                  ? t("receipt.rendering")
                  : t("receipt.downloadPdf")}
              </button>
              {/* Kept alongside the PDF: this one needs nothing but a browser, so
                  it still works if the server cannot render. */}
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-ghost"
              >
                {t("receipt.printBrowser")}
              </button>
              <button
                type="button"
                onClick={copy}
                className="btn btn-ghost"
              >
                {copied ? t("receipt.copied") : t("receipt.copyToken")}
              </button>
            </div>

            {pdfError ? (
              <p role="alert" className="text-xs text-revoked">
                {pdfError}
              </p>
            ) : null}

            {qrFailed ? (
              <p role="alert" className="text-xs text-revoked">
                {t("receipt.qrFailed")}
              </p>
            ) : null}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {copied ? t("receipt.copiedAnnounce") : ""}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        {/* The label read "Badge mono" -- the CSS class had leaked into the
            copy. Translating that into three languages would have made a
            typo permanent, so it is corrected here rather than carried. */}
        <Row
          label={t("receipt.badgeSerial")}
          value={visitor.badge_serial}
          mono
        />
        <Row label={t("form.country")} value={visitor.country} />
        <Row
          label={t("form.category")}
          value={t(vip ? "form.cat.vip" : "form.cat.normal")}
        />
      </dl>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="btn btn-primary"
        >
          {t("receipt.registerAnother")}
        </button>
        <Link
          href={`/visitors/${visitor.id}`}
          className="btn btn-ghost"
        >
          {t("receipt.open", { name: visitor.full_name })}
        </Link>
        <Link
          href="/visitors"
          className="px-2 py-2.5 text-sm text-ink-3 hover:text-ink"
        >
          {t("visitor.backToAll")}
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
            fontFamily: "var(--font-jakarta), sans-serif",
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
