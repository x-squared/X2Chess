import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLinkAnnotations,
  hasLinkAnnotations,
  stripLinkAnnotations,
  formatLinkAnnotation,
  replaceLinkAnnotation,
  appendLinkAnnotation,
} from "../../src/features/resources/services/link_parser.js";

// ── parseLinkAnnotations ───────────────────────────────────────────────────────

test("parseLinkAnnotations — empty string returns empty array", () => {
  assert.deepEqual(parseLinkAnnotations(""), []);
});

test("parseLinkAnnotations — plain comment with no annotation returns empty array", () => {
  assert.deepEqual(parseLinkAnnotations("White stands better."), []);
});

test("parseLinkAnnotations — parses annotation with recordId only", () => {
  const result = parseLinkAnnotations('[%link recordId="abc-123"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.recordId, "abc-123");
  assert.equal(result[0]!.label, "");
});

test("parseLinkAnnotations — parses annotation with recordId and label", () => {
  const result = parseLinkAnnotations('[%link recordId="abc-123" label="See also: Nimzo-Indian trap"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.recordId, "abc-123");
  assert.equal(result[0]!.label, "See also: Nimzo-Indian trap");
});

test("parseLinkAnnotations — parses multiple annotations from one comment", () => {
  const text = '[%link recordId="id-1" label="Game 1"] Some text [%link recordId="id-2"]';
  const result = parseLinkAnnotations(text);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.recordId, "id-1");
  assert.equal(result[0]!.label, "Game 1");
  assert.equal(result[1]!.recordId, "id-2");
  assert.equal(result[1]!.label, "");
});

test("parseLinkAnnotations — handles escaped quotes inside values", () => {
  const result = parseLinkAnnotations('[%link recordId="abc" label="He said \\"check\\""]');
  assert.equal(result[0]!.label, 'He said "check"');
});

test("parseLinkAnnotations — case insensitive for %link token", () => {
  const result = parseLinkAnnotations('[%LINK recordId="abc"]');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.recordId, "abc");
});

// ── hasLinkAnnotations ─────────────────────────────────────────────────────────

test("hasLinkAnnotations — returns false for plain text", () => {
  assert.equal(hasLinkAnnotations("White is better"), false);
});

test("hasLinkAnnotations — returns true when annotation is present", () => {
  assert.equal(hasLinkAnnotations('[%link recordId="abc"]'), true);
});

// ── stripLinkAnnotations ───────────────────────────────────────────────────────

test("stripLinkAnnotations — removes annotation leaving plain text", () => {
  const result = stripLinkAnnotations('Good move. [%link recordId="abc" label="See also"]');
  assert.equal(result, "Good move.");
});

test("stripLinkAnnotations — returns empty string for annotation-only comment", () => {
  const result = stripLinkAnnotations('[%link recordId="abc"]');
  assert.equal(result, "");
});

test("stripLinkAnnotations — removes multiple annotations", () => {
  const result = stripLinkAnnotations('[%link recordId="id-1"] text [%link recordId="id-2"]');
  assert.equal(result, "text");
});

// ── formatLinkAnnotation ───────────────────────────────────────────────────────

test("formatLinkAnnotation — formats annotation without label", () => {
  const result = formatLinkAnnotation({ recordId: "abc-123", label: "" });
  assert.equal(result, '[%link recordId="abc-123"]');
});

test("formatLinkAnnotation — includes label when non-empty", () => {
  const result = formatLinkAnnotation({ recordId: "abc-123", label: "Nimzo trap" });
  assert.equal(result, '[%link recordId="abc-123" label="Nimzo trap"]');
});

test("formatLinkAnnotation — escapes quotes in values", () => {
  const result = formatLinkAnnotation({ recordId: "abc", label: 'He said "check"' });
  assert.equal(result, '[%link recordId="abc" label="He said \\"check\\""]');
});

// ── round-trip ─────────────────────────────────────────────────────────────────

test("formatLinkAnnotation + parseLinkAnnotations — round-trip preserves values (with label)", () => {
  const original = { recordId: "xyz-789", label: 'What is "the" move?' };
  const formatted = formatLinkAnnotation(original);
  const parsed = parseLinkAnnotations(formatted);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], original);
});

test("formatLinkAnnotation + parseLinkAnnotations — round-trip preserves values (no label)", () => {
  const original = { recordId: "xyz-789", label: "" };
  const formatted = formatLinkAnnotation(original);
  const parsed = parseLinkAnnotations(formatted);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], original);
});

// ── replaceLinkAnnotation ──────────────────────────────────────────────────────

test("replaceLinkAnnotation — replaces annotation at given index", () => {
  const text = '[%link recordId="old"] [%link recordId="keep"]';
  const result = replaceLinkAnnotation(text, 0, { recordId: "new", label: "" });
  const parsed = parseLinkAnnotations(result);
  assert.equal(parsed[0]!.recordId, "new");
  assert.equal(parsed[1]!.recordId, "keep");
});

test("replaceLinkAnnotation — deletes annotation when null is passed", () => {
  const text = '[%link recordId="abc"] suffix';
  const result = replaceLinkAnnotation(text, 0, null);
  assert.equal(hasLinkAnnotations(result), false);
  assert.ok(result.includes("suffix"));
});

test("replaceLinkAnnotation — second annotation only", () => {
  const text = '[%link recordId="first"] [%link recordId="second"]';
  const result = replaceLinkAnnotation(text, 1, null);
  const parsed = parseLinkAnnotations(result);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.recordId, "first");
});

// ── appendLinkAnnotation ───────────────────────────────────────────────────────

test("appendLinkAnnotation — appends to empty string", () => {
  const result = appendLinkAnnotation("", { recordId: "abc", label: "" });
  assert.ok(result.startsWith("[%link"));
  const parsed = parseLinkAnnotations(result);
  assert.equal(parsed[0]!.recordId, "abc");
});

test("appendLinkAnnotation — appends after existing text", () => {
  const result = appendLinkAnnotation("White is better.", { recordId: "abc", label: "See also" });
  assert.ok(result.startsWith("White is better."));
  assert.equal(parseLinkAnnotations(result).length, 1);
});

test("appendLinkAnnotation — appends after existing annotation", () => {
  const base = '[%link recordId="first"]';
  const result = appendLinkAnnotation(base, { recordId: "second", label: "" });
  const parsed = parseLinkAnnotations(result);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1]!.recordId, "second");
});
