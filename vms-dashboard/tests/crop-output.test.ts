import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { cropOutputSize, isCropTooSmall } from "../lib/crop-output.ts";

const LIMITS = { maxWidth: 600, maxHeight: 800, minSide: 225 };

describe("cropOutputSize", () => {
  test("scales a large landscape crop down to fit 600 wide", () => {
    assert.deepEqual(cropOutputSize(4000, 3000, LIMITS), { width: 600, height: 450 });
  });

  test("scales a tall crop down to fit 800 high, keeping its shape", () => {
    assert.deepEqual(cropOutputSize(300, 900, LIMITS), { width: 267, height: 800 });
  });

  test("never upscales a crop that already fits", () => {
    assert.deepEqual(cropOutputSize(400, 500, LIMITS), { width: 400, height: 500 });
  });

  test("returns zero for an empty crop", () => {
    assert.deepEqual(cropOutputSize(0, 0, LIMITS), { width: 0, height: 0 });
  });
});

describe("isCropTooSmall", () => {
  test("accepts a crop whose output is at least the minimum on both sides", () => {
    assert.equal(isCropTooSmall(225, 225, LIMITS), false);
    assert.equal(isCropTooSmall(4000, 3000, LIMITS), false);
  });

  test("rejects a crop that is too narrow", () => {
    assert.equal(isCropTooSmall(200, 800, LIMITS), true);
  });

  test("rejects a very wide crop that fitting would squash below the minimum", () => {
    // 3000x600 fits as 600x120 -- the server refuses a side under 225.
    assert.equal(isCropTooSmall(3000, 600, LIMITS), true);
  });

  test("rejects an empty crop", () => {
    assert.equal(isCropTooSmall(0, 0, LIMITS), true);
  });
});
