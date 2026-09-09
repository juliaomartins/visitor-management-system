# -*- coding: utf-8 -*-
"""Emit the three dictionary files as pure ASCII TypeScript.

Non-ASCII is written as \\uXXXX escapes. TypeScript reads those natively, and an
ASCII file cannot be mangled by a shell, an editor or a transcoding step on the
way to review -- which is exactly what happened to the first version of these
files on this Windows machine.
"""
from pathlib import Path

ROOT = Path(r"C:\workplace\vms\vms-dashboard\lib\locales")

HEAD_EN = '''/**
 * English - the source of truth for every message in the dashboard.
 *
 * THIS FILE DEFINES THE KEY SET. `pt.ts` and `tet.ts` are typed as `Messages`,
 * so leaving a key out of either one is a TypeScript error rather than a screen
 * that silently falls back to English in front of a delegate. Adding a message
 * means adding it here first; the compiler then names what is missing.
 *
 * Keys are namespaced by where they appear, not by what they say. Two screens
 * that share a word in English still get their own key, because they can
 * diverge in Tetun, where the noun governs the verb.
 *
 * NON-ASCII IS WRITTEN AS \\uXXXX ESCAPES ON PURPOSE, and these files are
 * generated rather than hand-edited. The first version of them was written
 * through a shell heredoc on Windows and came back with "\\u00e7\\u00f5" turned
 * to mojibake -- invisible in a diff until it reaches a delegate. An ASCII file
 * cannot be transcoded by anything in the chain.
 *
 * `{name}` placeholders are filled by `t(key, { name })` - see `lib/i18n.tsx`.
 */
export const en = {'''

HEAD_PT = '''import type { Messages } from "./en";

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
export const pt: Messages = {'''

HEAD_TET = '''import type { Messages } from "./en";

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
export const tet: Messages = {'''

TAIL_EN = '''} as const;

/** Every message key in the dashboard. */
export type MessageKey = keyof typeof en;

/**
 * The shape a translation has to satisfy.
 *
 * `Record<MessageKey, string>` rather than `typeof en`: the English values are
 * literal types, and a translation must be free to say something different
 * while still covering every key.
 */
export type Messages = Record<MessageKey, string>;
'''

