import type { Messages } from "./en";

/**
 * Portuguese — European, not Brazilian.
 *
 * Timor-Leste's Portuguese follows Lisbon: "ecrã" not "tela", "crachá" not
 * "crachá de identificação", "a terminar sessão" not "saindo". The progressive
 * is "a + infinitive", which is why the busy states below read "A imprimir…"
 * rather than the Brazilian "Imprimindo…".
 */
export const pt: Messages = {
  // ---------------------------------------------------------------- shell --
  "nav.sections": "Secções",
  "nav.group.overview": "Visão geral",
  "nav.group.accreditation": "Acreditação",
  "nav.group.operations": "Operações",
  "nav.dashboard": "Painel",
  "nav.dashboard.hint": "Chegadas e estado das portas",
  "nav.visitors": "Visitantes",
  "nav.visitors.hint": "Registar e emitir crachás",
  "nav.badges": "Crachás",
  "nav.badges.hint": "Fila de impressão",
  "nav.devices": "Dispositivos",
  "nav.devices.hint": "Portas e ecrãs",
  "nav.reports": "Relatórios",
  "nav.reports.hint": "Registo de entradas",
  "nav.expand": "Expandir menu",
  "nav.collapse": "Recolher menu",
  "nav.signOut": "Terminar sessão",
  "nav.signingOut": "A terminar sessão…",
  "nav.silentDevices": "{count} dispositivo sem comunicar recentemente",

  "shell.restoringSession": "A restaurar sessão",
  "topbar.localTime": "Hora local",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Mudar para modo escuro",
  "theme.toLight": "Mudar para modo claro",
  "theme.dark": "Escuro",
  "theme.light": "Claro",

  "language.label": "Idioma",
  "language.choose": "Escolher idioma",
};
