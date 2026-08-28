"use client";

import { useEffect, useRef } from "react";

/**
 * Confirm before reprinting anything.
 *
 * Printing a badge that already exists is not a reprint — it cannot be. The raw
 * token behind the QR was never stored, so the server has nothing to redraw and
 * the only thing it can do is mint a new one. The card the visitor is currently
 * wearing stops scanning the instant this runs.
 *
 * That is a genuinely surprising consequence of a button labelled "print", so it
 * gets a dialog that says it in plain words rather than a tooltip nobody reads.
 */
export function ReissueDialog({
  open,
  count,
  name,
  output = "sheet",
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  count: number;
  /** Set when reissuing exactly one visitor, so the copy can name them. */
  name?: string;
  /** What comes back. A spreadsheet leaves the building; a print sheet usually does not. */
  output?: "sheet" | "spreadsheet";
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

  const subject = name ?? `${count} ${count === 1 ? "visitor" : "visitors"}`;
  const isFile = output === "spreadsheet";

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClose={onCancel}
      aria-labelledby="reissue-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] card p-0 text-ink backdrop:bg-graphite-950/60"
    >
      <div className="px-6 py-6">
        <h2 id="reissue-title" className="text-lg font-semibold tracking-tight">
          {isFile
            ? `Export new badges for ${subject}?`
            : `Print a new badge for ${subject}?`}
        </h2>

        <p className="mt-2 text-sm text-ink-2">
          This issues a{" "}
          <span className="font-medium text-ink">brand new badge token</span>.
          Any card already printed — including one they are wearing right now —
          stops working the moment you confirm.
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink-3">
          <li>
            The old QR is dead immediately. Collect and destroy the old card, or
            it will show red at the door.
          </li>
          <li>
            This is not a choice the system makes. Only the digest of a badge
            token is stored, so an existing card can never be reprinted — only
            replaced.
          </li>
          <li>
            The visitor, their serial and their scan history are unchanged.
          </li>
          {isFile ? (
            <li className="text-ink-2">
              <span className="font-medium text-ink">
                The file will be the only copy of these tokens.
              </span>{" "}
              The server keeps a hash and cannot produce them again — lose the
              file and every badge in it has to be reissued a second time.
              Anyone holding it can make a working badge, so send it the way you
              would send the printed cards.
            </li>
          ) : null}
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
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn btn-primary disabled:opacity-70"
          >
            {pending
              ? isFile
                ? "Building…"
                : "Rendering…"
              : "Reissue and download"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
