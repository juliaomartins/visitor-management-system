"use client";

import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ServerSetup } from "@/components/ServerSetup";
import { useServer } from "@/hooks/useServer";
import { ApiError, CODE_LENGTH, normaliseCode, pairScreen } from "@/lib/api";
import {
  NAME_MAX,
  SCREEN_NAME,
  refineScreenName,
  suggestScreenName,
} from "@/lib/device-name";
import { getDeviceToken, setDeviceToken } from "@/lib/device-token";

/**
 * Setup, once, on the machine that will run the wall.
 *
 * The code is the screen. Whoever does this is standing at a kiosk reading six
 * characters off a laptop across the room, so the code field is the large,
 * focused thing and everything else is secondary.
 *
 * EVERYTHING HAS TO BE REACHABLE, AND ON THE PANEL IT HAS TO FIT. This page used
 * to be one tall centred column, and the lobby's `overflow: hidden` on `body`
 * made it unscrollable — so on a 1920x1080 kiosk running Windows at 150% (a CSS
 * viewport near 1280x600) the Pair button sat below the fold with no way to
 * reach it. Two fixes, and they are separate on purpose:
 *
 * 1. The route scrolls (`app/pair/locale-shell.tsx`), so no layout can ever
 *    strand the button again, whatever the window.
 * 2. On a landscape panel (`wall:`, the variant the arrival stage already uses)
 *    the page splits into two columns — who is asking on the left, what to type
 *    on the right — so on the real kiosk nothing needs scrolling at all. Every
 *    vertical size is `clamp`ed against `vh` so a short window compresses the
 *    spacing before it spills.
 *
 * `m-auto` inside a `min-h-full` flex column centres the content when there is
 * room and pins it to the top when there is not. `justify-center` would do the
 * first and, in a box shorter than its content, clip the top edge off where no
 * scroll can reach it — the same trap the arrival stage documents.
 *
 * THE NAME FIELD IS PRE-FILLED. See `lib/device-name.ts` for exactly how little a
 * browser will say. A screen's name reaches the dashboard's device list and the
 * backend's `device.paired` log line, NOT the entrance report — only scanner
 * phones scan. There is no rename endpoint: a wrong name is fixed by revoking the
 * device and pairing again.
 */
