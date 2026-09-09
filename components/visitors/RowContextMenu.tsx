"use client";

import { useCallback, useEffect } from "react";
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
              className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none ${
                item.danger
                  ? "text-revoked hover:bg-revoked-soft focus-visible:bg-revoked-soft"
                  : "text-ink hover:bg-card-2 focus-visible:bg-card-2"
              }`}
            >
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
