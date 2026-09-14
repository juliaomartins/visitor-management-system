"use client";

import QRCode from "qrcode";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useFormat, useT } from "@/lib/i18n";
import type { RegistrationSettings } from "@/lib/registration";

const subscribeNever = () => () => {};

/**
 * The switch for public self-registration, and the link phones open.
 *
 * THE LINK IS BUILT FROM THE SERVER'S LAN ADDRESS, not from this tab's address
 * bar. An admin working on the server itself browses `localhost`, and a link
 * saying `http://localhost:3000/register` is useless to every phone in the room.
 * `GET /health` reports the LAN address the server detected at startup -- never
 * a hardcoded IP, never `.env` -- and only the dashboard's port and scheme come
 * from this tab.
 *
 * Prop-driven, like the other panels: the page owns the queries.
 */
export function RegistrationPanel({
  settings,
  loadFailed,
  saving,
  saveFailed,
  onToggle,
  lanIp,
}: {
  settings?: RegistrationSettings;
  loadFailed: boolean;
  saving: boolean;
  saveFailed: boolean;
  onToggle: (enabled: boolean) => void;
  lanIp?: string;
}) {
  const t = useT();
  const format = useFormat();
  const enabled = settings?.public_registration_enabled ?? false;

  /*
    A STRING, NEVER AN OBJECT. React compares snapshots with Object.is, so a
    getSnapshot that builds `{ protocol, port }` returns a "new" value on every
    read, React treats that as a change, re-renders, reads again -- "The result
    of getSnapshot should be cached", then "Maximum update depth exceeded", and
    /settings never renders. Two strings compare equal; an object never does.
  */
  const origin = useSyncExternalStore(
    subscribeNever,
    () => `${window.location.protocol}//|${window.location.port}`,
    () => "",
  );
  const [scheme, port] = origin.split("|");
  const url =
    lanIp && origin ? `${scheme}${lanIp}${port ? `:${port}` : ""}/register` : null;

  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" })
      .then((svg) => {
        if (live) setQr({ url, svg: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);

  async function saveQr() {
    if (!url) return;
    const png = await QRCode.toDataURL(url, { width: 1024, margin: 4 });
    const anchor = document.createElement("a");
    anchor.href = png;
    anchor.download = "drcc-2026-registration-qr.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5">
        <div className="min-w-0 max-w-prose">
          <h2 className="display text-[1.05rem] text-ink">{t("settings.registration")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
            {t("settings.registrationNote")}
          </p>
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-3">
          <span className="text-sm text-ink-2">{t("settings.registrationToggle")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t("settings.registrationToggle")}
            disabled={!settings || saving}
            onClick={() => onToggle(!enabled)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              enabled ? "bg-valid" : "bg-line-strong"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          {/* The state in words as well as position and colour. */}
          <span
            className={`pill-status ${enabled ? "bg-valid-soft text-valid" : "bg-card-2 text-ink-2"}`}
          >
            {enabled ? t("settings.registrationOpen") : t("settings.registrationClosed")}
          </span>
        </label>
      </div>

      {saveFailed || loadFailed ? (
        <p
          role="alert"
          className="mx-5 mt-3 rounded-lg bg-revoked-soft px-4 py-2.5 text-sm text-revoked"
        >
          {t("settings.registrationSaveFailed")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start gap-5 border-t border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-3">{t("settings.registrationUrl")}</p>
          {url ? (
            <>
              <p className="mono mt-1 text-base text-ink select-all [overflow-wrap:anywhere]">
                {url}
              </p>
              <p className="mt-1 text-xs text-ink-3">{t("settings.registrationUrlNote")}</p>
              <button
                type="button"
                onClick={() => void saveQr()}
                className="btn btn-ghost mt-3 h-8 px-3 text-xs"
              >
                {t("settings.registrationSaveQr")}
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-3">{t("settings.registrationNoAddress")}</p>
          )}
          {settings?.updated_by ? (
            <p className="mono mt-3 text-[11px] text-ink-3">
              {t("settings.registrationUpdated", {
                time: format.dateTime(settings.updated_at),
                user: settings.updated_by,
              })}
            </p>
          ) : null}
        </div>

        {qr && qr.url === url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.svg}
            alt=""
            className="h-32 w-32 shrink-0 rounded-lg bg-white p-1 ring-1 ring-line"
          />
        ) : null}
      </div>
    </section>
  );
}
