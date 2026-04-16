import test from "node:test";
import assert from "node:assert/strict";
import {
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

test("getX2StyleFromModel reads X2Style header or plain when missing", () => {
  const noTag = { headers: [{ key: "Event", value: "?" }] };
  assert.equal(getX2StyleFromModel(noTag), "plain");
  const withText = { headers: [{ key: "XTwoChessStyle", value: "text" }] };
  assert.equal(getX2StyleFromModel(withText), "text");
  const withLegacyText = { headers: [{ key: "X2Style", value: "text" }] };
  assert.equal(getX2StyleFromModel(withLegacyText), "text");
});

test("setHeaderValue writes canonical XTwoChessStyle key", () => {
  const withLegacyAndCanonical = {
    headers: [
      { key: "X2Style", value: "plain" },
      { key: "XTwoChessStyle", value: "text" },
    ],
  };
  const updated = setHeaderValue(withLegacyAndCanonical, "XTwoChessStyle", "tree");
  assert.deepEqual(updated.headers, [{ key: "XTwoChessStyle", value: "tree" }]);
});
