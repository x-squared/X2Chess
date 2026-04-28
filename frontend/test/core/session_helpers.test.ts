import test from "node:test";
import assert from "node:assert/strict";
import { shouldBlockPlaceholderOverwrite } from "../../src/core/services/session_helpers.js";

test("shouldBlockPlaceholderOverwrite blocks accidental placeholder replacement", () => {
  const blocked: boolean = shouldBlockPlaceholderOverwrite("White", "?", "?", "Carlsen");
  assert.equal(blocked, true);
});

test("shouldBlockPlaceholderOverwrite allows explicit clear for populated value", () => {
  const blocked: boolean = shouldBlockPlaceholderOverwrite("White", "", "", "Carlsen");
  assert.equal(blocked, false);
});

test("shouldBlockPlaceholderOverwrite allows non-placeholder updates", () => {
  const blocked: boolean = shouldBlockPlaceholderOverwrite("White", "Nakamura", "Nakamura", "Carlsen");
  assert.equal(blocked, false);
});
