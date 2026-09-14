"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import {
  QR_ERROR_CORRECTION,
  QR_LOGO_PAD,
  QR_LOGO_PLATE_FRACTION,
  QR_LOGO_SRC,
} from "@/lib/badge-geometry";
import { useT } from "@/lib/i18n";
import type { StoredPass } from "@/lib/registration";

/**
 * The success screen: a QR a guard can read off a phone at a door.
 *
 * Built for the camera, not for looks. Black modules on a white plate with a
 * quiet zone of its own, as large as the screen allows; the page around it is
 * light (see `.public-light`). The event mark sits in the middle exactly as it
 * does on the printed card, at the same error-correction level -- the argument
 * for M is at `QR_ERROR_CORRECTION`.
 *
 * The name and the visitor's own photo are shown so the guard can match the face
 * to the phone. No redirect and no timer: the page stays until the tab closes.
 */
export function RegistrationPass({ pass }: { pass: StoredPass }) {
  const t = useT();
  const [drawn, setDrawn] = useState<{ token: string; src: string } | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toString(pass.badge_token, {
      type: "svg",
      errorCorrectionLevel: QR_ERROR_CORRECTION,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((svg) => {
        if (live) {
          setDrawn({
            token: pass.badge_token,
            src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pass.badge_token]);

  const src = drawn?.token === pass.badge_token ? drawn.src : null;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="mono text-[11px] tracking-wider text-valid uppercase">
          {t("publicRegister.successTitle")}
        </p>
        <h1 className="display mt-1 text-2xl text-ink">{t("publicRegister.successShow")}</h1>
      </div>

      <div className="mx-auto w-full max-w-[22rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <div className="relative aspect-square w-full">
          {src ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={t("publicRegister.qrAlt", { serial: pass.badge_serial })}
                className="h-full w-full"
                style={{ imageRendering: "pixelated" }}
              />
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white"
                style={{
                  width: `${QR_LOGO_PLATE_FRACTION * 100 * 0.9}%`,
                  height: `${QR_LOGO_PLATE_FRACTION * 100 * 0.9}%`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={QR_LOGO_SRC}
                  alt=""
                  className="object-contain"
                  style={{
                    width: `${(1 / QR_LOGO_PAD) * 100}%`,
                    height: `${(1 / QR_LOGO_PAD) * 100}%`,
                  }}
                />
              </span>
            </>
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-line" />
          )}
        </div>
      </div>

      <p className="rounded-lg bg-vip-soft px-4 py-2.5 text-center text-sm font-medium text-ink">
        {t("publicRegister.brightness")}
      </p>

      <div className="card flex items-center gap-4 p-4">
        {pass.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pass.photo}
            alt=""
            className="h-24 w-24 shrink-0 rounded-full object-cover ring-2 ring-graphite-950"
          />
        ) : null}
        <div className="min-w-0">
          <p className="display text-lg leading-tight text-ink [overflow-wrap:anywhere]">
            {pass.full_name}
          </p>
          <p className="mono mt-1 text-sm text-ink-2">{pass.badge_serial}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-center text-sm text-ink-2">
        <p>{t("publicRegister.deskHelp", { serial: pass.badge_serial })}</p>
        <p className="text-ink-3">{t("publicRegister.keepPage")}</p>
      </div>
    </div>
  );
}
