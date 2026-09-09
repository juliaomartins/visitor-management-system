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
};
