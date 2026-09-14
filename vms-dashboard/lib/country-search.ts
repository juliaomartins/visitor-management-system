/**
 * Country search for the country combobox.
 *
 * PURE, AND IMPORTS NOTHING AT RUNTIME. No React and no data: the list is passed
 * in. That keeps it runnable under `node --test` with no bundler, which is how
 * `tests/country-search.test.ts` exercises it.
 */

export interface SearchableCountry {
  code: string;
  name: string;
  aliases?: readonly string[];
}

export interface CountryMatch<T extends SearchableCountry> {
  country: T;
  /** The alternative name or code that matched, when it was not the country's own name. */
  via?: string;
}

export const DEFAULT_RESULT_LIMIT = 8;

// Unicode "combining diacritical marks": the accents NFD splits off letters (ô → o + ◌̂).
// Filtered by code point rather than by a regex escape, which a file saved through
// the wrong encoding silently turns into a different range.
const COMBINING_MARKS_START = 0x0300;
const COMBINING_MARKS_END = 0x036f;

function stripAccents(text: string): string {
  return Array.from(text.normalize("NFD"))
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < COMBINING_MARKS_START || codePoint > COMBINING_MARKS_END;
    })
    .join("");
}

/** Lowercase, strip accents, and turn punctuation into single spaces: "Côte d'Ivoire" → "cote d ivoire". */
export function normalizeCountryText(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Lower is better. Within a tier the list keeps its alphabetical order.
const RANK = {
  exact: 0,
  namePrefix: 1,
  nameWordPrefix: 2,
  alias: 3,
  nameContains: 4,
} as const;

type Rank = (typeof RANK)[keyof typeof RANK];

function startsAnyWord(text: string, query: string): boolean {
  return ` ${text}`.includes(` ${query}`);
}

function rankCountry(
  country: SearchableCountry,
  query: string,
): { rank: Rank; via?: string } | null {
  const name = normalizeCountryText(country.name);
  const aliases = country.aliases ?? [];

  if (name === query) return { rank: RANK.exact };
  const exactAlias = aliases.find((alias) => normalizeCountryText(alias) === query);
  if (exactAlias) return { rank: RANK.exact, via: exactAlias };
  if (country.code.toLowerCase() === query) return { rank: RANK.exact, via: country.code };

  if (name.startsWith(query)) return { rank: RANK.namePrefix };
  if (startsAnyWord(name, query)) return { rank: RANK.nameWordPrefix };
  const aliasMatch = aliases.find((alias) => startsAnyWord(normalizeCountryText(alias), query));
  if (aliasMatch) return { rank: RANK.alias, via: aliasMatch };
  if (name.includes(query)) return { rank: RANK.nameContains };

  return null;
}

/** Optimal string alignment distance: insertions, deletions, substitutions and swapped neighbours. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

const MIN_TYPO_QUERY_LENGTH = 3;

function typoAllowance(queryLength: number): number {
  return queryLength <= 5 ? 1 : 2;
}

function closestSpellings<T extends SearchableCountry>(
  query: string,
  countries: readonly T[],
): CountryMatch<T>[] {
  if (query.length < MIN_TYPO_QUERY_LENGTH) return [];
  const allowance = typoAllowance(query.length);

  const candidates: Array<{ match: CountryMatch<T>; distance: number }> = [];
  for (const country of countries) {
    let best: { distance: number; via?: string } | null = null;
    const spellings: Array<{ text: string; via?: string }> = [
      { text: country.name },
      ...(country.aliases ?? []).map((alias) => ({ text: alias, via: alias })),
    ];
    for (const spelling of spellings) {
      const text = normalizeCountryText(spelling.text);
      // The whole name and its start, so a half-typed name with a typo still matches.
      const distance = Math.min(
        editDistance(query, text),
        editDistance(query, text.slice(0, query.length)),
      );
      if (distance <= allowance && (best === null || distance < best.distance)) {
        best = { distance, via: spelling.via };
      }
    }
    if (best) {
      candidates.push({ match: { country, via: best.via }, distance: best.distance });
    }
  }

  return candidates
    .sort((a, b) => a.distance - b.distance)
    .map((candidate) => candidate.match);
}

/**
 * Countries matching what was typed, best first: exact names, names that start
 * with the text, words that start with it, alternative names, then names that
 * contain it. Only when none of those match does it fall back to close spellings
 * -- so "chin" offers China alone, never China plus a guess.
 */
export function searchCountries<T extends SearchableCountry>(
  query: string,
  countries: readonly T[],
  limit: number = DEFAULT_RESULT_LIMIT,
): CountryMatch<T>[] {
  const normalized = normalizeCountryText(query);
  if (!normalized) return [];

  const ranked: Array<{ match: CountryMatch<T>; rank: Rank }> = [];
  for (const country of countries) {
    const result = rankCountry(country, normalized);
    if (result) ranked.push({ match: { country, via: result.via }, rank: result.rank });
  }

  // Array.prototype.sort is stable, so each tier keeps the list's alphabetical order.
  const matches =
    ranked.length > 0
      ? ranked.sort((a, b) => a.rank - b.rank).map((entry) => entry.match)
      : closestSpellings(normalized, countries);

  return matches.slice(0, limit);
}

/** The country whose name or alternative name is exactly this text, ignoring case, accents and punctuation. */
export function findCountryByText<T extends SearchableCountry>(
  text: string,
  countries: readonly T[],
): T | null {
  const normalized = normalizeCountryText(text);
  if (!normalized) return null;
  return (
    countries.find(
      (country) =>
        normalizeCountryText(country.name) === normalized ||
        (country.aliases ?? []).some((alias) => normalizeCountryText(alias) === normalized),
    ) ?? null
  );
}
