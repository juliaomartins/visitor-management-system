"use client";

import { useState, useSyncExternalStore } from "react";

import { EVENT } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import {
  readDeskToken,
  subscribeDeskToken,
  type DeskRegistration,
} from "@/lib/desk";

import { DeskForm } from "./DeskForm";
import { DeskPairing } from "./DeskPairing";
import { DeskResult } from "./DeskResult";

/**
 * The walk-in desk, on a laptop or tablet standing at the door.
 *
 * Three states and one loop: pair once, register, show the QR, register again.
 * There is no navigation, because there is nowhere else to go -- this page can
 * reach exactly two API routes (see apps/desk in the backend), and a staff
 * member standing in front of a queue should never have to find their way back
 * to the form.
 *
 * The token is read through `useSyncExternalStore` rather than during render, so
 * the server renders the pairing screen and the client corrects it once it can
 * see storage -- no hydration mismatch, and revoking a desk in one tab moves
 * every tab on that device.
 */
export function DeskFlow() {
  const t = useT();
  const token = useSyncExternalStore(subscribeDeskToken, readDeskToken, () => null);
  const [registered, setRegistered] = useState<DeskRegistration | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/drcc-event.png"
            alt=""
            aria-hidden
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="min-w-0">
            <span className="display block text-[0.95rem] leading-tight text-ink">
              {t("desk.title")}
            </span>
            <span className="block text-[12px] leading-tight text-ink-2">
              {EVENT.name}
            </span>
          </span>
        </div>
        <LanguageToggle />
      </header>

      <main className="mt-6 flex-1">
        {!token ? (
          <DeskPairing />
        ) : registered ? (
          <DeskResult registration={registered} onAgain={() => setRegistered(null)} />
        ) : (
          <DeskForm onRegistered={setRegistered} />
        )}
      </main>
    </div>
  );
}
