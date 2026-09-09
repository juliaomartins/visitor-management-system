/**
 * English - the source of truth for the lobby screen's messages.
 *
 * A MUCH SMALLER SET THAN THE DASHBOARD'S, and deliberately so. This panel has
 * almost no words on it: a greeting, a status, a clock and the two setup screens
 * nobody sees after the first morning. Everything else on the wall is a name, a
 * country and a photograph, which need no translation.
 *
 * `pt.ts` and `tet.ts` are typed as `Messages`, so omitting a key is a compile
 * error rather than an English word appearing on a wall in front of delegates.
 *
 * Non-ASCII is written as \uXXXX escapes and these files are generated - see
 * the dashboard's `lib/locales/en.ts` for the incident that made that a rule.
 */
export const en = {

  // ------------------------------------------------------------ the wall --
  "welcome.greeting": "Welcome",
  "welcome.statusVip": "VIP Visitor",
  "welcome.statusVisitor": "Visitor",
  "welcome.admitted": "Admitted",
  "welcome.guest": "Guest",
  "idle.waiting": "Waiting for arrivals",
  "queue.next": "Next",
  "feed.connected": "Arrival feed connected",
  "feed.disconnected": "Arrival feed disconnected",
  "brand.organisers": "Organisers",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Switch the display to dark mode",
  "theme.toLight": "Switch the display to light mode",
  "language.label": "Language",
  "language.choose": "Choose a language",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Pair this display",
  "pair.body": "Enter the screen pairing code from the dashboard.",
  "pair.codeLabel": "Six character pairing code",
  "pair.pairing": "Pairing\u2026",
  "pair.submit": "Pair display",
  "pair.finding": "Finding the server\u2026",
  "pair.noServer": "No server found",
  "pair.unreachable":
    "Could not reach the server. Check this machine is on the event network.",

  // -------------------------------------------------------- server setup --
  "server.address": "Server address",
  "server.hint":
    "A bare IP is fine \u2014 {http} and the port are filled in for you.",
  "server.badAddress":
    "That does not look like an address. Try 10.101.196.41:8000",
  "server.checking": "Checking\u2026",
  "server.connect": "Connect",

  // ------------------------------------------------------------ document --
  "meta.title": "DRCC 2026 \u2014 Arrivals",
  "meta.description":
    "D\u00edli Regional Cooperative Conference and Ministerial Dialogue 2026 \u2014 lobby arrivals display.",
} as const;

/** Every message key on the lobby screen. */
export type MessageKey = keyof typeof en;

/** The shape a translation has to satisfy. */
export type Messages = Record<MessageKey, string>;
