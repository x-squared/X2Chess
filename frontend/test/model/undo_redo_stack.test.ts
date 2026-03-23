import test from "node:test";
import assert from "node:assert/strict";
import { createUndoRedoStack } from "../../src/model/undo_redo_stack.js";

// ── initial state ──────────────────────────────────────────────────────────────

test("createUndoRedoStack — starts empty", () => {
  const stack = createUndoRedoStack<number>();
  assert.equal(stack.current, null);
  assert.equal(stack.canUndo, false);
  assert.equal(stack.canRedo, false);
  assert.equal(stack.undoDepth, 0);
  assert.equal(stack.redoDepth, 0);
});

// ── push ───────────────────────────────────────────────────────────────────────

test("push — sets current to pushed value", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(42);
  assert.equal(stack.current, 42);
});

test("push — second push enables undo", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  assert.equal(stack.canUndo, true);
  assert.equal(stack.undoDepth, 1);
});

test("push — clears redo history", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  stack.undo();
  assert.equal(stack.canRedo, true);
  stack.push(3);
  assert.equal(stack.canRedo, false);
  assert.equal(stack.redoDepth, 0);
});

// ── undo ───────────────────────────────────────────────────────────────────────

test("undo — returns null when at bottom", () => {
  const stack = createUndoRedoStack<string>();
  assert.equal(stack.undo(), null);
});

test("undo — returns previous state", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(10);
  stack.push(20);
  const result = stack.undo();
  assert.equal(result, 10);
  assert.equal(stack.current, 10);
});

test("undo — enables redo", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  stack.undo();
  assert.equal(stack.canRedo, true);
});

test("undo — multiple steps", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  stack.push(3);
  stack.undo();
  stack.undo();
  assert.equal(stack.current, 1);
  assert.equal(stack.undoDepth, 0);
});

// ── redo ───────────────────────────────────────────────────────────────────────

test("redo — returns null when at top", () => {
  const stack = createUndoRedoStack<string>();
  stack.push("a");
  assert.equal(stack.redo(), null);
});

test("redo — returns the undone state", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(10);
  stack.push(20);
  stack.undo();
  const result = stack.redo();
  assert.equal(result, 20);
  assert.equal(stack.current, 20);
});

test("redo — restores full sequence", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  stack.push(3);
  stack.undo();
  stack.undo();
  stack.redo();
  assert.equal(stack.current, 2);
  stack.redo();
  assert.equal(stack.current, 3);
  assert.equal(stack.canRedo, false);
});

// ── clear ─────────────────────────────────────────────────────────────────────

test("clear — removes undo history but keeps current", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  stack.clear();
  assert.equal(stack.current, 2);
  assert.equal(stack.canUndo, false);
  assert.equal(stack.undoDepth, 0);
});

test("clear — also removes redo history", () => {
  const stack = createUndoRedoStack<number>();
  stack.push(1);
  stack.push(2);
  stack.undo();
  stack.clear();
  assert.equal(stack.canRedo, false);
  assert.equal(stack.redoDepth, 0);
});

// ── maxDepth ──────────────────────────────────────────────────────────────────

test("maxDepth — caps undo history length", () => {
  const stack = createUndoRedoStack<number>({ maxDepth: 3 });
  for (let i = 0; i < 10; i++) stack.push(i);
  assert.equal(stack.undoDepth, 3);
});

test("maxDepth — oldest entries are dropped first", () => {
  const stack = createUndoRedoStack<number>({ maxDepth: 2 });
  stack.push(1);
  stack.push(2);
  stack.push(3); // 1 is dropped
  stack.push(4); // 2 is dropped
  // Undoing twice should give 3, then 2 (which is now oldest)
  assert.equal(stack.undo(), 3);
  assert.equal(stack.undo(), 2);
  assert.equal(stack.canUndo, false);
});
