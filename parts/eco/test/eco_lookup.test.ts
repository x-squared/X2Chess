import test from "node:test";
import assert from "node:assert/strict";
import { buildEcoLookup } from "../src/eco_lookup.js";
import type { EcoEntry } from "../src/eco_lookup.js";

const DATASET: EcoEntry[] = [
  { eco: "A00", name: "Amar Opening", moves: ["Nh3"] },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"] },
  { eco: "B90", name: "Sicilian Defense: Najdorf Variation", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
];

const lookup = buildEcoLookup(DATASET);

test("empty move list → null", () => {
  assert.equal(lookup([]), null);
});

test("single move matching shallowest entry", () => {
  const result = lookup(["Nh3"]);
  assert.ok(result !== null);
  assert.equal(result.eco, "A00");
  assert.equal(result.depth, 1);
});

test("B20 Sicilian identified from two moves", () => {
  const result = lookup(["e4", "c5"]);
  assert.ok(result !== null);
  assert.equal(result.eco, "B20");
  assert.equal(result.depth, 2);
});

test("deeper entry wins over shallower prefix", () => {
  const result = lookup(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Bg5"]);
  assert.ok(result !== null);
  assert.equal(result.eco, "B90");
  assert.equal(result.depth, 10);
});

test("Ruy Lopez Berlin preferred over base Ruy Lopez", () => {
  const result = lookup(["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O"]);
  assert.ok(result !== null);
  assert.equal(result.eco, "C65");
  assert.equal(result.depth, 6);
});

test("unknown opening → null", () => {
  assert.equal(lookup(["d4", "d5"]), null);
});

test("partial match of a longer entry still returns shallower match", () => {
  // Only the first 2 moves of Najdorf — falls back to B20
  const result = lookup(["e4", "c5", "Nf3"]);
  assert.ok(result !== null);
  assert.equal(result.eco, "B20");
});
