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
import { downloadBadgeCard, openBadgeCard } from "@/lib/badges";
import { useT } from "@/lib/i18n";
import { ApiError, type VisitorIssued } from "@/lib/visitors";

/**
 * The receipt shown the moment a visitor is registered.
 *
 * Registering does not redirect on success, so the registrar prints the card
 * while the visitor is still at the desk and the next registration starts from a
 * clean form. That used to be a necessity -- tokens were random, stored only as a
 * digest, and this screen was the only copy -- and it is now only a workflow.
 * Tokens are derived, so the same QR can be redrawn from the visitor's page, the
 * A4 sheet or the .xlsx for the life of the event.
 *
 * BOTH PRINT BUTTONS USE THE SERVER'S PDF, and there is no browser-drawn badge
 * any more. There used to be one: a hidden landscape card, 85.6 x 54 mm with a
 * rectangular photo, from before the PDF existed, printed by `window.print()`
 * under a print stylesheet that asked for a PORTRAIT 54 mm page. The card was
 * wider than the page it was pinned into, so names printed one letter per line,
 * and `visibility: hidden` on the rest of the page kept its layout -- five sheets
 * of paper for one badge, none of them the badge. It was also simply the wrong
 * card: the printed one is portrait with a circular photo.
 */

/**
 * The QR carries the raw token STRING and nothing else — no JSON, no envelope,
 * no id (CLAUDE.md constraint #3). The scanner posts exactly what it reads, so
 * anything wrapped around the token would have to be unwrapped by every reader
 * that ever touches a badge.
 *
 * Error correction M, with the event mark composited into the middle. The mark
 * is drawn OVER the finished code and is not encoded into it, so the string a
 * scanner reads is unchanged — this receipt shows the same credential it always
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
 * The event mark, decoded once per page rather than once per registration.
 *
 * A module promise means a second registration reuses the decode instead of
 * going back to the browser cache.
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
  const t = useT();
  const [copied, setCopied] = useState(false);
  /*
    One flag for both PDF buttons, not one each. They make the same request, and
    pressing Print while a Download is still rendering would fetch the card twice
    and race two results into the same error line.
  */
  const [busy, setBusy] = useState<"save" | "print" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const screenQr = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = screenQr.current;
    if (!canvas) return;

    let live = true;

    QRCode.toCanvas(canvas, visitor.badge_token, { ...QR_OPTIONS, width: 208 })
      .then(async () => {
        if (!live) return;
        /*
          The mark is decoration and the code is the credential, so a mark that
          fails to load must not report the QR as failed. Swallowing it here
          leaves a working, scannable code with no logo on it instead of blanking
          a QR the registrar needs right now.
        */
        await drawEventMark(canvas).catch(() => {});
      })
      .catch(() => {
        if (live) setQrFailed(true);
      });

    return () => {
      live = false;
    };
  }, [visitor.badge_token]);

  /**
   * Get the card out while the visitor is still at the desk.
   *
   * Download saves the server's PDF. Print opens that same PDF in the browser's
   * viewer in a new tab -- the screen `/badges` users already print from -- so
   * the registrar presses the printer icon instead of hunting for a file. If
   * pop-ups are blocked it downloads instead and says so.
   *
   * `openBadgeCard` must be reached with no `await` before it: it opens the tab
   * synchronously, and a pop-up blocker only allows that inside the click.
   */
  async function producePdf(kind: "save" | "print") {
    setBusy(kind);
    setPdfError(null);
    setNotice(null);
    try {
      if (kind === "save") {
        await downloadBadgeCard(visitor.badge_token, visitor.badge_serial);
      } else {
        const outcome = await openBadgeCard(
          visitor.badge_token,
          visitor.badge_serial,
          t("receipt.rendering"),
        );
        if (outcome === "downloaded") setNotice(t("receipt.printFellBack"));
      }
    } catch (cause) {
      setPdfError(
        cause instanceof ApiError ? cause.message : t("receipt.renderFailed"),
      );
    } finally {
      setBusy(null);
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
                onClick={() => producePdf("save")}
                disabled={busy !== null}
                className="btn btn-primary disabled:opacity-70"
              >
                {busy === "save"
                  ? t("receipt.rendering")
                  : t("receipt.downloadPdf")}
              </button>
              <button
                type="button"
                onClick={() => producePdf("print")}
                disabled={busy !== null}
                className="btn btn-ghost disabled:opacity-60"
              >
                {busy === "print" ? t("receipt.rendering") : t("receipt.print")}
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

            {notice ? (
              <p role="status" className="text-xs text-ink-2">
                {notice}
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
