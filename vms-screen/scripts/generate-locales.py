# -*- coding: utf-8 -*-
"""Emit the pairing screen's three dictionaries as pure ASCII TypeScript.

THE WALL IS NOT IN HERE ANY MORE. This used to carry the whole lobby screen,
29 keys, and the display had a language switcher in its corner. The switcher
now lives on `/pair` alone and the wall is English, so the wall's words moved
to `lib/wall-copy.ts` as plain constants and this table kept only what is
actually translated: the language control, pairing, and finding the server.

Fifteen keys, all of them read by somebody standing at the kiosk during setup
and by nobody afterwards. A key in here is a promise that the string is
translated; leaving "Welcome" behind would have kept that promise on file and
broken it in the room.

Same escaping rule as the dashboard's generator, for the same reason: a shell
heredoc on this Windows machine mangles non-ASCII silently, and a mojibaked
word is the worst thing to discover by reading bytes.
"""
from pathlib import Path

ROOT = Path(r"C:\workplace\vms\vms-screen\lib\locales")

HEAD_EN = '''/**
 * English - the source of truth for the pairing screen's messages.
 *
 * SETUP ONLY. The lobby wall is English and its words are plain constants in
 * `lib/wall-copy.ts`; everything here is read by an installer standing at the
 * kiosk on the first morning and by nobody after that. That is why the set is
 * small and why it is worth translating: somebody who has landed in a language
 * they cannot read needs a way out, and this is the screen they are on.
 *
 * `pt.ts` and `tet.ts` are typed as `Messages`, so omitting a key is a compile
 * error rather than an English word appearing mid-setup.
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
 * Setup words only, and they are the ones that matter most to get right: an
 * installer who cannot read the screen cannot finish. Worth a native check.
 *
 * Generated and escaped for the reason given in `en.ts`.
 */
export const tet: Messages = {'''

TAIL_EN = '''} as const;

/** Every message key on the pairing screen. */
export type MessageKey = keyof typeof en;

/** The shape a translation has to satisfy. */
export type Messages = Record<MessageKey, string>;
'''

M = [
    ("//the language control", "", "", ""),
    ("language.label", "Language", "Idioma", "Lian"),
    ("language.choose", "Choose a language", "Escolher idioma", "Hili lian"),

    ("//pairing", "", "", ""),
    ("pair.title", "Pair this display", "Emparelhar este ecrã",
     "Pareia ekrán ne’e"),
    ("pair.body", "Enter the screen pairing code from the dashboard.",
     "Introduza o código de emparelhamento do ecrã, vindo do painel.",
     "Tau kódigu pareia ekrán husi painél."),
    ("pair.codeLabel", "Six character pairing code",
     "Código de emparelhamento de seis caracteres",
     "Kódigu pareia ho karakter neen"),
    ("pair.pairing", "Pairing…", "A emparelhar…", "Pareia hela…"),
    ("pair.submit", "Pair display", "Emparelhar ecrã", "Pareia ekrán"),
    ("pair.finding", "Finding the server…", "A procurar o servidor…",
     "Buka servidór hela…"),
    ("pair.noServer", "No server found", "Nenhum servidor encontrado",
     "La hetan servidór"),
    ("pair.unreachable",
     "Could not reach the server. Check this machine is on the event network.",
     "Não foi possível contactar o servidor. Verifique se esta máquina está na "
     "rede do evento.",
     "La bele kontaktu servidór. Verifika se makina ne’e iha rede eventu."),

    ("//server setup", "", "", ""),
    ("server.address", "Server address", "Endereço do servidor",
     "Enderesu servidór"),
    ("server.hint",
     "A bare IP is fine — {http} and the port are filled in for you.",
     "Basta o IP — {http} e a porta são preenchidos por si.",
     "IP mesak deit di’ak ona — {http} no porta prenxe ba ita."),
    ("server.badAddress",
     "That does not look like an address. Try 10.101.196.41:8000",
     "Isso não parece um endereço. Experimente 10.101.196.41:8000",
     "Ne’e la hanesan enderesu. Koko 10.101.196.41:8000"),
    ("server.checking", "Checking…", "A verificar…",
     "Verifika hela…"),
    ("server.connect", "Connect", "Ligar", "Konekta"),
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
