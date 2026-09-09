"use client";

import { useEffect, useRef } from "react";

import { useRichT, useT } from "@/lib/i18n";

/**
 * Confirm the one thing left that deserves a confirmation.
 *
 * THIS DIALOG USED TO GUARD PRINTING, AND THEN REPLACING, AND NOW GUARDS
 * NEITHER. Badge tokens were once random and unrecoverable, so putting a QR on
 * a sheet meant minting a new one and killing the card the visitor was wearing.
 * Tokens are derived now: printing redraws what is already on the card, so the
 * print button asks nothing and simply produces the file.
 *
 * The "replace" case went with it. A badge is issued once at registration and
 * stays valid until the visitor is deactivated or deleted, so the dashboard has
 * control that rotates a token and this dialog no longer warns about one.
 *
 * What is left is custody, not breakage: the export writes working credentials
 * into a file that leaves the building.
 */
export function ReissueDialog({
  open,
  count,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  count: number;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const rich = useRichT();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /*
    The whole question is one message per plural form, not a count glued
    to a noun glued into a sentence. Portuguese agrees the participle
    with the noun and Tetun does not inflect it, so neither can be built
    from English fragments.
  */
  const title = t(count === 1 ? "export.titleOne" : "export.titleMany", {
    count,
  });

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
          {title}
        </h2>

        <p className="mt-2 text-sm text-ink-2">
          {rich("export.body", {
            strong: (
              <span className="font-medium text-ink">
                {t("export.bodyStrong")}
              </span>
            ),
          })}
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink-3">
          <li>{t("export.point1")}</li>
          <li>{t("export.point2")}</li>
          <li>{t("export.point3")}</li>
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
            {t("purge.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn btn-primary disabled:opacity-70"
          >
            {pending ? t("export.building") : t("export.confirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
