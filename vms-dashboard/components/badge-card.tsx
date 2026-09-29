"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { EVENT } from "@/components/brand";
import {
  QR_ERROR_CORRECTION,
  QR_LOGO_PAD,
  QR_LOGO_PLATE_FRACTION,
  QR_LOGO_SRC,
} from "@/lib/badge-geometry";
import { useT } from "@/lib/i18n";

/**
 * The event's official ID card, as issued.
 *
 * EVERY NUMBER IN THIS FILE WAS MEASURED OFF `ID CARD OFFICIAL.jpg`, the artwork
 * the organisers print, and is expressed as a percentage of the card's own box —
 * so the layout is the reference at any size. The measurements, in that file's
 * 748 x 1024 pixels and converted here:
 *
 *     navy field      #00065E     red band  #AA0000
 *     header curve    left edge 21.4%h, flat from 40%w at 29.7%h
 *     logo            5.5%..27%w, centred at 14.5%h
 *     photo           4.8%..37.0%w, 38.7%..69.8%h
 *     name / country  centred on 67.6%w, 38.9% and 43.6%h
 *     QR              54.1%..81.4%w, 49.3%..69.2%h
 *     red band        78.8%..85.1%h     navy band 85.2%..90.1%h
 *     tais strip      90.2%..100%h
 *
 * THE CARD IS NO LONGER CR80, because the artwork is not: it is 748 x 1024,
 * a 0.73 ratio against CR80 portrait's 0.63. The shape is part of the design —
 * the bands and the curve only sit where they do at this ratio.
 *
 * AND THE PRINTED PDF IS NOT THIS. `apps/badges/services.py` still draws the old
 * CR80 card with ReportLab, so this preview and the printer now disagree about
 * both the design and the shape. That was a deliberate instruction (the backend
 * was not to be touched) and it is the one thing to fix next: until then, what
 * comes out of `POST /badges/card` is not what this shows.
 *
 * Type is Arial/Helvetica rather than the dashboard's Plus Jakarta Sans. The
 * reference is set in it, and both are present on every machine at this event,
 * so nothing has to be downloaded on a laptop that is offline by event day.
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

const NAVY = "#00065E";
const RED = "#AA0000";

/**
 * A CONDENSED face, because the artwork is set in one and it is not a detail.
 *
 * Measured off the reference: "Amena Mariana dos Santos" is 24 characters in
 * 421px at a 30px cap height, about 0.43em per character. Arial Bold averages
 * 0.55em and needs ~540px for that string -- which is why the first attempt
 * wrapped the name onto a second line and pushed the country into the QR. Arial
 * Narrow is ~0.45em and lands within a few pixels of the artwork.
 *
 * Arial Narrow ships with Windows and with Office on macOS; the Liberation and
 * DejaVu condensed faces cover Linux. If none of them is present the stack falls
 * back to Arial and long strings wrap -- which the name box is built to survive.
 */
const CARD_FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

/**
 * THE ARTWORK MIXES TWO WIDTHS, and which line gets which is measurable.
 *
 * Every long line is condensed and every short one is not. In the reference, at
 * 748px wide: the name is 421px for 24 characters (0.43em each) and the theme
 * 370px for 23 -- both far below Arial's 0.55em average, and Arial Narrow's
 * 0.45em to within a few pixels. The country (258px for 11) and the role band
 * (478px for 18) are 0.60em, which is Arial itself. So the designer condensed
 * exactly the lines that had to fit, and this follows them line for line.
 */
const CARD_FONT_CONDENSED =
  '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", "DejaVu Sans Condensed", Arial, sans-serif';

