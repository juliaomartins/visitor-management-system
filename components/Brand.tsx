"use client";

import { useT } from "@/lib/i18n";
/**
 * The event's identity on the wall.
 *
 * WHICH LOGO IS WHICH MATTERS, and the brief is explicit. Two organisers, one
 * event mark, and they do different jobs:
 *
 *   The event PIN   the conference's own mark, and the source of every colour on
 *                   this screen. It leads, on the left, with the event name.
 *   RDTL + SECoop   the organisers. They appear together, always as a pair,
 *                   opposite the mark -- never one alone, because dropping one
 *                   misrepresents who is hosting a ministerial event.
 *
 * On a wall at three to five metres the organiser seals are never going to be
 * read; they are there to be *recognised*, which is a much lower bar and is why
 * they sit at a fixed modest height instead of scaling with the panel. The event
 * name is the part that has to be legible, so it gets the type.
 */
export const EVENT = {
  name: "Díli Regional Cooperative Conference",
  subtitle: "Ministerial Dialogue 2026",
  organisers: [
    { src: "/brand/rdtl.png", alt: "República Democrática de Timor-Leste" },
    { src: "/brand/secoop.png", alt: "Secretária de Estado de Cooperativas" },
  ],
} as const;

/** The event mark and the conference name. The left half of any header. */
export function EventMark() {
  return (
    <div className="flex min-w-0 items-center gap-[clamp(0.5rem,1vw,1rem)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/drcc-event.png"
        alt=""
        aria-hidden
        className="aspect-square w-[clamp(34px,3.6vw,64px)] shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="truncate text-[clamp(0.6rem,1.05vw,1rem)] leading-[1.2] font-semibold tracking-[0.14em] text-ink-soft uppercase">
          {EVENT.name}
        </p>
        <p
          className="truncate text-[clamp(0.58rem,1vw,0.95rem)] leading-[1.2] font-bold tracking-[0.14em] uppercase"
          style={{ color: "var(--accent, var(--color-expo))" }}
        >
          {EVENT.subtitle}
        </p>
      </div>
    </div>
  );
}

/**
 * Both organiser seals, on a white plate.
 *
 * The plate stays white in dark mode on purpose. These are government and state
 * secretariat marks; knocking them back with `opacity` or inverting them to "fit
 * the theme" is the sort of liberty that gets a system pulled from a ministerial
 * event. They keep their own background and their own colour, always.
 */
export function Organisers() {
  const t = useT();
  return (
    <div
      className="flex shrink-0 items-center gap-[clamp(0.35rem,0.7vw,0.7rem)] rounded-[0.6rem] bg-white px-[clamp(0.4rem,0.7vw,0.75rem)] py-[clamp(0.25rem,0.45vh,0.5rem)]"
      aria-label={t("brand.organisers")}
    >
      {EVENT.organisers.map((org) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={org.src}
          src={org.src}
          alt={org.alt}
          className="w-auto object-contain"
          style={{ height: "clamp(20px, 2.4vh, 40px)" }}
        />
      ))}
    </div>
  );
}