# (key, en, pt, tet). A key starting with "//" opens a section.
M = [
    ("//shell", "", "", ""),
    ("nav.sections", "Sections", "Secções", "Seksaun sira"),
    ("nav.group.overview", "Overview", "Visão geral", "Vizaun jerál"),
    ("nav.group.accreditation", "Accreditation", "Acreditação", "Akreditasaun"),
    ("nav.group.operations", "Operations", "Operações", "Operasaun"),
    ("nav.dashboard", "Dashboard", "Painel", "Painél"),
    ("nav.dashboard.hint", "Arrivals and door health",
     "Chegadas e estado das portas", "Xegada no estadu odamatan"),
    ("nav.visitors", "Visitors", "Visitantes", "Vizitante sira"),
    ("nav.visitors.hint", "Register and issue badges",
     "Registar e emitir crachás", "Rejistu no fó sai kartaun"),
    ("nav.badges", "Badges", "Crachás", "Kartaun"),
    ("nav.badges.hint", "Print queue", "Fila de impressão", "Fila ba impresaun"),
    ("nav.devices", "Devices", "Dispositivos", "Aparellu sira"),
    ("nav.devices.hint", "Doors and screens", "Portas e ecrãs",
     "Odamatan no ekrán"),
    ("nav.reports", "Reports", "Relatórios", "Relatóriu"),
    ("nav.reports.hint", "Entrance log", "Registo de entradas", "Rejistu tama"),
    ("nav.expand", "Expand menu", "Expandir menu", "Loke menu"),
    ("nav.collapse", "Collapse menu", "Recolher menu", "Taka menu"),
    ("nav.signOut", "Sign out", "Terminar sessão", "Sai"),
    ("nav.signingOut", "Signing out\u2026", "A terminar sessão\u2026",
     "Sai hela\u2026"),
    ("nav.silentDevices", "{count} device not checked in recently",
     "{count} dispositivo sem comunicar recentemente",
     "Aparellu {count} seidauk komunika"),
    ("shell.restoringSession", "Restoring session", "A restaurar sessão",
     "Restaura sesaun hela"),
    ("topbar.localTime", "Local time", "Hora local", "Oras lokál"),

    ("//preferences", "", "", ""),
    ("theme.toDark", "Switch to dark mode", "Mudar para modo escuro",
     "Troka ba modu nakukun"),
    ("theme.toLight", "Switch to light mode", "Mudar para modo claro",
     "Troka ba modu naroman"),
    ("theme.dark", "Dark", "Escuro", "Nakukun"),
    ("theme.light", "Light", "Claro", "Naroman"),
    ("language.label", "Language", "Idioma", "Lian"),
    ("language.choose", "Choose a language", "Escolher idioma", "Hili lian"),

    ("//login", "", "", ""),
    ("login.title", "Sign in", "Iniciar sessão", "Tama"),
    ("login.intro",
     "Administrator accounts only. Guards use a paired phone, and the lobby "
     "screen pairs itself.",
     "Apenas contas de administrador. Os seguranças usam um telemóvel "
     "emparelhado e o ecrã do átrio emparelha-se sozinho.",
     "Konta administradór deit. Seguransa sira uza telemóvel ne\u2019ebé pareia "
     "ona, no ekrán resepsaun pareia an rasik."),
    ("login.username", "Username", "Utilizador", "Naran uzuáriu"),
    ("login.password", "Password", "Palavra-passe", "Liafuan-xave"),
    ("login.submit", "Sign in", "Iniciar sessão", "Tama"),
    ("login.submitting", "Signing in\u2026", "A iniciar sessão\u2026",
     "Tama hela\u2026"),
    ("login.badCredentials", "That username and password did not match.",
     "O utilizador e a palavra-passe não coincidem.",
     "Naran uzuáriu ho liafuan-xave la hanesan."),
    ("login.failedStatus", "Sign-in failed (HTTP {status}).",
     "Falha ao iniciar sessão (HTTP {status}).",
     "La konsege tama (HTTP {status})."),
    ("login.unreachable",
     "Could not reach the server. Check that the backend is running.",
     "Não foi possível contactar o servidor. Verifique se o backend está a "
     "correr.",
     "La bele kontaktu servidór. Verifika se backend la\u2019o hela."),
    ("login.servingFrom", "Serving from", "A partir de", "Husi"),
    ("login.pitch",
     "Register a visitor, print their card, and watch every arrival land in "
     "one place \u2014 on your own network, with nothing leaving the building.",
     "Registe um visitante, imprima o crachá e veja todas as chegadas num só "
     "lugar \u2014 na sua própria rede, sem nada sair do edifício.",
     "Rejista vizitante, imprime nia kartaun, no haree xegada hotu iha fatin "
     "ida \u2014 iha ita-nia rede rasik, laiha buat ida sai husi edifísiu."),

    ("//errors", "", "", ""),
    ("error.unexpected", "Something went wrong.", "Ocorreu um erro.",
     "Iha erru ida."),
    ("error.fields", "Some fields need attention.", "Há campos por corrigir.",
     "Iha kampu balu presiza hadia."),
    ("error.visitorLoad", "That visitor could not be loaded.",
     "Não foi possível carregar este visitante.",
     "La bele karga vizitante ne\u2019e."),
    ("error.visitorRegister", "The visitor could not be registered.",
     "Não foi possível registar o visitante.",
     "La bele rejista vizitante ne\u2019e."),
    ("error.visitorSave", "The changes could not be saved.",
     "Não foi possível guardar as alterações.", "La bele rai mudansa sira."),
    ("error.visitorActivate", "The visitor could not be activated.",
     "Não foi possível ativar o visitante.",
     "La bele ativa vizitante ne\u2019e."),
    ("error.visitorDeactivate", "The visitor could not be deactivated.",
     "Não foi possível desativar o visitante.",
     "La bele dezativa vizitante ne\u2019e."),
    ("error.visitorDelete", "The visitor could not be deleted.",
     "Não foi possível eliminar o visitante.",
     "La bele hasai vizitante ne\u2019e."),

    ("//visitor list", "", "", ""),
    ("visitors.title", "Visitors", "Visitantes", "Vizitante sira"),
    ("visitors.subtitle", "Everyone registered for the event",
     "Todos os inscritos no evento",
     "Ema hotu ne\u2019eb\u00e9 rejista ba eventu"),
    ("visitors.search", "Search visitors", "Procurar visitantes",
     "Buka vizitante"),
    ("visitors.searchPlaceholder",
     "Name, organisation, country or badge serial",
     "Nome, organiza\u00e7\u00e3o, pa\u00eds ou n\u00famero do crach\u00e1",
     "Naran, organizasaun, nasaun ka n\u00fameru kartaun"),
    ("visitors.filterCategory", "Filter by category", "Filtrar por categoria",
     "Filtra tuir kategoria"),
    ("visitors.tab.all", "Everyone", "Todos", "Hotu"),
    ("visitors.tab.normal", "Normal", "Normal", "Norm\u00e1l"),
    ("visitors.tab.vip", "VIP", "VIP", "VIP"),
    ("visitors.exportTitle",
     "Spreadsheet of everyone registered. Nothing is reissued.",
     "Folha de c\u00e1lculo com todos os inscritos. Nada \u00e9 reemitido.",
     "Folha k\u00e1lkulu ho ema hotu ne\u2019eb\u00e9 rejista. La f\u00f3 sai kartaun foun."),
    ("visitors.exporting", "Exporting\u2026", "A exportar\u2026",
     "Esporta hela\u2026"),
    ("visitors.export", "Export .xlsx", "Exportar .xlsx", "Esporta .xlsx"),
    ("visitors.exportFailed", "The roster could not be exported.",
     "N\u00e3o foi poss\u00edvel exportar a lista.", "La bele esporta lista."),
    ("visitors.register", "Register visitor", "Registar visitante",
     "Rejista vizitante"),
    ("visitors.refreshing", "Refreshing\u2026", "A atualizar\u2026",
     "Atualiza hela\u2026"),
    ("visitors.loadFailed", "Could not load visitors",
     "N\u00e3o foi poss\u00edvel carregar os visitantes",
     "La bele karga vizitante sira"),
    ("visitors.requestFailed",
     "The request failed before it reached the server.",
     "O pedido falhou antes de chegar ao servidor.",
     "Pedidu falla molok to\u2019o servid\u00f3r."),
    ("visitors.serverRejected", "The server rejected that request.",
     "O servidor rejeitou o pedido.", "Servid\u00f3r rejeita pedidu ne\u2019e."),
    ("visitors.noneMatch", "No one matches those filters",
     "Ningu\u00e9m corresponde a esses filtros",
     "Laiha ema ida tuir filtru sira ne\u2019e"),
    ("visitors.noneMatchBody", "Try a shorter search, or widen the category.",
     "Tente uma pesquisa mais curta ou alargue a categoria.",
     "Koko buka ho liafuan badak liu, ka loke kategoria."),
    ("visitors.empty", "No visitors yet", "Ainda n\u00e3o h\u00e1 visitantes",
     "Seidauk iha vizitante"),
    ("visitors.emptyBody", "Register the first visitor to issue a badge.",
     "Registe o primeiro visitante para emitir um crach\u00e1.",
     "Rejista vizitante primeiru atu f\u00f3 sai kartaun."),
    ("visitors.menu.edit", "Edit details", "Editar dados", "Edita dadus"),
    ("visitors.menu.deactivate", "Deactivate visitor", "Desativar visitante",
     "Dezativa vizitante"),
    ("visitors.menu.activate", "Activate visitor", "Ativar visitante",
     "Ativa vizitante"),
    ("visitors.menu.delete", "Delete permanently", "Eliminar definitivamente",
     "Hasai permanente"),
    ("visitors.status.deactivated", "Deactivated", "Desativado", "Dezativadu"),

    ("//deactivate dialog", "", "", ""),
    ("deactivate.title", "Deactivate {name}?", "Desativar {name}?",
     "Dezativa {name}?"),
    ("deactivate.body",
     "Badge {serial} stops working immediately. The next scan of it shows red "
     "at the door.",
     "O crachá {serial} deixa de funcionar de imediato. A próxima leitura "
     "mostra vermelho à porta.",
     "Kartaun {serial} para funsiona kedas. Leitura tuirmai sei mosu mean iha "
     "odamatan."),
    ("deactivate.point1", "They stay on the visitor list, marked deactivated.",
     "Continuam na lista de visitantes, marcados como desativados.",
     "Sira sei hela iha lista vizitante, ho marka dezativadu."),
    ("deactivate.point2", "Their scan history is kept.",
     "O histórico de leituras é mantido.",
     "Istória leitura sei rai nafatin."),
    ("deactivate.point3",
     "Reversible. Activating puts the same printed card back to work — "
     "there is nothing to reprint.",
     "Reversível. Ativar põe o mesmo cartão impresso a funcionar — não há "
     "nada para reimprimir.",
     "Bele fila fali. Ativa fó fila kartaun ne’ebé imprime ona ba servisu "
     "— laiha buat atu imprime fali."),
    ("deactivate.cancel", "Keep them active", "Manter ativo",
     "Rai ativu nafatin"),
    ("deactivate.confirm", "Deactivate", "Desativar", "Dezativa"),
    ("deactivate.pending", "Deactivating…", "A desativar…",
     "Dezativa hela…"),

    ("//purge dialog", "", "", ""),
    ("purge.warning", "Cannot be undone", "Não pode ser anulado",
     "La bele fila fali"),
    ("purge.title", "Delete {name} permanently?",
     "Eliminar {name} definitivamente?", "Hasai {name} permanente?"),
    ("purge.body",
     "This removes the registration and the visitor’s photo from the server. "
     "Deactivating is the reversible option; this is not it.",
     "Isto remove o registo e a fotografia do visitante do servidor. Desativar "
     "é a opção reversível; esta não é.",
     "Ne’e hasai rejistu no vizitante nia foto husi servidór. Dezativa mak "
     "opsaun ne’ebé bele fila fali; ida ne’e lae."),
    ("purge.scansUnknown",
     "Any scans of this badge stay in the entrance log but stop naming "
     "anybody.",
     "As leituras deste crachá permanecem no registo de entradas, mas deixam "
     "de identificar alguém.",
     "Leitura kartaun ne’e nian sei hela iha rejistu tama, maibé la naran ema "
     "ida ona."),
    ("purge.scansNone",
     "No scans are affected — this badge has never been presented.",
     "Nenhuma leitura é afetada — este crachá nunca foi apresentado.",
     "Laiha leitura ida afetadu — kartaun ne’e seidauk aprezenta."),
    ("purge.scansOne",
     "{count} scan stays in the entrance log but stops naming anybody.",
     "{count} leitura permanece no registo de entradas, mas deixa de "
     "identificar alguém.",
     "Leitura {count} sei hela iha rejistu tama, maibé la naran ema ida ona."),
    ("purge.scansMany",
     "{count} scans stay in the entrance log but stop naming anybody.",
     "{count} leituras permanecem no registo de entradas, mas deixam de "
     "identificar alguém.",
     "Leitura {count} sei hela iha rejistu tama, maibé la naran ema ida ona."),
    ("purge.serialRetired", "Badge {serial} is retired. The serial is not "
     "reused.",
     "O crachá {serial} é retirado. O número não é reutilizado.",
     "Kartaun {serial} hasai ona. Númeru ne’e la uza fali."),
    ("purge.reRegister",
     "Registering them again later creates a new visitor, a new serial and a "
     "new QR.",
     "Voltar a registá-los cria um novo visitante, um novo número e um novo QR.",
     "Rejista fila sira sei kria vizitante foun, númeru foun no QR foun."),
    ("purge.typeToConfirm", "Type {serial} to confirm",
     "Escreva {serial} para confirmar", "Hakerek {serial} atu konfirma"),
    ("purge.cancel", "Cancel", "Cancelar", "Kansela"),
    ("purge.confirm", "Delete permanently", "Eliminar definitivamente",
     "Hasai permanente"),
    ("purge.pending", "Deleting…", "A eliminar…", "Hasai hela…"),

    ("//visitor detail", "", "", ""),
    ("common.loading", "Loading…", "A carregar…", "Karga hela…"),
    ("visitor.fallbackTitle", "Visitor", "Visitante", "Vizitante"),
    ("visitor.notFound", "Could not load this visitor",
     "Não foi possível carregar este visitante",
     "La bele karga vizitante ne’e"),
    ("visitor.notFoundBody",
     "They may have been deleted. Check the visitor list.",
     "Pode ter sido eliminado. Consulte a lista de visitantes.",
     "Karik hasai tiha ona. Haree lista vizitante."),
    ("visitor.backToAll", "Back to all visitors",
     "Voltar a todos os visitantes", "Fila ba vizitante hotu"),
    ("visitor.allVisitors", "All visitors", "Todos os visitantes",
     "Vizitante hotu"),
    ("visitor.status.active", "Active", "Ativo", "Ativu"),
    ("visitor.headingActive", "This badge opens the door",
     "Este crachá abre a porta", "Kartaun ne’e loke odamatan"),
    ("visitor.headingOff", "This badge is switched off",
     "Este crachá está desligado", "Kartaun ne’e desliga ona"),
    ("visitor.subActive",
     "Any paired scanner will accept it and the lobby screen will welcome them.",
     "Qualquer leitor emparelhado aceita-o e o ecrã do átrio dá as "
     "boas-vindas.",
     "Leitór ne’ebé pareia ona sei simu, no ekrán resepsaun sei fó benvindu."),
    ("visitor.subOff",
     "The next scan of it shows red. Activating puts the same card back to "
     "work — nothing needs reprinting.",
     "A próxima leitura mostra vermelho. Ativar põe o mesmo cartão a funcionar "
     "— não é preciso reimprimir.",
     "Leitura tuirmai sei mosu mean. Ativa fó fila kartaun hanesan ba servisu "
     "— la presiza imprime fali."),
    ("visitor.registered", "Registered", "Registado", "Rejista"),
    ("visitor.arrivals", "Arrivals", "Chegadas", "Xegada"),
    ("visitor.lastArrival", "Last arrival", "Última chegada", "Xegada ikus"),
    ("visitor.notYet", "Not yet", "Ainda não", "Seidauk"),
    ("visitor.scansLogged", "Scans logged", "Leituras registadas",
     "Leitura rejistadu"),
    ("visitor.activating", "Activating…", "A ativar…", "Ativa hela…"),
    ("visitor.qrNote",
     "This QR was generated when the visitor was registered and never changes. "
     "Reprint the card as often as you need — it scans the same every time. "
     "Deactivating stops it and activating starts it again, both without "
     "touching the code on the card. Deleting permanently is the only thing "
     "here that cannot be undone.",
     "Este QR foi gerado no registo do visitante e nunca muda. Reimprima o "
     "cartão as vezes que precisar — lê-se sempre igual. Desativar para-o e "
     "ativar volta a pô-lo a funcionar, sem tocar no código do cartão. "
     "Eliminar definitivamente é a única coisa aqui que não pode ser anulada.",
     "QR ne’e kria bainhira rejista vizitante no nunka muda. Imprime fali "
     "kartaun dala hira mak presiza — nia lee hanesan beibeik. Dezativa para "
     "nia, no ativa hahú fali, rua ne’e la book kódigu iha kartaun. Hasai "
     "permanente mak buat ida deit iha ne’e ne’ebé la bele fila fali."),
    ("visitor.scanHistory", "Scan history", "Histórico de leituras",
     "Istória leitura"),
    ("visitor.scanHistoryBody",
     "Every time this badge was presented, including the times it was refused.",
     "Todas as vezes que este crachá foi apresentado, incluindo as recusadas.",
     "Dala hotu kartaun ne’e aprezenta, inklui dala ne’ebé rejeita."),
    ("visitor.noScans", "This badge has not been scanned yet.",
     "Este crachá ainda não foi lido.", "Kartaun ne’e seidauk lee."),
    ("visitor.col.event", "Event", "Evento", "Eventu"),
    ("visitor.col.scannedAt", "Scanned at", "Lido em", "Lee iha"),
    ("visitor.col.result", "Result", "Resultado", "Rezultadu"),
    ("visitor.col.device", "Device", "Dispositivo", "Aparellu"),
    ("scan.valid", "Valid", "Válido", "Válidu"),
    ("scan.duplicate", "Duplicate", "Duplicado", "Duplikadu"),
    ("scan.revoked", "Revoked", "Revogado", "Revogadu"),
    ("scan.invalid", "Invalid", "Inválido", "Inválidu"),

    ("//registration form", "", "", ""),
    ("register.title", "Register a visitor", "Registar um visitante",
     "Rejista vizitante ida"),
    ("register.subtitle",
     "One badge, printed in advance, valid for the whole event",
     "Um crachá, impresso com antecedência, válido para todo o evento",
     "Kartaun ida, imprime uluk, válidu ba eventu tomak"),
    ("register.issuedTitle", "Badge issued", "Crachá emitido",
     "Kartaun fó sai ona"),
    ("register.issuedSubtitle",
     "Print the card now, or from the visitor’s page later",
     "Imprima o cartão agora, ou mais tarde a partir da página do visitante",
     "Imprime kartaun agora, ka depois husi vizitante nia pájina"),
    ("form.photoRequired",
     "A badge needs a photo. Add one before registering.",
     "Um crachá precisa de uma fotografia. Adicione uma antes de registar.",
     "Kartaun presiza foto. Tau ida molok rejista."),
    ("form.fullName", "Full name", "Nome completo", "Naran kompletu"),
    ("form.fullNameHint", "As it should read on the badge.",
     "Como deve aparecer no crachá.",
     "Hanesan ne’ebé tenke mosu iha kartaun."),
    ("form.country", "Country", "País", "Nasaun"),
    ("form.organisation", "Organisation", "Organização", "Organizasaun"),
    ("form.optional", "Optional.", "Opcional.", "Opsionál."),
    ("form.category", "Category", "Categoria", "Kategoria"),
    ("form.cat.normal", "Normal", "Normal", "Normál"),
    ("form.cat.normalNote", "Standard badge", "Crachá normal",
     "Kartaun normál"),
    ("form.cat.vip", "VIP", "VIP", "VIP"),
    ("form.cat.vipNote", "Distinct card and lobby welcome",
     "Cartão distinto e boas-vindas no átrio",
     "Kartaun espesiál no benvindu iha resepsaun"),
    ("form.registering", "Registering…", "A registar…", "Rejista hela…"),
    ("form.saving", "Saving…", "A guardar…", "Rai hela…"),
    ("form.register", "Register and issue badge", "Registar e emitir crachá",
     "Rejista no fó sai kartaun"),
    ("form.save", "Save changes", "Guardar alterações", "Rai mudansa"),
    ("form.noteCreate",
     "The serial is assigned when you register. The QR is generated at the "
     "same moment and never changes afterwards.",
     "O número é atribuído no momento do registo. O QR é gerado nesse mesmo "
     "instante e nunca muda depois.",
     "Númeru fó bainhira rejista. QR kria iha momentu hanesan no nunka muda "
     "depois."),
    ("form.noteEdit",
     "Editing details does not reissue the badge. The serial and the QR code "
     "stay exactly as printed.",
     "Editar os dados não reemite o crachá. O número e o código QR ficam "
     "exatamente como foram impressos.",
     "Edita dadus la fó sai kartaun foun. Númeru no kódigu QR sei hanesan ho "
     "ne’ebé imprime ona."),

    ("//badge receipt", "", "", ""),
    ("receipt.badgeIssued", "Badge issued", "Crachá emitido",
     "Kartaun fó sai ona"),
    ("receipt.registered", "{name} is registered", "{name} está registado",
     "{name} rejista ona"),
    ("receipt.permanent",
     "This QR is permanent. It was generated when {name} was registered and "
     "will not change — print it now, or from their page later, as many times "
     "as you need. It only stops working if you deactivate or delete the "
     "visitor.",
     "Este QR é permanente. Foi gerado quando {name} foi registado e não muda "
     "— imprima-o agora, ou mais tarde a partir da página do visitante, as "
     "vezes que precisar. Só deixa de funcionar se desativar ou eliminar o "
     "visitante.",
     "QR ne’e permanente. Nia kria bainhira rejista {name} no sei la muda — "
     "imprime agora, ka depois husi nia pájina, dala hira mak presiza. Nia "
     "para funsiona deit se dezativa ka hasai vizitante."),
    ("receipt.qrAlt", "QR code for badge {serial}",
     "Código QR do crachá {serial}", "Kódigu QR ba kartaun {serial}"),
    ("receipt.badgeToken", "Badge token", "Token do crachá", "Token kartaun"),
    ("receipt.rendering", "Rendering…", "A gerar…", "Kria hela…"),
    ("receipt.downloadPdf", "Download badge PDF",
     "Transferir PDF do crachá", "Deskarrega PDF kartaun"),
    ("receipt.printBrowser", "Print from browser", "Imprimir pelo navegador",
     "Imprime husi navegadór"),
    ("receipt.copied", "Copied", "Copiado", "Kopia ona"),
    ("receipt.copyToken", "Copy token", "Copiar token", "Kopia token"),
    ("receipt.qrFailed",
     "The QR code could not be drawn. Copy the token and print the badge from "
     "another machine rather than issuing a card without a code.",
     "Não foi possível desenhar o código QR. Copie o token e imprima o crachá "
     "noutra máquina, em vez de emitir um cartão sem código.",
     "La bele dezenha kódigu QR. Kopia token no imprime kartaun iha makina "
     "seluk, duke fó sai kartaun laiha kódigu."),
    ("receipt.copiedAnnounce", "Badge token copied to the clipboard.",
     "Token do crachá copiado para a área de transferência.",
     "Token kartaun kopia ba área transferénsia."),
    ("receipt.badgeSerial", "Badge serial", "Número do crachá",
     "Númeru kartaun"),
    ("receipt.registerAnother", "Register another visitor",
     "Registar outro visitante", "Rejista vizitante seluk"),
    ("receipt.open", "Open {name}", "Abrir {name}", "Loke {name}"),
    ("receipt.renderFailed", "The badge could not be rendered.",
     "Não foi possível gerar o crachá.", "La bele kria kartaun."),

    ("//edit", "", "", ""),
    ("edit.title", "Edit {name}", "Editar {name}", "Edita {name}"),
    ("edit.fallbackTitle", "Edit visitor", "Editar visitante",
     "Edita vizitante"),
]


