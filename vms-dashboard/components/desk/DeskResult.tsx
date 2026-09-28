"use client";

import { useEffect, useState } from "react";

import { useT } from "@/lib/i18n";
import { fetchDeskQr, type DeskRegistration } from "@/lib/desk";

/**
 * The QR, big, for the visitor to photograph -- then straight back to the form.
 *
 * The code is fetched from the server rather than drawn here, because the desk
 * token is what entitles this page to it: the image request carries the token in
 * a header, which an `<img src>` cannot do, so it is fetched and shown as a blob.
 *
 * `Register another visitor` is the only other control. A desk in a queue is a
 * loop, and the fastest possible loop is one button the same size as a thumb in
 * the same place every time.
 */
export function DeskResult({
  registration,
  onAgain,
}: {
  registration: DeskRegistration;
  onAgain: () => void;
}) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let url: string | null = null;

    fetchDeskQr(registration.badge_token)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [registration.badge_token]);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="mono text-[11px] tracking-wider text-valid uppercase">
          {t("desk.doneTitle")}
        </p>
        <h1 className="display mt-1 text-2xl text-ink">{t("desk.showQr")}</h1>
        <p className="mt-1.5 text-sm text-ink-2">{t("desk.keepIt")}</p>
      </div>

      <div className="mx-auto w-full max-w-[24rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <div className="aspect-square w-full">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={t("desk.qrAlt", { serial: registration.badge_serial })}
              className="h-full w-full"
              style={{ imageRendering: "pixelated" }}
            />
          ) : failed ? (
            <p
              role="alert"
              className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-revoked"
            >
              {t("desk.qrFailed")}
            </p>
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-line" />
          )}
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="display text-lg leading-tight text-ink [overflow-wrap:anywhere]">
            {registration.full_name}
          </p>
          <p className="mono mt-1 text-sm text-ink-2">{registration.badge_serial}</p>
        </div>
        {registration.category === "vip" ? (
          <span className="pill-status bg-vip-soft text-vip">{t("desk.vip")}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onAgain}
        autoFocus
        className="btn btn-primary btn-lg w-full"
      >
        {t("desk.again")}
      </button>
    </div>
  );
}
