# -*- coding: utf-8 -*-
"""Emit the scanner's three dictionaries as pure ASCII TypeScript.

Same escaping rule as the other two apps: a shell heredoc on this Windows
machine mangles non-ASCII silently, and Metro will happily bundle mojibake.
"""
from pathlib import Path

ROOT = Path(r"C:\workplace\vms\vms-scanner\src\locales")

HEAD_EN = '''/**
 * English - the source of truth for the scanner's messages.
 *
 * WRITTEN FOR SOMEBODY STANDING AT A DOOR, not sitting at a desk. The verdict
 * words are the ones a guard reads at arm's length while looking at a visitor's
 * face, so they stay short in all three languages even where a longer phrase
 * would be more literal.
 *
 * `pt.ts` and `tet.ts` are typed as `Messages`, so omitting a key is a compile
 * error rather than an English word appearing on a phone at a door.
 *
 * Non-ASCII is written as \\uXXXX escapes and these files are generated - see
 * the dashboard's `lib/locales/en.ts` for the incident that made that a rule.
 */
export const en = {'''

HEAD_PT = '''import type { Messages } from "./en";

/**
 * Portuguese - European, as Timor-Leste writes it.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const pt: Messages = {'''

HEAD_TET = '''import type { Messages } from "./en";

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
export const tet: Messages = {'''

TAIL_EN = '''} as const;

/** Every message key in the scanner. */
export type MessageKey = keyof typeof en;

/** The shape a translation has to satisfy. */
export type Messages = Record<MessageKey, string>;
'''