def literal(text):
    out = []
    for ch in text:
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ord(ch) < 128:
            out.append(ch)
        else:
            out.append("\\u%04x" % ord(ch))
    return '"' + "".join(out) + '"'


def build(head, tail, index):
    lines = [head]
    for entry in M:
        key = entry[0]
        if key.startswith("//"):
            name = key[2:]
            lines.append("")
            lines.append("  // " + "-" * (68 - len(name)) + " " + name + " --")
            continue
        value = literal(entry[index])
        one = '  "%s": %s,' % (key, value)
        if len(one) <= 80:
            lines.append(one)
        else:
            lines.append('  "%s":' % key)
            lines.append("    %s," % value)
    lines.append(tail)
    return "\n".join(lines)


ROOT.joinpath("en.ts").write_text(build(HEAD_EN, TAIL_EN, 1), encoding="utf-8")
ROOT.joinpath("pt.ts").write_text(build(HEAD_PT, "};\n", 2), encoding="utf-8")
ROOT.joinpath("tet.ts").write_text(build(HEAD_TET, "};\n", 3), encoding="utf-8")

for name in ("en.ts", "pt.ts", "tet.ts"):
    raw = ROOT.joinpath(name).read_bytes()
    bad = [b for b in raw if b > 127]
    keys = sum(1 for e in M if not e[0].startswith("//"))
    print("%-6s bytes=%-6d non-ascii=%-3d keys=%d" % (name, len(raw), len(bad), keys))
