"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n";

/**
 * A live front-camera preview, where the browser allows one.
 *
 * Only offered in a secure context -- see PhotoStep. The stream is stopped on
 * capture, on cancel and on unmount, so the camera light never stays on after
 * the dialog has gone.
 */
export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Mirror back: the preview is shown mirrored, like a mirror, but the saved
    // photo must not be -- text on a lanyard would read backwards.
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("publicRegister.useCamera")}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-graphite-950/90 p-4"
    >
      {failed ? (
        <p role="alert" className="rounded-lg bg-card px-4 py-3 text-sm text-revoked">
          {t("publicRegister.cameraFailed")}
        </p>
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          className="max-h-[70dvh] w-full max-w-md -scale-x-100 rounded-2xl bg-graphite-900 object-cover"
        />
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          {t("publicRegister.cancel")}
        </button>
        {failed ? null : (
          <button type="button" onClick={capture} className="btn btn-primary">
            {t("publicRegister.capture")}
          </button>
        )}
      </div>
    </div>
  );
}
