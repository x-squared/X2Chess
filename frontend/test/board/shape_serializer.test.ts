import test from "node:test";
import assert from "node:assert/strict";
import { serializeShapes, stripShapeAnnotations } from "../../src/board/shape_serializer.js";
import type { BoardShape } from "../../src/board/board_shapes.js";

// ── serializeShapes ────────────────────────────────────────────────────────────

test("serializeShapes — empty input returns empty string", () => {
  assert.equal(serializeShapes([]), "");
});

test("serializeShapes — single highlight", () => {
  const shapes: BoardShape[] = [{ kind: "highlight", square: "e4", color: "green" }];
  assert.equal(serializeShapes(shapes), "[%csl Ge4]");
});

test("serializeShapes — single arrow", () => {
  const shapes: BoardShape[] = [{ kind: "arrow", from: "e2", to: "e4", color: "red" }];
  assert.equal(serializeShapes(shapes), "[%cal Re2e4]");
});

test("serializeShapes — mixed highlights and arrows emitted in separate blocks", () => {
  const shapes: BoardShape[] = [
    { kind: "highlight", square: "e4", color: "green" },
    { kind: "arrow", from: "d2", to: "d4", color: "blue" },
  ];
  const result = serializeShapes(shapes);
  assert.ok(result.includes("[%csl Ge4]"), `expected csl block, got: ${result}`);
  assert.ok(result.includes("[%cal Bd2d4]"), `expected cal block, got: ${result}`);
});

test("serializeShapes — multiple highlights sorted alphabetically", () => {
  const shapes: BoardShape[] = [
    { kind: "highlight", square: "h1", color: "red" },
    { kind: "highlight", square: "a1", color: "green" },
    { kind: "highlight", square: "e4", color: "yellow" },
  ];
  assert.equal(serializeShapes(shapes), "[%csl Ga1,Rh1,Ye4]");
});

test("serializeShapes — all four colors", () => {
  const shapes: BoardShape[] = [
    { kind: "highlight", square: "a1", color: "green" },
    { kind: "highlight", square: "b2", color: "red" },
    { kind: "highlight", square: "c3", color: "yellow" },
    { kind: "highlight", square: "d4", color: "blue" },
  ];
  const result = serializeShapes(shapes);
  assert.ok(result.includes("Ga1"), result);
  assert.ok(result.includes("Rb2"), result);
  assert.ok(result.includes("Yc3"), result);
  assert.ok(result.includes("Bd4"), result);
});

test("serializeShapes — only arrows, no csl block", () => {
  const shapes: BoardShape[] = [
    { kind: "arrow", from: "e2", to: "e4", color: "green" },
    { kind: "arrow", from: "d2", to: "d4", color: "red" },
  ];
  const result = serializeShapes(shapes);
  assert.ok(!result.includes("[%csl"), result);
  assert.ok(result.includes("[%cal"), result);
});

// ── stripShapeAnnotations ──────────────────────────────────────────────────────

test("stripShapeAnnotations — no annotations unchanged (trimmed)", () => {
  assert.equal(stripShapeAnnotations("nice move"), "nice move");
});

test("stripShapeAnnotations — strips csl annotation", () => {
  assert.equal(stripShapeAnnotations("[%csl Ge4] nice move"), "nice move");
});

test("stripShapeAnnotations — strips cal annotation", () => {
  assert.equal(stripShapeAnnotations("nice move [%cal Re2e4]"), "nice move");
});

test("stripShapeAnnotations — strips both csl and cal", () => {
  assert.equal(stripShapeAnnotations("[%csl Ge4] text [%cal Re2e4]"), "text");
});

test("stripShapeAnnotations — empty string returns empty", () => {
  assert.equal(stripShapeAnnotations(""), "");
});

test("stripShapeAnnotations — only annotation returns empty", () => {
  assert.equal(stripShapeAnnotations("[%csl Ge4]"), "");
});

test("stripShapeAnnotations — case-insensitive stripping", () => {
  assert.equal(stripShapeAnnotations("[%CSL Ge4] text"), "text");
});

test("stripShapeAnnotations — round-trip with serializeShapes", () => {
  const shapes: BoardShape[] = [
    { kind: "highlight", square: "e4", color: "green" },
    { kind: "arrow", from: "e2", to: "e4", color: "red" },
  ];
  const comment = `good play ${serializeShapes(shapes)} interesting`;
  const stripped = stripShapeAnnotations(comment);
  assert.equal(stripped, "good play interesting");
});
