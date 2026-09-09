"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, {
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";

import {
  MIN_OUTPUT_WIDTH,
  OUTPUT_WIDTH,
  PHOTO_ASPECT,
} from "@/lib/badge-geometry";

/**
 * Crop a visitor photo. Two panes: the image on the left, the decisions on the
 * right.
 *
 * THE DEFAULT CROP IS THE BIGGEST ONE THAT FITS, and that is the whole point.
 * Earlier versions dropped a small box in the middle and left the registrar to
 * drag it out to something usable on every single visitor. The box now starts as
 * the largest rectangle of the locked ratio the image can contain, and face
 * positioning only TRANSLATES it -- never shrinks it. A 354x472 ID photo comes in
 * at the full 354px width, cropping only the overflow on the long axis.
 *
 * THE CIRCLE IS DRAWN INSIDE THE BOX because the circle is what anyone sees. The
 * badge clips the photo round (`clip.circle`, services.py) and the lobby screen
 * renders it `rounded-full object-cover`. The crop box is 3:4 because that is
 * the storage format three other places depend on, but the part that survives is
 * the inscribed circle, so it is drawn rather than left to be discovered after
 * printing.
 */
type Source = { url: string; name: string };

type RatioMode = "badge" | "square" | "free";

const RATIOS: { value: RatioMode; label: string; aspect?: number }[] = [
  { value: "badge", label: "Badge (locked)", aspect: PHOTO_ASPECT },
  { value: "square", label: "Square", aspect: 1 },
  { value: "free", label: "Free" },
];

const QUALITY_MIN = 0.5;
const QUALITY_MAX = 0.95;

/**
 * Where a face should sit vertically inside an ID photo, as a fraction from the
 * top of the crop. The convention is roughly the upper third; 0.38 puts the eyes
 * comfortably above centre without cropping the top of the head.
 */
const FACE_ZONE = 0.38;

/** The biggest crop of `aspect` that fits, in percent, positioned by `centreY`. */
function biggestCrop(
  aspect: number | undefined,
  naturalWidth: number,
  naturalHeight: number,
  centreX = 0.5,
  centreY = FACE_ZONE,
): Crop {
  if (!aspect) {
    return { unit: "%", x: 0, y: 0, width: 100, height: 100 };
  }

  // `makeAspectCrop` sizes to the container; asking for 100% on the axis that
  // can carry it gets the largest box, and the other axis follows the ratio.
  const wide = naturalWidth / naturalHeight > aspect;
  const base = makeAspectCrop(
    wide ? { unit: "%", height: 100 } : { unit: "%", width: 100 },
    aspect,
    naturalWidth,
    naturalHeight,
  );

  // Translate, never shrink: clamp the offset so the full-size box stays inside.
  const x = Math.min(Math.max(centreX * 100 - base.width / 2, 0), 100 - base.width);
  const y = Math.min(
    Math.max(centreY * 100 - base.height / 2, 0),
    100 - base.height,
  );
  return { ...base, x, y };
}

/**
 * Ask the browser where the face is, if it can answer.
 *
 * `FaceDetector` is Chromium-only and still flagged in some builds, so this is
 * strictly an enhancement: it runs after the default crop is already on screen,
 * it is never awaited by anything the user is waiting for, and a failure is
 * indistinguishable from the API being absent. No spinner, no lock.
 */
async function findFaceCentre(
  image: HTMLImageElement,
): Promise<{ x: number; y: number } | null> {
  const Detector = (
    window as unknown as {
      FaceDetector?: new (options?: { fastMode?: boolean }) => {
        detect: (source: CanvasImageSource) => Promise<
          { boundingBox: { x: number; y: number; width: number; height: number } }[]
        >;
      };
    }
  ).FaceDetector;
  if (!Detector) return null;

  try {
    const faces = await new Detector({ fastMode: true }).detect(image);
    if (!faces.length) return null;

    // The largest face, on the assumption the visitor is the subject.
    const face = faces.reduce((biggest, candidate) =>
      candidate.boundingBox.width > biggest.boundingBox.width ? candidate : biggest,
    );
    const box = face.boundingBox;
    return {
      x: (box.x + box.width / 2) / image.naturalWidth,
      y: (box.y + box.height / 2) / image.naturalHeight,
    };
  } catch {
    return null;
  }
}

