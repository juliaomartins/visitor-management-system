"use client";

import { useEffect, useRef } from "react";

/**
 * Confirm before killing a badge.
 *
 * A native `<dialog>` rather than a hand-rolled overlay: it brings the focus trap,
 * the Escape handler and the inert backdrop with it, and all three are easy to get
 * wrong by hand.
 *
 * The copy spells out what revoking does and does not do, because the two are
 * easy to confuse under pressure — the visitor stays on the list, and the scan
 * history stays with them.
 */
export function RevokeDialog({
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
      aria-labelledby="revoke-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-card p-0 text-ink backdrop:bg-graphite-950/60"
    >
      <div className="px-6 py-6">
        <h2 id="revoke-title" className="text-lg font-semibold tracking-tight">
          Revoke this badge?
        </h2>

        <p className="mt-2 text-sm text-ink-2">
          {visitorName}&rsquo;s badge{" "}
          <span className="mono text-ink">{badgeSerial}</span> stops working
          immediately. The next scan of it shows red at the door.
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink-3">
          <li>They stay on the visitor list, marked revoked.</li>
          <li>Their scan history is kept — that is the point of revoking.</li>
          <li>
            Reprinting means registering a new badge; this one cannot be brought
            back.
          </li>
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
            className="rounded-md px-3.5 py-2.5 text-sm text-ink-2 hover:text-ink disabled:opacity-60"
          >
            Keep it active
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-revoked px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            {pending ? "Revoking…" : "Revoke badge"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
