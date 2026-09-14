"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";

import { MIN_OUTPUT_WIDTH, OUTPUT_WIDTH, PHOTO_ASPECT } from "@/lib/badge-geometry";
import { cropOutputSize, isCropTooSmall, type CropLimits } from "@/lib/crop-output";
import { useT } from "@/lib/i18n";

/*
  The export box is the stored 3:4 photo turned into limits: at most 600 wide and
  800 high. The floor is the print floor, which is also the server's MIN_SIDE.
*/
const LIMITS: CropLimits = {
  maxWidth: OUTPUT_WIDTH,
  maxHeight: Math.round(OUTPUT_WIDTH / PHOTO_ASPECT),
  minSide: MIN_OUTPUT_WIDTH,
};

const WHOLE_IMAGE: Crop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

/**
 * The visitor's photo, full screen, with a free crop and two decisions.
 *
 * DELIBERATELY NOT THE DESK'S `PhotoCropper`. That one is a registrar's tool --
 * ratio select, pixel read-outs, a quality slider, three buttons -- and on a
 * phone it put the photo in a quarter of the screen and the decisions below the
 * fold. A visitor needs two things: is this the photo, yes or no.
 *
 * The crop starts as the whole image, because most selfies need nothing, and is
 * free in shape. Whatever shape is chosen, the badge and the lobby screen
 * cover-crop it to a circle (`cover_box` in apps/badges/services.py).
 *
 * THE BUTTONS ARE SIBLINGS OF THE CROP, NOT CHILDREN. ReactCrop starts a new
 * selection on any pointerdown inside itself, so a button rendered inside it
 * would redraw the crop on the way to being pressed. Laid over it as a sibling,
 * a press never reaches the cropper -- and the gap between the two discs leaves
 * the bottom-edge handle reachable underneath.
 */
export function PhotoReview({
  source,
  onUse,
  onRetake,
  onClose,
}: {
  source: string;
  onUse: (photo: File) => void;
  onRetake: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(WHOLE_IMAGE);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // The selection in SOURCE pixels, from the percent crop -- no layout read.
  const selection = {
    x: (crop.x / 100) * natural.width,
    y: (crop.y / 100) * natural.height,
    width: (crop.width / 100) * natural.width,
    height: (crop.height / 100) * natural.height,
  };
  const loaded = natural.width > 0;
  const tooSmall = isCropTooSmall(selection.width, selection.height, LIMITS);

  function use() {
    const image = imageRef.current;
    if (!image || tooSmall) return;

    const size = cropOutputSize(selection.width, selection.height, LIMITS);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      0,
      0,
      size.width,
      size.height,
    );

    setBusy(true);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onUse(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("publicRegister.reviewPhoto")}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950 p-3 outline-none"
    >
      <div className="relative flex max-w-full">
        <ReactCrop
          crop={crop}
          onChange={(_, percent) => setCrop(percent)}
          keepSelection
          ruleOfThirds
          minWidth={24}
          minHeight={24}
          className="vms-crop max-h-[calc(100dvh-1.5rem)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={source}
            alt={t("crop.alt")}
            onLoad={(event) =>
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            className="max-h-[calc(100dvh-1.5rem)] w-auto"
          />
        </ReactCrop>

        {loaded && tooSmall ? (
          <p
            role="alert"
            className="pointer-events-none absolute inset-x-3 top-3 mx-auto w-fit rounded-full bg-graphite-950/85 px-3.5 py-1.5 text-center text-xs text-white"
          >
            {t("publicRegister.cropTooSmall")}
          </p>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center gap-20">
          <button
            type="button"
            onClick={onRetake}
            aria-label={t("publicRegister.retakePhoto")}
            title={t("publicRegister.retakePhoto")}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-white text-graphite-950 shadow-[0_6px_20px_rgb(0_0_0/0.35)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white active:scale-95"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={use}
            disabled={!loaded || tooSmall || busy}
            aria-label={t("publicRegister.usePhoto")}
            title={t("publicRegister.usePhoto")}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-[0_6px_20px_rgb(0_0_0/0.35)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white active:scale-95 disabled:opacity-45 disabled:active:scale-100"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
