"use client";

import { useState } from "react";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import { DeskError, pairDesk, saveDeskToken } from "@/lib/desk";

const CODE_LENGTH = 6;

const FAILURE_MESSAGE: Record<string, MessageKey> = {
  invalid: "desk.pairFailed",
  wrong_device: "desk.wrongDevice",
  network: "desk.unreachable",
  server: "desk.failed",
  throttled: "desk.tooMany",
};

/**
 * Pairing, once per device, with an admin standing next to it.
 *
 * The same six-character code the scanner and the lobby screen redeem, from the
 * same alphabet with no 0, O, 1 or I -- so a code read aloud across a noisy
 * lobby cannot be mistyped into a different one.
 *
 * The name is optional and the backend fills in "Desk 2" when it is left blank,
 * but it is worth typing: it is what an admin reads on `/devices` when deciding
 * which desk to revoke.
 */
export function DeskPairing() {
  const t = useT();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    setDetail(null);

    try {
      saveDeskToken(await pairDesk(code, name));
    } catch (cause) {
      if (cause instanceof DeskError) {
        setFailure(FAILURE_MESSAGE[cause.kind] ?? "desk.failed");
        // The backend says exactly why a code was refused -- expired, already
        // used, never existed -- and that is more useful than our own summary.
        setDetail(cause.fields.code?.join(" ") ?? null);
      } else {
        setFailure("desk.failed");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h1 className="display text-2xl text-ink">{t("desk.pairTitle")}</h1>
        <p className="mt-1.5 text-sm text-ink-2">{t("desk.pairBody")}</p>
      </div>

      <div>
        <label htmlFor="desk-code" className="block text-sm font-medium text-ink-2">
          {t("desk.codeLabel")}
        </label>
        <input
          id="desk-code"
          name="code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH))
          }
          placeholder="ABC123"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={CODE_LENGTH}
          aria-invalid={failure ? true : undefined}
          className="field mono mt-1.5 py-4 text-center text-3xl tracking-[0.3em] uppercase"
        />
      </div>

      <div>
        <label htmlFor="desk-name" className="block text-sm font-medium text-ink-2">
          {t("desk.nameLabel")}
        </label>
        <input
          id="desk-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("desk.namePlaceholder")}
          autoComplete="off"
          maxLength={100}
          className="field mt-1.5 text-base"
        />
        <p className="mt-1.5 text-xs text-ink-3">{t("desk.nameHint")}</p>
      </div>

      {failure ? (
        <p role="alert" className="rounded-lg bg-revoked-soft px-3.5 py-2.5 text-sm text-revoked">
          {detail ?? t(failure)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || code.length < CODE_LENGTH}
        className="btn btn-primary btn-lg w-full disabled:opacity-50"
      >
        {busy ? t("desk.pairing") : t("desk.pair")}
      </button>
    </form>
  );
}
