import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAnchorAnnotations,
  hasAnchorAnnotations,
  stripAnchorAnnotations,
  formatAnchorAnnotation,
  replaceAnchorAnnotation,
  appendAnchorAnnotation,
  parseAnchorRefAnnotations,
  hasAnchorRefAnnotations,
  stripAnchorRefAnnotations,
  formatAnchorRefAnnotation,
  replaceAnchorRefAnnotation,
  appendAnchorRefAnnotation,
} from "../../src/resources_viewer/anchor_parser.js";

// ── parseAnchorAnnotations ─────────────────────────────────────────────────────

test("parseAnchorAnnotations — empty string returns empty array", () => {
  assert.deepEqual(parseAnchorAnnotations(""), []);
});

test("parseAnchorAnnotations — plain comment returns empty array", () => {
  assert.deepEqual(parseAnchorAnnotations("White stands better."), []);
});

test("parseAnchorAnnotations — parses a basic anchor annotation", () => {
  const result = parseAnchorAnnotations('[%anchor id="critical" text="The critical junction"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "critical");
  assert.equal(result[0]!.text, "The critical junction");
});

test("parseAnchorAnnotations — parses multiple anchors from one comment", () => {
  const text = '[%anchor id="a1" text="First"] Some text [%anchor id="a2" text="Second"]';
  const result = parseAnchorAnnotations(text);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, "a1");
  assert.equal(result[1]!.id, "a2");
});

test("parseAnchorAnnotations — handles escaped quotes inside text field", () => {
  const result = parseAnchorAnnotations('[%anchor id="x" text="He said \\"go\\""]');
  assert.equal(result[0]!.text, 'He said "go"');
});

