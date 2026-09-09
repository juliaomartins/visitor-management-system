"use client";

import { useEffect, useRef, useState } from "react";

import { useRichT, useT } from "@/lib/i18n";

/**
 * Confirm before erasing a registration for good.
 *
 * THE ONLY DIALOG IN THE DASHBOARD GUARDING SOMETHING TRULY IRREVERSIBLE, and
 * the only one that asks the operator to type. Deactivating is one click and one
 * click back; this drops the row and the visitor's photograph from the server,
 * and no amount of reprinting brings either of them back.
 *
 * Typing the serial is not ceremony. The serial is on the card in front of the
 * registrar, so copying it is trivial when they mean it and impossible when they
 * have the wrong visitor open — which is the mistake this exists to catch.
 *
 * The scan count is stated up front rather than reported afterwards. Those rows
 * survive the delete but stop naming anybody, so the entrance log keeps its
 * totals while losing an identity, and that trade is the operator's to make
 * knowingly.
 */
export function PurgeDialog({
  open,
  visitorName,
  badgeSerial,
  scanCount,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  visitorName: string;
  badgeSerial: string;
  /**
   * Scans that will survive, detached. Shown before anyone confirms.
   *
   * Undefined where the caller genuinely does not know — the visitor list holds
   * no scan history, and fetching one visitor's just to fill in a number would
   * put a request behind every right-click. The copy says less in that case
   * rather than guessing at a figure.
   */
  scanCount?: number;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const rich = useRichT();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /*
    Clearing the box is part of dismissing, not a consequence of `open` going
    false -- setting state from an effect body is the lint rule that exists to
    stop exactly that. Every route out of this dialog goes through here, so a
    matching serial is never left sitting in the field for the next visitor.
  */
  function dismiss() {
    setTyped("");
    onCancel();
  }

  const matches = typed.trim().toUpperCase() === badgeSerial.toUpperCase();

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) dismiss();
      }}
      onClose={dismiss}
      aria-labelledby="purge-title"
      className="m-auto w-[min(30rem,calc(100vw-2rem))] card p-0 text-ink backdrop:bg-graphite-950/60"
    >
      <div className="px-6 py-6">
        <p className="mono text-[11px] font-bold tracking-[0.22em] text-revoked uppercase">
          {t("purge.warning")}
        </p>
        <h2
          id="purge-title"
          className="mt-1 text-lg font-semibold tracking-tight"
        >
          {t("purge.title", { name: visitorName })}
        </h2>

        <p className="mt-2 text-sm text-ink-2">{t("purge.body")}</p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink-3">
          <li>
            {/*
              One and many are separate messages rather than a count glued to a
              conjugated verb. English needs "stays"/"stay"; Portuguese needs
              "permanece"/"permanecem"; Tetun inflects neither and says the same
              thing both times, which it can only do if it owns both strings.
            */}
            {scanCount === undefined
              ? t("purge.scansUnknown")
              : scanCount === 0
                ? t("purge.scansNone")
                : t(scanCount === 1 ? "purge.scansOne" : "purge.scansMany", {
                    count: scanCount,
                  })}
          </li>
          <li>{t("purge.serialRetired", { serial: badgeSerial })}</li>
          <li>{t("purge.reRegister")}</li>
        </ul>

        <label
          htmlFor="purge-confirm"
          className="mt-5 block text-xs font-medium text-ink-2"
        >
          {rich("purge.typeToConfirm", {
            serial: <span className="mono text-ink">{badgeSerial}</span>,
          })}
        </label>
        <input
          id="purge-confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={pending}
          autoComplete="off"
          spellCheck={false}
          placeholder={badgeSerial}
          className="field mono mt-1.5 w-full uppercase"
        />

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
            onClick={dismiss}
            disabled={pending}
            className="btn btn-ghost disabled:opacity-60"
          >
            {t("purge.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || !matches}
            className="btn btn-danger disabled:opacity-40"
          >
            {pending ? t("purge.pending") : t("purge.confirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