export default function PairPage() {
  const t = useT();
  const router = useRouter();
  const server = useServer();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
    Once somebody types in the name field, the suggestion never overwrites it.
    The refinement is asynchronous, and without this a person who started typing
    "Main entrance" in the first half-second would watch it replaced.
  */
  const edited = useRef(false);

  // Already paired: this page is not a way back to the setup flow.
  useEffect(() => {
    if (getDeviceToken()) router.replace("/");
  }, [router]);

  /*
    CLIENT ONLY, AND DEFERRED. `navigator` does not exist during the server
    render, so a suggestion computed in `useState`'s initialiser would hydrate
    mismatched. The first read goes to its own task rather than the effect body,
    the same way `IdleScreen` takes its first clock read.
  */
  useEffect(() => {
    let live = true;
    const first = window.setTimeout(() => {
      if (!edited.current) setName(suggestScreenName());
    }, 0);

    void refineScreenName().then((better) => {
      if (live && better && !edited.current) setName(better);
    });

    return () => {
      live = false;
      window.clearTimeout(first);
    };
  }, []);

  const ready = code.length === CODE_LENGTH && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    setBusy(true);
    setError(null);

    try {
      // Blank is allowed: the backend then names it "Screen 2", which is at
      // least unique. Trimmed so " Main entrance " is not a different wall.
      const device = await pairScreen(
        server.origin ?? "",
        code,
        name.trim().slice(0, NAME_MAX),
      );
      setDeviceToken(device.token);
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : t("pair.unreachable"),
      );
      setBusy(false);
    }
  }

  // No server, no pairing code to redeem. Ask for the address first.
  if (server.lost) {
    return <ServerSetup attempted={server.attempted} onResolved={server.adopt} />;
  }

  const status = server.searching
    ? "searching"
    : server.origin
      ? "found"
      : "missing";

  return (
    <main className="flex min-h-full w-full flex-col bg-stage px-[clamp(1rem,4vw,3rem)] pt-[clamp(1rem,4vh,3rem)] pb-[clamp(4rem,10vh,6rem)]">
      <div className="m-auto grid w-full max-w-md items-center gap-[clamp(1.5rem,5vh,2.5rem)] wall:max-w-5xl wall:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] wall:gap-[clamp(2.5rem,6vw,5rem)]">
        <header className="text-center wall:text-left">
          {/* The event's own mark, matching the dashboard's sign-in and the
              scanner's pairing screen. Three surfaces doing the same job should
              not each introduce a different brand. */}
          <div className="flex items-center justify-center gap-3 wall:justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/drcc-event.png"
              alt=""
              aria-hidden
              className="aspect-square w-[clamp(2.25rem,6vh,2.75rem)] shrink-0 object-contain"
            />
            <span className="text-left text-[0.68rem] leading-[1.25] font-semibold tracking-[0.16em] uppercase">
              <span className="block text-ink-soft">
                Díli Regional Cooperative Conference
              </span>
              <span className="block text-expo">Ministerial Dialogue 2026</span>
            </span>
          </div>

          {/* Both organisers, together, under the mark. Never one alone. */}
          <div className="mt-[clamp(0.75rem,2.5vh,1.25rem)] flex justify-center wall:justify-start">
            <span className="inline-flex items-center gap-3 rounded-lg bg-white px-3 py-[clamp(0.35rem,1vh,0.5rem)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/rdtl.png"
                alt="República Democrática de Timor-Leste"
                className="h-[clamp(1.25rem,3.5vh,1.75rem)] w-auto object-contain"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/secoop.png"
                alt="Secretária de Estado de Cooperativas"
                className="h-[clamp(1.25rem,3.5vh,1.75rem)] w-auto object-contain"
              />
            </span>
          </div>

          <h1 className="mt-[clamp(1rem,4.5vh,2.25rem)] text-[clamp(1.75rem,min(5vw,7vh),3rem)] leading-[1.1] font-bold tracking-tight text-balance text-ink">
            {t("pair.title")}
          </h1>
          <p className="mt-[clamp(0.5rem,1.5vh,0.875rem)] text-[clamp(0.95rem,min(1.8vw,2.6vh),1.2rem)] leading-relaxed text-pretty text-ink-soft">
            {t("pair.body")}
          </p>
        </header>

        <form onSubmit={submit} className="w-full">
          <label htmlFor="code" className="sr-only">
            {t("pair.codeLabel")}
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
            /*
              `pl-[0.3em]` IS THE OPTICAL CENTRING, not decoration. Letter-spacing
              adds its gap after the last character too, so the six letters sit
              left of centre. Indenting by one gap puts them back. This used to be
              `-mr-[0.3em]` on the box, which moved the box instead of the text and
              left it visibly out of line with every field beneath it.
            */
            className="block w-full rounded-2xl border border-edge bg-stage-raised py-[clamp(0.75rem,3vh,1.5rem)] pl-[0.3em] text-center text-[clamp(2rem,min(9vw,8vh),3.5rem)] font-bold tracking-[0.3em] text-ink tabular-nums placeholder:text-ink-faint/50 focus:border-live focus:outline-none"
          />

          {/* Progress, without a counter to read: the rule fills as they type. */}
          <span
            aria-hidden
            className="mt-3 block h-[3px] overflow-hidden rounded-full bg-edge"
          >
            <span
              className="block h-full origin-left rounded-full bg-live transition-transform duration-200"
              style={{ transform: `scaleX(${code.length / CODE_LENGTH})` }}
            />
          </span>

          {/*
            The name, under the code and deliberately smaller. It is already filled
            in, so for most installs it is something to glance at rather than a
            second task — and it never takes focus from the code.
          */}
          <div className="mt-[clamp(1rem,3.5vh,1.75rem)] text-left">
            <label
              htmlFor="device-name"
              className="block text-sm font-medium text-ink-soft"
            >
              {t("pair.nameLabel")}
            </label>
            <input
              id="device-name"
              value={name}
              onChange={(changed) => {
                edited.current = true;
                setName(changed.target.value);
              }}
              placeholder={SCREEN_NAME}
              autoComplete="off"
              spellCheck={false}
              maxLength={NAME_MAX}
              aria-describedby="device-name-hint"
              className="mt-2 block w-full rounded-xl border border-edge bg-stage-raised px-4 py-[clamp(0.6rem,1.8vh,0.875rem)] text-[clamp(1rem,2.4vh,1.125rem)] text-ink placeholder:text-ink-faint focus:border-live focus:outline-none"
            />
            <p
              id="device-name-hint"
              className="mt-2 text-[0.8125rem] leading-snug text-ink-faint"
            >
              {t("pair.nameHint")}
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-[clamp(0.75rem,2.5vh,1.25rem)] rounded-xl bg-down/15 px-4 py-3 text-left text-base leading-relaxed text-down"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!ready}
            className="mt-[clamp(1rem,3.5vh,1.75rem)] w-full cursor-pointer rounded-2xl bg-ink px-6 py-[clamp(0.85rem,2.6vh,1.25rem)] text-[clamp(1rem,2.6vh,1.125rem)] font-bold text-stage transition-opacity disabled:cursor-not-allowed disabled:opacity-25"
          >
            {busy ? t("pair.pairing") : t("pair.submit")}
          </button>

          {/*
            At an event this answers "is it pointed at the right box?" in a glance,
            and tapping it looks again. The dot is a second cue beside the words,
            never the only one.
          */}
          <button
            type="button"
            onClick={server.rescan}
            className="mt-[clamp(0.75rem,2.5vh,1.5rem)] flex w-full cursor-pointer items-center justify-center gap-2 text-sm text-ink-faint transition-colors hover:text-ink-soft"
          >
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${
                status === "searching"
                  ? "animate-pulse bg-ink-faint"
                  : status === "found"
                    ? "bg-live"
                    : "bg-down"
              }`}
            />
            {status === "searching"
              ? t("pair.finding")
              : (server.origin ?? t("pair.noServer"))}
          </button>
        </form>
      </div>
    </main>
  );
}
