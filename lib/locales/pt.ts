import type { Messages } from "./en";

/**
 * Portuguese - European, not Brazilian.
 *
 * Timor-Leste follows Lisbon: "ecra" not "tela", "utilizador" not "usuario",
 * "eliminar" not "excluir". The progressive is "a + infinitive", which is why
 * the busy states below read "A terminar sessao..." rather than the Brazilian
 * "Terminando...".
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const pt: Messages = {

  // --------------------------------------------------------------- shell --
  "nav.sections": "Sec\u00e7\u00f5es",
  "nav.group.overview": "Vis\u00e3o geral",
  "nav.group.accreditation": "Acredita\u00e7\u00e3o",
  "nav.group.operations": "Opera\u00e7\u00f5es",
  "nav.dashboard": "Painel",
  "nav.dashboard.hint": "Chegadas e estado das portas",
  "nav.visitors": "Visitantes",
  "nav.visitors.hint": "Registar e emitir crach\u00e1s",
  "nav.badges": "Crach\u00e1s",
  "nav.badges.hint": "Fila de impress\u00e3o",
  "nav.devices": "Dispositivos",
  "nav.devices.hint": "Portas e ecr\u00e3s",
  "nav.reports": "Relat\u00f3rios",
  "nav.reports.hint": "Registo de entradas",
  "nav.expand": "Expandir menu",
  "nav.collapse": "Recolher menu",
  "nav.signOut": "Terminar sess\u00e3o",
  "nav.signingOut": "A terminar sess\u00e3o\u2026",
  "nav.silentDevices": "{count} dispositivo sem comunicar recentemente",
  "shell.restoringSession": "A restaurar sess\u00e3o",
  "topbar.localTime": "Hora local",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Mudar para modo escuro",
  "theme.toLight": "Mudar para modo claro",
  "theme.dark": "Escuro",
  "theme.light": "Claro",
  "language.label": "Idioma",
  "language.choose": "Escolher idioma",

  // --------------------------------------------------------------- login --
  "login.title": "Iniciar sess\u00e3o",
  "login.intro":
    "Apenas contas de administrador. Os seguran\u00e7as usam um telem\u00f3vel emparelhado e o ecr\u00e3 do \u00e1trio emparelha-se sozinho.",
  "login.username": "Utilizador",
  "login.password": "Palavra-passe",
  "login.submit": "Iniciar sess\u00e3o",
  "login.submitting": "A iniciar sess\u00e3o\u2026",
  "login.badCredentials": "O utilizador e a palavra-passe n\u00e3o coincidem.",
  "login.failedStatus": "Falha ao iniciar sess\u00e3o (HTTP {status}).",
  "login.unreachable":
    "N\u00e3o foi poss\u00edvel contactar o servidor. Verifique se o backend est\u00e1 a correr.",
  "login.servingFrom": "A partir de",
  "login.pitch":
    "Registe um visitante, imprima o crach\u00e1 e veja todas as chegadas num s\u00f3 lugar \u2014 na sua pr\u00f3pria rede, sem nada sair do edif\u00edcio.",

  // -------------------------------------------------------------- errors --
  "error.unexpected": "Ocorreu um erro.",
  "error.fields": "H\u00e1 campos por corrigir.",
  "error.visitorLoad": "N\u00e3o foi poss\u00edvel carregar este visitante.",
  "error.visitorRegister": "N\u00e3o foi poss\u00edvel registar o visitante.",
  "error.visitorSave":
    "N\u00e3o foi poss\u00edvel guardar as altera\u00e7\u00f5es.",
  "error.visitorActivate": "N\u00e3o foi poss\u00edvel ativar o visitante.",
  "error.visitorDeactivate":
    "N\u00e3o foi poss\u00edvel desativar o visitante.",
  "error.visitorDelete": "N\u00e3o foi poss\u00edvel eliminar o visitante.",

  // -------------------------------------------------------- visitor list --
  "visitors.title": "Visitantes",
  "visitors.subtitle": "Todos os inscritos no evento",
  "visitors.search": "Procurar visitantes",
  "visitors.searchPlaceholder":
    "Nome, organiza\u00e7\u00e3o, pa\u00eds ou n\u00famero do crach\u00e1",
  "visitors.filterCategory": "Filtrar por categoria",
  "visitors.tab.all": "Todos",
  "visitors.tab.normal": "Normal",
  "visitors.tab.vip": "VIP",
  "visitors.exportTitle":
    "Folha de c\u00e1lculo com todos os inscritos. Nada \u00e9 reemitido.",
  "visitors.exporting": "A exportar\u2026",
  "visitors.export": "Exportar .xlsx",
  "visitors.exportFailed": "N\u00e3o foi poss\u00edvel exportar a lista.",
  "visitors.register": "Registar visitante",
  "visitors.refreshing": "A atualizar\u2026",
  "visitors.loadFailed": "N\u00e3o foi poss\u00edvel carregar os visitantes",
  "visitors.requestFailed": "O pedido falhou antes de chegar ao servidor.",
  "visitors.serverRejected": "O servidor rejeitou o pedido.",
  "visitors.noneMatch": "Ningu\u00e9m corresponde a esses filtros",
  "visitors.noneMatchBody":
    "Tente uma pesquisa mais curta ou alargue a categoria.",
  "visitors.empty": "Ainda n\u00e3o h\u00e1 visitantes",
  "visitors.emptyBody":
    "Registe o primeiro visitante para emitir um crach\u00e1.",
  "visitors.menu.edit": "Editar dados",
  "visitors.menu.deactivate": "Desativar visitante",
  "visitors.menu.activate": "Ativar visitante",
  "visitors.menu.delete": "Eliminar definitivamente",
  "visitors.status.deactivated": "Desativado",

  // --------------------------------------------------- deactivate dialog --
  "deactivate.title": "Desativar {name}?",
  "deactivate.body":
    "O crach\u00e1 {serial} deixa de funcionar de imediato. A pr\u00f3xima leitura mostra vermelho \u00e0 porta.",
  "deactivate.point1":
    "Continuam na lista de visitantes, marcados como desativados.",
  "deactivate.point2": "O hist\u00f3rico de leituras \u00e9 mantido.",
  "deactivate.point3":
    "Revers\u00edvel. Ativar p\u00f5e o mesmo cart\u00e3o impresso a funcionar \u2014 n\u00e3o h\u00e1 nada para reimprimir.",
  "deactivate.cancel": "Manter ativo",
  "deactivate.confirm": "Desativar",
  "deactivate.pending": "A desativar\u2026",

  // -------------------------------------------------------- purge dialog --
  "purge.warning": "N\u00e3o pode ser anulado",
  "purge.title": "Eliminar {name} definitivamente?",
  "purge.body":
    "Isto remove o registo e a fotografia do visitante do servidor. Desativar \u00e9 a op\u00e7\u00e3o revers\u00edvel; esta n\u00e3o \u00e9.",
  "purge.scansUnknown":
    "As leituras deste crach\u00e1 permanecem no registo de entradas, mas deixam de identificar algu\u00e9m.",
  "purge.scansNone":
    "Nenhuma leitura \u00e9 afetada \u2014 este crach\u00e1 nunca foi apresentado.",
  "purge.scansOne":
    "{count} leitura permanece no registo de entradas, mas deixa de identificar algu\u00e9m.",
  "purge.scansMany":
    "{count} leituras permanecem no registo de entradas, mas deixam de identificar algu\u00e9m.",
  "purge.serialRetired":
    "O crach\u00e1 {serial} \u00e9 retirado. O n\u00famero n\u00e3o \u00e9 reutilizado.",
  "purge.reRegister":
    "Voltar a regist\u00e1-los cria um novo visitante, um novo n\u00famero e um novo QR.",
  "purge.typeToConfirm": "Escreva {serial} para confirmar",
  "purge.cancel": "Cancelar",
  "purge.confirm": "Eliminar definitivamente",
  "purge.pending": "A eliminar\u2026",

  // ------------------------------------------------------ visitor detail --
  "common.loading": "A carregar\u2026",
  "visitor.fallbackTitle": "Visitante",
  "visitor.notFound": "N\u00e3o foi poss\u00edvel carregar este visitante",
  "visitor.notFoundBody":
    "Pode ter sido eliminado. Consulte a lista de visitantes.",
  "visitor.backToAll": "Voltar a todos os visitantes",
  "visitor.allVisitors": "Todos os visitantes",
  "visitor.status.active": "Ativo",
  "visitor.headingActive": "Este crach\u00e1 abre a porta",
  "visitor.headingOff": "Este crach\u00e1 est\u00e1 desligado",
  "visitor.subActive":
    "Qualquer leitor emparelhado aceita-o e o ecr\u00e3 do \u00e1trio d\u00e1 as boas-vindas.",
  "visitor.subOff":
    "A pr\u00f3xima leitura mostra vermelho. Ativar p\u00f5e o mesmo cart\u00e3o a funcionar \u2014 n\u00e3o \u00e9 preciso reimprimir.",
  "visitor.registered": "Registado",
  "visitor.arrivals": "Chegadas",
  "visitor.lastArrival": "\u00daltima chegada",
  "visitor.notYet": "Ainda n\u00e3o",
  "visitor.scansLogged": "Leituras registadas",
  "visitor.activating": "A ativar\u2026",
  "visitor.qrNote":
    "Este QR foi gerado no registo do visitante e nunca muda. Reimprima o cart\u00e3o as vezes que precisar \u2014 l\u00ea-se sempre igual. Desativar para-o e ativar volta a p\u00f4-lo a funcionar, sem tocar no c\u00f3digo do cart\u00e3o. Eliminar definitivamente \u00e9 a \u00fanica coisa aqui que n\u00e3o pode ser anulada.",
  "visitor.scanHistory": "Hist\u00f3rico de leituras",
  "visitor.scanHistoryBody":
    "Todas as vezes que este crach\u00e1 foi apresentado, incluindo as recusadas.",
  "visitor.noScans": "Este crach\u00e1 ainda n\u00e3o foi lido.",
  "visitor.col.event": "Evento",
  "visitor.col.scannedAt": "Lido em",
  "visitor.col.result": "Resultado",
  "visitor.col.device": "Dispositivo",
  "scan.valid": "V\u00e1lido",
  "scan.duplicate": "Duplicado",
  "scan.revoked": "Revogado",
  "scan.invalid": "Inv\u00e1lido",

  // --------------------------------------------------- registration form --
  "register.title": "Registar um visitante",
  "register.subtitle":
    "Um crach\u00e1, impresso com anteced\u00eancia, v\u00e1lido para todo o evento",
  "register.issuedTitle": "Crach\u00e1 emitido",
  "register.issuedSubtitle":
    "Imprima o cart\u00e3o agora, ou mais tarde a partir da p\u00e1gina do visitante",
  "form.photoRequired":
    "Um crach\u00e1 precisa de uma fotografia. Adicione uma antes de registar.",
  "form.fullName": "Nome completo",
  "form.fullNameHint": "Como deve aparecer no crach\u00e1.",
  "form.country": "Pa\u00eds",
  "form.organisation": "Organiza\u00e7\u00e3o",
  "form.optional": "Opcional.",
  "form.category": "Categoria",
  "form.cat.normal": "Normal",
  "form.cat.normalNote": "Crach\u00e1 normal",
  "form.cat.vip": "VIP",
  "form.cat.vipNote": "Cart\u00e3o distinto e boas-vindas no \u00e1trio",
  "form.registering": "A registar\u2026",
  "form.saving": "A guardar\u2026",
  "form.register": "Registar e emitir crach\u00e1",
  "form.save": "Guardar altera\u00e7\u00f5es",
  "form.noteCreate":
    "O n\u00famero \u00e9 atribu\u00eddo no momento do registo. O QR \u00e9 gerado nesse mesmo instante e nunca muda depois.",
  "form.noteEdit":
    "Editar os dados n\u00e3o reemite o crach\u00e1. O n\u00famero e o c\u00f3digo QR ficam exatamente como foram impressos.",

  // ------------------------------------------------------- badge receipt --
  "receipt.badgeIssued": "Crach\u00e1 emitido",
  "receipt.registered": "{name} est\u00e1 registado",
  "receipt.permanent":
    "Este QR \u00e9 permanente. Foi gerado quando {name} foi registado e n\u00e3o muda \u2014 imprima-o agora, ou mais tarde a partir da p\u00e1gina do visitante, as vezes que precisar. S\u00f3 deixa de funcionar se desativar ou eliminar o visitante.",
  "receipt.qrAlt": "C\u00f3digo QR do crach\u00e1 {serial}",
  "receipt.badgeToken": "Token do crach\u00e1",
  "receipt.rendering": "A gerar\u2026",
  "receipt.downloadPdf": "Transferir PDF do crach\u00e1",
  "receipt.printBrowser": "Imprimir pelo navegador",
  "receipt.copied": "Copiado",
  "receipt.copyToken": "Copiar token",
  "receipt.qrFailed":
    "N\u00e3o foi poss\u00edvel desenhar o c\u00f3digo QR. Copie o token e imprima o crach\u00e1 noutra m\u00e1quina, em vez de emitir um cart\u00e3o sem c\u00f3digo.",
  "receipt.copiedAnnounce":
    "Token do crach\u00e1 copiado para a \u00e1rea de transfer\u00eancia.",
  "receipt.badgeSerial": "N\u00famero do crach\u00e1",
  "receipt.registerAnother": "Registar outro visitante",
  "receipt.open": "Abrir {name}",
  "receipt.renderFailed": "N\u00e3o foi poss\u00edvel gerar o crach\u00e1.",

  // ---------------------------------------------------------------- edit --
  "edit.title": "Editar {name}",
  "edit.fallbackTitle": "Editar visitante",
};
