"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isSilent, useDevices, useNow } from "@/lib/devices";

/**
 * A rail, not a sidebar.
 *
 * There are four destinations. A 240px navigation panel to hold four words is
 * 240px taken from a table of 250 names, which is the thing a registrar is
 * actually reading. So the rail is narrow, and it spends what little room it has
 * on something a menu normally cannot do: it reports.
 *
 * Devices carries a live dot when a door has gone quiet. That is the one piece of
 * status worth interrupting someone mid-task for — a phone face-down with a flat
 * battery looks exactly like a quiet door until you go and check — and it belongs
 * in the chrome because it is true no matter which page you are on.
 */
const SECTIONS = [
  { href: "/visitors", label: "Visitors", hint: "Register and print" },
  { href: "/badges", label: "Badges", hint: "Print queue" },
  { href: "/devices", label: "Devices", hint: "Doors and screens" },
  { href: "/reports", label: "Reports", hint: "Entrance log" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  // The only query the chrome makes. Small, already polled by the devices page,
  // and the answer is the one thing worth knowing from anywhere.
  const { data: devices } = useDevices();
  const now = useNow();
  const silent = (devices ?? []).filter((device) => isSilent(device, now)).length;

  return (
    <nav
      aria-label="Sections"
      className="flex w-[13.5rem] shrink-0 flex-col bg-graphite-950 text-graphite-300"
    >
      <div className="px-5 py-6">
        <p className="display text-[1.35rem] leading-none font-bold text-white">
          VMS
        </p>
        <p className="mono mt-1.5 text-[10px] tracking-[0.18em] text-graphite-500 uppercase">
          Accreditation
        </p>
      </div>

      <ul className="flex-1 space-y-0.5 px-2.5">
        {SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          const alert = section.href === "/devices" && silent > 0;

          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors ${
                  active
                    ? "bg-white text-graphite-950"
                    : "text-graphite-300 hover:bg-graphite-800 hover:text-white"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9rem] font-medium">
                    {section.label}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[11px] ${
                      active ? "text-graphite-500" : "text-graphite-500"
                    }`}
                  >
                    {section.hint}
                  </span>
                </span>

                {alert ? (
                  <span
                    className="animate-pulse-dot h-2 w-2 shrink-0 rounded-full bg-vip"
                    aria-label={`${silent} not checked in recently`}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mono px-5 py-5 text-[10px] leading-relaxed tracking-[0.14em] text-graphite-700 uppercase">
        Local network
      </p>
    </nav>
  );
}
