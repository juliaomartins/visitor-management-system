"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ServerSetup } from "@/components/ServerSetup";
import { useServer } from "@/hooks/useServer";
import { ApiError, CODE_LENGTH, normaliseCode, pairScreen } from "@/lib/api";
import { getDeviceToken, setDeviceToken } from "@/lib/device-token";

/**
 * Setup, once, on the machine that will run the wall.
 *
 * One field and one button. Whoever does this is standing at a kiosk reading six
 * characters off a laptop across the room, so the code is the screen — everything
 * else is small enough to ignore.
 *
 * THE NAME FIELD IS GONE. There is one lobby screen in this deployment, so asking
 * an installer to name it was asking them to make a decision with one right
 * answer. The dashboard already shows the kind and the last-seen time, which is
 * what anyone actually looks for. Guard phones still take a name, because there
 * are several of them and the name is how you tell a quiet door from a dead one.
 *
 * After this the machine is switched on each morning and goes straight to the
 * display. There is no sign-in and nothing to remember.
 */
const SCREEN_NAME = "Lobby screen";

export default function PairPage() {
  const router = useRouter();
  const server = useServer();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already paired: this page is not a way back to the setup flow.
  useEffect(() => {
    if (getDeviceToken()) router.replace("/");
  }, [router]);

  const ready = code.length === CODE_LENGTH && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    setBusy(true);
    setError(null);

    try {
      const device = await pairScreen(server.origin ?? "", code, SCREEN_NAME);
      setDeviceToken(device.token);
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not reach the server. Check this machine is on the event network.",
      );
      setBusy(false);
    }
  }

  // No server, no pairing code to redeem. Ask for the address first.
  if (server.lost) {
    return <ServerSetup attempted={server.attempted} onResolved={server.adopt} />;
  }

  return (
    <main className="flex h-dvh w-dvw flex-col items-center justify-center bg-stage px-6">
      <form onSubmit={submit} className="w-full max-w-md text-center">
        {/* The event's own mark, matching the dashboard's sign-in and the
            scanner's pairing screen. Three surfaces doing the same job should
            not each introduce a different brand. */}
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/drcc-event.png"
            alt=""
            aria-hidden
            className="aspect-square w-11 shrink-0 object-contain"
          />
          <span className="text-left text-[0.68rem] leading-[1.25] font-semibold tracking-[0.16em] uppercase">
            <span className="block text-ink-soft">
              Díli Regional Cooperative Conference
            </span>
            <span className="block text-expo">Ministerial Dialogue 2026</span>
          </span>
        </div>

        {/* Both organisers, together, under the mark. Never one alone. */}
        <div className="mt-5 flex justify-center">
          <span className="inline-flex items-center gap-3 rounded-lg bg-white px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/rdtl.png"
            alt="República Democrática de Timor-Leste"
            className="h-7 w-auto object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/secoop.png"
            alt="Secretária de Estado de Cooperativas"
            className="h-7 w-auto object-contain"
            />
          </span>
        </div>

        <h1 className="mt-8 text-[clamp(1.75rem,5vw,2.75rem)] leading-tight font-bold tracking-tight text-ink">
          Pair this display
        </h1>
        <p className="mt-3 text-[clamp(0.95rem,1.6vw,1.15rem)] leading-relaxed text-ink-soft">
          Enter the screen pairing code from the dashboard.
        </p>

        <label htmlFor="code" className="sr-only">
          Six character pairing code
        </label>
        <input
          id="code"
          value={code}
          onChange={(changed) => {
            setCode(normaliseCode(changed.target.value));
            setError(null);
          }}
          placeholder="ABC123"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={CODE_LENGTH}
          // Tracking pushes the last character off-centre; the negative margin
          // pulls the block back so it reads as centred.
          className="mt-9 w-full -mr-[0.3em] rounded-2xl border border-edge bg-stage-raised py-6 text-center text-[clamp(2.25rem,9vw,3.5rem)] font-bold tracking-[0.3em] text-ink tabular-nums placeholder:text-ink-faint/50 focus:border-live focus:outline-none"
        />

        {/* Progress, without a counter to read: the rule fills as they type. */}
        <span aria-hidden className="mt-3 block h-[3px] overflow-hidden rounded-full bg-edge">
          <span
            className="block h-full origin-left rounded-full bg-live transition-transform duration-200"
            style={{ transform: `scaleX(${code.length / CODE_LENGTH})` }}
          />
        </span>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-down/15 px-5 py-4 text-left text-base leading-relaxed text-down"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!ready}
          className="mt-8 w-full rounded-2xl bg-ink px-6 py-5 text-lg font-bold text-stage transition-opacity disabled:opacity-25"
        >
          {busy ? "Pairing…" : "Pair display"}
        </button>

        {/* At an event this answers "is it pointed at the right box?" in a glance,
            and tapping it looks again. */}
        <button
          type="button"
          onClick={server.rescan}
          className="mt-8 w-full text-center text-sm text-ink-faint transition-colors hover:text-ink-soft"
        >
          {server.searching
            ? "Finding the server…"
            : (server.origin ?? "No server found")}
        </button>
      </form>
    </main>
  );
}
