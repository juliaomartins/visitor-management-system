"use client";

import {
  useId,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { COUNTRIES, type Country } from "@/lib/countries";
import { findCountryByText, searchCountries } from "@/lib/country-search";
import { useT } from "@/lib/i18n";

type InputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "role" | "value" | "defaultValue" | "onChange" | "autoComplete"
>;

interface CountryComboboxProps extends InputProps {
  /** A country name from the list, or '' while nothing valid is selected. */
  value: string;
  onValueChange: (name: string) => void;
}

/**
 * A text field that suggests countries as they are typed -- the WAI-ARIA
 * editable combobox with a listbox popup.
 *
 * NOT A `<datalist>`, which it replaces. A datalist filters by substring only, so
 * "usa", "holland" and "portgal" found nothing; Chrome on Android shows it as a
 * keyboard strip that hides half the options; and it accepts any free text, which
 * the form then had to reject after the fact.
 *
 * Only a country picked from the list, or typed out in full (its name or an
 * alternative name), counts as a value. Anything else reports ''.
 */
export function CountryCombobox({
  value,
  onValueChange,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  ...inputProps
}: CountryComboboxProps) {
  const t = useT();
  const listId = useId();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // A value set from outside -- a record loaded for editing -- replaces the text.
  // Adjusted during render rather than in an effect, so no frame shows the old text.
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    if (value && findCountryByText(text, COUNTRIES)?.name !== value) setText(value);
  }

  const query = text.trim();
  const matches = open && query ? searchCountries(query, COUNTRIES) : [];
  const showList = matches.length > 0;
  const showEmpty = open && query !== "" && matches.length === 0;
  const active = showList ? Math.min(activeIndex, matches.length - 1) : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(country: Country) {
    setText(country.name);
    setOpen(false);
    onValueChange(country.name);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setText(next);
    setOpen(true);
    setActiveIndex(0);
    // A name typed out in full counts at once; anything else clears the selection.
    onValueChange(findCountryByText(next, COUNTRIES)?.name ?? "");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (showList) {
          setActiveIndex(Math.min(active + 1, matches.length - 1));
        } else {
          setOpen(true);
          setActiveIndex(0);
        }
        break;
      case "ArrowUp":
        if (showList) {
          event.preventDefault();
          setActiveIndex(Math.max(active - 1, 0));
        }
        break;
      case "Enter":
        // Pick the highlighted country. Without preventDefault, Enter here would
        // submit the registration with whatever half-typed text was in the field.
        if (showList && active >= 0) {
          event.preventDefault();
          choose(matches[active].country);
        }
        break;
      case "Escape":
        if (showList || showEmpty) {
          event.preventDefault();
          setOpen(false);
        }
        break;
    }
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    if (!value && query) setOpen(true);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setOpen(false);
    const exact = findCountryByText(text, COUNTRIES);
    if (exact) {
      // Show the official name: "usa" becomes "United States".
      setText(exact.name);
      onValueChange(exact.name);
    }
    onBlur?.(event);
  }

  // The popup is absolutely positioned under the input, over whatever follows it.
  // Nothing above this in either form clips overflow; keep it that way.
  const popup =
    "absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 rounded-[0.6rem] border border-line-strong bg-card shadow-[0_18px_36px_-22px_rgb(11_16_22/0.45)]";

  return (
    <div className="relative">
      <input
        {...inputProps}
        type="text"
        role="combobox"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("country.listLabel")}
          className={`${popup} m-0 list-none p-1.5`}
        >
          {matches.map((match, index) => {
            const highlighted = index === active;
            return (
              <li
                key={match.country.code}
                id={optionId(index)}
                role="option"
                aria-selected={highlighted}
                className={`flex min-h-11 cursor-pointer items-baseline justify-between gap-4 rounded-[0.45rem] px-3 py-2.5 text-sm leading-snug ${
                  highlighted ? "bg-accent text-white" : "text-ink"
                }`}
                // Keep focus in the input, so its blur does not close the list
                // before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => {
                  if (!highlighted) setActiveIndex(index);
                }}
                onClick={() => choose(match.country)}
              >
                <span className="min-w-0">{match.country.name}</span>
                {match.via && match.via !== match.country.code ? (
                  <span
                    className={`shrink-0 text-xs whitespace-nowrap ${
                      highlighted ? "text-white/75" : "text-ink-3"
                    }`}
                  >
                    {match.via}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {showEmpty ? (
        <p role="status" className={`${popup} m-0 px-3.5 py-3 text-sm text-ink-3`}>
          {t("country.noMatch", { text: query })}
        </p>
      ) : null}
    </div>
  );
}
