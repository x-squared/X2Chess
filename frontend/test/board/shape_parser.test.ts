/**
 * Tests for board/shape_parser — parseShapes().
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseShapes } from "../../src/board/shape_parser";
import type { BoardShape } from "../../src/board/board_shapes";

describe("parseShapes", (): void => {
  it("returns empty array for empty string", (): void => {
    assert.deepEqual(parseShapes(""), []);
  });

  it("returns empty array for comment with no annotations", (): void => {
    assert.deepEqual(parseShapes("This is a plain comment."), []);
  });

  it("parses a single [%csl] green highlight", (): void => {
    const result: BoardShape[] = parseShapes("[%csl Ge4]");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { kind: "highlight", square: "e4", color: "green" });
  });

  it("parses multiple [%csl] tokens", (): void => {
    const result: BoardShape[] = parseShapes("[%csl Rg1,Ye4,Bd5]");
    assert.equal(result.length, 3);
    assert.deepEqual(result[0], { kind: "highlight", square: "g1", color: "red" });
    assert.deepEqual(result[1], { kind: "highlight", square: "e4", color: "yellow" });
    assert.deepEqual(result[2], { kind: "highlight", square: "d5", color: "blue" });
  });

  it("parses a single [%cal] arrow", (): void => {
    const result: BoardShape[] = parseShapes("[%cal Ge2e4]");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { kind: "arrow", from: "e2", to: "e4", color: "green" });
  });

  it("parses multiple [%cal] arrows with different colours", (): void => {
    const result: BoardShape[] = parseShapes("[%cal Re1g3,Yd1h5,Bb1c3]");
    assert.equal(result.length, 3);
    assert.deepEqual(result[0], { kind: "arrow", from: "e1", to: "g3", color: "red" });
    assert.deepEqual(result[1], { kind: "arrow", from: "d1", to: "h5", color: "yellow" });
    assert.deepEqual(result[2], { kind: "arrow", from: "b1", to: "c3", color: "blue" });
  });

  it("parses both [%csl] and [%cal] in the same comment", (): void => {
    const result: BoardShape[] = parseShapes("[%csl Rf4] [%cal Ge2e4,Ye4f6]");
    assert.equal(result.length, 3);
    assert.deepEqual(result[0], { kind: "highlight", square: "f4", color: "red" });
    assert.deepEqual(result[1], { kind: "arrow", from: "e2", to: "e4", color: "green" });
    assert.deepEqual(result[2], { kind: "arrow", from: "e4", to: "f6", color: "yellow" });
  });

  it("silently drops malformed square tokens", (): void => {
    const result: BoardShape[] = parseShapes("[%csl Ge4,XX,Rd5]");
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { kind: "highlight", square: "e4", color: "green" });
    assert.deepEqual(result[1], { kind: "highlight", square: "d5", color: "red" });
  });

  it("silently drops malformed arrow tokens", (): void => {
    const result: BoardShape[] = parseShapes("[%cal Ge2e4,BAD,Rb1c3]");
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { kind: "arrow", from: "e2", to: "e4", color: "green" });
    assert.deepEqual(result[1], { kind: "arrow", from: "b1", to: "c3", color: "red" });
  });

  it("drops zero-length arrows (same from and to)", (): void => {
    const result: BoardShape[] = parseShapes("[%cal Ge4e4]");
    assert.equal(result.length, 0);
  });

  it("is case-insensitive for annotation keywords", (): void => {
    const result: BoardShape[] = parseShapes("[%CSL Ge4] [%CAL Re2e4]");
    assert.equal(result.length, 2);
  });

  it("handles extra whitespace around tokens", (): void => {
    const result: BoardShape[] = parseShapes("[%csl  Ge4 , Rd5 ]");
    assert.equal(result.length, 2);
  });
});

describe("serializeShapes + stripShapeAnnotations round-trip", (): void => {
  it("round-trips highlights and arrows", async (): Promise<void> => {
    const { serializeShapes } = await import("../../src/board/shape_serializer");
    const shapes: BoardShape[] = [
      { kind: "highlight", square: "e4", color: "green" },
      { kind: "arrow", from: "e2", to: "e4", color: "green" },
    ];
    const serialized: string = serializeShapes(shapes);
    const reparsed: BoardShape[] = parseShapes(serialized);
    assert.deepEqual(reparsed, shapes);
  });

  it("stripShapeAnnotations removes [%csl] and [%cal] blocks", async (): Promise<void> => {
    const { stripShapeAnnotations } = await import("../../src/board/shape_serializer");
    const raw: string = "Good move [%csl Ge4] [%cal Re2e4] because it controls the centre.";
    const stripped: string = stripShapeAnnotations(raw);
    assert.equal(stripped, "Good move because it controls the centre.");
  });

  it("serializeShapes returns empty string for empty array", async (): Promise<void> => {
    const { serializeShapes } = await import("../../src/board/shape_serializer");
    assert.equal(serializeShapes([]), "");
  });
});
