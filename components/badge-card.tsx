"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

/**
 * THE BADGE, at true CR80 PORTRAIT proportion — 54 × 85.6 mm.
 *
 * A mirror of what `apps/badges/services.py` draws with ReportLab. It is not
 * decoration: what an admin sees here is the arrangement the guest will wear, so
 * a name that will overflow, a photo cropped through someone's chin, or a missing
 * VIP ring shows up here rather than after fifty cards have come off the printer.
 *
 * Portrait because that is how a badge hangs — a lanyard holds a card by a slot
 * in its short edge. Same CR80 blank as before, stood on its end.
 *
 * Every internal dimension is in `cqw`, a percentage of the card's own width, so
 * one component serves a small tile and a large hero with no second set of rules
 * and no chance of the two drifting apart.
 */
type BadgeVisitor = {
  full_name: string;
  country: string;
  organization?: string | null;
  badge_serial: string;
  photo: string;
  category?: string | null;
  is_active?: boolean;
  created_at?: string;
};

/** The motif palette, the same flat set the PDF uses. */
const MOTIF = [
  "#2743c4",
  "#4d8ff5",
  "#ffc531",
  "#f5821f",
  "#ec1e79",
  "#7b4dd8",
  "#e8442c",
];

export function BadgeCard({
  visitor,
  width,
  detail = false,
  token,
}: {
  visitor: BadgeVisitor;
  /** Any CSS width. Height follows from the CR80 portrait ratio. */
  width: string;
  /** Show the fields and the QR block. Off for small tiles, where they are noise. */
  detail?: boolean;
  /**
   * The RAW badge token, when the caller happens to hold one.
   *
   * Only two moments produce it: registering a visitor, and reissuing one. There
   * is no third — the server keeps `sha256(token)` and cannot hand back the code
   * already printed on a card. With it, the card below is the real thing; without
   * it, the QR panel says so rather than drawing a shape that means nothing.
   */
  token?: string;
}) {
  const vip = visitor.category === "vip";
  const revoked = visitor.is_active === false;
  const role = vip ? "VIP GUEST" : visitor.organization || "VISITOR";

  return (
    <div
      style={{ width }}
      className={`cr80 relative flex shrink-0 flex-col items-center overflow-hidden rounded-[2cqw] bg-white ${
        revoked ? "opacity-60" : ""
      }`}
    >
      {/* Lanyard slot — a punch guide on the real card, drawn here so the
          proportions read correctly. */}
      <div className="mt-[3cqw] h-[4.4cqw] w-[22cqw] shrink-0 rounded-full border border-line" />

      <Motifs corner="top-left" />
      <Motifs corner="top-right" />
      <Motifs corner="bottom-left" />
      <Motifs corner="bottom-right" />

      {/* Photo, cropped to a circle. Amber ring means VIP — the one signal that
          has to survive being read across a lobby. */}
      <div
        className={`cr80-photo mt-[2cqw] aspect-square shrink-0 rounded-full p-[2cqw] ${
          vip ? "bg-vip" : "bg-graphite-950"
        }`}
      >
        {visitor.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={visitor.photo}
            alt=""
            className={`h-full w-full rounded-full bg-line object-cover ${
              revoked ? "grayscale" : ""
            }`}
          />
        ) : (
          <div className="h-full w-full rounded-full bg-line" />
        )}
      </div>

      <div className="flex w-full flex-1 flex-col items-center px-[7cqw] text-center">
        <p className="cr80-name mt-[3cqw] font-bold text-ink uppercase [overflow-wrap:anywhere]">
          {visitor.full_name}
        </p>

        <p
          className={`cr80-role mt-[1.5cqw] italic ${vip ? "text-vip" : "text-[#ec1e79]"}`}
        >
          {role}
        </p>

        {detail ? (
          <>
            <div className="mt-[3cqw] h-px w-full bg-line" />

            <dl className="mt-[2.5cqw] w-full">
              <Field
                label="Registered"
                value={formatJoined(visitor.created_at)}
              />
              <Field label="Country" value={visitor.country} />
            </dl>

            <p className="cr80-serial mono mt-[2.5cqw] font-bold text-ink">
              {visitor.badge_serial}
            </p>

            {/*
              The QR's footprint, drawn as an empty frame and labelled.

              It cannot show the real code. The raw token exists only on the
              printed card — the server keeps `sha256(token)` and nothing else —
              so any pattern here would be decoration pretending to be a
              credential. A checkerboard stood in for it before and just read as
              a broken image. An outline that says what it is tells the truth
              about the layout without lying about the contents.
            */}
            <QrPanel token={token} serial={visitor.badge_serial} />
          </>
        ) : (
          <p className="cr80-serial mono mt-auto mb-[4cqw] font-bold text-ink">
            {visitor.badge_serial}
          </p>
        )}
      </div>

      {revoked ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="cr80-serial mono rounded-full bg-graphite-950 px-[4cqw] py-[1.5cqw] font-bold tracking-[0.2em] text-white uppercase">
            Revoked
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The QR, drawn for real when there is a token and framed honestly when not.
 *
 * Error correction M, matching the PDF: a badge collects scuffs and lanyard
 * creases, and M recovers about 15% while keeping the modules large enough to
 * read across a doorway.
 */
function QrPanel({ token, serial }: { token?: string; serial: string }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !canvas.current) return;
    setFailed(false);
    // Drawn large and scaled down by CSS so it stays crisp on a detail hero and
    // on a print-queue tile alike.
    QRCode.toCanvas(canvas.current, token, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => setFailed(true));
  }, [token]);

  if (token && !failed) {
    return (
      <canvas
        ref={canvas}
        aria-label={`QR code for badge ${serial}`}
        className="cr80-qr mt-[2cqw] mb-[4cqw] aspect-square shrink-0 rounded-[1cqw]"
      />
    );
  }

  return (
    <div className="cr80-qr mt-[2cqw] mb-[4cqw] flex aspect-square shrink-0 flex-col items-center justify-center rounded-[1cqw] border border-dashed border-line-strong">
      <span className="mono text-[3.4cqw] tracking-[0.14em] text-ink-3">
        QR
      </span>
      <span className="mt-[1cqw] px-[1cqw] text-center text-[2.8cqw] leading-tight text-ink-3">
        {failed ? "could not draw" : "on the printed card"}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="cr80-field flex items-baseline justify-between gap-[2cqw]">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 truncate font-semibold text-ink">
        {value || "—"}
      </dd>
    </div>
  );
}

