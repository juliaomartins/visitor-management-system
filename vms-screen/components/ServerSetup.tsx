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
 *
 * IT SCROLLS, AND IT CENTRES WITHOUT CLIPPING. This used to be a fixed `h-dvh`
 * box with `items-center`, and centred overflow clips at BOTH ends: on a short
 * window the heading went off the top and Connect off the bottom, with the
 * wall's `overflow: hidden` on `body` making neither reachable. Now the panel is
 * its own scroll container and `m-auto` centres only when there is room. It
 * renders on the wall as well as on `/pair`, so the pointer and text selection
 * are switched back on here directly — an installer typing an address needs to
 * see the mouse, and to select what they typed.
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
    <main className="scrollbar-gutter-stable h-dvh w-full cursor-auto overflow-y-auto overscroll-contain bg-stage select-text">
      <div className="flex min-h-full px-[clamp(1rem,5vw,3rem)] pt-[clamp(1.25rem,5vh,3rem)] pb-[clamp(4rem,10vh,6rem)]">
        <form onSubmit={submit} className="m-auto w-full max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.3em] text-down uppercase">
            Cannot reach the server
          </p>
          <h1 className="mt-2 text-[clamp(1.75rem,min(5vw,7vh),3rem)] leading-[1.1] font-bold tracking-tight text-balance text-ink">
            Where is the server?
          </h1>

          <p className="mt-[clamp(0.625rem,2vh,1rem)] text-[clamp(0.95rem,min(1.8vw,2.6vh),1.125rem)] leading-relaxed text-pretty text-ink-soft">
            Enter the address the backend is running on. On the server, run{" "}
            <code className="rounded bg-stage-raised px-2 py-0.5 text-ink">ipconfig</code>{" "}
            and use the IPv4 address — the port is almost always{" "}
            <span className="text-ink">8000</span>.
          </p>

          {attempted.length > 0 ? (
            <p className="mt-[clamp(0.5rem,1.5vh,1rem)] text-[clamp(0.875rem,2.2vh,1rem)] break-words text-ink-faint">
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
            className="mt-[clamp(1rem,4vh,2rem)] block text-sm font-medium text-ink-soft"
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
            className="mt-2 block w-full rounded-xl border border-edge bg-stage-raised px-[clamp(1rem,2.5vw,1.5rem)] py-[clamp(0.75rem,2.5vh,1.25rem)] text-[clamp(1.25rem,min(3.5vw,4.5vh),1.875rem)] text-ink placeholder:text-ink-faint focus:border-live focus:outline-none"
          />
          <p className="mt-2 text-sm text-ink-faint">
            {rich("server.hint", {
              http: <span className="text-ink-soft">http://</span>,
            })}
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-[clamp(0.75rem,2.5vh,1.5rem)] rounded-xl bg-down/15 px-5 py-4 text-[clamp(0.95rem,2.4vh,1.125rem)] text-down"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-[clamp(1rem,4vh,2rem)] flex gap-3">
            <button
              type="submit"
              disabled={checking || value.trim().length === 0}
              className="flex-1 cursor-pointer rounded-xl bg-ink px-6 py-[clamp(0.85rem,2.6vh,1.25rem)] text-[clamp(1rem,2.6vh,1.25rem)] font-bold text-stage transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              {checking ? t("server.checking") : t("server.connect")}
            </button>

            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="cursor-pointer rounded-xl border border-edge px-6 py-[clamp(0.85rem,2.6vh,1.25rem)] text-[clamp(1rem,2.6vh,1.25rem)] text-ink-soft"
              >
                Back
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
