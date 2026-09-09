"use client";

import { EVENT, OrganiserCredit } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";

import { LoginError, login } from "@/lib/auth";
import { useErrorText, useT } from "@/lib/i18n";

/**
 * The sign-in page, built from the dashboard's own parts.
 *
 * Same rail mark, same card, same field, same blue — someone signing in should
 * recognise the room they are about to enter. The right half is a flat drawing of
 * the dashboard itself rather than a stock photograph: it says what this is for
 * in the only vocabulary the product actually has.
 */
const subscribeNever = () => () => {};

function SignInPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const errorText = useErrorText();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The host, read from the browser with an empty server snapshot. Reading
  // `window` during render would make the server and client markup disagree.
  const host = useSyncExternalStore(
    subscribeNever,
    () => window.location.host,
    () => "",
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await login(username, password);
      router.replace(params.get("next") || "/dashboard");
    } catch (cause) {
      // A LoginError means the server answered and said no. Anything else means
      // it never answered at all, which is a different problem at a desk: check
      // the machine, not the password.
      setError(
        cause instanceof LoginError
          ? errorText(cause)
          : t("login.unreachable"),
      );
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* The sign-in page is the one screen where the event introduces itself,
          so the mark is given room and the conference name is spelled out in
          full rather than abbreviated. */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/drcc-event.png"
          alt=""
          aria-hidden
          className="h-14 w-14 shrink-0 object-contain"
        />
        <span className="min-w-0">
          <span className="display block text-[0.95rem] leading-tight text-ink">
            {EVENT.name}
          </span>
          <span className="block text-[12px] leading-tight text-ink-2">
            {EVENT.subtitle}
          </span>
          <span className="block text-[11px] leading-tight text-ink-3">
            {EVENT.dates}
          </span>
        </span>
      </div>

      {/*
        THE LANGUAGE SWITCH BELONGS ON THIS PAGE, not only inside the dashboard.
        Someone who has been handed a laptop left in a language they do not read
        has to be able to change it before they can sign in, and the sign-in
        screen is the one page they can reach without a session.
      */}
      <div className="mt-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-2xl text-ink">{t("login.title")}</h1>
          <p className="mt-1.5 text-sm text-ink-3">{t("login.intro")}</p>
        </div>
        <LanguageToggle />
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <Field
          id="username"
          label={t("login.username")}
          autoComplete="username"
          autoFocus
          value={username}
          onChange={setUsername}
        />

        <Field
          id="password"
          label={t("login.password")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-revoked-soft px-3.5 py-2.5 text-sm text-revoked"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full py-2.5 disabled:opacity-60"
        >
          {busy ? t("login.submitting") : t("login.submit")}
        </button>
      </form>

      {/* Genuinely useful at an event: confirms the laptop is on the right box. */}
      <p className="mono mt-8 text-xs text-ink-3">
        {t("login.servingFrom")}{" "}
        <span className="text-ink-2">{host || "…"}</span>
      </p>

      {/* Both organisers, together, at the foot of the page. Never one alone. */}
      <div className="mt-6 border-t border-line pt-5">
        <OrganiserCredit />
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field mt-1.5"
      />
    </div>
  );
}

/**
 * The dashboard, drawn flat.
 *
 * A rail, four stat tiles, the arrivals curve and a row of scans — the actual
 * layout waiting on the other side of the button, reduced to blocks. No real data
 * and no invented figures: it is a diagram of the product, not a screenshot of a
 * fictional event.
 */
function ProductDiagram() {
  const t = useT();

  return (
    <div aria-hidden className="w-full max-w-lg">
      <div className="card overflow-hidden shadow-sm">
        <div className="flex">
          <div className="w-14 shrink-0 space-y-2 border-r border-line bg-card p-2.5">
            <div className="h-5 w-5 rounded-md bg-accent" />
            <div className="h-2 w-full rounded-full bg-accent-soft" />
            <div className="h-2 w-full rounded-full bg-line" />
            <div className="h-2 w-full rounded-full bg-line" />
            <div className="h-2 w-full rounded-full bg-line" />
          </div>

          <div className="min-w-0 flex-1 space-y-3 bg-ground p-3">
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((tile) => (
                <div key={tile} className="card p-2">
                  <div className="h-1.5 w-8 rounded-full bg-line" />
                  <div className="mt-1.5 h-3 w-6 rounded bg-ink/80" />
                </div>
              ))}
            </div>

            <div className="card p-3">
              <div className="h-1.5 w-16 rounded-full bg-line" />
              <svg viewBox="0 0 200 56" className="mt-2 w-full">
                <defs>
                  <linearGradient id="login-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-accent)"
                      stopOpacity="0.24"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-accent)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                <path
                  d="M0 44 L25 36 L50 40 L75 20 L100 28 L125 10 L150 24 L175 14 L200 22 L200 56 L0 56 Z"
                  fill="url(#login-fill)"
                />
                <path
                  d="M0 44 L25 36 L50 40 L75 20 L100 28 L125 10 L150 24 L175 14 L200 22"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            <div className="card space-y-2 p-3">
              {["bg-valid", "bg-valid", "bg-vip", "bg-valid"].map((tone, row) => (
                <div key={row} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded-full bg-accent-soft" />
                  <div className="h-1.5 flex-1 rounded-full bg-line" />
                  <div className={`h-1.5 w-6 shrink-0 rounded-full ${tone}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-3">
        {t("login.pitch")}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-14">
        <Suspense fallback={null}>
          <SignInPanel />
        </Suspense>
      </div>

      <div className="hidden items-center justify-center border-l border-line bg-card px-10 lg:flex">
        <ProductDiagram />
      </div>
    </div>
  );
}
