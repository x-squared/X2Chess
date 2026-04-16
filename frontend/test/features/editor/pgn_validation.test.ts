/**
 * Regression tests for Developer Dock PGN quality diagnostics.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { autoFixPgnCompatibility, validatePgnQuality } from "../../../src/features/editor/model/pgn_validation";

test("validatePgnQuality — strict PGN returns strict_ok", () => {
  const report = validatePgnQuality('[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6 *');
  assert.equal(report.status, "strict_ok");
  assert.equal(report.issues.length, 0);
});

test("validatePgnQuality — legacy X2 headers degrade to normalized_ok", () => {
  const report = validatePgnQuality('[Event "?"]\n[X2Style "tree"]\n\n1. e4 e5 *');
  assert.equal(report.status, "normalized_ok");
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]?.phase, "strict");
  assert.ok(report.issues[0]?.line != null);
});

test("validatePgnQuality — malformed comment can recover at stripped stage", () => {
  const report = validatePgnQuality('[Event "?"]\n\n1. e4 {broken comment 1... e5 *');
  assert.equal(report.status, "stripped_ok");
  assert.equal(report.issues.length, 2);
  assert.equal(report.issues[0]?.phase, "strict");
  assert.equal(report.issues[1]?.phase, "normalized");
});

test("validatePgnQuality — irrecoverable PGN returns failed", () => {
  const report = validatePgnQuality('[Event "?"]\n\n1. e4 e5 [broken');
  assert.equal(report.status, "failed");
  assert.equal(report.issues.length, 3);
  assert.equal(report.issues[0]?.phase, "strict");
  assert.equal(report.issues[1]?.phase, "normalized");
  assert.equal(report.issues[2]?.phase, "stripped");
});

test("autoFixPgnCompatibility — renames legacy X2 headers", () => {
  const source = `[Event "?"]\n[X2Style "tree"]\n[X2BoardOrientation "black"]\n\n1. e4 *`;
  const fixed = autoFixPgnCompatibility(source);
  assert.equal(fixed.changed, true);
  assert.ok(fixed.fixedPgn.includes('[XTwoChessStyle "tree"]'));
  assert.ok(fixed.fixedPgn.includes('[XTwoChessBoardOrientation "black"]'));
  assert.ok(!fixed.fixedPgn.includes("[X2Style "));
  assert.ok(!fixed.fixedPgn.includes("[X2BoardOrientation "));
});

test("autoFixPgnCompatibility — injects SetUp for FEN header", () => {
  const source = `[Event "?"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Ka2 *`;
  const fixed = autoFixPgnCompatibility(source);
  assert.equal(fixed.changed, true);
  assert.ok(fixed.fixedPgn.includes('[SetUp "1"]'));
});
