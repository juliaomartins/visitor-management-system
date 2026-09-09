import type { Messages } from "./en";

/**
 * Tetun Dili, in the INL orthography.
 *
 * Portuguese loanwords are spelled the way Tetun spells them, not the way
 * Portuguese does: "akreditasaun" not "acreditação", "relatóriu" not
 * "relatório", "ekrán" not "ecrã". Getting this wrong is the usual way a
 * Tetun interface reads as Portuguese with the accents knocked off.
 *
 * Nouns are not inflected for number. "sira" marks a plural only where the
 * count is the point — a nav label that names a section stays singular, and
 * "Vizitante sira" appears where the screen is a list of people rather than a
 * destination.
 *
 * WORTH A NATIVE READ. These are careful, but Tetun has real regional
 * variation and this is the one language here that the event's own staff can
 * check faster than any dictionary.
 */
export const tet: Messages = {
  // ---------------------------------------------------------------- shell --
  "nav.sections": "Seksaun sira",
  "nav.group.overview": "Vizaun jerál",
  "nav.group.accreditation": "Akreditasaun",
  "nav.group.operations": "Operasaun",
  "nav.dashboard": "Painél",
  "nav.dashboard.hint": "Xegada no estadu odamatan",
  "nav.visitors": "Vizitante sira",
  "nav.visitors.hint": "Rejistu no fó sai kartaun",
  "nav.badges": "Kartaun",
  "nav.badges.hint": "Fila ba impresaun",
  "nav.devices": "Aparellu sira",
  "nav.devices.hint": "Odamatan no ekrán",
  "nav.reports": "Relatóriu",
  "nav.reports.hint": "Rejistu tama",
  "nav.expand": "Loke menu",
  "nav.collapse": "Taka menu",
  "nav.signOut": "Sai",
  "nav.signingOut": "Sai hela…",
  "nav.silentDevices": "Aparellu {count} seidauk komunika",

  "shell.restoringSession": "Restaura sesaun hela",
  "topbar.localTime": "Oras lokál",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Troka ba modu nakukun",
  "theme.toLight": "Troka ba modu naroman",
  "theme.dark": "Nakukun",
  "theme.light": "Naroman",

  "language.label": "Lian",
  "language.choose": "Hili lian",
};
