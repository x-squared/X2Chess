import test from "node:test";
import assert from "node:assert/strict";
import {
  parseQaAnnotations,
  hasQaAnnotations,
  stripQaAnnotations,
  formatQaAnnotation,
  replaceQaAnnotation,
  appendQaAnnotation,
} from "../../src/features/resources/services/qa_parser.js";

// ── parseQaAnnotations ─────────────────────────────────────────────────────────

test("parseQaAnnotations — empty string returns empty array", () => {
  assert.deepEqual(parseQaAnnotations(""), []);
});

test("parseQaAnnotations — plain comment with no annotation returns empty array", () => {
  assert.deepEqual(parseQaAnnotations("White stands better."), []);
});

test("parseQaAnnotations — parses a basic annotation with question and answer", () => {
  const result = parseQaAnnotations('[%qa question="What is the threat?" answer="Qxh7#"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.question, "What is the threat?");
  assert.equal(result[0]!.answer, "Qxh7#");
  assert.equal(result[0]!.hint, "");
});

test("parseQaAnnotations — parses annotation with all three fields", () => {
  const result = parseQaAnnotations('[%qa question="Best move?" answer="Nf6" hint="Check the knight"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.question, "Best move?");
  assert.equal(result[0]!.answer, "Nf6");
  assert.equal(result[0]!.hint, "Check the knight");
});

test("parseQaAnnotations — parses multiple annotations from one comment", () => {
  const text = '[%qa question="Q1?" answer="A1"] Some text [%qa question="Q2?" answer="A2"]';
  const result = parseQaAnnotations(text);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.question, "Q1?");
  assert.equal(result[1]!.question, "Q2?");
});

test("parseQaAnnotations — handles escaped quotes inside values", () => {
  const result = parseQaAnnotations('[%qa question="He said \\"check\\"" answer="Rf1"]');
  assert.equal(result[0]!.question, 'He said "check"');
});

test("parseQaAnnotations — case insensitive for %qa token", () => {
  const result = parseQaAnnotations('[%QA question="Test?" answer="Ng5"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.question, "Test?");
});

// ── hasQaAnnotations ───────────────────────────────────────────────────────────

test("hasQaAnnotations — returns false for plain text", () => {
  assert.equal(hasQaAnnotations("White is better"), false);
});

test("hasQaAnnotations — returns true when annotation is present", () => {
  assert.equal(hasQaAnnotations('[%qa question="?" answer="e4"]'), true);
});

// ── stripQaAnnotations ─────────────────────────────────────────────────────────

test("stripQaAnnotations — removes annotation leaving plain text", () => {
  const result = stripQaAnnotations('Good move. [%qa question="Why?" answer="Nf6"]');
  assert.equal(result, "Good move.");
});

test("stripQaAnnotations — returns empty string for annotation-only comment", () => {
  const result = stripQaAnnotations('[%qa question="?" answer="e4"]');
  assert.equal(result, "");
});

test("stripQaAnnotations — removes multiple annotations", () => {
  const result = stripQaAnnotations('[%qa question="Q1?" answer="A1"] text [%qa question="Q2?" answer="A2"]');
  assert.equal(result, "text");
});

// ── formatQaAnnotation ─────────────────────────────────────────────────────────

test("formatQaAnnotation — formats annotation without hint", () => {
  const result = formatQaAnnotation({ question: "Best move?", answer: "Ng5", hint: "" });
  assert.equal(result, '[%qa question="Best move?" answer="Ng5"]');
});

test("formatQaAnnotation — includes hint when non-empty", () => {
  const result = formatQaAnnotation({ question: "Best?", answer: "Nf6", hint: "Knight move" });
  assert.equal(result, '[%qa question="Best?" answer="Nf6" hint="Knight move"]');
});

test("formatQaAnnotation — escapes quotes in values", () => {
  const result = formatQaAnnotation({ question: 'He said "check"', answer: "Rf1", hint: "" });
  assert.equal(result, '[%qa question="He said \\"check\\"" answer="Rf1"]');
});

// ── round-trip ─────────────────────────────────────────────────────────────────

test("formatQaAnnotation + parseQaAnnotations — round-trip preserves values", () => {
  const original = { question: 'What is "the" move?', answer: "Qxf7+", hint: "Use the queen" };
  const formatted = formatQaAnnotation(original);
  const parsed = parseQaAnnotations(formatted);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], original);
});

// ── replaceQaAnnotation ────────────────────────────────────────────────────────

test("replaceQaAnnotation — replaces annotation at given index", () => {
  const text = '[%qa question="Old?" answer="Nc3"] [%qa question="Keep?" answer="e4"]';
  const result = replaceQaAnnotation(text, 0, { question: "New?", answer: "d4", hint: "" });
  const parsed = parseQaAnnotations(result);
  assert.equal(parsed[0]!.question, "New?");
  assert.equal(parsed[1]!.question, "Keep?");
});

test("replaceQaAnnotation — deletes annotation when null is passed", () => {
  const text = '[%qa question="Q?" answer="A"] suffix';
  const result = replaceQaAnnotation(text, 0, null);
  assert.equal(hasQaAnnotations(result), false);
  assert.ok(result.includes("suffix"));
});

// ── appendQaAnnotation ─────────────────────────────────────────────────────────

test("appendQaAnnotation — appends to empty string", () => {
  const result = appendQaAnnotation("", { question: "Q?", answer: "A", hint: "" });
  assert.ok(result.startsWith("[%qa"));
  const parsed = parseQaAnnotations(result);
  assert.equal(parsed[0]!.question, "Q?");
});

test("appendQaAnnotation — appends after existing text", () => {
  const result = appendQaAnnotation("White is better.", { question: "Q?", answer: "A", hint: "" });
  assert.ok(result.startsWith("White is better."));
  assert.equal(parseQaAnnotations(result).length, 1);
});
