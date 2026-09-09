"use client";

import { useEffect, useRef } from "react";

import { kindInlineKey, type Device } from "@/lib/devices";
import { useRichT, useT } from "@/lib/i18n";

/**
 * Confirm before killing a device.
 *
 * Revoking a device is more disruptive than revoking a badge: a badge stops one
 * guest, a device stops a door. So the copy names the device, says plainly that
 * it stops working the moment this is confirmed, and states that the only way
 * back is a new pairing code — there is no un-revoke.
 *
 * A native `<dialog>` brings the focus trap, the Escape handler and the inert
 * backdrop with it, and all three are easy to get wrong by hand.
 */
export function RevokeDeviceDialog({
  device,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  device: Device | null;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const rich = useRichT();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const open = device !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClose={onCancel}
      aria-labelledby="revoke-device-title"
      className="m-auto w-[min(30rem,calc(100vw-2rem))] card p-0 text-ink backdrop:bg-graphite-950/60"
    >
      {device ? (
        <div className="px-6 py-6">
          <h2
            id="revoke-device-title"
            className="text-lg font-semibold tracking-tight"
          >
            {t("revokeDevice.title", { name: device.name })}
          </h2>

          <p className="mt-2 text-sm text-ink-2">
            {/*
              The kind comes from its own mid-sentence message rather than from
              lowercasing the column label. Lowercasing a noun is an English
              habit; Portuguese and Tetun do not agree that the two forms are
              the same word with a different first letter.
            */}
            {rich("revokeDevice.body", {
              kind: t(kindInlineKey(device.kind)),
              strong: (
                <span className="font-medium text-ink">
                  {t("revokeDevice.bodyStrong")}
                </span>
              ),
            })}
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-ink-3">
            <li>
              {rich("revokeDevice.point1", {
                strong: (
                  <span className="font-medium text-ink-2">
                    {t("revokeDevice.point1Strong")}
                  </span>
                ),
              })}
            </li>
            <li>{t("revokeDevice.point2")}</li>
            <li>{t("revokeDevice.point3")}</li>
            <li>{t("revokeDevice.point4")}</li>
          </ul>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl bg-revoked-soft px-4 py-3 text-sm text-revoked"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="btn btn-ghost disabled:opacity-60"
            >
              {t("revokeDevice.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="btn btn-danger disabled:opacity-70"
            >
              {pending
                ? t("revokeDevice.pending")
                : t("revokeDevice.confirm")}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
