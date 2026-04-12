import test from "node:test";
import assert from "node:assert/strict";
import {
  parseEvalAnnotations,
  hasEvalAnnotations,
  stripEvalAnnotations,
  formatEvalAnnotation,
  replaceEvalAnnotation,
  formatEvalDisplay,
} from "../../src/features/resources/services/eval_parser.js";

// ── parseEvalAnnotations ───────────────────────────────────────────────────────

test("parseEvalAnnotations — empty string returns empty array", () => {
  assert.deepEqual(parseEvalAnnotations(""), []);
});

test("parseEvalAnnotations — no annotation returns empty array", () => {
  assert.deepEqual(parseEvalAnnotations("good move"), []);
});

test("parseEvalAnnotations — single centipawn annotation", () => {
  const result = parseEvalAnnotations("[%eval 0.17]");
  assert.equal(result.length, 1);
  assert.equal(result[0].value, "0.17");
});

test("parseEvalAnnotations — negative centipawn annotation", () => {
  const result = parseEvalAnnotations("[%eval -1.23]");
  assert.equal(result[0].value, "-1.23");
});

test("parseEvalAnnotations — mate annotation", () => {
  const result = parseEvalAnnotations("[%eval #5]");
  assert.equal(result[0].value, "#5");
});

test("parseEvalAnnotations — negative mate annotation", () => {
  const result = parseEvalAnnotations("[%eval #-3]");
  assert.equal(result[0].value, "#-3");
});

test("parseEvalAnnotations — multiple annotations", () => {
  const result = parseEvalAnnotations("text [%eval 0.17] more [%eval #2]");
  assert.equal(result.length, 2);
  assert.equal(result[0].value, "0.17");
  assert.equal(result[1].value, "#2");
});

test("parseEvalAnnotations — case-insensitive", () => {
  const result = parseEvalAnnotations("[%EVAL 0.50]");
  assert.equal(result.length, 1);
  assert.equal(result[0].value, "0.50");
});

// ── hasEvalAnnotations ─────────────────────────────────────────────────────────

test("hasEvalAnnotations — returns true when present", () => {
  assert.equal(hasEvalAnnotations("[%eval 0.17]"), true);
});

test("hasEvalAnnotations — returns false when absent", () => {
  assert.equal(hasEvalAnnotations("plain comment"), false);
});

// ── stripEvalAnnotations ───────────────────────────────────────────────────────

test("stripEvalAnnotations — removes single annotation", () => {
  assert.equal(stripEvalAnnotations("[%eval 0.17]"), "");
});

test("stripEvalAnnotations — preserves surrounding text (double space not collapsed)", () => {
  assert.equal(stripEvalAnnotations("text [%eval 0.17] end"), "text  end");
});

test("stripEvalAnnotations — removes multiple annotations", () => {
  assert.equal(stripEvalAnnotations("[%eval 0.17] mid [%eval #3]"), "mid");
});

test("stripEvalAnnotations — no-op on plain text", () => {
  assert.equal(stripEvalAnnotations("plain"), "plain");
});

// ── formatEvalAnnotation ───────────────────────────────────────────────────────

test("formatEvalAnnotation — centipawn", () => {
  assert.equal(formatEvalAnnotation({ value: "0.17" }), "[%eval 0.17]");
});

test("formatEvalAnnotation — mate", () => {
  assert.equal(formatEvalAnnotation({ value: "#5" }), "[%eval #5]");
});

// ── replaceEvalAnnotation ──────────────────────────────────────────────────────

test("replaceEvalAnnotation — replaces annotation at index", () => {
  const result = replaceEvalAnnotation("[%eval 0.17] text [%eval 0.50]", 0, { value: "1.00" });
  assert.ok(result.includes("[%eval 1.00]"), result);
  assert.ok(result.includes("[%eval 0.50]"), result);
});

test("replaceEvalAnnotation — null annotation deletes entry", () => {
  const result = replaceEvalAnnotation("[%eval 0.17] text", 0, null);
  assert.ok(!result.includes("[%eval"), result);
  assert.equal(result, "text");
});

test("replaceEvalAnnotation — leaves non-target annotations unchanged", () => {
  const result = replaceEvalAnnotation("[%eval 0.17] text [%eval 0.50]", 1, { value: "2.00" });
  assert.ok(result.includes("[%eval 0.17]"), result);
  assert.ok(result.includes("[%eval 2.00]"), result);
  assert.ok(!result.includes("[%eval 0.50]"), result);
});

// ── formatEvalDisplay ──────────────────────────────────────────────────────────

test("formatEvalDisplay — positive centipawn gets + prefix", () => {
  assert.equal(formatEvalDisplay("0.17"), "+0.17");
});

test("formatEvalDisplay — negative centipawn unchanged", () => {
  assert.equal(formatEvalDisplay("-1.23"), "-1.23");
});

test("formatEvalDisplay — zero displayed as 0.00", () => {
  assert.equal(formatEvalDisplay("0.00"), "0.00");
});

test("formatEvalDisplay — mate value returned as-is", () => {
  assert.equal(formatEvalDisplay("#5"), "#5");
  assert.equal(formatEvalDisplay("#-3"), "#-3");
});

test("formatEvalDisplay — unrecognised string returned unchanged", () => {
  assert.equal(formatEvalDisplay("??"), "??");
});