test("parseAnchorAnnotations — case insensitive for %anchor token", () => {
  const result = parseAnchorAnnotations('[%ANCHOR id="abc" text="Test"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "abc");
});

// ── hasAnchorAnnotations ───────────────────────────────────────────────────────

test("hasAnchorAnnotations — returns false for plain text", () => {
  assert.equal(hasAnchorAnnotations("White is better"), false);
});

test("hasAnchorAnnotations — returns true when annotation present", () => {
  assert.equal(hasAnchorAnnotations('[%anchor id="x" text="y"]'), true);
});

test("hasAnchorAnnotations — does not match anchorref", () => {
  assert.equal(hasAnchorAnnotations('[%anchorref id="x"]'), false);
});

// ── stripAnchorAnnotations ─────────────────────────────────────────────────────

test("stripAnchorAnnotations — removes annotation and trims", () => {
  const result = stripAnchorAnnotations('Hello [%anchor id="x" text="y"] world');
  assert.equal(result, "Hello  world");
});

test("stripAnchorAnnotations — returns plain text unchanged", () => {
  assert.equal(stripAnchorAnnotations("No annotations here"), "No annotations here");
});

test("stripAnchorAnnotations — does not strip anchorref", () => {
  const text = '[%anchorref id="x"]';
  assert.equal(stripAnchorAnnotations(text), text);
});

// ── formatAnchorAnnotation ─────────────────────────────────────────────────────

test("formatAnchorAnnotation — produces correct PGN string", () => {
  const result = formatAnchorAnnotation({ id: "test", text: "A test moment" });
  assert.equal(result, '[%anchor id="test" text="A test moment"]');
});

test("formatAnchorAnnotation — escapes quotes in values", () => {
  const result = formatAnchorAnnotation({ id: "q", text: 'He said "check"' });
  assert.ok(result.includes('\\"check\\"'));
});

// ── replaceAnchorAnnotation ────────────────────────────────────────────────────

test("replaceAnchorAnnotation — replaces annotation at index 0", () => {
  const raw = '[%anchor id="old" text="Old"]';
  const updated = replaceAnchorAnnotation(raw, 0, { id: "new", text: "New" });
  assert.ok(updated.includes('"new"'));
  assert.ok(!updated.includes('"old"'));
});

test("replaceAnchorAnnotation — deletes annotation when null passed", () => {
  const raw = 'Some text [%anchor id="old" text="Old"] more text';
  const updated = replaceAnchorAnnotation(raw, 0, null);
  assert.ok(!updated.includes("%anchor"));
  assert.ok(updated.includes("Some text"));
});

test("replaceAnchorAnnotation — only replaces correct index", () => {
  const raw = '[%anchor id="a" text="A"] [%anchor id="b" text="B"]';
  const updated = replaceAnchorAnnotation(raw, 1, { id: "c", text: "C" });
  assert.ok(updated.includes('"a"'));
  assert.ok(updated.includes('"c"'));
  assert.ok(!updated.includes('"b"'));
});

// ── appendAnchorAnnotation ─────────────────────────────────────────────────────

test("appendAnchorAnnotation — appends to existing text", () => {
  const result = appendAnchorAnnotation("Some comment", { id: "x", text: "X" });
  assert.ok(result.startsWith("Some comment "));
  assert.ok(result.includes('[%anchor id="x"'));
});

test("appendAnchorAnnotation — works on empty string", () => {
  const result = appendAnchorAnnotation("", { id: "x", text: "X" });
  assert.ok(result.startsWith("[%anchor"));
});

// ── parseAnchorRefAnnotations ──────────────────────────────────────────────────

test("parseAnchorRefAnnotations — empty string returns empty array", () => {
  assert.deepEqual(parseAnchorRefAnnotations(""), []);
});

test("parseAnchorRefAnnotations — parses a basic anchor reference", () => {
  const result = parseAnchorRefAnnotations('[%anchorref id="critical"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "critical");
});

test("parseAnchorRefAnnotations — parses multiple refs", () => {
  const text = '[%anchorref id="a"] text [%anchorref id="b"]';
  const result = parseAnchorRefAnnotations(text);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, "a");
  assert.equal(result[1]!.id, "b");
});

test("parseAnchorRefAnnotations — does not match anchor definitions", () => {
  const result = parseAnchorRefAnnotations('[%anchor id="x" text="y"]');
  assert.equal(result.length, 0);
});

// ── hasAnchorRefAnnotations ────────────────────────────────────────────────────

test("hasAnchorRefAnnotations — returns false for plain text", () => {
  assert.equal(hasAnchorRefAnnotations("No refs here"), false);
});

test("hasAnchorRefAnnotations — returns true when ref present", () => {
  assert.equal(hasAnchorRefAnnotations('[%anchorref id="x"]'), true);
});

// ── stripAnchorRefAnnotations ──────────────────────────────────────────────────

test("stripAnchorRefAnnotations — removes ref annotation", () => {
  const result = stripAnchorRefAnnotations('See [%anchorref id="x"] for details');
  assert.ok(!result.includes("%anchorref"));
  assert.ok(result.includes("See"));
});

test("stripAnchorRefAnnotations — does not strip anchor definitions", () => {
  const text = '[%anchor id="x" text="y"]';
  assert.equal(stripAnchorRefAnnotations(text), text);
});

// ── formatAnchorRefAnnotation ──────────────────────────────────────────────────

test("formatAnchorRefAnnotation — produces correct PGN string", () => {
  assert.equal(formatAnchorRefAnnotation({ id: "x" }), '[%anchorref id="x"]');
});

// ── replaceAnchorRefAnnotation ─────────────────────────────────────────────────

test("replaceAnchorRefAnnotation — replaces ref at index 0", () => {
  const raw = '[%anchorref id="old"]';
  const updated = replaceAnchorRefAnnotation(raw, 0, { id: "new" });
  assert.ok(updated.includes('"new"'));
  assert.ok(!updated.includes('"old"'));
});

test("replaceAnchorRefAnnotation — deletes when null", () => {
  const raw = 'Text [%anchorref id="x"] more';
  const updated = replaceAnchorRefAnnotation(raw, 0, null);
  assert.ok(!updated.includes("%anchorref"));
});

// ── appendAnchorRefAnnotation ──────────────────────────────────────────────────

test("appendAnchorRefAnnotation — appends to existing text", () => {
  const result = appendAnchorRefAnnotation("See here:", { id: "x" });
  assert.ok(result.startsWith("See here:"));
  assert.ok(result.includes('[%anchorref id="x"]'));
});

test("appendAnchorRefAnnotation — works on empty string", () => {
  const result = appendAnchorRefAnnotation("", { id: "x" });
  assert.equal(result, '[%anchorref id="x"]');
});

// ── Round-trip ─────────────────────────────────────────────────────────────────

test("round-trip — format then parse anchor annotation", () => {
  const original = { id: "rook-ending", text: "Key rook ending" };
  const formatted = formatAnchorAnnotation(original);
  const parsed = parseAnchorAnnotations(formatted);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], original);
});

test("round-trip — format then parse anchor ref annotation", () => {
  const original = { id: "intro" };
  const formatted = formatAnchorRefAnnotation(original);
  const parsed = parseAnchorRefAnnotations(formatted);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], original);
});
