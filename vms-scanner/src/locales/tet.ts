import type { Messages } from "./en";

/**
 * Tetun Dili, INL orthography.
 *
 * THE LANGUAGE MOST GUARDS ON THIS DOOR ACTUALLY READ. The three verdicts
 * matter more here than anywhere else in the system - they are read in a
 * doorway, in a hurry, next to the person they are about - so they are kept to
 * one or two words. Worth a native check before the event.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const tet: Messages = {

  // ------------------------------------------------------------ verdicts --
  "verdict.valid.headline": "Benvindu",
  "verdict.valid.detail": "Kartaun v\u00e1lidu",
  "verdict.invalid.headline": "Kartaun la v\u00e1lidu",
  "verdict.invalid.detail":
    "K\u00f3digu QR ne\u2019e la\u2019\u00f3s husi eventu ne\u2019e",
  "verdict.revoked.headline": "Kartaun revogadu",
  "verdict.revoked.detail": "Labele tama. Haruka ba meza rejistu",
  "verdict.duplicate.headline": "Lee tiha ona",
  "verdict.duplicate.detail": "Kartaun hanesan iha minutu ikus",
  "verdict.tapContinue": "Hanehan atu kontinua",
  "verdict.tapNext": "Hanehan atu lee kartaun tuirmai",
  "verdict.badgePhoto": "{name} nia foto kartaun",
  "verdict.queued": "Iha fila, seidauk verifika. {name}. Hanehan atu kontinua.",
  "verdict.unknownBadge": "Kartaun la hatene",

  // -------------------------------------------------------------- camera --
  "camera.hint": "Tau kartaun nia QR iha kuadru laran",
  "camera.checking": "Verifika hela\u2026",
  "camera.off": "K\u00e1mara desliga ona",
  "camera.why":
    "Aplikasaun ne\u2019e lee kartaun nia k\u00f3digu QR deit no la halo buat seluk ho k\u00e1mara. La foti foto no la rai buat ida iha telem\u00f3vel.",
  "camera.allow": "F\u00f3 lisensa ba k\u00e1mara",
  "camera.openSettings": "Loke konfigurasaun atu f\u00f3 lisensa",
  "camera.torchOn": "Lampu lakan",
  "camera.torch": "Lampu",
  "camera.turnTorchOn": "Lakan lampu",
  "camera.turnTorchOff": "Desliga lampu",
  "camera.fallbackName": "Leit\u00f3r",
  "camera.unpairA11y": "Hasai pareia husi telem\u00f3vel ne\u2019e",

  // --------------------------------------------------------------- queue --
  "queue.syncingOne": "Sinkroniza hela. Leitura {count} seidauk haruka.",
  "queue.syncingMany": "Sinkroniza hela. Leitura {count} seidauk haruka.",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Pareia telem\u00f3vel ne\u2019e",
  "pair.body": "Tau k\u00f3digu pareia leit\u00f3r husi pain\u00e9l.",
  "pair.codeLabel": "K\u00f3digu pareia ho karakter neen",
  "pair.nameLabel": "F\u00f3 naran ba telem\u00f3vel ne\u2019e",
  "pair.namePlaceholder": "Odamatan norte",
  "pair.nameA11y": "Aparellu naran",
  "pair.failed": "Pareia falla. Koko fali.",
  "pair.noStorage":
    "Navegad\u00f3r ne\u2019e la rai buat ida, tan ne\u2019e la bele rai token. Sai husi navegasaun privada, ka uza leit\u00f3r iha telem\u00f3vel.",
  "pair.browserStorage":
    "Navegad\u00f3r ne\u2019e laiha kofre seguru, tan ne\u2019e token rai iha armazenamentu baibain. Di\u2019ak ba postu ne\u2019eb\u00e9 ita kontrola \u2014 revoga aparellu ne\u2019e iha pain\u00e9l bainhira eventu remata.",
  "pair.finding": "Buka servid\u00f3r hela\u2026",
  "pair.noServer": "La hetan servid\u00f3r",

  // -------------------------------------------------------------- unpair --
  "unpair.title": "Hasai pareia husi telem\u00f3vel ne\u2019e?",
  "unpair.body":
    "Nia la bele rejista leitura ona to\u2019o pareia fali ho k\u00f3digu foun. Se telem\u00f3vel lakon, revoga m\u00f3s husi pain\u00e9l.",
  "unpair.keep": "Rai pareia nafatin",
  "unpair.confirm": "Hasai pareia",

  // -------------------------------------------------------------- server --
  "server.whereIsIt": "Servid\u00f3r iha ne\u2019eb\u00e9?",
  "server.cannotReach": "LA BELE KONTAKTU SERVID\u00d3R",
  "server.alreadyTried": "Koko tiha ona",
  "server.address": "Enderesu servid\u00f3r",
  "server.addressA11y": "Servid\u00f3r nia enderesu IP no porta",
  "server.ipLabel": "Enderesu IP ka naran host",
  "server.portLabel": "Porta",
  "server.ipA11y": "Servid\u00f3r nia enderesu IP ka naran host",
  "server.portA11y": "Servid\u00f3r nia porta",
  "server.hint":
    "Husu enderesu IP ba makina ne\u2019eb\u00e9 la\u2019o servid\u00f3r, ka hala\u2019o {cmd} iha nia.",
  "server.test": "Testa ligasaun",
  "server.save": "Rai enderesu",
  "server.useBuiltIn": "Uza fali enderesu ne\u2019eb\u00e9 iha ona",
  "server.cancel": "Kansela",
  "server.connect": "Konekta",
  "server.searching": "Buka hela\u2026",
  "server.retrySaved": "Koko fali enderesu ne\u2019eb\u00e9 rai ona",
  "server.settingsA11y": "Konfigurasaun enderesu servid\u00f3r",
  "server.checking": "Verifika hela",
  "server.online": "Konekta",
  "server.offline": "La konekta",

  // ------------------------------------------------------- server errors --
  "server.badAddress":
    "Ne\u2019e la hanesan enderesu. Koko hanesan 192.168.0.63.",
  "server.timeout":
    "Laiha resposta iha segundu lima. Verifika se telem\u00f3vel ne\u2019e ho servid\u00f3r iha Wi-Fi hanesan.",
  "server.refused":
    "Laiha buat ida rona iha ne\u2019eb\u00e1. Verifika enderesu, no se servid\u00f3r la\u2019o hela.",
  "server.notVms":
    "Buat ida hat\u00e1n, maib\u00e9 la\u2019\u00f3s servid\u00f3r VMS (HTTP {status}). Verifika porta.",
  "server.nothingAnswered":
    "Laiha buat ida hat\u00e1n iha ne\u2019eb\u00e1. Verifika enderesu, no se servid\u00f3r lakan no iha rede ne\u2019e.",
  "settings.hint":
    "Hatudu telem\u00f3vel ne\u2019e ba servid\u00f3r. Husu enderesu IP ba ema ne\u2019eb\u00e9 prepara laptop, ka hala\u2019o {cmd} iha nia.",
  "settings.testFirst": "Testa enderesu molok rai.",
  "settings.connected": "Konekta ona. Ne\u2019e mak servid\u00f3r VMS.",
  "settings.reports": "Nia hato\u2019o {ip}.",
  "setup.hint":
    "Husu enderesu IP ba ema ne\u2019eb\u00e9 prepara laptop, ka hala\u2019o {cmd} iha nia. Porta baibain 8000.",

  // ------------------------------------------------------------ language --
  "language.label": "Lian",
};
