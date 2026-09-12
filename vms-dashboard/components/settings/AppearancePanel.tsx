"use client";

import { setLocale, useLocale, useT } from "@/lib/i18n";
import { LOCALES } from "@/lib/locales";
import { setTheme, useTheme, type Theme } from "@/lib/theme";

/**
 * Theme and language, as choices rather than as toggles.
 *
 * BOTH ALREADY EXIST IN THE TOPBAR AND BOTH STAY THERE. This does not move
 * them: a registrar with a queue in front of them should not have to navigate
 * to change the language. It mirrors them, because Settings is where somebody
 * looks for a preference they are not in a hurry about.
 *
 * The difference is not cosmetic. `ThemeToggle` deliberately labels its
 * DESTINATION -- the button says "Dark" when pressing it gives you dark -- and
 * its own comment explains why that is right for a control you glance at. A
 * settings page needs the opposite: the current state, visible without pressing
 * anything. That is a radio group, and it is the same reason these are real
 * `<input type="radio">` elements in a real `<fieldset>` rather than invented
 * pills: arrow keys move between options, the legend names the group for a
 * screen reader, and none of that has to be rebuilt.
 */
export function AppearancePanel() {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();

  return (
    <section className="card">
      <div className="px-5 pt-5">
        <h2 className="display text-[1.05rem] text-ink">
          {t("settings.appearance")}
        </h2>
        <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-ink-3">
          {t("settings.appearanceNote")}
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
        <Choices
          legend={t("settings.themeLabel")}
          name="vms-theme"
          value={theme}
          options={THEMES.map((entry) => ({
            value: entry,
            /*
              The theme's own word, translated: "Dark" and "Light" are already
              in the dictionary for the topbar button, so the two controls
              cannot come to disagree about what to call a theme.
            */
            label: t(entry === "dark" ? "theme.dark" : "theme.light"),
          }))}
          onChange={(next) => setTheme(next as Theme)}
        />

        <Choices
          legend={t("settings.languageLabel")}
          name="vms-locale"
          value={locale}
          /*
            Each language named in ITSELF -- `LOCALES[].label` is "Portugues",
            not "Portuguese". Somebody hunting for their own language scans for
            the word they would use, which by definition is not in the language
            currently on screen.
          */
          options={LOCALES.map((entry) => ({
            value: entry.code,
            label: entry.label,
          }))}
          onChange={(next) => setLocale(next as (typeof LOCALES)[number]["code"])}
        />
      </div>
    </section>
  );
}

const THEMES: Theme[] = ["light", "dark"];

/**
 * One `fieldset` of radios, styled as rows.
 *
 * The whole row is the label, so the hit target is the row and not the 16px
 * circle -- which matters on the touchscreen laptop this runs on at a desk. The
 * native input is kept and only visually replaced, so focus, arrow keys and
 * `:checked` all still come from the browser.
 */
function Choices({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs text-ink-3">{legend}</legend>

      <div className="mt-2 space-y-1">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong hover:bg-card-2"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {/* Drawn, not the browser's own dot: this has to sit on both
                  themes and the native control ignores most of that. */}
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-accent" : "border-line-strong"
                }`}
              >
                {selected ? (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                ) : null}
              </span>
              <span
                className={`text-sm ${selected ? "font-medium text-ink" : "text-ink-2"}`}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
