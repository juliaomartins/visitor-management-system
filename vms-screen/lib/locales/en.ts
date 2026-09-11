/**
 * English - the source of truth for the pairing screen's messages.
 *
 * SETUP ONLY. The lobby wall is English and its words are plain constants in
 * `lib/wall-copy.ts`; everything here is read by an installer standing at the
 * kiosk on the first morning and by nobody after that. That is why the set is
 * small and why it is worth translating: somebody who has landed in a language
 * they cannot read needs a way out, and this is the screen they are on.
 *
 * `pt.ts` and `tet.ts` are typed as `Messages`, so omitting a key is a compile
 * error rather than an English word appearing mid-setup.
 *
 * Non-ASCII is written as \uXXXX escapes and these files are generated - see
 * the dashboard's `lib/locales/en.ts` for the incident that made that a rule.
 */
export const en = {

  // ------------------------------------------------ the language control --
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
} as const;

/** Every message key on the pairing screen. */
export type MessageKey = keyof typeof en;

/** The shape a translation has to satisfy. */
export type Messages = Record<MessageKey, string>;
