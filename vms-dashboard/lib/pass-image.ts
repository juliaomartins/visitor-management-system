/**
 * The visitor's pass as a PNG they can keep.
 *
 * WHY A FILE AND NOT THE PAGE. The pass lives in `sessionStorage`, so it dies
 * with the tab -- a phone that runs out of battery, a browser that drops a tab
 * under memory pressure, or a visitor who closes it walks up to the door with
 * nothing. A saved image sits in their photos and needs no network, no session
 * and no server.
 *
 * The image is drawn for a scanner first: black modules on white with a quiet
 * zone, the event mark in the middle exactly as the printed card carries it (see
 * `QR_ERROR_CORRECTION` -- the level does not change for the logo), and the name
 * and serial printed underneath so a guard can match the phone to the person.
 */
import QRCode from "qrcode";

import {
  QR_ERROR_CORRECTION,
  QR_LOGO_PAD,
  QR_LOGO_PLATE_FRACTION,
  QR_LOGO_SRC,
} from "@/lib/badge-geometry";
import { wrapLines } from "@/lib/pass-name";

const WIDTH = 1080;
const PAD = 72;
const QR_SIZE = WIDTH - PAD * 2;

const EVENT_SIZE = 34;
const DATES_SIZE = 28;
const NAME_SIZE = 56;
const SERIAL_SIZE = 40;
const FOOT_SIZE = 28;

/* System stacks on purpose: a canvas cannot wait for a web font, and a missing
   family would silently fall back mid-draw with the layout already measured. */
const SANS = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const MONO = `ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, monospace`;

const INK = "#0b1016";
const INK_SOFT = "#4a5560";

export interface PassSubject {
  full_name: string;
  badge_serial: string;
  badge_token: string;
}

/** Already translated by the caller: this module holds no strings of its own. */
export interface PassCaptions {
  event: string;
  dates: string;
  foot: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image failed: ${src}`));
    image.src = src;
  });
}

/**
 * Draw the pass. Rejects rather than returning half an image: the button says
 * so, and a visitor must never be handed a QR that did not finish rendering.
 */
export async function buildPassPng(
  subject: PassSubject,
  captions: PassCaptions,
): Promise<Blob> {
  const [qr, logo] = await Promise.all([
    QRCode.toDataURL(subject.badge_token, {
      errorCorrectionLevel: QR_ERROR_CORRECTION,
      margin: 2,
      width: QR_SIZE,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(loadImage),
    loadImage(QR_LOGO_SRC).catch(() => null),
  ]);

  const measurer = document.createElement("canvas").getContext("2d");
  if (!measurer) throw new Error("no 2d context");
  measurer.font = `700 ${NAME_SIZE}px ${SANS}`;
  const nameLines = wrapLines(subject.full_name, WIDTH - PAD * 2, (text) =>
    measurer.measureText(text).width,
  );

  const qrTop = PAD + EVENT_SIZE + 16 + DATES_SIZE + 40;
  const nameTop = qrTop + QR_SIZE + 56;
  const serialTop = nameTop + nameLines.length * (NAME_SIZE + 12) + 12;
  const footTop = serialTop + SERIAL_SIZE + 44;
  const height = footTop + FOOT_SIZE + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, WIDTH, height);
  context.textAlign = "center";
  context.textBaseline = "top";

  context.fillStyle = INK;
  context.font = `700 ${EVENT_SIZE}px ${SANS}`;
  context.fillText(captions.event, WIDTH / 2, PAD, WIDTH - PAD * 2);
  context.fillStyle = INK_SOFT;
  context.font = `400 ${DATES_SIZE}px ${SANS}`;
  context.fillText(captions.dates, WIDTH / 2, PAD + EVENT_SIZE + 16, WIDTH - PAD * 2);

  context.drawImage(qr, PAD, qrTop, QR_SIZE, QR_SIZE);

  if (logo) {
    // The same plate the screen and the printed card use, so one code is drawn
    // three ways and reads identically.
    const plate = QR_SIZE * QR_LOGO_PLATE_FRACTION;
    const mark = plate / QR_LOGO_PAD;
    const centreX = PAD + QR_SIZE / 2;
    const centreY = qrTop + QR_SIZE / 2;
    context.fillStyle = "#ffffff";
    context.fillRect(centreX - plate / 2, centreY - plate / 2, plate, plate);
    context.drawImage(logo, centreX - mark / 2, centreY - mark / 2, mark, mark);
  }

  context.fillStyle = INK;
  context.font = `700 ${NAME_SIZE}px ${SANS}`;
  nameLines.forEach((line, index) => {
    context.fillText(line, WIDTH / 2, nameTop + index * (NAME_SIZE + 12));
  });

  context.font = `500 ${SERIAL_SIZE}px ${MONO}`;
  context.fillText(subject.badge_serial, WIDTH / 2, serialTop);

  context.fillStyle = INK_SOFT;
  context.font = `400 ${FOOT_SIZE}px ${SANS}`;
  context.fillText(captions.foot, WIDTH / 2, footTop, WIDTH - PAD * 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

/** What happened when the file was handed to the browser. */
export type SaveOutcome = "saved" | "opened";

/**
 * Hand the image to the phone.
 *
 * `<a download>` is the path on every browser at this event's age, including
 * iOS Safari 13 and later. Where it is missing the image is opened in a tab
 * instead, and the caller tells the visitor to press and hold it -- which is
 * also the gesture iOS users reach for anyway.
 *
 * NOT `navigator.share`, which would offer "Save Image" directly: it is
 * secure-context only, and this page is served over plain http on the event LAN
 * (CLAUDE.md hard constraint 9), so it does not exist where it would be used.
 */
export function savePassImage(blob: Blob, fileName: string): SaveOutcome {
  const url = URL.createObjectURL(blob);

  if ("download" in HTMLAnchorElement.prototype) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Long after the save has started, and never during it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "saved";
  }

  // Left un-revoked on purpose: the new tab is still reading it.
  window.open(url, "_blank", "noopener");
  return "opened";
}
