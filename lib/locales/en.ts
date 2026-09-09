/**
 * English - the source of truth for every message in the dashboard.
 *
 * THIS FILE DEFINES THE KEY SET. `pt.ts` and `tet.ts` are typed as `Messages`,
 * so leaving a key out of either one is a TypeScript error rather than a screen
 * that silently falls back to English in front of a delegate. Adding a message
 * means adding it here first; the compiler then names what is missing.
 *
 * Keys are namespaced by where they appear, not by what they say. Two screens
 * that share a word in English still get their own key, because they can
 * diverge in Tetun, where the noun governs the verb.
 *
 * NON-ASCII IS WRITTEN AS \uXXXX ESCAPES ON PURPOSE, and these files are
 * generated rather than hand-edited. The first version of them was written
 * through a shell heredoc on Windows and came back with "\u00e7\u00f5" turned
 * to mojibake -- invisible in a diff until it reaches a delegate. An ASCII file
 * cannot be transcoded by anything in the chain.
 *
 * `{name}` placeholders are filled by `t(key, { name })` - see `lib/i18n.tsx`.
 */
export const en = {

  // --------------------------------------------------------------- shell --
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
  "nav.signingOut": "Signing out\u2026",
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

  // --------------------------------------------------------------- login --
  "login.title": "Sign in",
  "login.intro":
    "Administrator accounts only. Guards use a paired phone, and the lobby screen pairs itself.",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in\u2026",
  "login.badCredentials": "That username and password did not match.",
  "login.failedStatus": "Sign-in failed (HTTP {status}).",
  "login.unreachable":
    "Could not reach the server. Check that the backend is running.",
  "login.servingFrom": "Serving from",
  "login.pitch":
    "Register a visitor, print their card, and watch every arrival land in one place \u2014 on your own network, with nothing leaving the building.",

  // -------------------------------------------------------------- errors --
  "error.unexpected": "Something went wrong.",
  "error.fields": "Some fields need attention.",
  "error.visitorLoad": "That visitor could not be loaded.",
  "error.visitorRegister": "The visitor could not be registered.",
  "error.visitorSave": "The changes could not be saved.",
  "error.visitorActivate": "The visitor could not be activated.",
  "error.visitorDeactivate": "The visitor could not be deactivated.",
  "error.visitorDelete": "The visitor could not be deleted.",
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
