"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The whole product, listed honestly.
 *
 * Sections that do not exist yet are shown but not linked. Hiding them would make
 * the shell lie about what this tool is; making them clickable would make it lie
 * about what it does. Dimmed and inert says both true things at once.
 */
const SECTIONS = [
  { href: "/visitors", label: "Visitors", note: "Register and print" },
  { href: null, label: "Badges", note: "Print queue" },
  { href: null, label: "Devices", note: "Pairing codes" },
  { href: null, label: "Reports", note: "Entrance log" },
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
          const active = section.href !== null && pathname.startsWith(section.href);

          if (section.href === null) {
            return (
              <li key={section.label}>
                <span
                  aria-disabled="true"
                  title="Not built yet"
                  className="block cursor-default rounded-md px-3 py-2.5 text-sm text-ink-700"
                >
                  {section.label}
                  <span className="mt-0.5 block text-[11px] text-ink-800">
                    {section.note}
                  </span>
                </span>
              </li>
            );
          }

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
