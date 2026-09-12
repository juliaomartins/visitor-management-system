import type { Messages } from "./en";

/**
 * Portuguese - European, as Timor-Leste writes it.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const pt: Messages = {

  // ------------------------------------------------------------ verdicts --
  "verdict.valid.headline": "Bem-vindo",
  "verdict.valid.detail": "O crach\u00e1 \u00e9 v\u00e1lido",
  "verdict.invalid.headline": "Crach\u00e1 inv\u00e1lido",
  "verdict.invalid.detail": "Este c\u00f3digo QR n\u00e3o \u00e9 deste evento",
  "verdict.revoked.headline": "Crach\u00e1 revogado",
  "verdict.revoked.detail":
    "N\u00e3o admitir. Encaminhe para o balc\u00e3o de registo",
  "verdict.duplicate.headline": "J\u00e1 lido",
  "verdict.duplicate.detail": "O mesmo crach\u00e1 no \u00faltimo minuto",
  "verdict.tapContinue": "Toque para continuar",
  "verdict.tapNext": "Toque para ler o crach\u00e1 seguinte",
  "verdict.badgePhoto": "Fotografia do crach\u00e1 de {name}",
  "verdict.queued":
    "Em fila, n\u00e3o verificado. {name}. Toque para continuar.",
  "verdict.unknownBadge": "Crach\u00e1 desconhecido",

  // -------------------------------------------------------------- camera --
  "camera.hint": "Mantenha o QR do crach\u00e1 dentro do quadro",
  "camera.checking": "A verificar\u2026",
  "camera.off": "A c\u00e2mara est\u00e1 desligada",
  "camera.why":
    "Esta aplica\u00e7\u00e3o l\u00ea c\u00f3digos QR de crach\u00e1s e n\u00e3o faz mais nada com a c\u00e2mara. N\u00e3o tira fotografias nem guarda nada no telem\u00f3vel.",
  "camera.allow": "Permitir a c\u00e2mara",
  "camera.openSettings": "Abrir defini\u00e7\u00f5es para permitir",
  "camera.torchOn": "Lanterna ligada",
  "camera.torch": "Lanterna",
  "camera.turnTorchOn": "Ligar a lanterna",
  "camera.turnTorchOff": "Desligar a lanterna",
  "camera.fallbackName": "Leitor",
  "camera.unpairA11y": "Desemparelhar este telem\u00f3vel",

  // --------------------------------------------------------------- queue --
  "queue.syncingOne": "A sincronizar. {count} leitura ainda pendente.",
  "queue.syncingMany": "A sincronizar. {count} leituras ainda pendentes.",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Emparelhar este telem\u00f3vel",
  "pair.body":
    "Introduza o c\u00f3digo de emparelhamento do leitor, vindo do painel.",
  "pair.codeLabel": "C\u00f3digo de emparelhamento de seis caracteres",
  "pair.nameLabel": "D\u00ea um nome a este telem\u00f3vel",
  "pair.namePlaceholder": "Porta norte",
  "pair.nameA11y": "Nome do dispositivo",
  "pair.failed": "O emparelhamento falhou. Tente de novo.",
  "pair.noStorage":
    "Este navegador n\u00e3o guarda nada, por isso n\u00e3o \u00e9 poss\u00edvel guardar um token. Saia da navega\u00e7\u00e3o privada, ou use o leitor num telem\u00f3vel.",
  "pair.browserStorage":
    "Este navegador n\u00e3o tem um cofre seguro, por isso o token fica no armazenamento comum do navegador. Serve para um posto que controla \u2014 revogue este dispositivo no painel quando o evento terminar.",
  "pair.finding": "A procurar o servidor\u2026",
  "pair.noServer": "Nenhum servidor encontrado",

  // -------------------------------------------------------------- unpair --
  "unpair.title": "Desemparelhar este telem\u00f3vel?",
  "unpair.body":
    "Deixa de conseguir registar leituras at\u00e9 ser emparelhado de novo com um c\u00f3digo novo. Revogue-o tamb\u00e9m no painel se o telem\u00f3vel se perder.",
  "unpair.keep": "Manter emparelhado",
  "unpair.confirm": "Desemparelhar",

  // -------------------------------------------------------------- server --
  "server.whereIsIt": "Onde est\u00e1 o servidor?",
  "server.cannotReach": "N\u00c3O \u00c9 POSS\u00cdVEL CONTACTAR O SERVIDOR",
  "server.alreadyTried": "J\u00e1 tentados",
  "server.address": "Endere\u00e7o do servidor",
  "server.addressA11y": "Endere\u00e7o IP e porta do servidor",
  "server.ipLabel": "Endere\u00e7o IP ou nome do anfitri\u00e3o",
  "server.portLabel": "Porta",
  "server.ipA11y": "Endere\u00e7o IP ou nome do anfitri\u00e3o do servidor",
  "server.portA11y": "Porta do servidor",
  "server.hint":
    "Pe\u00e7a o endere\u00e7o IP \u00e0 m\u00e1quina que corre o servidor, ou execute {cmd} nela.",
  "server.test": "Testar liga\u00e7\u00e3o",
  "server.save": "Guardar endere\u00e7o",
  "server.useBuiltIn": "Voltar a usar o endere\u00e7o predefinido",
  "server.cancel": "Cancelar",
  "server.connect": "Ligar",
  "server.searching": "A procurar\u2026",
  "server.retrySaved": "Tentar de novo os endere\u00e7os guardados",
  "server.settingsA11y": "Defini\u00e7\u00f5es do endere\u00e7o do servidor",
  "server.checking": "A verificar",
  "server.online": "Ligado",
  "server.offline": "Desligado",

  // ------------------------------------------------------- server errors --
  "server.badAddress":
    "Isso n\u00e3o parece um endere\u00e7o. Experimente algo como 192.168.0.63.",
  "server.timeout":
    "Sem resposta em cinco segundos. Verifique se este telem\u00f3vel e o servidor est\u00e3o na mesma Wi-Fi.",
  "server.refused":
    "N\u00e3o h\u00e1 nada \u00e0 escuta nesse endere\u00e7o. Verifique o endere\u00e7o e se o servidor est\u00e1 a correr.",
  "server.notVms":
    "Algo respondeu, mas n\u00e3o \u00e9 o servidor VMS (HTTP {status}). Verifique a porta.",
  "server.nothingAnswered":
    "Nada respondeu nesse endere\u00e7o. Verifique o endere\u00e7o, e se o servidor est\u00e1 ligado e nesta rede.",
  "settings.hint":
    "Aponte este telem\u00f3vel ao servidor. Pe\u00e7a o endere\u00e7o IP a quem configurou o port\u00e1til, ou execute {cmd} nele.",
  "settings.testFirst": "Teste o endere\u00e7o antes de o guardar.",
  "settings.connected": "Ligado. Este \u00e9 o servidor VMS.",
  "settings.reports": "Reporta {ip}.",
  "setup.hint":
    "Pe\u00e7a o endere\u00e7o IP a quem configurou o port\u00e1til, ou execute {cmd} nele. A porta \u00e9 quase sempre 8000.",
  "setup.bareIp":
    "Basta o IP \u2014 o http:// e a porta s\u00e3o preenchidos automaticamente.",

  // ------------------------------------------------------------ language --
  "language.label": "Idioma",
};
