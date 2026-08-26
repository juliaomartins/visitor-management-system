"use client";

import { useEffect, useRef } from "react";

import { kindLabel, type Device } from "@/lib/devices";

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
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-rule bg-card p-0 text-ink-900 backdrop:bg-ink-950/60"
    >
      {device ? (
        <div className="px-6 py-6">
          <h2
            id="revoke-device-title"
            className="text-lg font-semibold tracking-tight"
          >
            Revoke {device.name}?
          </h2>

          <p className="mt-2 text-sm text-ink-700">
            This {kindLabel(device.kind).toLowerCase()} stops working{" "}
            <span className="font-medium text-ink-900">immediately</span>. If it is
            a door phone, that door cannot record arrivals until someone re-pairs
            it.
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-ink-500">
            <li>
              Its token is dead. There is no un-revoke — getting it back means a new
              pairing code.
            </li>
            <li>
              Scans it already recorded are kept, and any it saved offline will
              still sync once it is paired again.
            </li>
            <li>It stays in this list, marked revoked, so the audit trail holds.</li>
          </ul>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md bg-revoked-soft px-3 py-2.5 text-sm text-revoked"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-md px-3.5 py-2.5 text-sm text-ink-700 hover:text-ink-900 disabled:opacity-60"
            >
              Keep it active
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="rounded-md bg-revoked px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-revoked focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
            >
              {pending ? "Revoking…" : "Revoke device"}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
