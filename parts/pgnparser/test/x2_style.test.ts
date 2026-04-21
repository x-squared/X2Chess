import test from "node:test";
import assert from "node:assert/strict";
import {
  getHeaderValue,
  getX2StyleFromModel,
  normalizeX2StyleValue,
  setHeaderValue,
} from "../src/pgn_headers.js";

test("normalizeX2StyleValue defaults invalid and empty to plain", () => {
  assert.equal(normalizeX2StyleValue(""), "plain");
  assert.equal(normalizeX2StyleValue("bogus"), "plain");
  assert.equal(normalizeX2StyleValue("TEXT"), "text");
  assert.equal(normalizeX2StyleValue(" Tree "), "tree");
});

test("getX2StyleFromModel reads XSqrChessStyle, transitional XTwoChessStyle, or X2Style", () => {
  const noTag = { headers: [{ key: "Event", value: "?" }] };
  assert.equal(getX2StyleFromModel(noTag), "plain");
  const withXsqr = { headers: [{ key: "XSqrChessStyle", value: "text" }] };
  assert.equal(getX2StyleFromModel(withXsqr), "text");
  const withTransitional = { headers: [{ key: "XTwoChessStyle", value: "text" }] };
  assert.equal(getX2StyleFromModel(withTransitional), "text");
  const withLegacyText = { headers: [{ key: "X2Style", value: "text" }] };
  assert.equal(getX2StyleFromModel(withLegacyText), "text");
});

test("getHeaderValue — null model returns fallback", () => {
  assert.equal(getHeaderValue(null, "Event", "?"), "?");
});

test("setHeaderValue writes canonical XSqrChessStyle key", () => {
  const withLegacyAndTransitional = {
    headers: [
      { key: "X2Style", value: "plain" },
      { key: "XTwoChessStyle", value: "text" },
    ],
  };
  const updated = setHeaderValue(withLegacyAndTransitional, "XTwoChessStyle", "tree");
  assert.deepEqual(updated.headers, [{ key: "XSqrChessStyle", value: "tree" }]);
});