M = [
    ("//verdicts", "", "", ""),
    ("verdict.valid.headline", "Welcome", "Bem-vindo", "Benvindu"),
    ("verdict.valid.detail", "Badge is valid", "O crachá é válido",
     "Kartaun válidu"),
    ("verdict.invalid.headline", "Not a valid badge", "Crachá inválido",
     "Kartaun la válidu"),
    ("verdict.invalid.detail", "This QR code is not from this event",
     "Este código QR não é deste evento",
     "Kódigu QR ne\u2019e la\u2019ós husi eventu ne\u2019e"),
    ("verdict.revoked.headline", "Badge revoked", "Crachá revogado",
     "Kartaun revogadu"),
    ("verdict.revoked.detail",
     "Do not admit. Send them to the registration desk",
     "Não admitir. Encaminhe para o balcão de registo",
     "Labele tama. Haruka ba meza rejistu"),
    ("verdict.duplicate.headline", "Already scanned", "Já lido",
     "Lee tiha ona"),
    ("verdict.duplicate.detail", "Same badge within the last minute",
     "O mesmo crachá no último minuto",
     "Kartaun hanesan iha minutu ikus"),
    ("verdict.tapContinue", "Tap to continue", "Toque para continuar",
     "Hanehan atu kontinua"),
    ("verdict.tapNext", "Tap to scan the next badge",
     "Toque para ler o crachá seguinte",
     "Hanehan atu lee kartaun tuirmai"),
    ("verdict.badgePhoto", "Badge photo of {name}",
     "Fotografia do crachá de {name}", "{name} nia foto kartaun"),
    ("verdict.queued",
     "Queued, not verified. {name}. Tap to continue.",
     "Em fila, não verificado. {name}. Toque para continuar.",
     "Iha fila, seidauk verifika. {name}. Hanehan atu kontinua."),
    ("verdict.unknownBadge", "Unknown badge", "Crachá desconhecido",
     "Kartaun la hatene"),

    ("//camera", "", "", ""),
    ("camera.hint", "Hold the badge QR inside the frame",
     "Mantenha o QR do crachá dentro do quadro",
     "Tau kartaun nia QR iha kuadru laran"),
    ("camera.checking", "Checking\u2026", "A verificar\u2026",
     "Verifika hela\u2026"),
    ("camera.off", "The camera is off", "A câmara está desligada",
     "Kámara desliga ona"),
    ("camera.why",
     "This app reads badge QR codes and does nothing else with the camera. No "
     "photos are taken and nothing is stored on the phone.",
     "Esta aplicação lê códigos QR de crachás e não faz mais nada com a "
     "câmara. Não tira fotografias nem guarda nada no telemóvel.",
     "Aplikasaun ne\u2019e lee kartaun nia kódigu QR deit no la halo buat "
     "seluk ho kámara. La foti foto no la rai buat ida iha telemóvel."),
    ("camera.allow", "Allow the camera", "Permitir a câmara",
     "Fó lisensa ba kámara"),
    ("camera.openSettings", "Open settings to allow it",
     "Abrir definições para permitir", "Loke konfigurasaun atu fó lisensa"),
    ("camera.torchOn", "Torch on", "Lanterna ligada", "Lampu lakan"),
    ("camera.torch", "Torch", "Lanterna", "Lampu"),
    ("camera.turnTorchOn", "Turn the torch on", "Ligar a lanterna",
     "Lakan lampu"),
    ("camera.turnTorchOff", "Turn the torch off", "Desligar a lanterna",
     "Desliga lampu"),
    ("camera.fallbackName", "Scanner", "Leitor", "Leitór"),
    ("camera.unpairA11y", "Unpair this phone",
     "Desemparelhar este telemóvel",
     "Hasai pareia husi telemóvel ne’e"),

    ("//queue", "", "", ""),
    ("queue.syncingOne", "Syncing. {count} scan still pending.",
     "A sincronizar. {count} leitura ainda pendente.",
     "Sinkroniza hela. Leitura {count} seidauk haruka."),
    ("queue.syncingMany", "Syncing. {count} scans still pending.",
     "A sincronizar. {count} leituras ainda pendentes.",
     "Sinkroniza hela. Leitura {count} seidauk haruka."),

    ("//pairing", "", "", ""),
    ("pair.title", "Pair this phone", "Emparelhar este telemóvel",
     "Pareia telemóvel ne\u2019e"),
    ("pair.body", "Enter the scanner pairing code from the dashboard.",
     "Introduza o código de emparelhamento do leitor, vindo do painel.",
     "Tau kódigu pareia leitór husi painél."),
    ("pair.codeLabel", "Six character pairing code",
     "Código de emparelhamento de seis caracteres",
     "Kódigu pareia ho karakter neen"),
    ("pair.nameLabel", "Name this phone", "Dê um nome a este telemóvel",
     "Fó naran ba telemóvel ne\u2019e"),
    ("pair.namePlaceholder", "North door", "Porta norte",
     "Odamatan norte"),
    ("pair.nameA11y", "Device name", "Nome do dispositivo", "Aparellu naran"),
    ("pair.failed", "Pairing failed. Try again.",
     "O emparelhamento falhou. Tente de novo.",
     "Pareia falla. Koko fali."),
    # Kept, but now only for a browser that refuses storage outright -- a
    # private window, or storage blocked. That genuinely cannot pair.
    ("pair.noStorage",
     "This browser will not store anything, so a token cannot be kept. "
     "Leave private browsing, or run the scanner on a phone.",
     "Este navegador não guarda nada, por isso não é possível guardar um "
     "token. Saia da navegação privada, ou use o leitor num telemóvel.",
     "Navegadór ne\u2019e la rai buat ida, tan ne\u2019e la bele rai token. "
     "Sai husi navegasaun privada, ka uza leitór iha telemóvel."),
    # The web case: pairing works, and the operator is told what it means.
    ("pair.browserStorage",
     "This browser has no secure keystore, so the token is kept in ordinary "
     "browser storage. Fine for a check-in desk you control — revoke this "
     "device from the dashboard when the event is over.",
     "Este navegador não tem um cofre seguro, por isso o token fica no "
     "armazenamento comum do navegador. Serve para um posto que controla — "
     "revogue este dispositivo no painel quando o evento terminar.",
     "Navegadór ne\u2019e laiha kofre seguru, tan ne\u2019e token rai iha "
     "armazenamentu baibain. Di\u2019ak ba postu ne\u2019ebé ita kontrola — "
     "revoga aparellu ne\u2019e iha painél bainhira eventu remata."),
    ("pair.finding", "Finding the server\u2026", "A procurar o servidor\u2026",
     "Buka servidór hela\u2026"),
    ("pair.noServer", "No server found", "Nenhum servidor encontrado",
     "La hetan servidór"),

    ("//unpair", "", "", ""),
    ("unpair.title", "Unpair this phone?",
     "Desemparelhar este telemóvel?", "Hasai pareia husi telemóvel ne\u2019e?"),
    ("unpair.body",
     "It stops being able to record scans until it is paired again with a new "
     "code. Revoke it from the dashboard as well if the phone is lost.",
     "Deixa de conseguir registar leituras até ser emparelhado de novo com um "
     "código novo. Revogue-o também no painel se o telemóvel se perder.",
     "Nia la bele rejista leitura ona to\u2019o pareia fali ho kódigu foun. Se "
     "telemóvel lakon, revoga mós husi painél."),
    ("unpair.keep", "Keep paired", "Manter emparelhado", "Rai pareia nafatin"),
    ("unpair.confirm", "Unpair", "Desemparelhar", "Hasai pareia"),

    ("//server", "", "", ""),
    ("server.whereIsIt", "Where is the server?", "Onde está o servidor?",
     "Servidór iha ne\u2019ebé?"),
    ("server.cannotReach", "CANNOT REACH THE SERVER",
     "NÃO É POSSÍVEL CONTACTAR O SERVIDOR",
     "LA BELE KONTAKTU SERVIDÓR"),
    ("server.alreadyTried", "Already tried", "Já tentados", "Koko tiha ona"),
    ("server.address", "Server address", "Endereço do servidor",
     "Enderesu servidór"),
    ("server.addressA11y", "Server IP address and port",
     "Endereço IP e porta do servidor", "Servidór nia enderesu IP no porta"),
    ("server.ipLabel", "IP address or hostname", "Endereço IP ou nome do anfitrião",
     "Enderesu IP ka naran host"),
    ("server.portLabel", "Port", "Porta", "Porta"),
    ("server.ipA11y", "Server IP address or hostname",
     "Endereço IP ou nome do anfitrião do servidor",
     "Servidór nia enderesu IP ka naran host"),
    ("server.portA11y", "Server port", "Porta do servidor",
     "Servidór nia porta"),
    ("server.hint",
     "Ask the machine running the server for its IP address, or run {cmd} on "
     "it.",
     "Peça o endereço IP à máquina que corre o servidor, ou execute {cmd} nela.",
     "Husu enderesu IP ba makina ne\u2019ebé la\u2019o servidór, ka hala\u2019o "
     "{cmd} iha nia."),
    ("server.test", "Test connection", "Testar ligação", "Testa ligasaun"),
    ("server.save", "Save address", "Guardar endereço", "Rai enderesu"),
    ("server.useBuiltIn", "Use the built-in address again",
     "Voltar a usar o endereço predefinido",
     "Uza fali enderesu ne\u2019ebé iha ona"),
    ("server.cancel", "Cancel", "Cancelar", "Kansela"),
    ("server.connect", "Connect", "Ligar", "Konekta"),
    ("server.searching", "Searching\u2026", "A procurar\u2026",
     "Buka hela\u2026"),
    ("server.retrySaved", "Try the saved addresses again",
     "Tentar de novo os endereços guardados",
     "Koko fali enderesu ne\u2019ebé rai ona"),
    ("server.settingsA11y", "Server address settings",
     "Definições do endereço do servidor",
     "Konfigurasaun enderesu servidór"),
    ("server.checking", "Checking", "A verificar", "Verifika hela"),
    ("server.online", "Online", "Ligado", "Konekta"),
    ("server.offline", "Offline", "Desligado", "La konekta"),

    ("//server errors", "", "", ""),
    ("server.badAddress",
     "That does not look like an address. Try something like 192.168.0.63.",
     "Isso não parece um endereço. Experimente algo como 192.168.0.63.",
     "Ne\u2019e la hanesan enderesu. Koko hanesan 192.168.0.63."),
    ("server.timeout",
     "No answer within five seconds. Check that this phone and the server are "
     "on the same Wi-Fi.",
     "Sem resposta em cinco segundos. Verifique se este telemóvel e o servidor "
     "estão na mesma Wi-Fi.",
     "Laiha resposta iha segundu lima. Verifika se telemóvel ne\u2019e ho "
     "servidór iha Wi-Fi hanesan."),
    ("server.refused",
     "Nothing is listening there. Check the address, and that the server is "
     "running.",
     "Não há nada à escuta nesse endereço. Verifique o endereço e se o "
     "servidor está a correr.",
     "Laiha buat ida rona iha ne\u2019ebá. Verifika enderesu, no se servidór "
     "la\u2019o hela."),
    ("server.notVms",
     "Something answered, but it is not the VMS server (HTTP {status}). Check "
     "the port.",
     "Algo respondeu, mas não é o servidor VMS (HTTP {status}). Verifique a "
     "porta.",
     "Buat ida hatán, maibé la\u2019ós servidór VMS (HTTP {status}). Verifika "
     "porta."),
    ("server.nothingAnswered",
     "Nothing answered there. Check the address, and that the server is on and "
     "on this network.",
     "Nada respondeu nesse endereço. Verifique o endereço, e se o servidor "
     "está ligado e nesta rede.",
     "Laiha buat ida hatán iha ne\u2019ebá. Verifika enderesu, no se servidór "
     "lakan no iha rede ne\u2019e."),

    ("settings.hint",
     "Point this phone at the server. Ask whoever set up the laptop for its IP "
     "address, or run {cmd} on it.",
     "Aponte este telemóvel ao servidor. Peça o endereço IP a quem "
     "configurou o portátil, ou execute {cmd} nele.",
     "Hatudu telemóvel ne’e ba servidór. Husu enderesu IP ba ema "
     "ne’ebé prepara laptop, ka hala’o {cmd} iha nia."),
    ("settings.testFirst", "Test the address before saving it.",
     "Teste o endereço antes de o guardar.",
     "Testa enderesu molok rai."),
    ("settings.connected", "Connected. This is the VMS server.",
     "Ligado. Este é o servidor VMS.",
     "Konekta ona. Ne’e mak servidór VMS."),
    ("settings.reports", "It reports {ip}.", "Reporta {ip}.",
     "Nia hato’o {ip}."),
    ("setup.hint",
     "Ask whoever set up the laptop for its IP address, or run {cmd} on it. "
     "The port is almost always 8000.",
     "Peça o endereço IP a quem configurou o portátil, ou execute "
     "{cmd} nele. A porta é quase sempre 8000.",
     "Husu enderesu IP ba ema ne’ebé prepara laptop, ka hala’o {cmd} "
     "iha nia. Porta baibain 8000."),
    ("setup.bareIp",
     "A bare IP is fine — http:// and the port are filled in for you.",
     "Basta o IP — o http:// e a porta são preenchidos automaticamente.",
     "IP mesak deit mos bele — http:// ho porta prenxe automatikamente."),

    ("//language", "", "", ""),
    ("language.label", "Language", "Idioma", "Lian"),
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


ROOT.mkdir(parents=True, exist_ok=True)
ROOT.joinpath("en.ts").write_text(build(HEAD_EN, TAIL_EN, 1), encoding="utf-8")
ROOT.joinpath("pt.ts").write_text(build(HEAD_PT, "};\n", 2), encoding="utf-8")
ROOT.joinpath("tet.ts").write_text(build(HEAD_TET, "};\n", 3), encoding="utf-8")

for name in ("en.ts", "pt.ts", "tet.ts"):
    raw = ROOT.joinpath(name).read_bytes()
    bad = [b for b in raw if b > 127]
    keys = sum(1 for e in M if not e[0].startswith("//"))
    print("%-6s bytes=%-6d non-ascii=%-3d keys=%d" % (name, len(raw), len(bad), keys))
