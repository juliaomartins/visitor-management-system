# -*- coding: utf-8 -*-
"""Emit the lobby screen's three dictionaries as pure ASCII TypeScript.

Same escaping rule as the dashboard's generator, for the same reason: a shell
heredoc on this Windows machine mangles non-ASCII silently, and a mojibaked
greeting on a wall-sized panel is the worst place to find that out.
"""
from pathlib import Path

ROOT = Path(r"C:\workplace\vms\vms-screen\lib\locales")

HEAD_EN = '''/**
 * English - the source of truth for the lobby screen's messages.
 *
 * A MUCH SMALLER SET THAN THE DASHBOARD'S, and deliberately so. This panel has
 * almost no words on it: a greeting, a status, a clock and the two setup screens
 * nobody sees after the first morning. Everything else on the wall is a name, a
 * country and a photograph, which need no translation.
 *
 * `pt.ts` and `tet.ts` are typed as `Messages`, so omitting a key is a compile
 * error rather than an English word appearing on a wall in front of delegates.
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
 * The greeting is the one word on this panel a visitor actually reads, and
 * "Benvindu" is what a Timorese lobby says. Worth a native check all the same.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const tet: Messages = {'''

TAIL_EN = '''} as const;

/** Every message key on the lobby screen. */
export type MessageKey = keyof typeof en;

/** The shape a translation has to satisfy. */
export type Messages = Record<MessageKey, string>;
'''

M = [
    ("//the wall", "", "", ""),
    ("welcome.greeting", "Welcome", "Bem-vindo", "Benvindu"),
    ("welcome.statusVip", "VIP Visitor", "Visitante VIP", "Vizitante VIP"),
    ("welcome.statusVisitor", "Visitor", "Visitante", "Vizitante"),
    ("welcome.admitted", "Admitted", "Admitido", "Simu ona"),
    ("welcome.guest", "Guest", "Convidado", "Konvidadu"),
    ("idle.waiting", "Waiting for arrivals", "A aguardar chegadas",
     "Hein xegada"),
    ("queue.next", "Next", "Segue", "Tuirmai"),
    ("feed.connected", "Arrival feed connected",
     "Ligado ao fluxo de chegadas", "Konekta ba fluxu xegada"),
    ("feed.disconnected", "Arrival feed disconnected",
     "Desligado do fluxo de chegadas", "La konekta ba fluxu xegada"),
    ("brand.organisers", "Organisers", "Organizadores", "Organizadór sira"),

    ("//preferences", "", "", ""),
    ("theme.toDark", "Switch the display to dark mode",
     "Mudar o ecrã para modo escuro", "Troka ekrán ba modu nakukun"),
    ("theme.toLight", "Switch the display to light mode",
     "Mudar o ecrã para modo claro", "Troka ekrán ba modu naroman"),
    ("language.label", "Language", "Idioma", "Lian"),
    ("language.choose", "Choose a language", "Escolher idioma", "Hili lian"),

    ("//pairing", "", "", ""),
    ("pair.title", "Pair this display", "Emparelhar este ecrã",
     "Pareia ekrán ne\u2019e"),
    ("pair.body", "Enter the screen pairing code from the dashboard.",
     "Introduza o código de emparelhamento do ecrã, vindo do painel.",
     "Tau kódigu pareia ekrán husi painél."),
    ("pair.codeLabel", "Six character pairing code",
     "Código de emparelhamento de seis caracteres",
     "Kódigu pareia ho karakter neen"),
    ("pair.pairing", "Pairing\u2026", "A emparelhar\u2026", "Pareia hela\u2026"),
    ("pair.submit", "Pair display", "Emparelhar ecrã", "Pareia ekrán"),
    ("pair.finding", "Finding the server\u2026", "A procurar o servidor\u2026",
     "Buka servidór hela\u2026"),
    ("pair.noServer", "No server found", "Nenhum servidor encontrado",
     "La hetan servidór"),
    ("pair.unreachable",
     "Could not reach the server. Check this machine is on the event network.",
     "Não foi possível contactar o servidor. Verifique se esta máquina está na "
     "rede do evento.",
     "La bele kontaktu servidór. Verifika se makina ne\u2019e iha rede eventu."),

    ("//server setup", "", "", ""),
    ("server.address", "Server address", "Endereço do servidor",
     "Enderesu servidór"),
    ("server.hint",
     "A bare IP is fine \u2014 {http} and the port are filled in for you.",
     "Basta o IP \u2014 {http} e a porta são preenchidos por si.",
     "IP mesak deit di\u2019ak ona \u2014 {http} no porta prenxe ba ita."),
    ("server.badAddress",
     "That does not look like an address. Try 10.101.196.41:8000",
     "Isso não parece um endereço. Experimente 10.101.196.41:8000",
     "Ne\u2019e la hanesan enderesu. Koko 10.101.196.41:8000"),
    ("server.checking", "Checking\u2026", "A verificar\u2026",
     "Verifika hela\u2026"),
    ("server.connect", "Connect", "Ligar", "Konekta"),

    ("//document", "", "", ""),
    ("meta.title", "DRCC 2026 \u2014 Arrivals", "DRCC 2026 \u2014 Chegadas",
     "DRCC 2026 \u2014 Xegada"),
    ("meta.description",
     "D\u00edli Regional Cooperative Conference and Ministerial Dialogue 2026 "
     "\u2014 lobby arrivals display.",
     "Conferência Regional Cooperativa de Díli e Diálogo Ministerial 2026 "
     "\u2014 ecrã de chegadas do átrio.",
     "Konferénsia Rejionál Kooperativa Díli no Diálogu Ministeriál 2026 "
     "\u2014 ekrán xegada iha resepsaun."),
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
