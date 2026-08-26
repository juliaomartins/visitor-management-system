"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Crop the visitor photo, in the browser, before anything is uploaded.
 *
 * NOT the card aspect. The CR80 card is 85.6 × 54 mm landscape, but the photo is
 * a PORTRAIT region inside it, the way a passport photo sits on an ID card. The
 * two get confused constantly — hence the name below, and hence this paragraph.
 *
 * 3:4 at 600 × 800 px: tall enough for the lobby screen, which renders arrivals at
 * 400 px tall, and enough pixels for the card without carrying a print-resolution
 * file through every list request.
 */
export const PHOTO_ASPECT = 3 / 4;

const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 800;

/** Display size of the crop stage. The export scales up from here. */
const STAGE_HEIGHT = 400;
const STAGE_WIDTH = Math.round(STAGE_HEIGHT * PHOTO_ASPECT);

const MAX_ZOOM = 4;
const NUDGE_PX = 8;
const JPEG_QUALITY = 0.9;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

type Frame = { scale: number; x: number; y: number };

export function PhotoUpload({
  onChange,
  existingUrl,
  error,
}: {
  onChange: (file: File | null) => void;
  /** On edit, the photo already on file. Untouched unless a new one is chosen. */
  existingUrl?: string;
  error?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const [sourceName, setSourceName] = useState<string | null>(null);
  const [frame, setFrame] = useState<Frame>({ scale: 1, x: 0, y: 0 });
  const [minScale, setMinScale] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);

  /** Keep the image covering the stage — no empty gutters, ever. */
  const clamp = useCallback((next: Frame, image: HTMLImageElement): Frame => {
    const floor = Math.max(
      STAGE_WIDTH / image.naturalWidth,
      STAGE_HEIGHT / image.naturalHeight,
    );
    const scale = Math.min(Math.max(next.scale, floor), floor * MAX_ZOOM);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    return {
      scale,
      x: Math.min(0, Math.max(next.x, STAGE_WIDTH - width)),
      y: Math.min(0, Math.max(next.y, STAGE_HEIGHT - height)),
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = STAGE_WIDTH * ratio;
    canvas.height = STAGE_HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      frame.x,
      frame.y,
      image.naturalWidth * frame.scale,
      image.naturalHeight * frame.scale,
    );
  }, [frame]);

  useEffect(draw, [draw]);

  /** Re-cut the crop and hand the parent a fresh File. */
  const emit = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;

    const output = document.createElement("canvas");
    output.width = OUTPUT_WIDTH;
    output.height = OUTPUT_HEIGHT;

    const context = output.getContext("2d");
    if (!context) return;

    const factor = OUTPUT_WIDTH / STAGE_WIDTH;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      frame.x * factor,
      frame.y * factor,
      image.naturalWidth * frame.scale * factor,
      image.naturalHeight * frame.scale * factor,
    );

    output.toBlob(
      (blob) => {
        if (!blob) return;
        onChange(
          new File([blob], `${(sourceName ?? "photo").replace(/\.\w+$/, "")}.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  }, [frame, onChange, sourceName]);

  // Debounced: a drag fires dozens of frames, and each one would re-encode a
  // 600 × 800 JPEG for a crop the registrar is still adjusting.
  useEffect(() => {
    if (!imageRef.current) return;
    const timer = setTimeout(emit, 120);
    return () => clearTimeout(timer);
  }, [emit]);

  function accept(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProblem("That file is not an image. Choose a JPEG or PNG.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setProblem("That image is over 20 MB. Choose a smaller one.");
      return;
    }

    setProblem(null);
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      imageRef.current = image;
      setSourceName(file.name);

      const floor = Math.max(
        STAGE_WIDTH / image.naturalWidth,
        STAGE_HEIGHT / image.naturalHeight,
      );
      setMinScale(floor);
      // Open centred, filling the frame.
      setFrame({
        scale: floor,
        x: (STAGE_WIDTH - image.naturalWidth * floor) / 2,
        y: (STAGE_HEIGHT - image.naturalHeight * floor) / 2,
      });
      URL.revokeObjectURL(url);
    };

    image.onerror = () => {
      setProblem("That image could not be read.");
      URL.revokeObjectURL(url);
    };

    image.src = url;
  }

  function move(dx: number, dy: number) {
    const image = imageRef.current;
    if (!image) return;
    setFrame((current) => clamp({ ...current, x: current.x + dx, y: current.y + dy }, image));
  }

  function zoomTo(scale: number) {
    const image = imageRef.current;
    if (!image) return;

    setFrame((current) => {
      // Zoom about the centre of the stage, not the top-left corner.
      const centreX = (STAGE_WIDTH / 2 - current.x) / current.scale;
      const centreY = (STAGE_HEIGHT / 2 - current.y) / current.scale;

      return clamp(
        {
          scale,
          x: STAGE_WIDTH / 2 - centreX * scale,
          y: STAGE_HEIGHT / 2 - centreY * scale,
        },
        image,
      );
    });
  }

  // Derived from state, not from imageRef: a ref read during render does not
  // re-render when the image finishes decoding.
  const loaded = sourceName !== null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="block text-xs font-medium text-ink-700">Photo</span>
        <span className="serial text-[11px] text-ink-500">
          3:4 portrait · {OUTPUT_WIDTH} × {OUTPUT_HEIGHT}
        </span>
      </div>

      <div className="mt-1.5 rounded-md border border-rule-strong bg-card p-4">
        {loaded ? (
          <>
            <canvas
              ref={canvasRef}
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              tabIndex={0}
              role="img"
              aria-label="Badge photo crop. Drag to reposition, or use the arrow keys."
              style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
              className="max-w-full cursor-grab touch-none rounded bg-ink-950 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                move(event.clientX - drag.x, event.clientY - drag.y);
                dragRef.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              onKeyDown={(event) => {
                const steps: Record<string, [number, number]> = {
                  ArrowLeft: [NUDGE_PX, 0],
                  ArrowRight: [-NUDGE_PX, 0],
                  ArrowUp: [0, NUDGE_PX],
                  ArrowDown: [0, -NUDGE_PX],
                };
                if (steps[event.key]) {
                  event.preventDefault();
                  move(...steps[event.key]);
                } else if (event.key === "+" || event.key === "=") {
                  event.preventDefault();
                  zoomTo(frame.scale * 1.15);
                } else if (event.key === "-") {
                  event.preventDefault();
                  zoomTo(frame.scale / 1.15);
                }
              }}
            />

            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="photo-zoom" className="text-xs text-ink-700">
                Zoom
              </label>
              <input
                id="photo-zoom"
                type="range"
                min={minScale}
                max={minScale * MAX_ZOOM}
                step={minScale / 100}
                value={frame.scale}
                onChange={(event) => zoomTo(Number(event.target.value))}
                className="h-1 flex-1 accent-accent"
              />
              <label className="cursor-pointer rounded-md border border-rule px-3 py-1.5 text-xs text-ink-700 hover:border-rule-strong hover:text-ink-900">
                Replace
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => accept(event.target.files?.[0])}
                />
              </label>
            </div>
          </>
        ) : (
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded border border-dashed border-rule-strong px-6 py-10 text-center hover:border-accent"
            style={{ minHeight: STAGE_HEIGHT }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              accept(event.dataTransfer.files?.[0]);
            }}
          >
            {existingUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={existingUrl}
                alt="Photo currently on file"
                className="mb-4 h-24 rounded object-cover"
                style={{ aspectRatio: PHOTO_ASPECT }}
              />
            ) : null}
            <span className="text-sm font-medium text-ink-900">
              {existingUrl ? "Replace the photo" : "Add a photo"}
            </span>
            <span className="mt-1 text-xs text-ink-500">
              Drop an image here, or click to choose one. You will crop it to the card
              next.
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => accept(event.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {loaded ? (
        <p className="mt-1.5 text-xs text-ink-500">
          Drag to reposition. Exported at {OUTPUT_WIDTH} × {OUTPUT_HEIGHT} px — a
          portrait photo, not the shape of the card it prints on.
        </p>
      ) : null}

      {problem ?? error ? (
        <p role="alert" className="mt-1.5 text-xs text-revoked">
          {problem ?? error}
        </p>
      ) : null}
    </div>
  );
}