export function BadgeCard({
  visitor,
  width,
  detail = false,
  token,
  deferQr = false,
}: {
  visitor: BadgeVisitor;
  /** Any CSS width. Height follows from the artwork's 748 : 1024 ratio. */
  width: string;
  /** Draw the QR. Off for tiles too small to hold a scannable code. */
  detail?: boolean;
  /**
   * The RAW badge token — the string the QR encodes.
   *
   * Derived from the visitor, not random, so it is the same code every time and
   * the same code on the printed card. `GET /visitors/{id}` returns it, and the
   * list returns it for every row under `?with_tokens=true`.
   */
  token?: string;
  /**
   * Hold the QR encode until the caller says the card is worth drawing.
   *
   * The print queue mounts one card per visitor, and `QRCode.toString` is real
   * work on the main thread -- 250 encodes before the page settles, for cards
   * that are mostly off screen. The queue flips this as a card nears the
   * viewport; see `useNearViewport` there.
   */
  deferQr?: boolean;
}) {
  const t = useT();
  const vip = visitor.category === "vip";
  const inactive = visitor.is_active === false;
  // The reference card carries the bearer's role in the red band. Ours is the
  // one the rest of the app already uses, so a VIP still reads as a VIP.
  const role = vip ? "VIP GUEST" : visitor.organization || "VISITOR";

  return (
    <div
      style={{ width, fontFamily: CARD_FONT }}
      className={`cr80 relative shrink-0 overflow-hidden bg-white ${
        inactive ? "opacity-60" : ""
      }`}
    >
      {/*
        The navy field and its curved hem.

        `preserveAspectRatio="none"` on a 0..100 box is deliberate here, and is
        the opposite of the rule the charts follow: there is no stroke and no
        radius to distort, and the curve is DEFINED in percentages of the card,
        so stretching the box to the card is what reproduces the artwork. The
        control point sits at half the curve's span, which is the parabola the
        measured points fit: 21.4% at the left edge, 25.9% at 10%w, 28.7% at
        20%w, flat at 29.7% from 30.6%w on.
      */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path d="M0 0 H100 V29.7 H30.6 Q15.3 29.7 0 21.4 Z" fill={NAVY} />
      </svg>

      {/*
        The event mark, on the navy.

        THE BOX IS BIGGER THAN THE MARK, and it has to be: `drcc-event.png` is
        628 x 419 with the emblem occupying only x 132..543 of it, so more than
        a third of the file is transparent padding. Sized naively the emblem came
        out 105px against the artwork's ~155, visibly small. The box is therefore
        scaled by the padding ratio (0.655 of its width is emblem) and offset to
        put the emblem where the artwork has it -- which pushes the box a whisker
        off the left edge, hidden by the card's own `overflow-hidden`.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/drcc-event.png"
        alt=""
        aria-hidden
        className="absolute object-contain"
        style={{ left: "-0.4%", top: "5.7%", width: "31.6%", height: "16%" }}
      />

      {/* Conference name and theme, centred in the space beside the mark. */}
      {/*
        Both title lines are centred on 62.2% of the card -- the axis the theme
        shares, right of the mark. Line 1 is 482px of the artwork's 748 (64.4%)
        and line 2 is 386, which is what pins the size: 36 characters in 482px
        is 0.36em each, so this is the condensed face again, set at 4.4cqw with
        a 35px line pitch (lineHeight 1.06 at that size).
      */}
      <p
        className="absolute text-center font-bold text-white"
        style={{
          left: "26%",
          right: "1.6%",
          top: "7.9%",
          fontFamily: CARD_FONT_CONDENSED,
          fontSize: "4.4cqw",
          lineHeight: 1.064,
        }}
      >
        {EVENT.name}
        <br />
        {EVENT.subtitle}
      </p>

      {/*
        The theme, on the same 62.2% axis as the title. Title Case and
        typographic quotes, as the artwork sets it; `capitalize` rather than a
        second copy of the words in the constant.
      */}
      <p
        className="absolute text-center text-white capitalize"
        style={{
          left: "36.2%",
          right: "11.8%",
          top: "17.1%",
          fontFamily: CARD_FONT_CONDENSED,
          fontSize: "5cqw",
          /*
            SET TIGHT ON PURPOSE. The artwork stacks these two lines 29px apart
            on a 37px face -- the descender of "Empowering" runs down beside the
            cap of "Connecting". At a normal 1.2 the second line drops 16px and
            the block stops matching.
          */
          lineHeight: 0.72,
        }}
      >
        &ldquo;{EVENT.theme}&rdquo;
      </p>

      {/*
        The photograph: a rounded rectangle with a thin dark keyline, NOT the
        circle the old card used. `object-cover` crops whatever shape is stored
        to this box, the same way the lobby screen does.
      */}
      <div
        className="absolute overflow-hidden bg-white"
        style={{
          left: "4.8%",
          top: "38.7%",
          width: "32.2%",
          height: "31.1%",
          borderRadius: "2.6cqw",
          border: "0.5cqw solid #111111",
        }}
      >
        {visitor.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={visitor.photo}
            alt=""
            /*
              The print queue renders one card per visitor, so this is 250 full
              badge-resolution photographs on a page that shows a dozen. The box
              has its size from the card, so lazy loading costs no layout shift.
            */
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${inactive ? "grayscale" : ""}`}
          />
        ) : (
          <div className="h-full w-full bg-line" />
        )}
      </div>

      {/*
        The name, underlined, sitting ON a baseline rather than hanging from a
        top edge: the box is anchored at the bottom and grows UPWARD into the
        white space above, so a name twice this long wraps toward the header
        instead of pushing the country down into the code.
      */}
      <div
        className="absolute flex items-end justify-center text-center"
        style={{
          left: "38.5%",
          right: "3.3%",
          top: "27%",
          height: "15.2%",
          color: "#000000",
        }}
      >
        <p
          className="font-bold underline [overflow-wrap:anywhere]"
          style={{
            fontFamily: CARD_FONT_CONDENSED,
            fontSize: "5.32cqw",
            lineHeight: 1.1,
            textUnderlineOffset: "0.14em",
            textDecorationThickness: "0.055em",
          }}
        >
          {visitor.full_name}
        </p>
      </div>

      <p
        className="absolute truncate text-center font-bold uppercase"
        style={{
          left: "38.5%",
          right: "3.3%",
          top: "42.9%",
          fontFamily: CARD_FONT_CONDENSED,
          fontSize: "5.42cqw",
          letterSpacing: "0.075em",
          lineHeight: 1.1,
          color: "#000000",
        }}
      >
        {visitor.country}
      </p>

      {/* The code, in the artwork's square. */}
      {detail ? (
        <div
          className="absolute"
          style={{ left: "54.1%", top: "49.3%", width: "27.3%", height: "19.9%" }}
        >
          <QrPanel token={token} serial={visitor.badge_serial} defer={deferQr} />
        </div>
      ) : null}

      {/* The bearer's role. */}
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ top: "78.8%", height: "6.3%", background: RED }}
      >
        <p
          className="truncate px-[3%] font-bold text-white uppercase"
          style={{ fontSize: "5.6cqw", lineHeight: 1 }}
        >
          {role}
        </p>
      </div>

      {/* The organisers' address, as printed. */}
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ top: "85.1%", height: "5.1%", background: NAVY }}
      >
        <p
          className="text-white"
          style={{
            fontSize: "4.7cqw",
            lineHeight: 1,
            transform: "translateY(-0.14em)",
          }}
        >
          {EVENT.website}
        </p>
      </div>

      {/*
        The tais at the foot: a photograph of the woven band from the artwork
        itself (`public/brand/tais-strip.png`, cropped from it), stretched to the
        card's width exactly as the original does. Nothing here is generated --
        a drawn approximation of a real textile reads as a pattern, not as cloth.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/tais-strip.png"
        alt=""
        aria-hidden
        className="absolute inset-x-0 bottom-0"
        style={{ height: "9.8%", width: "100%", objectFit: "fill" }}
      />

      {inactive ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="mono rounded-full bg-graphite-950 px-[3cqw] py-[1.5cqw] font-bold tracking-[0.12em] text-white uppercase"
            style={{ fontSize: "5.6cqw" }}
          >
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
 * (see qrcode/lib/renderer/canvas.js), and an inline style outranks the size
 * this card gives it. The QR therefore rendered at a fixed 320px on every card.
 * A vector in an `<img>` has no intrinsic pixel size to fight with.
 *
 * Error correction M with the event mark in the middle, matching the PDF. The
 * level did NOT change when the mark went in, and raising it would make the
 * badge worse — see `QR_ERROR_CORRECTION` in `lib/badge-geometry.ts` and the
 * measurement it points at. The mark is composited over the finished code
 * rather than encoded into it, so the string a scanner reads is unchanged.
 *
 * The colours are literal black on white on purpose. This is the one element on
 * the card that is not decoration but data — a scanner needs the contrast the
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
    and a `failed` flag set separately. Encoding is asynchronous and the token
    can change under us -- a different visitor lands in the same grid slot as the
    print queue re-renders -- so tagging the result means a slow encode that
    resolves late cannot paint the previous visitor's QR onto this card.
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
      // One module of quiet zone, as the artwork has it. The spec asks for four;
      // the card's own white field supplies the rest.
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
      <div className="relative h-full w-full bg-white">
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
    <div className="flex h-full w-full flex-col items-center justify-center border border-dashed border-line-strong">
      <span className="mono text-[3.4cqw] tracking-[0.14em] text-ink-3">QR</span>
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
