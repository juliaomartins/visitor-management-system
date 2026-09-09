"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { EventMark } from "@/components/brand";
import { logout } from "@/lib/auth";
import { isSilent, useDevices, useNow } from "@/lib/devices";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";

/**
 * The rail, grouped by what someone is trying to do.
 *
 * Five destinations is too many for a flat list and too few for a mega-menu, so
 * they are grouped by the job: read the room, handle people, run the doors. The
 * headings are not decoration — they are why Devices does not sit next to
 * Visitors, which are different jobs done by different people at different times
 * of day.
 *
 * COLLAPSED, THE RAIL IS ICONS ONLY and each one grows a label on hover *and* on
 * keyboard focus. Hover alone strands anyone tabbing through, which is the usual
 * way an icon rail fails an audit.
 *
 * The collapsed state is remembered per browser. Someone who works from a
 * cramped registration laptop should not re-collapse it every morning.
 */
const STORAGE_KEY = "vms.sidebar.collapsed";

/*
 * The collapsed flag lives in a tiny store outside React.
 *
 * It is browser state, not derived state, so `useSyncExternalStore` reads it
 * directly with an expanded server snapshot. Hydrating from an effect instead
 * would set state during mount and cascade a second render before the first has
 * painted — and the rail would visibly jump from wide to narrow on every load.
 */
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // A locked-down browser still gets a working, expanded rail.
    return false;
  }
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function getSnapshot(): boolean {
  if (cached === null) cached = readCollapsed();
  return cached;
}

/** The server has no localStorage, so it always renders the rail expanded. */
function getServerSnapshot(): boolean {
  return false;
}

function writeCollapsed(next: boolean): void {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* the preference simply is not remembered */
  }
  for (const notify of listeners) notify();
}

/**
 * One tooltip, measured from its anchor and rendered into `document.body`.
 *
 * Two separate things were burying it before. Absolute positioning inside the
 * `overflow-y: auto` nav got it clipped AND counted into that container's scroll
 * width, so the rail grew a scrollbar for tips nobody could see — opacity never
 * removes anything from layout. Switching to `fixed` solved the clipping but not
 * the painting: `z-index` only ranks an element inside whatever stacking context
 * it happens to land in, and the sticky, backdrop-blurred topbar establishes one
 * of its own, so the tip could still end up underneath a sibling of its ancestor.
 *
 * A portal to `document.body` ends the whole class of bug: the tip is a direct
 * child of the root stacking context, and no ancestor can trap it again.
 *
 * It closes on scroll and on resize rather than following, because a label that
 * has drifted away from its icon is worse than one that simply went away.
 */
type Tip = { label: string; hint?: string; top: number; left: number };

function useNavTip(enabled: boolean) {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!tip) return;

    const dismiss = () => setTip(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [tip]);

  const show = useCallback(
    (element: HTMLElement, label: string, hint?: string) => {
      if (!enabled) return;
      const box = element.getBoundingClientRect();
      setTip({
        label,
        hint,
        top: box.top + box.height / 2,
        left: box.right + 12,
      });
    },
    [enabled],
  );

  const hide = useCallback(() => setTip(null), []);

  return { tip, show, hide };
}

/*
  The rail holds MESSAGE KEYS, not words.

  It is a module-level constant, so it is built once, before any component has a
  translator to call. Storing keys keeps it that way and moves the lookup to the
  render, which is also the only place that knows the current language.
*/
type Item = {
  href: string;
  labelKey: MessageKey;
  hintKey: MessageKey;
  icon: (props: { className?: string }) => React.ReactElement;
};

