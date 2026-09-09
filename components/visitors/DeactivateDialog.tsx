"use client";

import { useEffect, useRef } from "react";

/**
 * Confirm before switching a visitor off.
 *
 * A native `<dialog>` rather than a hand-rolled overlay: it brings the focus
 * trap, the Escape handler and the inert backdrop with it, and all three are
 * easy to get wrong by hand.
 *
 * THIS USED TO BE THE REVOKE DIALOG AND ITS WARNING IS NOW MILDER ON PURPOSE.
 * It said the badge "cannot be brought back" and that a replacement meant
 * registering a new one, which was true when the action was one-way. Activating
 * is one click now and the same printed card resumes working, so a dialog that
 * still spoke of a dead badge would be asking for more dread than the action
 * deserves — and dread spent here is dread unavailable for the delete, which
 * really is permanent.
 */
export function DeactivateDialog({
  open,
  visitorName,
  badgeSerial,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  visitorName: string;
  badgeSerial: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

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
      aria-labelledby="deactivate-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] card p-0 text-ink backdrop:bg-graphite-950/60"
    >
      <div className="px-6 py-6">
        <h2
          id="deactivate-title"
          className="text-lg font-semibold tracking-tight"
        >
          Deactivate {visitorName}?
        </h2>

        <p className="mt-2 text-sm text-ink-2">
          Badge <span className="mono text-ink">{badgeSerial}</span> stops
          working immediately. The next scan of it shows red at the door.
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink-3">
          <li>They stay on the visitor list, marked deactivated.</li>
          <li>Their scan history is kept.</li>
          <li>
            Reversible. Activating puts the same printed card back to work —
            there is nothing to reprint.
          </li>
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
            Keep them active
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn btn-danger disabled:opacity-70"
          >
            {pending ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
