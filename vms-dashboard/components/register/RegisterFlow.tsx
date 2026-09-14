"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";

import { EVENT, Organisers } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import {
  PUBLIC_STATUS_KEY,
  fetchPublicRegistrationStatus,
  parsePass,
  readPass,
  subscribePass,
} from "@/lib/registration";

import { RegisterForm } from "./RegisterForm";
import { RegistrationPass } from "./RegistrationPass";

/**
 * The public page: closed, open, or done.
 *
 * A pass already in this tab's session wins over everything, including the switch
 * being closed since -- a visitor who registered must keep their QR even if an
 * admin shuts registration five minutes later.
 */
export function RegisterFlow() {
  const t = useT();

  // Read on the client only; the server renders the form state. A pass read
  // during render would make the server and client markup disagree.
  const rawPass = useSyncExternalStore(subscribePass, readPass, () => null);
  const pass = useMemo(() => parsePass(rawPass), [rawPass]);

  const status = useQuery({
    queryKey: PUBLIC_STATUS_KEY,
    queryFn: ({ signal }) => fetchPublicRegistrationStatus(signal),
    enabled: !pass,
    retry: 1,
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/drcc-event.png"
            alt=""
            aria-hidden
            className="h-12 w-12 shrink-0 object-contain"
          />
          <span className="min-w-0">
            <span className="display block text-[0.9rem] leading-tight text-ink">
              {EVENT.name}
            </span>
            <span className="block text-[12px] leading-tight text-ink-2">
              {EVENT.subtitle}
            </span>
            <span className="block text-[11px] leading-tight text-ink-3">
              {t("brand.dates")}
            </span>
          </span>
        </div>
        {pass ? null : <LanguageToggle />}
      </header>

      <main className="mt-6 flex-1">
        {pass ? (
          <RegistrationPass pass={pass} />
        ) : status.isPending ? (
          <p className="mono py-16 text-center text-xs text-ink-3">
            {t("publicRegister.loading")}
          </p>
        ) : status.isError ? (
          <Notice title={t("publicRegister.unreachable")} />
        ) : status.data ? (
          <RegisterForm />
        ) : (
          <Notice title={t("publicRegister.closedTitle")} body={t("publicRegister.closedBody")} />
        )}
      </main>

      {/* Both organisers, together, on their white plates. Never one alone. */}
      <footer className="mt-8 border-t border-line pt-5">
        <Organisers compact />
      </footer>
    </div>
  );
}

function Notice({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card px-5 py-8 text-center">
      <p className="display text-lg text-ink">{title}</p>
      {body ? <p className="mt-2 text-sm text-ink-2">{body}</p> : null}
    </div>
  );
}
