"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useErrorText, useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";

import {
  kindLabelKey,
  useCreatePairingCode,
  type DeviceKind,
  type PairingCode,
} from "@/lib/devices";
import { useHealth } from "@/lib/health";

/**
 * A code someone reads off this laptop and types into a phone across the room.
 *
 * So it is set enormous, in mono, with wide tracking and the characters spaced
 * apart. Density is worthless here — the whole job of this panel is to be legible
 * from three metres by someone holding a phone at arm's length, and to be
 * unambiguous when read aloud.
 *
 * The server draws codes from an alphabet with no 0, O, 1 or I, so the four
 * characters people mishear over a noisy lobby simply never appear.
 *
 * A DESK ALSO NEEDS A LINK, because unlike a phone or a screen it has no app to
 * open: the walk-in desk lives at an unguessable path in this dashboard, and the
 * path is minted here alongside the code. It is never stored and never listed —
 * lose it and the answer is a fresh code, which is cheap.
 */
/* Keys, not words -- a module constant, built before any translator. */
const KINDS: { value: DeviceKind; blurbKey: MessageKey }[] = [
  { value: "scanner", blurbKey: "pair.blurb.scanner" },
  { value: "screen", blurbKey: "pair.blurb.screen" },
  { value: "desk", blurbKey: "pair.blurb.desk" },
];

/**
 * The secret segment of the desk's URL: 24 characters, about 120 bits.
 *
 * `crypto.getRandomValues` is NOT one of the secure-context-only APIs (unlike
 * `crypto.subtle`), so it works on the event's plain-http LAN, which is exactly
 * where this has to be minted.
 */