/**
 * The geometric corner blocks.
 *
 * A fixed arrangement, not a random one — every card in a run should look like it
 * came off the same press, and a per-visitor shuffle would read as a printing
 * fault rather than as design.
 */
function Motifs({
  corner,
}: {
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const place = {
    "top-left": "top-[13cqw] left-[5cqw]",
    "top-right": "top-[13cqw] right-[5cqw]",
    "bottom-left": "bottom-[5cqw] left-[5cqw]",
    "bottom-right": "bottom-[5cqw] right-[5cqw]",
  }[corner];

  const offset = {
    "top-left": 0,
    "top-right": 2,
    "bottom-left": 4,
    "bottom-right": 1,
  }[corner];

  return (
    <div
      aria-hidden
      className={`absolute ${place} grid grid-cols-2 gap-[1cqw]`}
    >
      {[0, 1, 2, 3].map((cell) => (
        <span
          key={cell}
          className="block h-[5cqw] w-[5cqw]"
          style={{
            background: MOTIF[(cell + offset) % MOTIF.length],
            borderRadius:
              cell % 3 === 0 ? "50% 0 50% 0" : cell % 3 === 1 ? "0" : "50%",
          }}
        />
      ))}
    </div>
  );
}

/** The day they were registered, matching the PDF's `%d %b %Y`. */
function formatJoined(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
