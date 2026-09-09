import type { Messages } from "./en";

/**
 * Tetun Dili, in the INL orthography.
 *
 * Portuguese loanwords are spelled the way Tetun spells them, not the way
 * Portuguese does: "akreditasaun" not "acreditacao", "relatoriu" not
 * "relatorio", "ekran" not "ecra". Getting this wrong is the usual way a Tetun
 * interface ends up reading as Portuguese with the accents knocked off.
 *
 * Nouns are not inflected for number. "sira" marks a plural only where the
 * count is the point, so a nav label naming a destination stays singular while
 * a list of people does not.
 *
 * WORTH A NATIVE READ. These are careful, but Tetun has real regional variation
 * and the event's own staff can check them faster than any dictionary.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const tet: Messages = {

  // --------------------------------------------------------------- shell --
  "nav.sections": "Seksaun sira",
  "nav.group.overview": "Vizaun jer\u00e1l",
  "nav.group.accreditation": "Akreditasaun",
  "nav.group.operations": "Operasaun",
  "nav.dashboard": "Pain\u00e9l",
  "nav.dashboard.hint": "Xegada no estadu odamatan",
  "nav.visitors": "Vizitante sira",
  "nav.visitors.hint": "Rejistu no f\u00f3 sai kartaun",
  "nav.badges": "Kartaun",
  "nav.badges.hint": "Fila ba impresaun",
  "nav.devices": "Aparellu sira",
  "nav.devices.hint": "Odamatan no ekr\u00e1n",
  "nav.reports": "Relat\u00f3riu",
  "nav.reports.hint": "Rejistu tama",
  "nav.expand": "Loke menu",
  "nav.collapse": "Taka menu",
  "nav.signOut": "Sai",
  "nav.signingOut": "Sai hela\u2026",
  "nav.silentDevices": "Aparellu {count} seidauk komunika",
  "shell.restoringSession": "Restaura sesaun hela",
  "topbar.localTime": "Oras lok\u00e1l",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Troka ba modu nakukun",
  "theme.toLight": "Troka ba modu naroman",
  "theme.dark": "Nakukun",
  "theme.light": "Naroman",
  "language.label": "Lian",
  "language.choose": "Hili lian",

  // --------------------------------------------------------------- login --
  "login.title": "Tama",
  "login.intro":
    "Konta administrad\u00f3r deit. Seguransa sira uza telem\u00f3vel ne\u2019eb\u00e9 pareia ona, no ekr\u00e1n resepsaun pareia an rasik.",
  "login.username": "Naran uzu\u00e1riu",
  "login.password": "Liafuan-xave",
  "login.submit": "Tama",
  "login.submitting": "Tama hela\u2026",
  "login.badCredentials": "Naran uzu\u00e1riu ho liafuan-xave la hanesan.",
  "login.failedStatus": "La konsege tama (HTTP {status}).",
  "login.unreachable":
    "La bele kontaktu servid\u00f3r. Verifika se backend la\u2019o hela.",
  "login.servingFrom": "Husi",
  "login.pitch":
    "Rejista vizitante, imprime nia kartaun, no haree xegada hotu iha fatin ida \u2014 iha ita-nia rede rasik, laiha buat ida sai husi edif\u00edsiu.",

  // -------------------------------------------------------------- errors --
  "error.unexpected": "Iha erru ida.",
  "error.fields": "Iha kampu balu presiza hadia.",
  "error.visitorLoad": "La bele karga vizitante ne\u2019e.",
  "error.visitorRegister": "La bele rejista vizitante ne\u2019e.",
  "error.visitorSave": "La bele rai mudansa sira.",
  "error.visitorActivate": "La bele ativa vizitante ne\u2019e.",
  "error.visitorDeactivate": "La bele dezativa vizitante ne\u2019e.",
  "error.visitorDelete": "La bele hasai vizitante ne\u2019e.",

  // -------------------------------------------------------- visitor list --
  "visitors.title": "Vizitante sira",
  "visitors.subtitle": "Ema hotu ne\u2019eb\u00e9 rejista ba eventu",
  "visitors.search": "Buka vizitante",
  "visitors.searchPlaceholder":
    "Naran, organizasaun, nasaun ka n\u00fameru kartaun",
  "visitors.filterCategory": "Filtra tuir kategoria",
  "visitors.tab.all": "Hotu",
  "visitors.tab.normal": "Norm\u00e1l",
  "visitors.tab.vip": "VIP",
  "visitors.exportTitle":
    "Folha k\u00e1lkulu ho ema hotu ne\u2019eb\u00e9 rejista. La f\u00f3 sai kartaun foun.",
  "visitors.exporting": "Esporta hela\u2026",
  "visitors.export": "Esporta .xlsx",
  "visitors.exportFailed": "La bele esporta lista.",
  "visitors.register": "Rejista vizitante",
  "visitors.refreshing": "Atualiza hela\u2026",
  "visitors.loadFailed": "La bele karga vizitante sira",
  "visitors.requestFailed": "Pedidu falla molok to\u2019o servid\u00f3r.",
  "visitors.serverRejected": "Servid\u00f3r rejeita pedidu ne\u2019e.",
  "visitors.noneMatch": "Laiha ema ida tuir filtru sira ne\u2019e",
  "visitors.noneMatchBody":
    "Koko buka ho liafuan badak liu, ka loke kategoria.",
  "visitors.empty": "Seidauk iha vizitante",
  "visitors.emptyBody": "Rejista vizitante primeiru atu f\u00f3 sai kartaun.",
  "visitors.menu.edit": "Edita dadus",
  "visitors.menu.deactivate": "Dezativa vizitante",
  "visitors.menu.activate": "Ativa vizitante",
  "visitors.menu.delete": "Hasai permanente",
  "visitors.status.deactivated": "Dezativadu",

  // --------------------------------------------------- deactivate dialog --
  "deactivate.title": "Dezativa {name}?",
  "deactivate.body":
    "Kartaun {serial} para funsiona kedas. Leitura tuirmai sei mosu mean iha odamatan.",
  "deactivate.point1":
    "Sira sei hela iha lista vizitante, ho marka dezativadu.",
  "deactivate.point2": "Ist\u00f3ria leitura sei rai nafatin.",
  "deactivate.point3":
    "Bele fila fali. Ativa f\u00f3 fila kartaun ne\u2019eb\u00e9 imprime ona ba servisu \u2014 laiha buat atu imprime fali.",
  "deactivate.cancel": "Rai ativu nafatin",
  "deactivate.confirm": "Dezativa",
  "deactivate.pending": "Dezativa hela\u2026",

  // -------------------------------------------------------- purge dialog --
  "purge.warning": "La bele fila fali",
  "purge.title": "Hasai {name} permanente?",
  "purge.body":
    "Ne\u2019e hasai rejistu no vizitante nia foto husi servid\u00f3r. Dezativa mak opsaun ne\u2019eb\u00e9 bele fila fali; ida ne\u2019e lae.",
  "purge.scansUnknown":
    "Leitura kartaun ne\u2019e nian sei hela iha rejistu tama, maib\u00e9 la naran ema ida ona.",
  "purge.scansNone":
    "Laiha leitura ida afetadu \u2014 kartaun ne\u2019e seidauk aprezenta.",
  "purge.scansOne":
    "Leitura {count} sei hela iha rejistu tama, maib\u00e9 la naran ema ida ona.",
  "purge.scansMany":
    "Leitura {count} sei hela iha rejistu tama, maib\u00e9 la naran ema ida ona.",
  "purge.serialRetired":
    "Kartaun {serial} hasai ona. N\u00fameru ne\u2019e la uza fali.",
  "purge.reRegister":
    "Rejista fila sira sei kria vizitante foun, n\u00fameru foun no QR foun.",
  "purge.typeToConfirm": "Hakerek {serial} atu konfirma",
  "purge.cancel": "Kansela",
  "purge.confirm": "Hasai permanente",
  "purge.pending": "Hasai hela\u2026",
};
