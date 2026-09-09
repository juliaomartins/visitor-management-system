import type { Messages } from "./en";

/**
 * Tetun Dili, INL orthography.
 *
 * The greeting is the one word on this panel a visitor actually reads, and
 * "Benvindu" is what a Timorese lobby says. Worth a native check all the same.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const tet: Messages = {

  // ------------------------------------------------------------ the wall --
  "welcome.greeting": "Benvindu",
  "welcome.statusVip": "Vizitante VIP",
  "welcome.statusVisitor": "Vizitante",
  "welcome.admitted": "Simu ona",
  "welcome.guest": "Konvidadu",
  "idle.waiting": "Hein xegada",
  "queue.next": "Tuirmai",
  "feed.connected": "Konekta ba fluxu xegada",
  "feed.disconnected": "La konekta ba fluxu xegada",
  "brand.organisers": "Organizad\u00f3r sira",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Troka ekr\u00e1n ba modu nakukun",
  "theme.toLight": "Troka ekr\u00e1n ba modu naroman",
  "language.label": "Lian",
  "language.choose": "Hili lian",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Pareia ekr\u00e1n ne\u2019e",
  "pair.body": "Tau k\u00f3digu pareia ekr\u00e1n husi pain\u00e9l.",
  "pair.codeLabel": "K\u00f3digu pareia ho karakter neen",
  "pair.pairing": "Pareia hela\u2026",
  "pair.submit": "Pareia ekr\u00e1n",
  "pair.finding": "Buka servid\u00f3r hela\u2026",
  "pair.noServer": "La hetan servid\u00f3r",
  "pair.unreachable":
    "La bele kontaktu servid\u00f3r. Verifika se makina ne\u2019e iha rede eventu.",

  // -------------------------------------------------------- server setup --
  "server.address": "Enderesu servid\u00f3r",
  "server.hint":
    "IP mesak deit di\u2019ak ona \u2014 {http} no porta prenxe ba ita.",
  "server.badAddress": "Ne\u2019e la hanesan enderesu. Koko 10.101.196.41:8000",
  "server.checking": "Verifika hela\u2026",
  "server.connect": "Konekta",

  // ------------------------------------------------------------ document --
  "meta.title": "DRCC 2026 \u2014 Xegada",
  "meta.description":
    "Konfer\u00e9nsia Rejion\u00e1l Kooperativa D\u00edli no Di\u00e1logu Ministeri\u00e1l 2026 \u2014 ekr\u00e1n xegada iha resepsaun.",
};
