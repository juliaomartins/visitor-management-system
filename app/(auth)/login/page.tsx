"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type CSSProperties } from "react";

import { LoginError, login } from "@/lib/auth";

function SignInCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      {/* The first card off the sheet — same cut marks that frame every row. */}
      <div
        className="cutmarks bg-card px-8 py-9"
        style={{ "--cutmark-color": "var(--color-ink-700)" } as CSSProperties}
      >
        <p className="serial text-[11px] uppercase text-ink-500">
          Visitor management
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Administrator accounts only. Guards use a paired phone; the lobby screen
          pairs itself.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-ink-700"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-rule-strong bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-ink-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-rule-strong bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-revoked-soft px-3 py-2.5 text-sm text-revoked"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-pressed focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 focus-visible:outline-none disabled:opacity-70"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      {/* Genuinely useful at an event: confirms the laptop is on the right box. */}
      <p className="serial mt-6 text-center text-[11px] text-ink-500">
        Serving from{" "}
        <span className="text-ink-300">
          {typeof window === "undefined" ? "…" : window.location.host}
        </span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-12">
      <Suspense fallback={null}>
        <SignInCard />
      </Suspense>
    </div>
  );
}
