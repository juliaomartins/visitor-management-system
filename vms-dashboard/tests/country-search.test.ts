import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COUNTRIES } from "../lib/countries.ts";
import { findCountryByText, searchCountries } from "../lib/country-search.ts";

const codes = (query: string) =>
  searchCountries(query, COUNTRIES).map((match) => match.country.code);

describe("searchCountries", () => {
  test("returns nothing for an empty or blank query", () => {
    assert.deepEqual(codes(""), []);
    assert.deepEqual(codes("   "), []);
  });

  test("puts names that start with the query first", () => {
    const results = codes("por");
    assert.equal(results[0], "PT");
    assert.ok(results.indexOf("SG") > 0, 'Singapore contains "por", so it comes after Portugal');
  });

  test("ranks an exact name above longer names with the same start", () => {
    const results = codes("guinea");
    assert.equal(results[0], "GN");
    for (const code of ["GW", "GQ", "PG"]) assert.ok(results.includes(code), `expected ${code}`);
  });

  test("matches the start of any word in the name", () => {
    assert.equal(codes("zealand")[0], "NZ");
    assert.deepEqual(codes("korea").slice(0, 2).sort(), ["KP", "KR"]);
  });

  test("ignores case and accents", () => {
    assert.equal(codes("PORTUGAL")[0], "PT");
    assert.equal(codes("cote")[0], "CI");
    assert.equal(codes("aland")[0], "AX");
    assert.equal(codes("turkiye")[0], "TR");
  });

  test("finds countries by common alternative names", () => {
    const cases: Array<[query: string, code: string]> = [
      ["usa", "US"],
      ["uk", "GB"],
      ["holland", "NL"],
      ["ivory coast", "CI"],
      ["east timor", "TL"],
      ["burma", "MM"],
      ["turkey", "TR"],
    ];
    for (const [query, code] of cases) assert.equal(codes(query)[0], code, `"${query}"`);
  });

  test("reports which alternative name matched", () => {
    assert.equal(searchCountries("holland", COUNTRIES)[0].via, "Holland");
  });

  test("prefers an exact alternative name over a name that merely starts with the query", () => {
    const results = codes("uk");
    assert.equal(results[0], "GB");
    assert.ok(results.includes("UA"), "Ukraine still appears");
  });

  test("includes names that contain the query anywhere", () => {
    const results = codes("stan");
    assert.ok(results.includes("AF"));
    assert.ok(results.includes("PK"));
  });

  test("returns at most 8 results by default", () => {
    assert.equal(codes("a").length, 8);
  });
});

describe("searchCountries with spelling mistakes", () => {
  test("suggests the closest spelling when nothing matches", () => {
    assert.equal(codes("portgal")[0], "PT");
    assert.equal(codes("protugal")[0], "PT");
    assert.equal(codes("brazl")[0], "BR");
    assert.equal(codes("germny")[0], "DE");
  });

  test("returns nothing for text that is not close to any country", () => {
    assert.deepEqual(codes("xyzzy"), []);
  });

  test("does not add spelling suggestions when real matches exist", () => {
    assert.deepEqual(codes("chin"), ["CN"]);
  });
});

describe("findCountryByText", () => {
  test("finds a country when the full name is typed", () => {
    assert.equal(findCountryByText(" portugal ", COUNTRIES)?.code, "PT");
    assert.equal(findCountryByText("cote d'ivoire", COUNTRIES)?.code, "CI");
    assert.equal(findCountryByText("Côte d'Ivoire", COUNTRIES)?.code, "CI");
  });

  test("accepts common alternative names", () => {
    assert.equal(findCountryByText("USA", COUNTRIES)?.code, "US");
  });

  test("returns null for partial or unknown text", () => {
    assert.equal(findCountryByText("port", COUNTRIES), null);
    assert.equal(findCountryByText("", COUNTRIES), null);
  });
});

describe("country data", () => {
  test("lists all 249 ISO 3166-1 alpha-2 countries once each", () => {
    assert.equal(COUNTRIES.length, 249);
    assert.equal(new Set(COUNTRIES.map((country) => country.code)).size, 249);
  });
});