const GROUPS: { headingKey: MessageKey; items: Item[] }[] = [
  {
    headingKey: "nav.group.overview",
    items: [
      {
        href: "/dashboard",
        labelKey: "nav.dashboard",
        hintKey: "nav.dashboard.hint",
        icon: IconGrid,
      },
    ],
  },
  {
    headingKey: "nav.group.accreditation",
    items: [
      {
        href: "/visitors",
        labelKey: "nav.visitors",
        hintKey: "nav.visitors.hint",
        icon: IconPeople,
      },
      {
        href: "/badges",
        labelKey: "nav.badges",
        hintKey: "nav.badges.hint",
        icon: IconCard,
      },
    ],
  },
  {
    headingKey: "nav.group.operations",
    items: [
      {
        href: "/devices",
        labelKey: "nav.devices",
        hintKey: "nav.devices.hint",
        icon: IconDevice,
      },
      {
        href: "/reports",
        labelKey: "nav.reports",
        hintKey: "nav.reports.hint",
        icon: IconChart,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [signingOut, setSigningOut] = useState(false);
  const { tip, show, hide } = useNavTip(collapsed);

  // The only query the chrome makes. Small, already polled by the devices page,
  // and the answer is the one thing worth knowing from anywhere.
  const { data: devices } = useDevices();
  const now = useNow();
  const silent = (devices ?? []).filter((device) =>
    isSilent(device, now),
  ).length;

  const toggle = useCallback(() => {
    // Expanding leaves the pointer sitting on the same button, so no
    // pointerleave fires — without this the tip would hang there describing a
    // rail that is no longer collapsed.
    hide();
    writeCollapsed(!getSnapshot());
  }, [hide]);

  async function handleSignOut() {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  }

  return (
    <aside
      data-collapsed={collapsed ? "" : undefined}
      className={`sticky top-0 flex h-dvh shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 ${
        collapsed ? "w-[4.75rem]" : "w-[15.5rem]"
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center gap-2.5 border-b border-line ${
          collapsed ? "justify-center px-2" : "px-4"
        }`}
      >
        {/* The event's own mark replaces the placeholder letter tile. Collapsed,
            the rail is narrow, so the mark drops its text and stands alone at
            32px -- below that the PIN's inner ring of type turns to mush. */}
        <EventMark size={collapsed ? 32 : 34} showText={!collapsed} />
      </div>

      <nav
        aria-label={t("nav.sections")}
        className="flex-1 overflow-y-auto px-2.5 py-4"
      >
        {GROUPS.map((group) => (
          <div key={group.headingKey} className="mb-5 last:mb-0">
            {collapsed ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line" />
            ) : (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-ink-3">
                {t(group.headingKey)}
              </p>
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const alert = item.href === "/devices" && silent > 0;
                const Icon = item.icon;
                const label = t(item.labelKey);
                const hint = t(item.hintKey);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? undefined : hint}
                      onPointerEnter={(event) =>
                        show(event.currentTarget, label, hint)
                      }
                      onPointerLeave={hide}
                      onFocus={(event) => show(event.currentTarget, label, hint)}
                      onBlur={hide}
                      className={`relative flex items-center gap-2.5 rounded-lg py-2.5 transition-colors ${
                        collapsed ? "justify-center px-0" : "px-2.5"
                      } ${
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-ink-2 hover:bg-card-2 hover:text-ink"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <Icon className="h-[1.15rem] w-[1.15rem]" />
                        {alert && collapsed ? (
                          <span className="animate-pulse-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-vip" />
                        ) : null}
                      </span>

                      {/* Always in the DOM. Dropping it would leave the
                          collapsed link holding an aria-hidden icon and no
                          accessible name at all. */}
                      <span
                        className={
                          collapsed
                            ? "sr-only"
                            : "min-w-0 flex-1 truncate text-[0.875rem] font-medium"
                        }
                      >
                        {label}
                      </span>

                      {alert && !collapsed ? (
                        <span
                          className="animate-pulse-dot h-2 w-2 shrink-0 rounded-full bg-vip"
                          aria-label={t("nav.silentDevices", { count: silent })}
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          onPointerEnter={(event) =>
            show(event.currentTarget, t("nav.expand"))
          }
          onPointerLeave={hide}
          onFocus={(event) => show(event.currentTarget, t("nav.expand"))}
          onBlur={hide}
          className={`relative mb-1 flex w-full items-center gap-2.5 rounded-lg py-2.5 text-ink-2 transition-colors hover:bg-card-2 hover:text-ink ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          <IconCollapse
            className={`h-[1.15rem] w-[1.15rem] shrink-0 transition-transform duration-200 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
          {collapsed ? null : (
            <span className="text-[0.875rem] font-medium">
              {t("nav.collapse")}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label={t("nav.signOut")}
          onPointerEnter={(event) =>
            show(event.currentTarget, t("nav.signOut"))
          }
          onPointerLeave={hide}
          onFocus={(event) => show(event.currentTarget, t("nav.signOut"))}
          onBlur={hide}
          className={`relative flex w-full items-center gap-2.5 rounded-lg py-2.5 text-ink-2 transition-colors hover:bg-card-2 hover:text-ink disabled:opacity-60 ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          <IconExit className="h-[1.15rem] w-[1.15rem] shrink-0" />
          {collapsed ? null : (
            <span className="text-[0.875rem] font-medium">
              {signingOut ? t("nav.signingOut") : t("nav.signOut")}
            </span>
          )}
        </button>
      </div>

      {/* Portalled to the body so no ancestor stacking context can cover it.
          Decorative: the control it describes already carries the same words as
          its accessible name. */}
      {tip
        ? createPortal(
            <span
              aria-hidden
              className="nav-tip"
              style={{ top: tip.top, left: tip.left }}
            >
              {tip.label}
              {tip.hint ? (
                <span className="ml-1.5 text-graphite-300">{tip.hint}</span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </aside>
  );
}

/* --------------------------------------------------------------- icons -- */
/* Drawn inline at a common 24-box on a 1.6 stroke, so the rail never waits on a
   font or an icon package to paint. */

function IconGrid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3"
        y="3"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="13.5"
        y="3"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="3"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="13.5"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconPeople({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16.5 5.2a3.4 3.4 0 0 1 0 6.4M18 14.9c2 .7 3.4 2.4 3.4 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="5.6"
        y="8.4"
        width="4.6"
        height="5.6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M13.4 9.4h5M13.4 12.4h5M13.4 15.2h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDevice({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="7"
        y="2.5"
        width="10"
        height="19"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10.6 18.6h2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 20V4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7.5 16.5v-4M12 16.5V8M16.5 16.5v-6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCollapse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10 4v16" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M17 10.2 14.6 12l2.4 1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M14 4.5H6.8A2.3 2.3 0 0 0 4.5 6.8v10.4a2.3 2.3 0 0 0 2.3 2.3H14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17.5 8.6 21 12l-3.5 3.4M20.4 12H10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
