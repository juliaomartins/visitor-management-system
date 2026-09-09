"use client";

/**
 * The event's identity, in one place.
 *
 * WHICH LOGO IS WHICH MATTERS, and the brief is explicit about it. There are two
 * organisers and one event mark, and they are not interchangeable:
 *
 *   RDTL + SECoop   organisers. They appear together, always as a pair, at the
 *                   foot of a page or beside the event mark -- never one alone,
 *                   because leaving one off misrepresents who is hosting.
 *   The event PIN    the event's own mark. It is the identity of the conference
 *                   and it carries the palette the rest of this console is
 *                   derived from.
 *
 * Strings live here rather than in each page so that "Ministerial Dialogue 2026"
 * cannot end up spelled three ways across the app.
 */
import { useRichT } from "@/lib/i18n";

export const EVENT = {
  name: "Díli Regional Cooperative Conference",
  subtitle: "and Ministerial Dialogue 2026",
  shortName: "DRCC 2026",
  dates: "Díli, 2–3 October 2026",
  theme: "Empowering communities, connecting nations",
  organisers: [
    {
      src: "/brand/rdtl.png",
      alt: "República Democrática de Timor-Leste",
      label: "IX Governo Constitucional",
      detail:
        "Vice-Primeiro-Ministro, Ministro Coordenador dos Assuntos Económicos, Ministro do Turismo e Ambiente",
    },
    {
      src: "/brand/secoop.png",
      alt: "Secretária de Estado de Cooperativas",
      label: "Secretária de Estado de Cooperativas",
      detail: "Servisu Hamutuk Halo Mudansa",
    },
  ],
} as const;

/**
 * The event mark, with the conference name set beside it.
 *
 * The PIN is a detailed piece of artwork -- a feathered plume, a map, a star, two
 * rings of type. Below about 36px none of that survives and it turns to mush, so
 * the smallest size here is 36 and the mark is never scaled to fit a slot that
 * cannot hold it. Where there is less room than that, use the wordmark alone.
 */
export function EventMark({
  size = 40,
  showText = true,
}: {
  size?: number;
  showText?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/drcc-event.png"
        alt={showText ? "" : EVENT.name}
        aria-hidden={showText || undefined}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
      {showText ? (
        <span className="min-w-0">
          <span className="display block truncate text-[0.95rem] leading-tight text-ink">
            {EVENT.shortName}
          </span>
          <span className="block truncate text-[11px] leading-tight text-ink-3">
            Accreditation
          </span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * The two organisers, side by side.
 *
 * Their artwork is dense and mostly mid-tone, so both sit on a white plate rather
 * than directly on the surface. In dark mode that plate stays light on purpose:
 * a government seal reversed out of a dark field is the one thing here nobody is
 * free to restyle, and knocking it back with `opacity` to "fit the theme" is
 * exactly the sort of thing that gets a badge system pulled from a ministerial
 * event.
 */
export function Organisers({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-start gap-3"}>
      {EVENT.organisers.map((org) => (
        <span
          key={org.src}
          className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={org.src}
            alt={org.alt}
            className="shrink-0 object-contain"
            style={{ height: compact ? 22 : 30, width: "auto" }}
          />
        </span>
      ))}
    </div>
  );
}

/** The organisers with their titles spelled out. For a page foot, not a rail. */
export function OrganiserCredit() {
  const rich = useRichT();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Organisers />
      <p className="min-w-0 flex-1 text-[11px] leading-snug text-ink-3">
        {/*
          No article in front of the names. English wants "the", Portuguese
          wants "pelo" or "pela" depending on each organiser's gender, and the
          organisers are configuration rather than messages -- so the sentence
          is written to need neither.
        */}
        {rich("brand.organisedBy", {
          first: (
            <span className="text-ink-2">{EVENT.organisers[0].label}</span>
          ),
          second: (
            <span className="text-ink-2">{EVENT.organisers[1].label}</span>
          ),
        })}
      </p>
    </div>
  );
}
