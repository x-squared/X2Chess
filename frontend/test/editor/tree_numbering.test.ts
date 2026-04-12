import test from "node:test";
import assert from "node:assert/strict";
import { alphaNumericPathStrategy } from "../../src/features/editor/model/tree_numbering.js";

test("empty path returns empty string", () => {
  assert.equal(alphaNumericPathStrategy([]), "");
});

test("[0] → A", () => {
  assert.equal(alphaNumericPathStrategy([0]), "A");
});

test("[1] → B", () => {
  assert.equal(alphaNumericPathStrategy([1]), "B");
});

test("[25] → Z", () => {
  assert.equal(alphaNumericPathStrategy([25]), "Z");
});

test("[0, 0] → A.1", () => {
  assert.equal(alphaNumericPathStrategy([0, 0]), "A.1");
});

test("[0, 1] → A.2", () => {
  assert.equal(alphaNumericPathStrategy([0, 1]), "A.2");
});

test("[1, 0] → B.1", () => {
  assert.equal(alphaNumericPathStrategy([1, 0]), "B.1");
});

test("[0, 0, 0] → A.1.1", () => {
  assert.equal(alphaNumericPathStrategy([0, 0, 0]), "A.1.1");
});

test("[0, 0, 1] → A.1.2", () => {
  assert.equal(alphaNumericPathStrategy([0, 0, 1]), "A.1.2");
});

test("[1, 2, 3] → B.3.4", () => {
  assert.equal(alphaNumericPathStrategy([1, 2, 3]), "B.3.4");
});
