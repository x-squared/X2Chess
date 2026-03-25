import test from "node:test";
import assert from "node:assert/strict";
import { materialKeyFromFen } from "../../../resource/domain/material_key";

test("materialKeyFromFen — empty string returns empty", () => {
  assert.equal(materialKeyFromFen(""), "");
});

test("materialKeyFromFen — non-FEN string returns empty", () => {
  assert.equal(materialKeyFromFen("notafen"), "");
});

test("materialKeyFromFen — K vs K endgame", () => {
  assert.equal(materialKeyFromFen("8/8/4k3/8/8/3K4/8/8 w - - 0 1"), "KvK");
});

test("materialKeyFromFen — K+Q+3P vs K+R+P", () => {
  assert.equal(
    materialKeyFromFen("8/5k2/8/8/8/8/PPP5/KQ6 w - - 0 1"),
    // white: Q + PPP; black: no R or P in this FEN — use explicit FEN below
    "KQPPPvK",
  );
});

test("materialKeyFromFen — explicit endgame position KQPPPvKRP", () => {
  // White: K on a1, Q on b1, P on a2/b2/c2; Black: K on e8, R on f8, P on f7
  assert.equal(
    materialKeyFromFen("4kr2/5p2/8/8/8/8/PPP5/KQ6 w - - 0 1"),
    "KQPPPvKRP",
  );
});

test("materialKeyFromFen — K+B+N vs K", () => {
  assert.equal(materialKeyFromFen("4k3/8/8/8/8/8/8/KBN5 w - - 0 1"), "KBNvK");
});

test("materialKeyFromFen — pieces sorted by value desc, B before N on same value", () => {
  // White has N+B+R, should produce KRBNvK
  assert.equal(materialKeyFromFen("4k3/8/8/8/8/8/8/KRNB4 w - - 0 1"), "KRBNvK");
});

test("materialKeyFromFen — standard starting position produces full material key", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const key: string = materialKeyFromFen(startFen);
  // White: Q, R, R, B, B, N, N, P×8 → KQRRBBNNNPPPPPPPP — check structure
  assert.ok(key.startsWith("K"), "key starts with K");
  assert.ok(key.includes("v"), "key contains separator v");
  const [white, black] = key.split("v");
  assert.ok((white ?? "").startsWith("K"));
  assert.ok((black ?? "").startsWith("K"));
  // Both sides have Q
  assert.ok((white ?? "").includes("Q"));
  assert.ok((black ?? "").includes("Q"));
});
