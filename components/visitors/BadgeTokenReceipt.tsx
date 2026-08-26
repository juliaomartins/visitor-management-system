"use client";

import Link from "next/link";
import { useState } from "react";

import type { VisitorIssued } from "@/lib/visitors";

/**
 * The one and only sight of a badge token.
 *
 * The backend stores a SHA-256 digest and nothing else, so this string exists in
 * exactly two places: this screen, and whatever the registrar does with it next.
 * Navigating away destroys it, and the badge can then never be printed — the
 * visitor has to be registered again from scratch.
 *
 * That is why registering does not redirect on success. The registrar leaves this
 * screen deliberately, having copied the token, not because a router decided the
 * job was finished.
 *
 * Phase 5 makes most of this unnecessary: `GET /visitors/{id}/badge` will render
 * the PDF directly and the token will go straight into a QR without a human ever
 * seeing it.
 */
export function BadgeTokenReceipt({
  visitor,
  onRegisterAnother,
}: {
  visitor: VisitorIssued;
  onRegisterAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(visitor.badge_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the token is selectable either way.
      setCopied(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-lg border border-vip bg-vip-soft px-6 py-6">
        <p className="serial text-[11px] uppercase text-vip">Copy this now</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-900">
          {visitor.full_name} is registered
        </h2>
        <p className="mt-2 text-sm text-ink-700">
          The badge token below goes into the QR code. It is stored only as a hash,
          so this is the only time it can be read. Leave this page without it and the
          badge cannot be printed — you would have to register {visitor.full_name}{" "}
          again.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="serial min-w-0 flex-1 overflow-x-auto rounded border border-vip/40 bg-card px-3 py-2.5 text-sm text-ink-900">
            {visitor.badge_token}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md bg-ink-900 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {copied ? "Copied" : "Copy token"}
          </button>
        </div>

        <p aria-live="polite" className="sr-only">
          {copied ? "Badge token copied to the clipboard." : ""}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <Row label="Badge serial" value={visitor.badge_serial} mono />
        <Row label="Country" value={visitor.country} />
        <Row
          label="Category"
          value={visitor.category === "vip" ? "VIP" : "Normal"}
        />
      </dl>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-pressed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Register another visitor
        </button>
        <Link
          href={`/visitors/${visitor.id}`}
          className="rounded-md border border-rule px-3.5 py-2.5 text-sm text-ink-700 hover:border-rule-strong hover:text-ink-900"
        >
          Open {visitor.full_name}
        </Link>
        <Link
          href="/visitors"
          className="px-2 py-2.5 text-sm text-ink-500 hover:text-ink-900"
        >
          Back to all visitors
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className={`mt-0.5 text-ink-900 ${mono ? "serial" : ""}`}>{value}</dd>
    </div>
  );
}
