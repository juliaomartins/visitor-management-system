"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePageMeta } from "@/components/page-meta";
import { logout } from "@/lib/auth";

/** Page heading, record count, and the way out. */
export function Topbar() {
  const router = useRouter();
  const { title, subtitle, count } = usePageMeta();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  }

  return (
    <header className="flex items-center gap-6 border-b border-rule bg-card px-8 py-5">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>

      {count !== undefined ? (
        <p className="serial shrink-0 rounded-md border border-rule px-3 py-1.5 text-xs text-ink-700">
          {count} {count === 1 ? "record" : "records"}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="ml-auto shrink-0 rounded-md border border-rule px-3.5 py-2 text-sm text-ink-700 transition-colors hover:border-rule-strong hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </header>
  );
}
