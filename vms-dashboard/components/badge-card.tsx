"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import {
  PHOTO_BOX_CQW,
  QR_ERROR_CORRECTION,
  QR_LOGO_PAD,
  QR_LOGO_PLATE_FRACTION,
  QR_LOGO_SRC,
} from "@/lib/badge-geometry";
import { useT } from "@/lib/i18n";

/**
 * THE PRINTED LABELS HERE ARE NOT TRANSLATED, AND THAT IS THE POINT.
 *
 * `apps/badges/services.py` draws the physical card with ReportLab, in English,
 * in Helvetica: "Registered", "Country", "VIP GUEST", "VISITOR". This component
 * exists to show what comes out of the printer, so translating those labels
 * would make the preview lie about the card -- a registrar would check a Tetun
 * preview and hand over an English badge.
 *
 * Only the chrome that never reaches paper follows the interface language: the
 * deactivated overlay and the empty QR frame. If the printed card should itself
 * be multilingual, that is a change to services.py first and this one second.
 *
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
  deferQr = false,
}: {
  visitor: BadgeVisitor;
  /** Any CSS width. Height follows from the CR80 portrait ratio. */
  width: string;
  /** Show the fields and the QR block. Off for small tiles, where they are noise. */
  detail?: boolean;
  /**
   * The RAW badge token — the string the QR encodes.
   *
   * Derived from the visitor, not random, so it is the same code every time and
   * the same code on the printed card. `GET /visitors/{id}` returns it, and the
   * list returns it for every row under `?with_tokens=true`. Without it the QR
   * panel says so rather than drawing a shape that means nothing.
   */
  token?: string;
  /**
   * Hold the QR encode until the caller says the card is worth drawing.
   *
   * The print queue mounts one card per visitor, and `QRCode.toString` is real
   * work on the main thread -- 250 encodes before the page settles, for cards
   * that are mostly off screen. The queue flips this as a card nears the
   * viewport; see `useNearViewport` there.
   *
   * The token is still passed while this is true, which is the point: the panel
   * says it is DRAWING rather than claiming the code is only on the printed
   * card. Deferring is our scheduling decision, not a fact about the badge.
   */
  deferQr?: boolean;
}) {
  const t = useT();
  const vip = visitor.category === "vip";
  const inactive = visitor.is_active === false;
  const role = vip ? "VIP GUEST" : visitor.organization || "VISITOR";

  return (
    <div
      style={{ width }}
      className={`cr80 relative flex shrink-0 flex-col items-center overflow-hidden rounded-[2cqw] bg-white ${
        inactive ? "opacity-60" : ""
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
        // Width comes from lib/badge-geometry, which derives it from the same
        // millimetres services.py prints with, so the preview cannot drift.
        //
        // `overflow-hidden` IS WHAT KEEPS THIS ROUND, not decoration. An
        // `aspect-ratio` box still has `min-height: auto`, so it grows to fit
        // its content -- and a portrait photo at `w-full` is taller than the
        // square. Measured in Chrome at a 270px card: a 600x798 photo made this
        // 106x137, an oval that pushed the name down, while a landscape photo
        // stayed 106x106. Any overflow other than `visible` drops that
        // content-based minimum, so the box is square for every stored shape
        // and `object-cover` crops exactly what `cover_box` in services.py does.
        style={{ width: `${PHOTO_BOX_CQW}cqw` }}
        className={`mt-[2cqw] aspect-square shrink-0 overflow-hidden rounded-full p-[2cqw] ${
          vip ? "bg-vip" : "bg-graphite-950"
        }`}
      >
        {visitor.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={visitor.photo}
            alt=""
            /*
              The print queue renders one card per visitor, so this is 250 full
              badge-resolution photographs on a page that shows a dozen. The
              circle has its size from the container query above rather than
              from the image, so there is no layout shift to trade for it.
            */
            loading="lazy"
            decoding="async"
            className={`h-full w-full rounded-full bg-line object-cover ${
              inactive ? "grayscale" : ""
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
              The real QR wherever a token is in hand, and an honest empty frame
              where one is not. It used to be the frame everywhere, because the
              token was unrecoverable; it is derived now, so this is the same
              code the printer draws.
            */}
            <QrPanel
              token={token}
              serial={visitor.badge_serial}
              defer={deferQr}
            />
          </>
        ) : (
          <p className="cr80-serial mono mt-auto mb-[4cqw] font-bold text-ink">
            {visitor.badge_serial}
          </p>
        )}
      </div>

      {inactive ? (
        /* "Deactivated" is four characters longer than the "Revoked" this
           replaced, so the padding and tracking come in to keep the pill inside
           a 54mm-wide card at preview size. */
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="cr80-serial mono rounded-full bg-graphite-950 px-[3cqw] py-[1.5cqw] font-bold tracking-[0.12em] text-white uppercase">
            {t("card.deactivated")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The QR, drawn for real when there is a token and framed honestly when not.
 *
 * SVG, NOT CANVAS, AND THAT IS A BUG FIX RATHER THAN A PREFERENCE. `toCanvas`
 * writes `style.width` and `style.height` in pixels straight onto the element
 * (see qrcode/lib/renderer/canvas.js), and an inline style outranks the
 * `width: 26cqw` in `.cr80-qr`. The QR therefore rendered at a fixed 320px on
 * every card — correct on none of them, and on the detail hero it burst out of
 * the card and over the caption beneath. A vector in an `<img>` has no intrinsic
 * pixel size to fight with, so the card's own container query decides how big it
 * is, and it stays sharp whether the card is a 60mm tile or a full-width hero.
 *
 * Error correction M with the event mark in the middle, matching the PDF. The
 * level did NOT change when the mark went in, and raising it would make the
 * badge worse — see `QR_ERROR_CORRECTION` in `lib/badge-geometry.ts` and the
 * measurement it points at. The mark is composited over the finished code
 * rather than encoded into it, so the string a scanner reads is unchanged and
 * every card already printed keeps working.
 *
 * THE MARK IS AN OVERLAY, NOT PART OF THE SVG, and that follows from the note
 * above: the QR is an `<img>` sized by the card's container query, so the mark
 * is a second absolutely-positioned `<img>` in a relative wrapper. Injecting an
 * `<image>` into the SVG string would work too, and would reintroduce exactly
 * the intrinsic-size fight this component already solved once.
 *
 * The colours are literal black on white on purpose. This is the one element on
 * the page that is not decoration but data — a scanner needs the contrast the
 * spec assumes, and a themed QR that dims in dark mode is a QR that fails at the
 * door.
 */
function QrPanel({
  token,
  serial,
  defer = false,
}: {
  token?: string;
  serial: string;
  defer?: boolean;
}) {
  /*
    One piece of state carrying WHICH token it belongs to, rather than a `src`
    and a `failed` flag set separately.

    Encoding is asynchronous and the token can change under us -- a different
    visitor lands in the same grid slot as the print queue re-renders. Tagging
    the result means a slow encode that resolves late cannot paint the previous
    visitor's QR onto this card, and it means nothing has to be reset when the
    token changes: the tag simply stops matching. That in turn keeps every
    setState inside a callback instead of the effect body, which is the pattern
    React asks for and the linter enforces.
  */
  const t = useT();
  const [drawn, setDrawn] = useState<{
    token: string;
    src: string | null;
  } | null>(null);

  useEffect(() => {
    if (!token || defer) return;

    let live = true;

    QRCode.toString(token, {
      type: "svg",
      errorCorrectionLevel: QR_ERROR_CORRECTION,
      // One module of quiet zone, as the PDF draws it. The spec asks for four;
      // the card's own white margin supplies the rest.
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((svg) => {
        if (live) {
          setDrawn({
            token,
            src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          });
        }
      })
      .catch(() => {
        if (live) setDrawn({ token, src: null });
      });

    return () => {
      live = false;
    };
  }, [token, defer]);

  const settled = token && drawn?.token === token ? drawn : null;

  if (settled?.src) {
    return (
      <div className="cr80-qr relative mt-[2cqw] mb-[4cqw] aspect-square shrink-0 rounded-[1cqw] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={settled.src}
          alt={`QR code for badge ${serial}`}
          className="h-full w-full"
        />
        {/*
          The white plate, then the mark inset within it. Two elements rather
          than one padded image because the plate is the thing with a job: it is
          the clean erasure the decoder repairs, and it must be opaque white
          right up to its edge whatever the artwork's own transparency does.

          aria-hidden, and the plate is not described: the QR's own alt text
          already says what this graphic is. A screen reader announcing the
          conference logo here would be reading out decoration sitting on top of
          the only element on the card that is data.
        */}
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white"
          style={{
            width: `${QR_LOGO_PLATE_FRACTION * 100}%`,
            height: `${QR_LOGO_PLATE_FRACTION * 100}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QR_LOGO_SRC}
            alt=""
            className="object-contain"
            style={{
              width: `${(1 / QR_LOGO_PAD) * 100}%`,
              height: `${(1 / QR_LOGO_PAD) * 100}%`,
            }}
          />
        </span>
      </div>
    );
  }

  return (
    <div className="cr80-qr mt-[2cqw] mb-[4cqw] flex aspect-square shrink-0 flex-col items-center justify-center rounded-[1cqw] border border-dashed border-line-strong">
      <span className="mono text-[3.4cqw] tracking-[0.14em] text-ink-3">
        QR
      </span>
      <span className="mt-[1cqw] px-[1cqw] text-center text-[2.8cqw] leading-tight text-ink-3">
        {settled
          ? t("card.qrFailed")
          : token
            ? t("card.qrDrawing")
            : t("card.qrOnCard")}
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
