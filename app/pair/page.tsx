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
 * Whoever does this is standing at the kiosk with a keyboard, reading a code off
 * a laptop across the room — so the input is large and the type is big, the same
 * reasoning as the dashboard's code panel but from the other end.
 *
 * After this the machine is switched on each morning and goes straight to the
 * display. There is no sign-in and nothing to remember.
 */
export default function PairPage() {
  const router = useRouter();
  const server = useServer();
  const [code, setCode] = useState("");
  const [name, setName] = useState("Lobby screen");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already paired: this page is not a way back to the setup flow.
  useEffect(() => {
    if (getDeviceToken()) router.replace("/");
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH || busy) return;

    setBusy(true);
    setError(null);

    try {
      const device = await pairScreen(
        server.origin ?? "",
        code,
        name.trim() || "Lobby screen",
      );
      setDeviceToken(device.token);
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : `Could not reach ${server.origin ?? "the server"}. Check this machine is on the event network.`,
      );
      setBusy(false);
    }
  }

  // No server, no pairing code to redeem. Ask for the address first.
  if (server.lost) {
    return <ServerSetup attempted={server.attempted} onResolved={server.adopt} />;
  }

  return (
    <main className="flex h-dvh w-dvw items-center justify-center bg-stage px-8">
      <form onSubmit={submit} className="w-full max-w-xl">
        <p className="text-sm font-semibold tracking-[0.3em] text-ink-faint uppercase">
          Lobby screen
        </p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight text-ink">
          Pair this display
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          On the dashboard, generate a <strong className="text-ink">screen</strong>{" "}
          pairing code and type it below. You only do this once.
        </p>

        <label htmlFor="code" className="mt-10 block text-sm font-medium text-ink-soft">
          Pairing code
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
          aria-label="Six character pairing code"
          className="mt-2 w-full rounded-xl border border-edge bg-stage-raised px-6 py-6 text-center text-6xl font-medium tracking-[0.25em] text-ink tabular-nums placeholder:text-ink-faint focus:border-live focus:outline-none"
        />

        <label htmlFor="name" className="mt-6 block text-sm font-medium text-ink-soft">
          Name this display
        </label>
        <input
          id="name"
          value={name}
          onChange={(changed) => setName(changed.target.value)}
          maxLength={100}
          className="mt-2 w-full rounded-xl border border-edge bg-stage-raised px-5 py-4 text-xl text-ink focus:border-live focus:outline-none"
        />

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-down/15 px-5 py-4 text-lg text-down"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={code.length !== CODE_LENGTH || busy}
          className="mt-8 w-full rounded-xl bg-ink px-6 py-5 text-xl font-bold text-stage transition-opacity disabled:opacity-30"
        >
          {busy ? "Pairing…" : "Pair display"}
        </button>

        {/* At an event this answers "is it pointed at the right box?" in a glance. */}
        <button
          type="button"
          onClick={server.rescan}
          className="mt-6 w-full text-center text-sm text-ink-faint hover:text-ink-soft"
        >
          {server.searching
            ? "Finding the server…"
            : (server.origin ?? "No server found") + " — tap to search again"}
        </button>
      </form>
    </main>
  );
}
