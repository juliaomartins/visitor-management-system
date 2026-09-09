/**
 * English — the source of truth for every message in the dashboard.
 *
 * THIS FILE DEFINES THE KEY SET. `pt.ts` and `tet.ts` are typed as
 * `Messages`, so leaving a key out of either one is a TypeScript error rather
 * than a screen that silently falls back to English in front of a delegate.
 * Adding a message means adding it here first; the compiler then tells you
 * exactly what is missing in the other two.
 *
 * Keys are namespaced by where they appear, not by what they say, because the
 * question being asked of this file is always "what does this screen need"
 * rather than "where else is this word used". Two screens that happen to share
 * a word still get their own key: `visitors.empty` and `badges.empty` read the
 * same in English and diverge in Tetum, where the noun changes the verb.
 *
 * `{name}` placeholders are filled by `t(key, { name })` — see `lib/i18n.tsx`.
 */
export const en = {
  // ---------------------------------------------------------------- shell --
  "nav.sections": "Sections",
  "nav.group.overview": "Overview",
  "nav.group.accreditation": "Accreditation",
  "nav.group.operations": "Operations",
  "nav.dashboard": "Dashboard",
  "nav.dashboard.hint": "Arrivals and door health",
  "nav.visitors": "Visitors",
  "nav.visitors.hint": "Register and issue badges",
  "nav.badges": "Badges",
  "nav.badges.hint": "Print queue",
  "nav.devices": "Devices",
  "nav.devices.hint": "Doors and screens",
  "nav.reports": "Reports",
  "nav.reports.hint": "Entrance log",
  "nav.expand": "Expand menu",
  "nav.collapse": "Collapse menu",
  "nav.signOut": "Sign out",
  "nav.signingOut": "Signing out…",
  "nav.silentDevices": "{count} device not checked in recently",

  "shell.restoringSession": "Restoring session",
  "topbar.localTime": "Local time",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Switch to dark mode",
  "theme.toLight": "Switch to light mode",
  "theme.dark": "Dark",
  "theme.light": "Light",

  "language.label": "Language",
  "language.choose": "Choose a language",
} as const;

/** Every message key in the dashboard. */
export type MessageKey = keyof typeof en;

/**
 * The shape a translation has to satisfy.
 *
 * `Record<MessageKey, string>` rather than `typeof en`: the English values are
 * literal types, and a translation must be free to say something different
 * while still covering every key.
 */
export type Messages = Record<MessageKey, string>;
