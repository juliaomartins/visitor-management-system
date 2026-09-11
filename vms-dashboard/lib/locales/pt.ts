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
    "Todos os inscritos, com foto e QR do cart\u00e3o. Nada \u00e9 reemitido.",
  "visitors.exporting": "A exportar\u2026",
  "visitors.export": "Exportar Excel",
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

  // ----------------------------------------------- photo upload and crop --
  "photo.label": "Fotografia",
  "photo.spec": "3:4 VERTICAL \u00b7 600 \u00d7 800",
  "photo.notImage": "Isso n\u00e3o \u00e9 uma imagem. Escolha um JPEG ou PNG.",
  "photo.tooLarge": "Essa imagem tem mais de 20 MB. Escolha uma mais pequena.",
  "photo.alt": "A fotografia do crach\u00e1 do visitante",
  "photo.ready": "Recortada e pronta.",
  "photo.onFile":
    "A fotografia j\u00e1 guardada. Mant\u00e9m-se a menos que a substitua.",
  "photo.adjustCrop": "Ajustar recorte",
  "photo.chooseDifferent": "Escolher outra fotografia",
  "photo.add": "Adicionar fotografia",
  "photo.dropHint":
    "Largue uma aqui, ou clique para escolher. A seguir recorta-a.",
  "photo.dialogLabel": "Recortar a fotografia do visitante",
  "photo.frameFace": "Enquadrar o rosto",
  "photo.closeWithoutSaving": "Fechar sem guardar",
  "crop.alt": "A fotografia a ser recortada",
  "crop.preview": "Imagem recortada",
  "crop.circleHint":
    "S\u00f3 o c\u00edrculo \u00e9 impresso e mostrado no ecr\u00e3 do \u00e1trio. Preencha-o com a cabe\u00e7a e os ombros.",
  "crop.aspect": "Propor\u00e7\u00e3o",
  "crop.ratio.badge": "Crach\u00e1 (fixo)",
  "crop.ratio.square": "Quadrado",
  "crop.ratio.free": "Livre",
  "crop.width": "Largura",
  "crop.height": "Altura",
  "crop.heightLocked": "Altura (fixa)",
  "crop.tooSmall":
    "Este recorte tem {width}px de largura. O crach\u00e1 imprime a fotografia a {min}px para 300dpi, por isso ficar\u00e1 desfocada no cart\u00e3o. Recorte menos, ou use uma fotografia maior.",
  "crop.quality": "Qualidade da imagem",
  "crop.bestCompression": "Mais compress\u00e3o",
  "crop.bestQuality": "Mais qualidade",
  "crop.applying": "A aplicar\u2026",
  "crop.use": "Usar esta fotografia",
  "crop.changeImage": "Mudar de imagem",

  // -------------------------------------------------------------- badges --
  "badges.title": "Impress\u00e3o de crach\u00e1s",
  "badges.subtitle": "Nove por folha A4, com marcas de corte",
  "badges.loadFailed":
    "N\u00e3o foi poss\u00edvel carregar a lista de visitantes.",
  "badges.safeTitle": "Imprimir de novo \u00e9 seguro",
  "badges.safeBody":
    "Cada folha leva o QR j\u00e1 existente de cada visitante, por isso um cart\u00e3o pode ser reimpresso as vezes que precisar e os j\u00e1 entregues continuam a funcionar. Para travar um cart\u00e3o perdido, desative esse visitante na p\u00e1gina dele \u2014 o QR nunca muda, por isso ativ\u00e1-lo de novo p\u00f5e o mesmo cart\u00e3o a funcionar.",
  "badges.searchPlaceholder":
    "Nome, organiza\u00e7\u00e3o, pa\u00eds ou n\u00famero",
  "badges.clearSelection": "Limpar sele\u00e7\u00e3o",
  "badges.selectAll": "Selecionar todos ({count})",
  "badges.print": "Imprimir",
  "badges.printCount": "Imprimir {count}",
  "badges.sheetFailed": "N\u00e3o foi poss\u00edvel produzir a folha.",
  "badges.export": "Exportar Excel",
  "badges.fileFailed": "N\u00e3o foi poss\u00edvel produzir o ficheiro.",
  "badges.selectedOne": "{count} selecionado \u00b7 {sheets} folha A4",
  "badges.selectedMany": "{count} selecionados \u00b7 {sheets} folhas A4",
  "badges.noMatch": "Nenhum visitante corresponde a essa pesquisa.",
  "badges.onSheet": "Na folha",
  "badges.notPrinting": "Fora da folha",

  // ------------------------------------------------------- export dialog --
  "export.titleOne":
    "Exportar c\u00f3digos de crach\u00e1 de {count} visitante?",
  "export.titleMany":
    "Exportar c\u00f3digos de crach\u00e1 de {count} visitantes?",
  "export.body":
    "Este ficheiro cont\u00e9m um {strong} para cada visitante nele. Exportar n\u00e3o altera nada \u2014 os c\u00f3digos s\u00e3o os que j\u00e1 est\u00e3o nos cart\u00f5es \u2014 mas quem tiver o ficheiro consegue produzir um crach\u00e1 que \u00e9 lido.",
  "export.bodyStrong": "c\u00f3digo QR funcional",
  "export.point1":
    "Envie-o como enviaria os cart\u00f5es impressos, n\u00e3o como enviaria uma lista de convidados.",
  "export.point2":
    "Exportar de novo mais tarde produz um ficheiro id\u00eantico. Perder este s\u00f3 custa o tempo de o exportar outra vez.",
  "export.point3":
    "Para travar um crach\u00e1 espec\u00edfico, desative esse visitante na p\u00e1gina dele. Apagar o ficheiro n\u00e3o trava nada.",
  "export.building": "A preparar\u2026",
  "export.confirm": "Exportar e transferir",
  "card.deactivated": "Desativado",
  "card.qrOnCard": "no cart\u00e3o impresso",
  "card.qrDrawing": "a desenhar\u2026",
  "card.qrFailed": "n\u00e3o foi poss\u00edvel desenhar",

  // ------------------------------------------------------------- devices --
  "time.justNow": "agora mesmo",
  "device.kind.scanner": "Leitor",
  "device.kind.screen": "Ecr\u00e3",
  "device.kindInline.scanner": "leitor",
  "device.kindInline.screen": "ecr\u00e3",
  "devices.subtitleQuiet":
    "Telem\u00f3veis dos seguran\u00e7as e o ecr\u00e3 do \u00e1trio",
  "devices.silentOne":
    "{count} dispositivo n\u00e3o comunica h\u00e1 algum tempo",
  "devices.silentMany":
    "{count} dispositivos n\u00e3o comunicam h\u00e1 algum tempo",
  "devices.alertOne": "{count} dispositivo est\u00e1 em sil\u00eancio.",
  "devices.alertMany": "{count} dispositivos est\u00e3o em sil\u00eancio.",
  "devices.alertBody":
    "Uma porta sem leituras h\u00e1 dez minutos ou est\u00e1 parada ou est\u00e1 offline \u2014 v\u00e1 l\u00e1 verificar.",
  "devices.paired": "Dispositivos emparelhados",
  "devices.pairedBody":
    "Atualiza sozinho. \u201cVisto pela \u00faltima vez\u201d \u00e9 o \u00faltimo pedido feito pelo dispositivo, e \u00e9 assim que se distingue uma porta parada de um telem\u00f3vel morto.",
  "devices.loadFailed": "N\u00e3o foi poss\u00edvel carregar os dispositivos",
  "devices.none": "Ainda n\u00e3o h\u00e1 dispositivos emparelhados",
  "devices.noneBody":
    "Gere um c\u00f3digo acima e introduza-o no telem\u00f3vel do seguran\u00e7a ou no ecr\u00e3 do \u00e1trio.",
  "devices.col.device": "Dispositivo",
  "devices.col.kind": "Tipo",
  "devices.col.lastSeen": "Visto pela \u00faltima vez",
  "devices.col.state": "Estado",
  "devices.neverCheckedIn": "Nunca comunicou",
  "devices.silentCheck": "Em sil\u00eancio \u2014 verifique a porta",
  "devices.notSeenSincePairing": "Sem sinal desde o emparelhamento",
  "devices.stateRevoked": "REVOGADO",
  "devices.stateActive": "ATIVO",
  "devices.revoke": "Revogar",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Emparelhar um dispositivo",
  "pair.body":
    "Abra a aplica\u00e7\u00e3o no telem\u00f3vel ou no ecr\u00e3 e leia-lhe o c\u00f3digo abaixo. Cada c\u00f3digo funciona uma s\u00f3 vez.",
  "pair.codeButton": "C\u00f3digo de {kind}",
  "pair.blurb.scanner": "O telem\u00f3vel de um seguran\u00e7a, a uma porta",
  "pair.blurb.screen": "O ecr\u00e3 do \u00e1trio",
  "pair.codeLabel": "C\u00f3digo de emparelhamento de {kind}",
  "pair.expired":
    "Este c\u00f3digo expirou. Gere outro \u2014 n\u00e3o foi emparelhado nada com ele.",
  "pair.expiresIn": "Expira em",
  "pair.alphabetNote":
    "Os c\u00f3digos nunca cont\u00eam 0, O, 1 nem I \u2014 esses quatro ficam de fora porque s\u00e3o os que as pessoas ouvem e escrevem mal. O dispositivo aparece na lista abaixo assim que emparelha.",

  // ------------------------------------------------ revoke device dialog --
  "revokeDevice.title": "Revogar {name}?",
  "revokeDevice.body":
    "Este {kind} deixa de funcionar {strong}. Se for um telem\u00f3vel de porta, essa porta n\u00e3o consegue registar chegadas at\u00e9 algu\u00e9m o emparelhar de novo.",
  "revokeDevice.bodyStrong": "de imediato",
  "revokeDevice.point1":
    "{strong} \u2014 em segundos, sem ningu\u00e9m ter de l\u00e1 ir. Tenha um novo c\u00f3digo de emparelhamento pronto se quiser traz\u00ea-lo logo de volta.",
  "revokeDevice.point1Strong": "Volta sozinho ao ecr\u00e3 de emparelhamento",
  "revokeDevice.point2":
    "O seu token morreu. N\u00e3o h\u00e1 forma de anular \u2014 recuper\u00e1-lo implica um novo c\u00f3digo de emparelhamento.",
  "revokeDevice.point3":
    "As leituras que j\u00e1 registou s\u00e3o mantidas, e as que guardou offline ainda sincronizam quando voltar a emparelhar.",
  "revokeDevice.point4":
    "Permanece nesta lista, marcado como revogado, para o registo de auditoria se manter.",
  "revokeDevice.cancel": "Manter ativo",
  "revokeDevice.pending": "A revogar\u2026",
  "revokeDevice.confirm": "Revogar dispositivo",
  "error.deviceLoad":
    "N\u00e3o foi poss\u00edvel carregar a lista de dispositivos.",
  "error.pairingCode":
    "N\u00e3o foi poss\u00edvel gerar um c\u00f3digo de emparelhamento.",
  "error.deviceRevoke": "N\u00e3o foi poss\u00edvel revogar o dispositivo.",

  // ------------------------------------------------------------- reports --
  "reports.title": "Registo de entradas",
  "reports.subtitleQuiet": "Chegadas e recusas",
  "reports.subtitleRefused": "{count} recusados \u00e0 porta",
  "reports.subtitleNoRefusals": "Nenhum crach\u00e1 recusado neste intervalo",
  "reports.allOutcomes": "Todos os resultados",
  "reports.allCategories": "Todas as categorias",
  "reports.from": "De",
  "reports.to": "At\u00e9",
  "reports.outcome": "Resultado",
  "reports.any": "Qualquer",
  "reports.exportNote":
    "Exatamente como os filtros acima est\u00e3o definidos.",
  "reports.preparing": "A preparar\u2026",
  "reports.exportFailed":
    "N\u00e3o foi poss\u00edvel guardar a exporta\u00e7\u00e3o.",
  "reports.logFailed": "N\u00e3o foi poss\u00edvel carregar o registo",
  "reports.everyBadge": "Todos os crach\u00e1s apresentados",
  "reports.everyBadgeNote":
    "As linhas por tr\u00e1s dos n\u00fameros acima, recusas inclu\u00eddas",
  "reports.timezone": "Horas mostradas em {zone}.",
  "reports.format.pdf": "Relat\u00f3rio PDF",
  "reports.format.pdfHint":
    "O relat\u00f3rio escrito \u2014 conclus\u00f5es, gr\u00e1ficos e tabelas. Para reencaminhar.",
  "reports.format.xlsx": "Livro Excel",
  "reports.format.xlsxHint":
    "Seis folhas, valores como n\u00fameros. Para quem quiser trabalh\u00e1-los.",
  "reports.format.csv": "Registo CSV",
  "reports.format.csvHint":
    "O registo bruto de leituras, uma linha por crach\u00e1 apresentado. Sem an\u00e1lise.",
  "reports.export.stale":
    "Essa exporta\u00e7\u00e3o ainda n\u00e3o existe no servidor \u2014 est\u00e1 a correr uma vers\u00e3o mais antiga do que esta p\u00e1gina. Reinicie o backend e tente de novo.",
  "reports.export.expired":
    "A sua sess\u00e3o expirou. Recarregue a p\u00e1gina e inicie sess\u00e3o de novo.",
  "reports.export.serverError":
    "O servidor n\u00e3o conseguiu produzir essa exporta\u00e7\u00e3o (HTTP {status}).",
  "reports.export.downloadFailed":
    "N\u00e3o foi poss\u00edvel transferir essa exporta\u00e7\u00e3o (HTTP {status}).",
  "error.reportLoad":
    "N\u00e3o foi poss\u00edvel carregar o registo de entradas.",

  // --------------------------------------------------------------- recap --
  "recap.unavailable": "An\u00e1lise indispon\u00edvel",
  "recap.unavailableBody":
    "O servidor respondeu sem as conclus\u00f5es derivadas, o que significa que est\u00e1 a correr uma vers\u00e3o mais antiga do que esta p\u00e1gina. Reinicie o backend e recarregue \u2014 o registo abaixo n\u00e3o \u00e9 afetado e continua exato.",
  "recap.scans": "Leituras",
  "recap.inRange": "Neste intervalo",
  "recap.people": "Pessoas",
  "recap.distinct": "Visitantes distintos",
  "recap.duplicates": "Duplicados",
  "recap.reEntries": "Reentradas, n\u00e3o recusas",
  "recap.refused": "Recusados",
  "recap.invalidOrRevoked": "Inv\u00e1lidos ou revogados",
  "recap.nothingScanned": "Nada lido neste intervalo",
  "recap.nothingScannedBody":
    "Alargue as datas, ou limpe os filtros. Ainda n\u00e3o h\u00e1 nada para relatar.",
  "recap.attendance": "Presen\u00e7a",
  "recap.attendanceNote": "{arrived} de {registered} registados",
  "recap.scansLogged": "Leituras registadas",
  "recap.repeatNote": "{count} pessoas passaram mais do que uma vez",
  "recap.busiestHour": "Hora de maior movimento",
  "recap.peakNote": "{total} leituras \u00b7 {share}% do per\u00edodo",
  "recap.noArrivals": "Nenhuma chegada registada",
  "recap.refusalNote": "{rate}% de tudo o que foi apresentado",
  "recap.noneTurnedAway": "Nenhum crach\u00e1 recusado",
  "recap.whatNumbersSay": "O que dizem os n\u00fameros",
  "recap.whatNumbersSayNote":
    "Gerado a partir deste intervalo \u2014 cada linha \u00e9 uma afirma\u00e7\u00e3o que os dados sustentam",
  "recap.loadByDoor": "Movimento por porta",
  "recap.loadByDoorNote":
    "Uma porta que recusa crach\u00e1s \u00e9 uma porta com um problema",
  "recap.noDoorScan": "Nenhuma porta registou leituras.",
  "recap.refusedHere": "{count} recusados aqui",
  "recap.notArrived": "Registados, ainda n\u00e3o chegaram",
  "recap.notArrivedCount": "{count} de {registered}",
  "recap.notArrivedNote":
    "Sem leitura v\u00e1lida neste intervalo. A lista completa est\u00e1 no PDF e no livro Excel.",

  // ----------------------------------------------------------- entry log --
  "entry.emptyBody": "Alargue as datas, ou limpe os filtros.",
  "entry.col.time": "Hora",
  "entry.col.name": "Nome",
  "chart.noScans":
    "Sem leituras neste intervalo, por isso n\u00e3o h\u00e1 nada para representar.",

  // ------------------------------------------------------------ overview --
  "overview.subtitleQuiet": "As chegadas de hoje em todas as portas",
  "overview.silentOne":
    "{count} porta ficou em sil\u00eancio \u2014 verifique Dispositivos",
  "overview.silentMany":
    "{count} portas ficaram em sil\u00eancio \u2014 verifique Dispositivos",
  "overview.registered": "Registados",
  "overview.vipCount": "{count} VIP",
  "overview.arrivedToday": "Chegaram hoje",
  "overview.arrivedNote": "{percent}% dos registados",
  "overview.refusedAtDoor": "Recusados \u00e0 porta",
  "overview.duplicateOne": "{count} leitura duplicada n\u00e3o contada",
  "overview.duplicateMany": "{count} leituras duplicadas n\u00e3o contadas",
  "overview.doorsReporting": "Portas a comunicar",
  "overview.silentCount": "{count} em sil\u00eancio",
  "overview.allCheckedIn": "Todas comunicaram recentemente",
  "overview.arrivalsByHour": "Chegadas por hora",
  "overview.arrivalsByHourNote":
    "Todos os crach\u00e1s apresentados hoje, marcados na hora em que aconteceu",
  "overview.scanCountOne": "{count} leitura",
  "overview.scanCountMany": "{count} leituras",
  "overview.outcomeSplit": "Divis\u00e3o dos resultados",
  "overview.outcomeSplitNote": "Como se dividiram as leituras de hoje",
  "overview.recentScans": "Leituras recentes",
  "overview.recentScansNote": "Mais recentes primeiro, recusas inclu\u00eddas",
  "overview.nothingToday": "Ainda n\u00e3o foi lido nada hoje.",
  "overview.arrivalsAppear":
    "As chegadas aparecem aqui assim que um seguran\u00e7a l\u00ea um crach\u00e1.",
  "overview.colVisitor": "Visitante",
  "overview.openLog": "Abrir o registo de entradas completo \u2192",
  "overview.arrivedSummary.oneOne":
    "{people} pessoa chegou em {scans} leitura.",
  "overview.arrivedSummary.oneMany":
    "{people} pessoa chegou em {scans} leituras.",
  "overview.arrivedSummary.manyOne":
    "{people} pessoas chegaram em {scans} leitura.",
  "overview.arrivedSummary.manyMany":
    "{people} pessoas chegaram em {scans} leituras.",

  // --------------------------------------------------------------- brand --
  "brand.organisedBy": "Organizado por {first} e {second}.",
  "brand.dates": "D\u00edli, 2\u20133 de outubro de 2026",
};
