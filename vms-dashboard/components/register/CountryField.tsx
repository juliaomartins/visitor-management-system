"use client";

import { COUNTRIES } from "@/lib/countries";
import { useT } from "@/lib/i18n";

/**
 * A searchable country picker, built on the browser's own `<datalist>`.
 *
 * Typing filters the list natively on Android Chrome and iOS Safari, with the
 * platform's own keyboard and suggestion UI -- which a phone user already knows
 * how to drive -- and no custom listbox to get wrong for a screen reader. The
 * catch with a datalist is that it also accepts free text, so the form checks
 * the value against the list before submitting and names the problem if not.
 */
export function CountryField({
  value,
  onChange,
  invalid,
  errors,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  errors?: string[];
}) {
  const t = useT();
  const message = invalid ? t("publicRegister.countryInvalid") : errors?.join(" ");

  return (
    <div>
      <label htmlFor="country" className="block text-sm font-medium text-ink-2">
        {t("publicRegister.country")}
      </label>
      <input
        id="country"
        name="country"
        list="country-options"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("publicRegister.countryPlaceholder")}
        autoComplete="country-name"
        required
        aria-invalid={message ? true : undefined}
        className="field mt-1.5 text-base"
      />
      <datalist id="country-options">
        {COUNTRIES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {message ? (
        <p role="alert" className="mt-1.5 text-xs text-revoked">
          {message}
        </p>
      ) : null}
    </div>
  );
}
