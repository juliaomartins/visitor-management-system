/**
 * Every word the lobby wall says, in English, and the formats it says numbers in.
 *
 * THE WALL IS NOT TRANSLATED, AND THAT IS THE POINT OF THIS FILE.
 *
 * It used to be. The screen carried the same three dictionaries as the dashboard
 * and the scanner, with a language switcher in the corner of the display. The
 * switcher is now on the pairing screen only, and the wall itself is English —
 * so the wall's strings live here as plain constants rather than as keys in a
 * dictionary, and `lib/locales/` carries only what `/pair` actually translates.
 *
 * A key in a translated dictionary is a promise that the string is translated.
 * Leaving "Welcome" in `tet.ts` after the wall stopped reading it would have
 * kept that promise on file and broken it in the room, which is the single most
 * expensive kind of wrong thing this repository can hold.
 *
 * There is no hook and no context here. A component that needs a word imports
 * it. `useT()` still exists for `/pair`, and nothing on the wall should call it.
 *
 * @see lib/locales/index.ts for the fifteen keys that ARE translated.
 */

/**
 * The wall's words.
 *
 * Grouped the way the screen is, not the way a dictionary is — this is the one
 * place to read or change the wording, so it should read like the panel.
 */
export const WALL = {
  /** The arrival card. */
  greeting: "Welcome",
  statusVip: "VIP Visitor",
  statusVisitor: "Visitor",

  /** The seal that rings the photograph. */
  admitted: "Admitted",
  guest: "Guest",

  /** Between arrival waves. */
  waiting: "Waiting for arrivals",

  /** The queue beside the hero. */
  next: "Next",

  /** The connection dot, read by staff and by a screen reader. */
  feedConnected: "Arrival feed connected",
  feedDisconnected: "Arrival feed disconnected",

  /** The two seals in the header. */
  organisers: "Organisers",

  /** The theme control. The registration desk chooses; the OS does not. */
  toDark: "Switch the display to dark mode",
  toLight: "Switch the display to light mode",

  /** The document itself. */
  title: "DRCC 2026 — Arrivals",
  description:
    "Díli Regional Cooperative Conference and Ministerial Dialogue 2026 — lobby arrivals display.",
} as const;

/*
  en-GB, NOT THE HOST MACHINE, AND NOT PLAIN "en".

  `IdleScreen` used to render the clock and the date with `toLocaleTimeString([])`
  and `toLocaleDateString([])`. An empty locale list means "whatever this machine
  was installed as", so a kiosk imaged in the United States put "September 11" and
  a 12-hour clock on a wall in Dili. That was a real bug, and it survived a whole
  pass that added an i18n formatter precisely to fix it, because the component
  never adopted it.

  Naming the locale here closes that for good. `en-GB` rather than `en` because
  bare `en` resolves to US conventions in every browser that matters: mm/dd and
  a 12-hour clock. Timor-Leste writes dd/mm and reads a 24-hour clock, and that
  is true of the wall whatever language the words on it are in.
*/
const LOCALE = "en-GB";

/** Built once. `Intl` constructors are expensive and the clock ticks every second. */
const TIME = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const ORDINAL_RULES = new Intl.PluralRules(LOCALE, { type: "ordinal" });
const ORDINAL_SUFFIX: Record<string, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
};

export const wallFormat = {
  /** "14:32". Always 24-hour. */
  time: (value: Date) => TIME.format(value),

  /** "Friday 2 October". */
  date: (value: Date) => DATE.format(value),

  /**
   * "1st", "2nd", "3rd" — a queue position.
   *
   * `Intl.PluralRules` rather than a hand-written st/nd/rd/th table. The table
   * is four lines and gets 11th, 12th and 13th wrong unless somebody remembers
   * to special-case them; the rules object knows.
   */
  ordinal: (n: number) => `${n}${ORDINAL_SUFFIX[ORDINAL_RULES.select(n)] ?? "th"}`,
};
