"use client";

import { useEffect, useState } from "react";

import { EVENT } from "@/components/brand";
import { fetchDeskQr, type DeskRegistration } from "@/lib/desk";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import { buildPassPng, savePassImage } from "@/lib/pass-image";
import { passFileName } from "@/lib/pass-name";

/**
 * The QR, big, for the visitor to photograph -- then straight back to the form.
 *
 * The code is fetched from the server rather than drawn here, because the desk
 * token is what entitles this page to it: the image request carries the token in
 * a header, which an `<img src>` cannot do, so it is fetched and shown as a blob.
 *
 * `Register another visitor` stays the primary control and stays last, under the
 * thumb: a desk in a queue is a loop, and the fastest loop is one button in the
 * same place every time.
 *
 * DOWNLOADING SAVES THE SAME IMAGE A SELF-REGISTERING VISITOR SAVES -- the QR
 * with the event mark, the name and the serial under it (`lib/pass-image.ts`),
 * not the bare code on screen. Staff can then send it to the visitor, who may
 * have no phone to hand or a camera that will not focus, and it identifies
 * itself in a gallery full of screenshots.
 *
 * The image is drawn here from the badge token rather than fetched again: the
 * token is the QR's payload, so the file carries exactly the code the server
 * drew, and the desk path keeps the two routes it has.
 *
 * NOT `navigator.share`, which would offer a share sheet directly: it is
 * secure-context only and does not exist on the event LAN over http. A saved
 * file is shareable by every app on the device anyway.
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
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    key: MessageKey;
    failed: boolean;
  } | null>(null);

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

  async function download() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const png = await buildPassPng(
        {
          full_name: registration.full_name,
          badge_serial: registration.badge_serial,
          badge_token: registration.badge_token,
        },
        {
          event: EVENT.name,
          dates: t("brand.dates"),
          foot: t("publicRegister.successShow"),
        },
      );
      const outcome = savePassImage(png, passFileName(registration.badge_serial));
      setSaveMessage({
        key: outcome === "saved" ? "desk.downloadDone" : "desk.downloadOpened",
        failed: false,
      });
    } catch {
      // Photographing the screen still works, and needs nothing from us.
      setSaveMessage({ key: "desk.downloadFailed", failed: true });
    } finally {
      setSaving(false);
    }
  }

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

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void download()}
          disabled={saving || !src}
          className="btn btn-ghost btn-lg w-full disabled:opacity-60"
        >
          {saving ? t("desk.downloading") : t("desk.downloadQr")}
        </button>
        {saveMessage ? (
          <p
            aria-live="polite"
            className={`text-center text-sm ${saveMessage.failed ? "text-revoked" : "text-valid"}`}
          >
            {t(saveMessage.key)}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onAgain}
          autoFocus
          className="btn btn-primary btn-lg w-full"
        >
          {t("desk.again")}
        </button>
      </div>
    </div>
  );
}