const subscribeNever = () => () => {};

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function useCountdown(expiresAt: string | undefined) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return remaining;
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PairingCodeCard() {
  const create = useCreatePairingCode();
  const t = useT();
  const errorText = useErrorText();
  const health = useHealth();
  const [issued, setIssued] = useState<PairingCode | null>(null);
  const remaining = useCountdown(issued?.expires_at);

  const expired = issued !== null && remaining === 0;
  const error = create.error
    ? errorText(create.error, "error.pairingCode")
    : null;

  /*
    THE LINK IS BUILT FROM THE SERVER'S LAN ADDRESS, not from this tab's address
    bar -- an admin working on the server itself browses `localhost`, and a link
    saying `http://localhost:3000/desk/...` is useless to a tablet at the door.
    Only the scheme and port come from this tab. Same reasoning as the public
    registration link in /settings.
  */
  /*
    A STRING, NEVER AN OBJECT. React compares snapshots with Object.is, so a
    getSnapshot building `{ protocol, port }` is a new value on every read --
    which is the render loop that once took /settings down.
  */
  const origin = useSyncExternalStore(
    subscribeNever,
    () => `${window.location.protocol}//|${window.location.port}`,
    () => "",
  );

  // One key per issued code, minted on the client only (`issued` is null during
  // the server render, so there is nothing to mismatch on hydration).
  const deskKey = useMemo(
    () => (issued && issued.kind === "desk" ? randomKey() : null),
    [issued],
  );

  const [scheme, port] = origin.split("|");
  const lanIp = health.data?.lanIp;
  const deskLink =
    deskKey && lanIp && origin
      ? `${scheme}${lanIp}${port ? `:${port}` : ""}/desk/${deskKey}`
      : null;

  // Keyed on the link rather than cleared on change: nothing sets state in the
  // effect body, so a stale code can never be shown for a new link either.
  const [drawn, setDrawn] = useState<{ link: string; src: string } | null>(null);
  useEffect(() => {
    if (!deskLink) return;
    let live = true;
    QRCode.toDataURL(deskLink, { width: 320, margin: 2 })
      .then((src) => {
        if (live) setDrawn({ link: deskLink, src });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [deskLink]);
  const linkQr = drawn?.link === deskLink ? drawn.src : null;

  // `navigator.clipboard` is secure-context only and absent on the event LAN, so
  // the fallback selects the text and lets the admin copy it by hand.
  const linkRef = useRef<HTMLParagraphElement | null>(null);
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    if (!deskLink) return;
    try {
      await navigator.clipboard.writeText(deskLink);
      setCopied(true);
    } catch {
      const node = linkRef.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  return (
    <section className="card">
      <div className="border-b border-line px-6 py-5">
        <h2 className="display text-base text-ink">{t("pair.title")}</h2>
        <p className="mt-1 text-sm text-ink-3">
          {t("pair.body")}
        </p>
      </div>

      <div className="px-6 py-6">
        <div className="flex flex-wrap gap-3">
          {KINDS.map((kind) => (
            <button
              key={kind.value}
              type="button"
              disabled={create.isPending}
              onClick={() => {
                setCopied(false);
                create.mutate(kind.value, { onSuccess: (code) => setIssued(code) });
              }}
              className="min-w-52 flex-1 rounded-2xl border border-line-strong px-4 py-3 text-left transition-colors hover:border-ink disabled:opacity-60"
            >
              <span className="block text-sm font-medium text-ink">
                {t("pair.codeButton", {
                  kind: t(kindLabelKey(kind.value)),
                })}
              </span>
              <span className="mt-0.5 block text-xs text-ink-3">
                {t(kind.blurbKey)}
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-revoked-soft px-4 py-3 text-sm text-revoked"
          >
            {error}
          </p>
        ) : null}

        {issued ? (
          <div
            className={`mt-6 rounded-xl px-6 py-8 text-center ${
              expired ? "bg-card-2" : "bg-graphite-950 text-white"
            }`}
          >
            <p
              className={`mono text-[11px] tracking-widest uppercase ${
                expired ? "text-ink-3" : "text-graphite-300"
              }`}
            >
              {t("pair.codeLabel", { kind: t(kindLabelKey(issued.kind)) })}
            </p>

            <p
              aria-live="polite"
              // Tracking is on the element and a trailing space is added by the
              // browser; the negative right margin pulls the block back to centre.
              className={`mono mt-3 -mr-[0.22em] text-[clamp(2.75rem,11vw,4.5rem)] leading-none font-medium tracking-[0.22em] tabular-nums ${
                expired ? "text-ink-3 line-through" : "text-white"
              }`}
            >
              {issued.code}
            </p>

            {expired ? (
              <p className="mt-4 text-sm text-ink-3">
                {t("pair.expired")}
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm text-graphite-300">
                  {t("pair.expiresIn")}{" "}
                  <span
                    className={`mono font-medium ${
                      remaining < 60_000 ? "text-accent" : "text-white"
                    }`}
                  >
                    {formatRemaining(remaining)}
                  </span>
                </p>
                <p className="mx-auto mt-2 max-w-sm text-xs text-graphite-500">
                  {t("pair.alphabetNote")}
                </p>
              </>
            )}
          </div>
        ) : null}

        {issued?.kind === "desk" ? (
          <div className="mt-4 rounded-xl border border-line-strong px-5 py-5">
            <h3 className="display text-base text-ink">{t("pair.deskLink")}</h3>
            <p className="mt-1 text-sm text-ink-3">{t("pair.deskLinkBody")}</p>

            {deskLink ? (
              <div className="mt-4 flex flex-wrap items-start gap-5">
                <div className="min-w-0 flex-1">
                  <p
                    ref={linkRef}
                    className="mono text-sm break-all text-ink select-all"
                  >
                    {deskLink}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="btn btn-ghost mt-3 h-8 px-3 text-xs"
                  >
                    {copied ? t("pair.copied") : t("pair.copyLink")}
                  </button>
                  <p className="mt-3 text-xs text-ink-3">{t("pair.deskLinkWarn")}</p>
                </div>
                {linkQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={linkQr}
                    alt=""
                    className="h-32 w-32 shrink-0 rounded-lg bg-white p-1 ring-1 ring-line"
                  />
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-3">{t("pair.deskLinkNoAddress")}</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
