"use client";

import { useEffect, useRef, useState } from "react";

import { setLocale, useLocale, useT } from "@/lib/i18n";
import { LOCALES, localeMeta } from "@/lib/locales";

/**
 * Three languages, named in their own words.
 *
 * A menu rather than a cycling button. Cycling is fine for two states — the
 * theme toggle next to this one does exactly that — but with three it stops
 * telling you where you will land, and somebody who has arrived in a language
 * they cannot read should not have to click through the other two to escape.
 *
 * THE LABELS ARE NEVER TRANSLATED. "Português" is Português in every language,
 * because the person hunting for it is looking for the word they recognise, not
 * for the word this interface currently happens to be using.
 *
 * The trigger shows the short code rather than a flag. Flags are countries, not
 * languages, and there is no flag that means Tetum without also meaning
 * something political on a screen at a ministerial conference.
 */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);

  const root = useRef<HTMLDivElement | null>(null);
  const firstItem = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Focus lands on the list so the whole thing is reachable from the keyboard
    // without a trip through the trigger.
    firstItem.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const current = localeMeta(locale);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language.choose")}
        title={t("language.label")}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
          compact ? "h-9 px-2" : "h-9 px-3"
        }`}
      >
        <GlobeIcon />
        <span className="mono text-[11px] font-bold tracking-wider">
          {current.short}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("language.label")}
          className="absolute right-0 z-40 mt-1.5 min-w-44 rounded-xl border border-line bg-card p-1 shadow-lg"
        >
          {LOCALES.map((entry, index) => {
            const active = entry.code === locale;

            return (
              <button
                key={entry.code}
                ref={index === 0 ? firstItem : undefined}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                lang={entry.html}
                onClick={() => {
                  setLocale(entry.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-ink hover:bg-card-2 focus-visible:bg-card-2"
                }`}
              >
                <span className="w-4 shrink-0">
                  {active ? <CheckIcon /> : null}
                </span>
                {entry.label}
                <span className="mono ml-auto text-[10px] tracking-wider text-ink-3">
                  {entry.short}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* Same conventions as the rail and the row menu: a 24-box, no fill, 1.6 stroke
   in currentColor, round caps. */
function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" strokeLinecap="round" />
      <path
        d="M12 3.8c2.1 2.3 3.2 5.1 3.2 8.2S14.1 17.9 12 20.2c-2.1-2.3-3.2-5.1-3.2-8.2S9.9 6.1 12 3.8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5.5 12.5 4 4 9-9" />
    </svg>
  );
}
