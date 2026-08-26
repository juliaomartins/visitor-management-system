"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The whole product, listed honestly.
 *
 * Every section is live as of phase 6, so the "shown but not linked" branch that
 * used to sit here is gone — TypeScript flagged it as unreachable, which is the
 * right answer once nothing is unbuilt. A future unbuilt section should come back
 * dimmed and inert rather than hidden: that tells the truth about what the tool is
 * and what it does at the same time.
 */
const SECTIONS = [
  { href: "/visitors", label: "Visitors", note: "Register and print" },
  { href: "/badges", label: "Badges", note: "Print queue" },
  { href: "/devices", label: "Devices", note: "Pairing codes" },
  { href: "/reports", label: "Reports", note: "Entrance log" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex w-60 shrink-0 flex-col bg-ink-900 text-ink-300"
    >
      <div className="border-b border-ink-800 px-6 py-6">
        <p className="text-lg font-semibold tracking-tight text-white">VMS</p>
        <p className="serial mt-1 text-[11px] uppercase text-ink-500">
          Visitor management
        </p>
      </div>

      <ul className="flex-1 px-3 py-4">
        {SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);

          return (
            <li key={section.label}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${
                  active
                    ? "bg-ink-800 font-medium text-white"
                    : "hover:bg-ink-800/60 hover:text-white"
                }`}
              >
                {section.label}
                <span
                  className={`mt-0.5 block text-[11px] ${
                    active ? "text-ink-300" : "text-ink-500"
                  }`}
                >
                  {section.note}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="serial border-t border-ink-800 px-6 py-4 text-[11px] text-ink-500">
        Local network only
      </p>
    </nav>
  );
}
