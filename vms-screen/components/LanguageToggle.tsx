"use client";

import { useEffect, useRef, useState } from "react";

import { setLocale, useLocale, useT } from "@/lib/i18n";
import { LOCALES, localeMeta } from "@/lib/locales";

/**
 * The language control. `/pair` ONLY.
 *
 * IT USED TO SIT ON THE WALL, beside the theme toggle, and it does not any
 * more. The lobby display is English — its words are constants in
 * `lib/wall-copy.ts` — so a language control there would have been a switch
 * with nothing behind it. The installer still needs one, and the pairing screen
 * is where they are standing, so it lives there and nowhere else.
 *
 * That move is also why the anchor is the plain bottom-left corner now. It used
 * to carry an offset the width of the theme toggle, to sit to its right; there
 * is no theme toggle on the pairing screen, and the offset left it floating in
 * the middle of nothing.
 *
 * A menu rather than a cycling button. With three languages, cycling stops
 * telling you where you will land, and the person most likely to need this is
 * the one who cannot read the language currently on screen.
 *
 * THE MENU OPENS UPWARDS. It is anchored to the bottom of a full-height panel,
 * so a downward menu would open off the screen — and on a kiosk there is
 * nothing to scroll.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);

  const root = useRef<HTMLDivElement | null>(null);
  const firstItem = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

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

  return (
    <div
      ref={root}
      className="fixed bottom-[clamp(0.6rem,1.6vh,1.4rem)] left-[clamp(0.6rem,1.6vw,1.4rem)] z-50"
    >
      {open ? (
        <div
          role="menu"
          aria-label={t("language.label")}
          className="absolute bottom-full left-0 mb-2 min-w-40 rounded-xl bg-stage-raised/95 p-1 ring-1 ring-edge backdrop-blur"
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
                /* The label is in its own language, so it is tagged as such —
                   otherwise a screen reader announces "Português" with an
                   English voice. */
                lang={entry.html}
                onClick={() => {
                  setLocale(entry.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-edge text-ink"
                    : "text-ink-soft hover:bg-edge/60 hover:text-ink focus-visible:bg-edge/60"
                }`}
              >
                <span className="w-3.5 shrink-0">{active ? "✓" : null}</span>
                {entry.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language.choose")}
        title={t("language.label")}
        className={`flex h-[clamp(28px,3vh,44px)] min-w-[clamp(28px,3vh,44px)] items-center justify-center rounded-full bg-stage-raised/70 px-2 text-[clamp(9px,1vh,12px)] font-bold tracking-wider text-ink-faint ring-1 ring-edge backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-expo focus-visible:outline-none ${
          open ? "opacity-100" : "opacity-35"
        }`}
      >
        {localeMeta(locale).short}
      </button>
    </div>
  );
}
