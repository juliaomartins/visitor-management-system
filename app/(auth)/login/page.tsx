"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";

import { LoginError, login } from "@/lib/auth";

/**
 * An unprinted badge blank, at true CR80 proportion.
 *
 * The hero of this page is the thing the system makes, before it has made it: the
 * edge band, the empty photo well, ruled lines where a name will go, a dark QR
 * square. It says what the app is for without inventing a person to demonstrate
 * on — and there is no session here, so there is no real visitor to show.
 */
function BadgeBlank() {
  return (
    <div
      aria-hidden
      className="cr80 relative flex w-full overflow-hidden rounded-[4px] bg-card shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]"
    >
      <div className="cr80-band h-full shrink-0 bg-graphite-900" />

      <div className="flex flex-1 items-stretch gap-[3cqw] p-[4cqw]">
        <div className="cr80-photo aspect-3/4 self-start rounded-[2px] bg-line" />

        <div className="flex flex-1 flex-col justify-start pt-[1cqw]">
          <div className="h-[7cqw] w-[70%] rounded-[1px] bg-line-strong" />
          <div className="mt-[3.5cqw] h-[4cqw] w-[45%] rounded-[1px] bg-line" />
          <div className="mt-[2cqw] h-[4cqw] w-[55%] rounded-[1px] bg-line" />
          <div className="mt-auto h-[4cqw] w-[38%] rounded-[1px] bg-line" />
        </div>

        <div className="cr80-qr aspect-square self-end rounded-[2px] bg-[repeating-conic-gradient(var(--color-graphite-900)_0%_25%,#fff_0%_50%)] bg-[length:14%_14%] opacity-30" />
      </div>
    </div>
  );
}

const subscribeNever = () => () => {};

function SignInCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The host, read from the browser with an empty server snapshot. Reading
  // `window` during render would make the server and client markup disagree;
  // this is the sanctioned way to say "this value only exists on the client".
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
      router.replace(params.get("next") || "/visitors");
    } catch (cause) {
      setError(
        cause instanceof LoginError
          ? cause.message
          : "Could not reach the server. Check that the backend is running.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <BadgeBlank />

      <div className="mt-8">
        <p className="mono text-[10px] tracking-[0.28em] text-graphite-500 uppercase">
          Visitor management
        </p>
        <h1 className="display mt-2 text-3xl font-bold text-white">Sign in</h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <DarkField
          id="username"
          label="Username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={setUsername}
        />

        <DarkField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-revoked/50 bg-revoked/15 px-3 py-2.5 text-sm text-white"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-white px-4 py-3 text-sm font-semibold text-graphite-950 transition-colors hover:bg-graphite-300 focus-visible:outline-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-graphite-500">
        Administrator accounts only. Guards use a paired phone, and the lobby
        screen pairs itself.
      </p>

      {/* Genuinely useful at an event: confirms the laptop is on the right box. */}
      <p className="mono mt-1.5 text-xs text-graphite-500">
        Serving from <span className="text-graphite-300">{host || "…"}</span>
      </p>
    </div>
  );
}

function DarkField({
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
      <label
        htmlFor={id}
        className="block text-xs font-medium text-graphite-300"
      >
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
        className="mt-1.5 w-full rounded-md border border-graphite-700 bg-graphite-900 px-3 py-2.5 text-sm text-white transition-colors focus:border-graphite-300 focus-visible:outline-white"
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-graphite-950 px-6 py-12">
      <Suspense fallback={null}>
        <SignInCard />
      </Suspense>
    </div>
  );
}
