"use client";

import { useRichT, useT } from "@/lib/i18n";
import { useEffect, useState } from "react";

import { normaliseOrigin, probe } from "@/lib/server";

/**
 * "Where is the server?", asked only when nobody else could answer it.
 *
 * The screen tries its own hostname and its build default first, so this panel
 * appears solely when both have failed — which means the person looking at it is
 * standing in a lobby with a display that is not working, probably minutes before
 * doors open. So it says what it tried, tells them where to find the right
 * number, accepts whatever they type, and CHECKS before claiming success.
 *
 * Saving an address that does not answer would be the worst outcome here: it
 * looks like it worked and fails again in thirty seconds.
 */
export function ServerSetup({
  attempted,
  onResolved,
  onCancel,
}: {
  /** The addresses already tried, so nobody retypes one that just failed. */
  attempted: string[];
  onResolved: (origin: string) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const rich = useRichT();
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A kiosk usually has a keyboard plugged in only for moments like this.
  useEffect(() => {
    const input = document.getElementById("server-origin");
    input?.focus();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const origin = normaliseOrigin(value);
    if (!origin) {
      setError(t("server.badAddress"));
      return;
    }

    setChecking(true);
    setError(null);

    const found = await probe(origin);
    setChecking(false);

    if (!found) {
      setError(
        `Nothing answered at ${origin}. Check the address, and that the server is switched on and on the same network.`,
      );
      return;
    }

    onResolved(origin);
  }

  return (
    <main className="flex h-dvh w-dvw items-center justify-center bg-stage px-8">
      <form onSubmit={submit} className="w-full max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.3em] text-down uppercase">
          Cannot reach the server
        </p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight text-ink">
          Where is the server?
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          Enter the address the backend is running on. On the server, run{" "}
          <code className="rounded bg-stage-raised px-2 py-0.5 text-ink">ipconfig</code>{" "}
          and use the IPv4 address — the port is almost always{" "}
          <span className="text-ink">8000</span>.
        </p>

        {attempted.length > 0 ? (
          <p className="mt-4 text-base text-ink-faint">
            Already tried:{" "}
            {attempted.map((origin, index) => (
              <span key={origin}>
                {index > 0 ? ", " : ""}
                <span className="text-ink-soft">{origin}</span>
              </span>
            ))}
          </p>
        ) : null}

        <label
          htmlFor="server-origin"
          className="mt-8 block text-sm font-medium text-ink-soft"
        >
          {t("server.address")}
        </label>
        <input
          id="server-origin"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="10.101.196.41:8000"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          className="mt-2 w-full rounded-xl border border-edge bg-stage-raised px-6 py-5 text-3xl text-ink placeholder:text-ink-faint focus:border-live focus:outline-none"
        />
        <p className="mt-2 text-sm text-ink-faint">
          {rich("server.hint", {
            http: <span className="text-ink-soft">http://</span>,
          })}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-down/15 px-5 py-4 text-lg text-down"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex gap-3">
          <button
            type="submit"
            disabled={checking || value.trim().length === 0}
            className="flex-1 rounded-xl bg-ink px-6 py-5 text-xl font-bold text-stage transition-opacity disabled:opacity-30"
          >
            {checking ? t("server.checking") : t("server.connect")}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-edge px-6 py-5 text-xl text-ink-soft"
            >
              Back
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}
