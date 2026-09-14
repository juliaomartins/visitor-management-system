"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { checkFaces, warmFaceCheck, type FaceCheck } from "@/lib/face-check";
import { useT } from "@/lib/i18n";

import { CameraCapture } from "./CameraCapture";
import { PhotoReview } from "./PhotoReview";

const subscribeNever = () => () => {};

type Origin = "file" | "camera";

/**
 * Photo in, reviewed with a free crop, face-checked.
 *
 * THE FILE INPUT IS THE REAL PATH. `capture="user"` opens the front camera on a
 * phone and works over plain http. The live camera preview is offered only
 * where `navigator.mediaDevices` exists -- a secure context -- which on the
 * event's `http://<lan-ip>` means localhost and nowhere else (CLAUDE.md, the
 * scanner-on-web section, measured it undefined on phones).
 *
 * Whichever way the photo arrived, `PhotoReview` shows it full screen with two
 * choices. ✕ goes back the same way it came -- the camera again, or the picker
 * again -- because "not this one" means "another one", not "no photo". Its
 * output fits 600 x 800 and is never upscaled: nothing larger leaves the phone.
 *
 * The face check runs on the CROPPED photo, because that is what prints.
 */
export function PhotoStep({
  onPhoto,
  onFaceCheck,
  face,
  errors,
}: {
  onPhoto: (file: File | null) => void;
  onFaceCheck: (result: FaceCheck) => void;
  face: FaceCheck | "checking" | null;
  errors?: string[];
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<{ url: string; origin: Origin } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);

  const canUseCamera = useSyncExternalStore(
    subscribeNever,
    () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    () => false,
  );

  // Object URLs are released on replace and on unmount; nothing is persisted.
  const live = useRef<{ source: string | null; preview: string | null }>({
    source: null,
    preview: null,
  });
  useEffect(() => {
    live.current = { source: source?.url ?? null, preview };
  }, [source, preview]);
  useEffect(
    () => () => {
      if (live.current.source) URL.revokeObjectURL(live.current.source);
      if (live.current.preview) URL.revokeObjectURL(live.current.preview);
    },
    [],
  );

  const open = useCallback((file: File | Blob | null | undefined, origin: Origin) => {
    if (!file || !file.type.startsWith("image/")) return;
    warmFaceCheck();
    setSource((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url: URL.createObjectURL(file), origin };
    });
  }, []);

  const closeReview = useCallback(() => {
    setSource((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  function retake() {
    const origin = source?.origin;
    closeReview();
    // Still inside the ✕ click, so the browser allows the picker to open.
    if (origin === "camera") setCamera(true);
    else inputRef.current?.click();
  }

  const applied = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      closeReview();
      onPhoto(file);

      const image = new Image();
      image.src = url;
      try {
        await image.decode();
        onFaceCheck(await checkFaces(image));
      } catch {
        onFaceCheck({ outcome: "unavailable" });
      }
    },
    [closeReview, onPhoto, onFaceCheck],
  );

  return (
    <div>
      <span className="block text-sm font-medium text-ink-2">{t("publicRegister.photo")}</span>
      <p className="mt-0.5 text-xs text-ink-3">{t("publicRegister.photoHint")}</p>

      {preview ? (
        <div className="mt-2.5 flex items-center gap-4">
          {/* The photo as it will be sent: the crop's own shape, not boxed to 3:4. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="max-h-32 w-auto max-w-28 shrink-0 rounded-xl ring-1 ring-line"
          />
          <div className="min-w-0 space-y-2">
            <FaceMessage face={face} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn btn-ghost px-3 py-1.5 text-sm"
            >
              {t("publicRegister.changePhoto")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong px-6 py-8 text-ink transition-colors hover:border-accent"
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
              <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
              <circle cx="12" cy="12.5" r="3.5" />
            </svg>
            <span className="mt-2 text-sm font-medium">{t("publicRegister.choosePhoto")}</span>
          </button>
          {canUseCamera ? (
            <button
              type="button"
              onClick={() => setCamera(true)}
              className="btn btn-ghost w-full text-sm"
            >
              {t("publicRegister.useCamera")}
            </button>
          ) : null}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          open(event.target.files?.[0], "file");
          event.target.value = "";
        }}
      />

      {errors ? (
        <p role="alert" className="mt-2 text-xs text-revoked">
          {errors.join(" ")}
        </p>
      ) : null}

      {camera ? (
        <CameraCapture
          onCapture={(blob) => {
            setCamera(false);
            open(blob, "camera");
          }}
          onCancel={() => setCamera(false)}
        />
      ) : null}

      {source ? (
        <PhotoReview
          // A new photo starts a fresh review, not the last photo's crop.
          key={source.url}
          source={source.url}
          onUse={(file) => void applied(file)}
          onRetake={retake}
          onClose={closeReview}
        />
      ) : null}
    </div>
  );
}

function FaceMessage({ face }: { face: FaceCheck | "checking" | null }) {
  const t = useT();
  if (face === null) return null;
  if (face === "checking") {
    return (
      <p aria-live="polite" className="text-sm text-ink-3">
        {t("publicRegister.checkingFace")}
      </p>
    );
  }
  if (face.outcome === "none" || face.outcome === "many") {
    return (
      <p role="alert" className="text-sm text-revoked">
        {t(face.outcome === "none" ? "publicRegister.faceNone" : "publicRegister.faceMany")}
      </p>
    );
  }
  if (face.outcome === "one") {
    return (
      <p aria-live="polite" className="text-sm text-valid">
        {t("publicRegister.faceOk")}
      </p>
    );
  }
  return null;
}
