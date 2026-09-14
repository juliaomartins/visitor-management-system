import type { Messages } from "./en";

/**
 * Tetun Dili, INL orthography.
 *
 * Setup words only, and they are the ones that matter most to get right: an
 * installer who cannot read the screen cannot finish. Worth a native check.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const tet: Messages = {

  // ------------------------------------------------ the language control --
  "language.label": "Lian",
  "language.choose": "Hili lian",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Pareia ekr\u00e1n ne\u2019e",
  "pair.body": "Tau k\u00f3digu pareia ekr\u00e1n husi pain\u00e9l.",
  "pair.codeLabel": "K\u00f3digu pareia ho karakter neen",
  "pair.pairing": "Pareia hela\u2026",
  "pair.submit": "Pareia ekr\u00e1n",
  "pair.nameLabel": "Naran ekr\u00e1n",
  "pair.nameHint":
    "Sujere husi browser ne\u2019e. Troka ba fatin ne\u2019eb\u00e9 ekr\u00e1n hamriik, ez. Entrada prinsip\u00e1l \u2014 ne\u2019e naran iha lista dispozitivu no rejistu servid\u00f3r.",
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
};
