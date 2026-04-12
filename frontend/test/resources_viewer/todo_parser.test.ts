import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTodoAnnotations,
  hasTodoAnnotations,
  stripTodoAnnotations,
  formatTodoAnnotation,
  replaceTodoAnnotation,
  appendTodoAnnotation,
} from "../../src/features/resources/services/todo_parser.js";

// ── parseTodoAnnotations ───────────────────────────────────────────────────────

test("parseTodoAnnotations — empty string returns empty array", () => {
  assert.deepEqual(parseTodoAnnotations(""), []);
});

test("parseTodoAnnotations — no annotation returns empty array", () => {
  assert.deepEqual(parseTodoAnnotations("plain comment"), []);
});

test("parseTodoAnnotations — single annotation", () => {
  const result = parseTodoAnnotations('[%todo text="fix this"]');
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "fix this");
});

test("parseTodoAnnotations — escaped quote inside text", () => {
  const result = parseTodoAnnotations(String.raw`[%todo text="say \"hello\""]`);
  assert.equal(result[0].text, 'say "hello"');
});

test("parseTodoAnnotations — multiple annotations", () => {
  const result = parseTodoAnnotations('[%todo text="first"] mid [%todo text="second"]');
  assert.equal(result.length, 2);
  assert.equal(result[0].text, "first");
  assert.equal(result[1].text, "second");
});

test("parseTodoAnnotations — empty text field", () => {
  const result = parseTodoAnnotations('[%todo text=""]');
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "");
});

test("parseTodoAnnotations — case-insensitive", () => {
  const result = parseTodoAnnotations('[%TODO text="task"]');
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "task");
});

// ── hasTodoAnnotations ─────────────────────────────────────────────────────────

test("hasTodoAnnotations — returns true when present", () => {
  assert.equal(hasTodoAnnotations('[%todo text="x"]'), true);
});

test("hasTodoAnnotations — returns false when absent", () => {
  assert.equal(hasTodoAnnotations("plain comment"), false);
});

// ── stripTodoAnnotations ───────────────────────────────────────────────────────

test("stripTodoAnnotations — removes single annotation", () => {
  assert.equal(stripTodoAnnotations('[%todo text="x"]'), "");
});

test("stripTodoAnnotations — preserves surrounding text (double space not collapsed)", () => {
  assert.equal(stripTodoAnnotations('before [%todo text="x"] after'), "before  after");
});

test("stripTodoAnnotations — removes multiple annotations", () => {
  assert.equal(stripTodoAnnotations('[%todo text="a"] mid [%todo text="b"]'), "mid");
});

// ── formatTodoAnnotation ───────────────────────────────────────────────────────

test("formatTodoAnnotation — basic text", () => {
  assert.equal(formatTodoAnnotation({ text: "review this" }), '[%todo text="review this"]');
});

test("formatTodoAnnotation — escapes double quotes in text", () => {
  const result = formatTodoAnnotation({ text: 'say "hello"' });
  assert.ok(result.includes(String.raw`\"hello\"`), result);
});

test("formatTodoAnnotation — escapes backslashes in text", () => {
  const result = formatTodoAnnotation({ text: String.raw`path\to\file` });
  assert.ok(result.includes(String.raw`path\\to\\file`), result);
});

// ── replaceTodoAnnotation ──────────────────────────────────────────────────────

test("replaceTodoAnnotation — replaces at index 0", () => {
  const result = replaceTodoAnnotation('[%todo text="old"]', 0, { text: "new" });
  assert.ok(result.includes('[%todo text="new"]'), result);
  assert.ok(!result.includes("old"), result);
});

test("replaceTodoAnnotation — null deletes the annotation", () => {
  const result = replaceTodoAnnotation('start [%todo text="x"] end', 0, null);
  assert.equal(result, "start end");
});

test("replaceTodoAnnotation — leaves other annotations unchanged", () => {
  const raw = '[%todo text="first"] text [%todo text="second"]';
  const result = replaceTodoAnnotation(raw, 1, { text: "replaced" });
  assert.ok(result.includes('[%todo text="first"]'), result);
  assert.ok(result.includes('[%todo text="replaced"]'), result);
  assert.ok(!result.includes("second"), result);
});

// ── appendTodoAnnotation ───────────────────────────────────────────────────────

test("appendTodoAnnotation — appends to non-empty text", () => {
  const result = appendTodoAnnotation("existing text", { text: "new todo" });
  assert.ok(result.startsWith("existing text"), result);
  assert.ok(result.includes('[%todo text="new todo"]'), result);
});

test("appendTodoAnnotation — empty base string returns just the annotation", () => {
  const result = appendTodoAnnotation("", { text: "task" });
  assert.equal(result, '[%todo text="task"]');
});

test("appendTodoAnnotation — round-trip: append then parse", () => {
  const raw = appendTodoAnnotation("some comment", { text: "do this" });
  const parsed = parseTodoAnnotations(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text, "do this");
});
