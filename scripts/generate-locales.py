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