export function PhotoCropper({
  source,
  onApply,
  onCancel,
  onChangeImage,
}: {
  source: Source;
  onApply: (file: File) => void;
  onCancel: () => void;
  onChangeImage: () => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop>();
  const [ratio, setRatio] = useState<RatioMode>("badge");
  const [quality, setQuality] = useState(0.9);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);

  const aspect = RATIOS.find((option) => option.value === ratio)?.aspect;

  /**
   * Re-fit on a ratio change, in the handler rather than an effect.
   *
   * Changing the ratio is an event, not a synchronisation with anything
   * external, so deriving the new box here keeps it to a single render. The
   * same work in an effect is a second render every time -- and the hooks lint
   * rejects it, correctly.
   */
  const chooseRatio = useCallback(
    (next: RatioMode) => {
      setRatio(next);
      if (!natural.width) return;
      const nextAspect = RATIOS.find((option) => option.value === next)?.aspect;
      setCrop(biggestCrop(nextAspect, natural.width, natural.height));
    },
    [natural.width, natural.height],
  );

  const onImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const { naturalWidth, naturalHeight } = image;
      setNatural({ width: naturalWidth, height: naturalHeight });
      setCrop(biggestCrop(PHOTO_ASPECT, naturalWidth, naturalHeight));

      // Enhancement only, and deliberately not awaited.
      void findFaceCentre(image).then((centre) => {
        if (!centre) return;
        setCrop((current) =>
          current
            ? biggestCrop(PHOTO_ASPECT, naturalWidth, naturalHeight, centre.x, centre.y)
            : current,
        );
      });
    },
    [],
  );

  // The live preview. Drawn from the completed crop so it does not repaint on
  // every pointer move while a handle is being dragged.
  useEffect(() => {
    const canvas = previewRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !completed?.width || !completed?.height) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const sourceWidth = completed.width * scaleX;
    const sourceHeight = completed.height * scaleY;

    // Never upscale: the output is the crop's own size, capped at the canonical
    // width. Scaling a 200px crop up to 600 invents detail that is not there and
    // prints softer than the honest small version.
    const width = Math.min(Math.round(sourceWidth), OUTPUT_WIDTH);
    const height = Math.round(width * (sourceHeight / sourceWidth));

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      completed.x * scaleX,
      completed.y * scaleY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
  }, [completed]);

  /*
    The crop in SOURCE pixels, derived from the percent crop rather than from the
    image element.

    `completed` is in displayed pixels, so converting it needs the element's
    rendered size -- a ref read, which React forbids during render and which
    would be stale on the first paint after a resize anyway. `crop` is already a
    percentage of the image, so multiplying by the natural size is both correct
    and ref-free.
  */
  const sourcePixels =
    crop?.width && natural.width
      ? {
          width: Math.round((crop.width / 100) * natural.width),
          height: Math.round((crop.height / 100) * natural.height),
        }
      : null;

  const tooSmall = sourcePixels !== null && sourcePixels.width < MIN_OUTPUT_WIDTH;

  const apply = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas || !completed?.width) return;

    setBusy(true);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return;
        onApply(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality,
    );
  }, [completed, quality, onApply]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* CANVAS PANE. The container sizes the image, not the viewport: this sits
          inside a dialog whose width is decided elsewhere, and reading `vw` here
          would make it wrong the moment anybody nests it differently. */}
      <div className="flex min-w-0 items-center justify-center rounded-xl border border-dashed border-line-strong bg-card-2 p-3">
        <ReactCrop
          crop={crop}
          onChange={(_, percent) => setCrop(percent)}
          onComplete={(pixels) => setCompleted(pixels)}
          aspect={aspect}
          ruleOfThirds
          keepSelection
          minWidth={24}
          className="vms-crop max-h-[52dvh]"
          renderSelectionAddon={() => (
            <>
              {/* The circle that actually gets printed and displayed. */}
              <span
                aria-hidden
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: "50%",
                  top: "50%",
                  width: "100%",
                  aspectRatio: "1",
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 0 1px var(--color-overlay-guide)",
                }}
              />
              {/* Crosshair at the centre of the box. */}
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2"
                style={{ background: "var(--color-overlay-guide)", opacity: 0.7 }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2"
                style={{ background: "var(--color-overlay-guide)", opacity: 0.7 }}
              />
            </>
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={source.url}
            alt="The photo being cropped"
            onLoad={onImageLoad}
            className="max-h-[52dvh] w-auto"
          />
        </ReactCrop>
      </div>

      {/* CONTROLS PANE. Scrollable in its own right below the canvas on narrow
          screens, so the buttons are never the thing that falls off. */}
      <div className="min-w-0 space-y-4 lg:max-h-[52dvh] lg:overflow-y-auto lg:pr-1">
        <div>
          <p className="mono text-[10px] tracking-[0.18em] text-ink-3 uppercase">
            Cropped image
          </p>
          <div className="mt-1.5 flex items-start gap-3">
            <canvas
              ref={previewRef}
              className="w-24 shrink-0 rounded-lg bg-card-2 object-contain ring-1 ring-line"
              style={{ aspectRatio: aspect ?? PHOTO_ASPECT }}
            />
            <p className="min-w-0 text-[11px] leading-snug text-ink-3">
              Only the circle is printed and shown on the lobby screen. Fill it
              with the head and shoulders.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-ink-2">Aspect ratio</span>
          <select
            value={ratio}
            onChange={(event) => chooseRatio(event.target.value as RatioMode)}
            className="field mt-1.5 w-full"
          >
            {RATIOS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-ink-2">Width</span>
            <input
              readOnly
              value={sourcePixels ? `${sourcePixels.width} px` : "—"}
              className="field mono mt-1.5 w-full text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-2">
              Height{ratio !== "free" ? " (locked)" : ""}
            </span>
            <input
              readOnly
              value={sourcePixels ? `${sourcePixels.height} px` : "—"}
              className="field mono mt-1.5 w-full text-xs"
            />
          </label>
        </div>

        {tooSmall ? (
          <p role="alert" className="rounded-lg bg-vip-soft px-3 py-2 text-[11px] leading-snug text-vip">
            This crop is {sourcePixels?.width}px wide. The badge prints the photo
            at {MIN_OUTPUT_WIDTH}px for 300dpi, so it will look soft on the card.
            Crop less, or use a larger photo.
          </p>
        ) : null}

        <label className="block">
          <span className="text-xs font-medium text-ink-2">Image quality</span>
          <input
            type="range"
            min={QUALITY_MIN}
            max={QUALITY_MAX}
            step={0.01}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
            className="mt-1.5 w-full accent-accent"
          />
          <span className="mt-1 flex justify-between text-[10px] text-ink-3">
            <span>Best compression</span>
            <span>Best quality</span>
          </span>
        </label>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={apply}
            disabled={busy || !completed?.width}
            className="btn btn-primary w-full py-2 text-sm disabled:opacity-60"
          >
            {busy ? "Applying…" : "Use this photo"}
          </button>
          <button
            type="button"
            onClick={onChangeImage}
            className="btn btn-ghost w-full py-2 text-sm"
          >
            Change image
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost w-full py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
