"use client";

/**
 * THE BADGE, at true CR80 proportion.
 *
 * This is the one object the whole system is about, so it is the one object the
 * interface is built from — not a motif applied to a generic admin layout. A row
 * in the visitor list is a miniature of it. The detail page shows it at reading
 * size. The print queue is a sheet of them.
 *
 * That makes it useful rather than decorative: what an admin sees on screen is the
 * arrangement the guest will actually wear, so a name that will overflow, a photo
 * cropped badly, or a missing VIP band is visible here rather than after fifty
 * cards have come off the printer.
 *
 * Every internal dimension is in `cqw` — a percentage of the card's own width — so
 * a single component serves a 96px thumbnail and a 420px hero with no second set
 * of rules and no chance of the two drifting apart.
 */
type BadgeVisitor = {
  full_name: string;
  country: string;
  organization?: string | null;
  badge_serial: string;
  photo: string;
  category?: string | null;
  is_active?: boolean;
};

export function BadgeCard({
  visitor,
  width,
  detail = false,
}: {
  visitor: BadgeVisitor;
  /** Any CSS width. Height follows from the CR80 aspect ratio. */
  width: string;
  /** Show organisation and the QR block. Off for thumbnails, where they are noise. */
  detail?: boolean;
}) {
  const vip = visitor.category === "vip";
  const revoked = visitor.is_active === false;

  return (
    <div
      style={{ width }}
      className={`cr80 relative flex shrink-0 overflow-hidden rounded-[3px] bg-white ring-1 ring-line-strong ${
        revoked ? "opacity-55" : ""
      }`}
    >
      {/* The edge band. Amber means VIP and nothing else — see globals.css. */}
      <div
        className={`cr80-band h-full shrink-0 ${vip ? "bg-vip" : "bg-graphite-900"}`}
      />

      <div className="flex min-w-0 flex-1 items-stretch gap-[2.5cqw] p-[3.5cqw]">
        {visitor.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={visitor.photo}
            alt=""
            className={`cr80-photo aspect-3/4 self-start rounded-[2px] bg-line object-cover ${
              revoked ? "grayscale" : ""
            }`}
          />
        ) : (
          <div className="cr80-photo aspect-3/4 self-start rounded-[2px] bg-line" />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {vip ? (
            <p className="cr80-serial mono font-bold tracking-[0.3em] text-vip uppercase">
              VIP
            </p>
          ) : null}

          <p className="cr80-name display mt-[1cqw] font-bold text-ink [overflow-wrap:anywhere]">
            {visitor.full_name}
          </p>

          <p className="cr80-meta mt-[2cqw] text-ink-2">{visitor.country}</p>

          {detail && visitor.organization ? (
            <p className="cr80-meta mt-[1cqw] text-ink-3">{visitor.organization}</p>
          ) : null}

          <p className="cr80-serial mono mt-auto pt-[2cqw] font-medium text-ink">
            {visitor.badge_serial}
          </p>
        </div>

        {detail ? (
          /* Where the QR sits on the real card. Drawn as a placeholder rather than
             a live code: the raw token is not recoverable after registration, so
             this is the shape of the card, not a scannable badge. */
          <div className="cr80-qr aspect-square self-end rounded-[2px] bg-[repeating-conic-gradient(var(--color-graphite-900)_0%_25%,#fff_0%_50%)] bg-[length:16%_16%] opacity-25" />
        ) : null}
      </div>

      {revoked ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="cr80-serial mono rounded-[2px] bg-revoked px-[2cqw] py-[0.8cqw] font-bold tracking-[0.2em] text-white uppercase">
            Revoked
          </span>
        </div>
      ) : null}
    </div>
  );
}
