"use client";

import { useState } from "react";

import { useFormat, useT } from "@/lib/i18n";
import { driftState, readDrift, type Health } from "@/lib/health";

/**
 * What the server says about itself, as an instrument reading.
 *
 * A label-and-value list rather than a grid of tiles, because these are not
 * four comparable figures — they are one answer each to a different question,
 * and the only thing they share is where they came from. Values are set in mono
 * for the reason mono is used everywhere else in this app: a serial, a token, a
 * timestamp and an address are all machine-issued, and the font says so.
 *
 * THE LAN ADDRESS IS THE POINT OF THIS PANEL. CLAUDE.md records that it is the
 * question asked most often at the event, that a moved server breaks every
 * paired device, and that the only way to read it today is to run `ipconfig` on
 * the server itself. So it gets the size and the copy button, and everything
 * below it stays quiet.
 *
 * Prop-driven on purpose: the page owns the query, which is what lets these
 * panels be photographed with fixed data -- including the unreachable and
 * high-drift states, which are the two nobody sees until the morning they
 * matter.
 */
export function ServerPanel({
  health,
  checking,
  onCheckAgain,
}: {
  health?: Health;
  checking: boolean;
  onCheckAgain: () => void;
}) {
  const t = useT();
  const format = useFormat();

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 pb-1">
        <h2 className="display text-[1.05rem] text-ink">
          {t("settings.server")}
        </h2>
        <button
          type="button"
          onClick={onCheckAgain}
          disabled={checking}
          className="btn btn-ghost h-8 px-3 text-xs disabled:opacity-60"
        >
          {checking ? t("settings.checking") : t("settings.checkAgain")}
        </button>
      </div>
      <p className="max-w-prose px-5 text-xs leading-relaxed text-ink-3">
        {t("settings.serverNote")}
      </p>

      {health && !health.reachable ? (
        <p
          role="alert"
          className="mx-5 mt-4 rounded-lg bg-revoked-soft px-4 py-3 text-sm leading-relaxed text-revoked"
        >
          {t("settings.unreachableBody")}
        </p>
      ) : null}

      {/* The hero. Large, mono, and copyable -- the three things somebody
          reading it off a screen to type into a phone actually needs. */}
      <div className="mt-4 border-y border-line bg-card-2 px-5 py-4">
        <p className="text-xs text-ink-3">{t("settings.lanAddress")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="mono text-xl text-ink tabular-nums select-all">
            {health?.lanIp ?? "—"}
          </p>
          {health?.lanIp ? <CopyButton value={health.lanIp} /> : null}
        </div>
        {/* Only when there is an address. "Devices reach the server here"
            under an em-dash points at nothing and reads as though the dash
            were the answer. */}
        {health?.lanIp ? (
          <p className="mt-1 text-xs text-ink-3">
            {t("settings.lanAddressNote")}
          </p>
        ) : null}
      </div>

      <dl className="divide-y divide-line px-5">
        <Row label={t("settings.reachable")}>
          {health === undefined ? (
            <span className="text-ink-3">—</span>
          ) : health.reachable ? (
            <span className="text-valid">
              {t("settings.reachableYes", { ms: Math.round(health.latencyMs) })}
            </span>
          ) : (
            <span className="text-revoked">{t("settings.reachableNo")}</span>
          )}
        </Row>

        <Row label={t("settings.service")}>
          <span className="mono">{health?.service ?? "—"}</span>
        </Row>

        <Row label={t("settings.serverClock")}>
          <span className="mono">
            {health?.serverTime ? format.time(health.serverTime) : "—"}
          </span>
        </Row>

        <Row label={t("settings.browserClock")}>
          <span className="mono">
            {health?.browserTime ? format.time(health.browserTime) : "—"}
          </span>
        </Row>

        <Row label={t("settings.drift")}>
          <Drift health={health} />
        </Row>
      </dl>

      <div className="px-5 py-4">
        <p className="max-w-prose text-xs leading-relaxed text-ink-3">
          {t("settings.driftNote")}
        </p>
        {health ? (
          <p className="mono mt-2 text-[11px] text-ink-3">
            {t("settings.checkedAt", { time: format.time(health.checkedAt) })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The clock difference, with its word.
 *
 * Never colour alone: the state is carried by the reading itself ("4m behind")
 * and the colour only reinforces it, which is the rule the palette comment in
 * `globals.css` sets for every status in this app.
 */
function Drift({ health }: { health?: Health }) {
  const t = useT();
  const reading = readDrift(health?.driftMs);

  if (!reading) return <span className="text-ink-3">—</span>;

  const tone = driftState(health?.driftMs);
  const colour =
    tone === "alert" ? "text-revoked" : tone === "warn" ? "text-vip" : "text-valid";

  return (
    <span className={colour}>
      {reading.direction === "level"
        ? t("settings.driftLevel")
        : t(
            reading.direction === "ahead"
              ? "settings.driftAhead"
              : "settings.driftBehind",
            { amount: reading.amount },
          )}
    </span>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mono text-sm tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * Copy, then say so.
 *
 * The label changes to "Copied" for a moment rather than raising a toast: the
 * confirmation belongs where the click happened, and this app has no toast
 * system to borrow. `navigator.clipboard` needs a secure context, and the LAN
 * runs on plain http by HARD CONSTRAINT 9 -- so on a phone browser reaching
 * this dashboard by IP the write will reject. The button then leaves the text
 * selectable (`select-all` on the address above) rather than pretending it
 * worked.
 */
function CopyButton({ value }: { value: string }) {
  const t = useT();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          // No secure context, or permission refused. The address is
          // select-all, so there is still a way to take it.
        }
      }}
      className="btn btn-ghost h-7 px-2.5 text-[11px]"
    >
      {done ? t("settings.copied") : t("settings.copy")}
    </button>
  );
}
