"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PhotoCropper } from "@/components/visitors/PhotoCropper";
import { PHOTO_ASPECT } from "@/lib/badge-geometry";

/**
 * Choose a visitor photo, and crop it in the same breath.
 *
 * THE CROP IS NOT A SEPARATE STEP THE REGISTRAR CAN SKIP. Picking a file opens
 * the cropper immediately, because the moment to frame someone's face is while
 * they are standing at the desk -- not later, from a list, with no idea which
 * blurry thumbnail was which.
 *
 * This file owns the file, the validation and the dialog. The cropping itself
 * lives in PhotoCropper, which is where the geometry belongs; the two were one
 * component until the crop grew a second pane and stopped fitting under a header.
 *
 * IMAGE DATA STAYS IN MEMORY. Object URLs only, revoked on replace and on
 * unmount -- nothing is written to localStorage, which would leave a visitor's
 * photograph sitting on a shared registration laptop after the event.
 */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

type Source = { url: string; name: string };

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
  const [source, setSource] = useState<Source | null>(null);
  const [cropping, setCropping] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Read by the unmount cleanup only. A ref rather than the state values
  // themselves, so that effect can stay `[]` and never re-run mid-session.
  const liveRef = useRef<{ source: Source | null; preview: string | null }>({
    source: null,
    preview: null,
  });
  useEffect(() => {
    liveRef.current = { source, preview };
  }, [source, preview]);

  useEffect(() => {
    return () => {
      if (liveRef.current.source) URL.revokeObjectURL(liveRef.current.source.url);
      if (liveRef.current.preview) URL.revokeObjectURL(liveRef.current.preview);
    };
  }, []);

  const accept = useCallback((file: File | undefined | null) => {
    setProblem(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProblem("That is not an image. Choose a JPEG or PNG.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setProblem("That image is over 20 MB. Choose a smaller one.");
      return;
    }

    setSource((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url: URL.createObjectURL(file), name: file.name };
    });
    setCropping(true);
  }, []);

  const applied = useCallback(
    (file: File) => {
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      onChange(file);
      setCropping(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (!cropping) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCropping(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cropping]);

  const shown = preview ?? existingUrl ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-2">Photo</span>
        <span className="mono text-[10px] tracking-wider text-ink-3">
          3:4 PORTRAIT · 600 × 800
        </span>
      </div>

      {shown ? (
        <div className="mt-2 flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt="The visitor's badge photo"
            className="w-28 shrink-0 rounded-xl object-cover ring-1 ring-line"
            style={{ aspectRatio: PHOTO_ASPECT }}
          />
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-ink-2">
              {preview
                ? "Cropped and ready."
                : "The photo already on file. It stays unless you replace it."}
            </p>
            <div className="flex flex-wrap gap-2">
              {source ? (
                <button
                  type="button"
                  onClick={() => setCropping(true)}
                  className="btn btn-ghost px-3 py-1.5 text-xs"
                >
                  Adjust crop
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn btn-ghost px-3 py-1.5 text-xs"
              >
                Choose a different photo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files?.[0]);
          }}
          className={`mt-2 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong hover:border-accent"
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-8 w-8 text-ink-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 16.5V18a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-1.5M12 3v13.5M7.5 7.5 12 3l4.5 4.5" />
          </svg>
          <span className="mt-3 text-sm font-medium text-ink">Add a photo</span>
          <span className="mt-1 text-xs text-ink-3">
            Drop one here, or click to choose. You crop it next.
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Reset, so choosing the same file twice still fires a change event.
          event.target.value = "";
        }}
      />

      {problem || error ? (
        <p role="alert" className="mt-2 text-xs text-revoked">
          {problem ?? error}
        </p>
      ) : null}

      {cropping && source ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crop the visitor photo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950/70 p-4 backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setCropping(false);
          }}
        >
          {/*
            Wide, because the cropper is two panes side by side above 1024px.
            Below that it stacks and this scrolls -- the header stays put and the
            cropper's own buttons travel with the controls, so nothing important
            ends up off the bottom of a short screen.
          */}
          <div className="card flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden p-0">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="display text-[0.95rem] leading-tight text-ink">
                  Frame the face
                </h2>
                <p className="mt-0.5 truncate text-[11px] text-ink-3">
                  {source.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCropping(false)}
                aria-label="Close without saving"
                className="-mt-0.5 -mr-1 shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-card-2 hover:text-ink"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <PhotoCropper
                source={source}
                onApply={applied}
                onCancel={() => setCropping(false)}
                onChangeImage={() => inputRef.current?.click()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
