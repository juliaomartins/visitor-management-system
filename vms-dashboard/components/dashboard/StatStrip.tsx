"use client";

import Link from "next/link";

/**
 * The figures that support the hero, as one band rather than four cards.
 *
 * Four separate cards each with its own border, shadow and sparkline was the
 * problem: it spent a card's worth of visual weight on every number, so nothing
 * was more important than anything else, and it is the single most templated
 * shape a dashboard can take. One band with hairline dividers says these belong
 * together and sit below the headline -- which is what is actually true.
 *
 * The sparklines went with them. A 28px plot beside a figure could not be read
 * and could not be labelled; the hour chart below is the same data at a size
 * where it means something, and printing it twice only invited the eye to
 * compare two things that were never comparable.
 *
 * `tone` is never the only carrier: an alert cell also says its number and its
 * word, because these colours are the door's status set and shipping one as
 * colour alone is the thing the palette comment forbids.
 */
export type StatCell = {
  key: string;
  label: string;
  value: string | number;
  /** A true relationship, never a fabricated week-on-week delta. */
  note?: string;
  tone?: "plain" | "good" | "warn" | "alert";
  /** Makes the cell a link. Used for doors, which are actionable. */
  href?: string;
};

export function StatStrip({ cells }: { cells: StatCell[] }) {
  return (
    <section className="card overflow-hidden">
      {/*
        A grid rather than flex, so every cell is the same width and the numbers
        line up as a row of figures. 1 up on a phone, 2 on a tablet, 4 from
        `lg` -- and the dividers follow, which is why they are drawn with ring
        offsets rather than borders per cell.
      */}
      <dl className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
        {cells.map((cell) => (
          <Cell key={cell.key} cell={cell} />
        ))}
      </dl>
    </section>
  );
}

function Cell({ cell }: { cell: StatCell }) {
  const noteTone =
    cell.tone === "good"
      ? "text-valid"
      : cell.tone === "warn"
        ? "text-vip"
        : cell.tone === "alert"
          ? "text-revoked"
          : "text-ink-3";

  const body = (
    <>
      <dt className="text-[0.78rem] tracking-wide text-ink-3">{cell.label}</dt>
      <dd className="mt-1.5">
        <span className="display block text-2xl leading-none text-ink tabular-nums">
          {cell.value}
        </span>
        {cell.note ? (
          <span className={`mt-1.5 block text-xs ${noteTone}`}>
            {cell.note}
          </span>
        ) : null}
      </dd>
    </>
  );

  /*
    The Link IS the grid child, with no wrapper. `divide-*` styles
    `& > * + *`, so a `display: contents` wrapper would hand the border to an
    element that renders no box and the divider beside this one cell would
    silently go missing.
  */
  if (cell.href) {
    return (
      <Link
        href={cell.href}
        className="p-4 transition-colors hover:bg-card-2 focus-visible:bg-card-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink sm:p-5"
      >
        {body}
      </Link>
    );
  }

  return <div className="p-4 sm:p-5">{body}</div>;
}
