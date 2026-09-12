"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The right-click menu on a visitor row.
 *
 * WHY IT REPLACES THE BROWSER'S OWN MENU, which is not a free trade. Right-click
 * on a link normally offers "open in new tab", and a registrar who relied on
 * that loses it here. It is worth the swap on this list only: the three things
 * anyone does to a visitor -- edit, switch off, delete -- otherwise cost a
 * navigation to their page and a navigation back, and at a desk with a queue
 * that round trip is the whole interaction. Left-click still opens the row, so
 * the cheap path is untouched.
 *
 * KEYBOARD USERS GET THIS FOR FREE and it is not an afterthought. The Menu key
 * and Shift+F10 both raise a `contextmenu` event on whatever has focus, and the
 * row's link is focusable, so tabbing to a visitor and pressing either opens
 * exactly this menu. Arrow keys move, Enter activates, Escape closes.
 *
 * Positioned by writing to `style` from a ref callback rather than by holding
 * coordinates in state. The menu has to be measured before it can be clamped
 * inside the viewport, and measuring in an effect and then setting state is the
 * cascade React asks you not to write -- so the one DOM write happens where the
 * DOM node is first handed over.
 */
export type MenuItem = {
  label: string;
  onSelect: () => void;
  /**
   * A 24x24 glyph, drawn in `currentColor` so it takes the item's tone.
   *
   * Required rather than optional. A menu where some rows have an icon and some
   * do not has to choose between a ragged label column and a hole, and both look
   * like a mistake -- so the type refuses the situation instead of the reviewer
   * having to catch it.
   */
  icon: ReactNode;
  /** Styles the item as destructive and sets it apart from the ones above. */
  danger?: boolean;
};

/** Kept clear of the viewport edge so the menu never sits flush against it. */
const EDGE_PADDING = 8;

export function RowContextMenu({
  x,
  y,
  heading,
  items,
  onClose,
}: {
  x: number;
  y: number;
  /** Whose row this is. A menu with no subject is a menu you can misfire. */
  heading: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  const place = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;

      const { width, height } = element.getBoundingClientRect();
      const left = Math.min(x, window.innerWidth - width - EDGE_PADDING);
      const top = Math.min(y, window.innerHeight - height - EDGE_PADDING);

      element.style.left = `${Math.max(EDGE_PADDING, left)}px`;
      element.style.top = `${Math.max(EDGE_PADDING, top)}px`;

      // Focus the first action, so the menu is usable by keyboard the moment it
      // appears however it was opened.
      element.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    },
    [x, y],
  );

  useEffect(() => {
    // Anything that moves the page moves the menu away from what it points at,
    // so scrolling and resizing dismiss rather than reposition. `true` catches
    // scrolls inside containers, which do not bubble.
    const dismiss = () => onClose();

    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);

    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
    };
  }, [onClose]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const menu = event.currentTarget;
    const options = Array.from(
      menu.querySelectorAll<HTMLButtonElement>("[role='menuitem']"),
    );
    const here = options.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    // Wraps at both ends: a four-item menu is faster to reach backwards from the
    // top than by arrowing down through everything.
    const next = {
      ArrowDown: here + 1,
      ArrowUp: here - 1,
      Home: 0,
      End: options.length - 1,
    }[event.key];

    if (next === undefined) return;

    event.preventDefault();
    const wrapped = (next + options.length) % options.length;
    options[wrapped]?.focus();
  }

  return createPortal(
    <>
      {/*
        A full-screen catcher rather than a document listener, so the dismissing
        click is absorbed instead of also opening the row it was sitting over.

        IT CLOSES ON `click`, NOT `pointerdown`, and the difference is the bug.
        Closing on pointerdown unmounts this overlay between the press and the
        release, which leaves the release landing on whatever is underneath --
        the row link -- and the dashboard navigates away from a menu the user was
        only trying to dismiss. Waiting for the click keeps the catcher in place
        for the whole gesture.

        A right-click out here dismisses too, but it does NOT open the menu for
        the row underneath: this element received the event, not the row. That
        second menu costs a second right-click, which is the price of catching
        the first click reliably.
      */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />

      <div
        ref={place}
        role="menu"
        aria-label={`Actions for ${heading}`}
        onKeyDown={onKeyDown}
        className="card fixed z-50 min-w-52 p-1 shadow-lg"
      >
        <p className="truncate px-3 pt-1.5 pb-2 text-[11px] text-ink-3">
          {heading}
        </p>

        {items.map((item) => (
          <div key={item.label}>
            {item.danger ? <div className="my-1 h-px bg-line" /> : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                item.onSelect();
              }}
              className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none ${
                item.danger
                  ? "text-revoked hover:bg-revoked-soft focus-visible:bg-revoked-soft"
                  : "text-ink hover:bg-card-2 focus-visible:bg-card-2"
              }`}
            >
              {/*
                Muted by opacity rather than by a grey token, so the glyph keeps
                the item's hue: the trash is red beside a red label instead of
                going grey next to it, which reads as a disabled row.

                The icon is decoration and `aria-hidden` on each glyph says so.
                The label is the accessible name -- a screen reader announcing
                "pencil Edit details" would be reading the wallpaper aloud.
              */}
              <span className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {item.icon}
              </span>
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}

/*
  The glyph set for this menu.

  Drawn here rather than pulled from a package: the dashboard ships no icon
  library, and adding one for four shapes would put a dependency on an offline
  LAN build for something that is forty lines of SVG. They follow the same
  conventions as `components/sidebar.tsx` -- a 24x24 box, no fill, 1.6 stroke in
  `currentColor`, round caps -- so a menu icon and a nav icon look like siblings.

  Deactivate and activate get DIFFERENT glyphs rather than one toggle symbol.
  Only one of the two is ever on screen, so a single power icon would leave the
  reader working out which direction it points; a barred circle and a ticked one
  each say what the row will become.
*/
const ICON = "h-4 w-4";

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <path
        d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 6.5 17.5 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Deactivate: the badge still exists and stops opening the door. */
export function BanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6.2 6.2 17.8 17.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Activate: the same printed card starts working again. */
export function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m8.4 12.2 2.5 2.5 4.7-4.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <path
        d="M4.5 6.5h15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 10v6.6M13.6 10v6.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Print: the badge PDF, a card page for one visitor or A4 sheets for many. */
export function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <path
        d="M7 9V4.5h10V9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 14h10v5.5H7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Export: a grid rather than a generic download arrow -- it is a spreadsheet. */
export function SpreadsheetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.5 9.5h15M4.5 14.5h15M9.5 4.5v15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
