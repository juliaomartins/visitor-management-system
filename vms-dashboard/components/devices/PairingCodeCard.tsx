"use client";

import { useErrorText, useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import { useEffect, useState } from "react";

import {
  kindLabelKey,
  useCreatePairingCode,
  type DeviceKind,
  type PairingCode,
} from "@/lib/devices";

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
 */
/* Keys, not words -- a module constant, built before any translator. */
const KINDS: { value: DeviceKind; blurbKey: MessageKey }[] = [
  { value: "scanner", blurbKey: "pair.blurb.scanner" },
  { value: "screen", blurbKey: "pair.blurb.screen" },
];

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
  const [issued, setIssued] = useState<PairingCode | null>(null);
  const remaining = useCountdown(issued?.expires_at);

  const expired = issued !== null && remaining === 0;
  const error = create.error
    ? errorText(create.error, "error.pairingCode")
    : null;

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
              onClick={() =>
                create.mutate(kind.value, { onSuccess: (code) => setIssued(code) })
              }
              className="flex-1 rounded-2xl border border-line-strong px-4 py-3 text-left transition-colors hover:border-ink disabled:opacity-60"
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
      </div>
    </section>
  );
}
