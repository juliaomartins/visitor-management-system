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

  // ------------------------------------------------------ visitor detail --
  "common.loading": "Karga hela\u2026",
  "visitor.fallbackTitle": "Vizitante",
  "visitor.notFound": "La bele karga vizitante ne\u2019e",
  "visitor.notFoundBody": "Karik hasai tiha ona. Haree lista vizitante.",
  "visitor.backToAll": "Fila ba vizitante hotu",
  "visitor.allVisitors": "Vizitante hotu",
  "visitor.status.active": "Ativu",
  "visitor.headingActive": "Kartaun ne\u2019e loke odamatan",
  "visitor.headingOff": "Kartaun ne\u2019e desliga ona",
  "visitor.subActive":
    "Leit\u00f3r ne\u2019eb\u00e9 pareia ona sei simu, no ekr\u00e1n resepsaun sei f\u00f3 benvindu.",
  "visitor.subOff":
    "Leitura tuirmai sei mosu mean. Ativa f\u00f3 fila kartaun hanesan ba servisu \u2014 la presiza imprime fali.",
  "visitor.registered": "Rejista",
  "visitor.arrivals": "Xegada",
  "visitor.lastArrival": "Xegada ikus",
  "visitor.notYet": "Seidauk",
  "visitor.scansLogged": "Leitura rejistadu",
  "visitor.activating": "Ativa hela\u2026",
  "visitor.qrNote":
    "QR ne\u2019e kria bainhira rejista vizitante no nunka muda. Imprime fali kartaun dala hira mak presiza \u2014 nia lee hanesan beibeik. Dezativa para nia, no ativa hah\u00fa fali, rua ne\u2019e la book k\u00f3digu iha kartaun. Hasai permanente mak buat ida deit iha ne\u2019e ne\u2019eb\u00e9 la bele fila fali.",
  "visitor.scanHistory": "Ist\u00f3ria leitura",
  "visitor.scanHistoryBody":
    "Dala hotu kartaun ne\u2019e aprezenta, inklui dala ne\u2019eb\u00e9 rejeita.",
  "visitor.noScans": "Kartaun ne\u2019e seidauk lee.",
  "visitor.col.event": "Eventu",
  "visitor.col.scannedAt": "Lee iha",
  "visitor.col.result": "Rezultadu",
  "visitor.col.device": "Aparellu",
  "scan.valid": "V\u00e1lidu",
  "scan.duplicate": "Duplikadu",
  "scan.revoked": "Revogadu",
  "scan.invalid": "Inv\u00e1lidu",

  // --------------------------------------------------- registration form --
  "register.title": "Rejista vizitante ida",
  "register.subtitle": "Kartaun ida, imprime uluk, v\u00e1lidu ba eventu tomak",
  "register.issuedTitle": "Kartaun f\u00f3 sai ona",
  "register.issuedSubtitle":
    "Imprime kartaun agora, ka depois husi vizitante nia p\u00e1jina",
  "form.photoRequired": "Kartaun presiza foto. Tau ida molok rejista.",
  "form.fullName": "Naran kompletu",
  "form.fullNameHint": "Hanesan ne\u2019eb\u00e9 tenke mosu iha kartaun.",
  "form.country": "Nasaun",
  "form.organisation": "Organizasaun",
  "form.optional": "Opsion\u00e1l.",
  "form.category": "Kategoria",
  "form.cat.normal": "Norm\u00e1l",
  "form.cat.normalNote": "Kartaun norm\u00e1l",
  "form.cat.vip": "VIP",
  "form.cat.vipNote": "Kartaun espesi\u00e1l no benvindu iha resepsaun",
  "form.registering": "Rejista hela\u2026",
  "form.saving": "Rai hela\u2026",
  "form.register": "Rejista no f\u00f3 sai kartaun",
  "form.save": "Rai mudansa",
  "form.noteCreate":
    "N\u00fameru f\u00f3 bainhira rejista. QR kria iha momentu hanesan no nunka muda depois.",
  "form.noteEdit":
    "Edita dadus la f\u00f3 sai kartaun foun. N\u00fameru no k\u00f3digu QR sei hanesan ho ne\u2019eb\u00e9 imprime ona.",

  // ------------------------------------------------------- badge receipt --
  "receipt.badgeIssued": "Kartaun f\u00f3 sai ona",
  "receipt.registered": "{name} rejista ona",
  "receipt.permanent":
    "QR ne\u2019e permanente. Nia kria bainhira rejista {name} no sei la muda \u2014 imprime agora, ka depois husi nia p\u00e1jina, dala hira mak presiza. Nia para funsiona deit se dezativa ka hasai vizitante.",
  "receipt.qrAlt": "K\u00f3digu QR ba kartaun {serial}",
  "receipt.badgeToken": "Token kartaun",
  "receipt.rendering": "Kria hela\u2026",
  "receipt.downloadPdf": "Deskarrega PDF kartaun",
  "receipt.printBrowser": "Imprime husi navegad\u00f3r",
  "receipt.copied": "Kopia ona",
  "receipt.copyToken": "Kopia token",
  "receipt.qrFailed":
    "La bele dezenha k\u00f3digu QR. Kopia token no imprime kartaun iha makina seluk, duke f\u00f3 sai kartaun laiha k\u00f3digu.",
  "receipt.copiedAnnounce":
    "Token kartaun kopia ba \u00e1rea transfer\u00e9nsia.",
  "receipt.badgeSerial": "N\u00fameru kartaun",
  "receipt.registerAnother": "Rejista vizitante seluk",
  "receipt.open": "Loke {name}",
  "receipt.renderFailed": "La bele kria kartaun.",

  // ---------------------------------------------------------------- edit --
  "edit.title": "Edita {name}",
  "edit.fallbackTitle": "Edita vizitante",
};
