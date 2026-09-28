import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { passFileName, wrapLines } from "../lib/pass-name.ts";

describe("passFileName", () => {
  test("names the file after the badge serial", () => {
    assert.equal(passFileName("VMS-2026-0042"), "drcc-2026-badge-vms-2026-0042.png");
  });

  test("keeps a serial with odd characters safe for a file system", () => {
    assert.equal(passFileName("VMS/26 #7"), "drcc-2026-badge-vms-26-7.png");
  });

  test("falls back when the serial carries nothing usable", () => {
    assert.equal(passFileName(""), "drcc-2026-badge.png");
    assert.equal(passFileName("///"), "drcc-2026-badge.png");
  });
});

describe("wrapLines", () => {
  // A stand-in for canvas measureText: every character is 10 wide.
  const measure = (text: string) => text.length * 10;

  test("breaks between words at the width", () => {
    assert.deepEqual(wrapLines("Ana Maria Sousa", 100, measure), ["Ana Maria", "Sousa"]);
  });

  test("keeps a line that fits", () => {
    assert.deepEqual(wrapLines("Ana Sousa", 100, measure), ["Ana Sousa"]);
  });

  test("hard-breaks a single word too long to fit", () => {
    assert.deepEqual(wrapLines("AAAAAAAAAAAA", 50, measure), ["AAAAA", "AAAAA", "AA"]);
  });

  test("returns nothing for empty text", () => {
    assert.deepEqual(wrapLines("   ", 100, measure), []);
  });
});
