/**
 * Tests for merging resource-list metadata into PGN headers on open.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model";
import { ensureRequiredPgnHeaders, getHeaderValue } from "../../../parts/pgnparser/src/pgn_headers";
import { hydratePgnModelFromResourceMetadata } from "../../src/features/sessions/services/resource_metadata_hydrate";

test("hydratePgnModelFromResourceMetadata fills only blank header slots", () => {
  const raw = `[White "A"]\n[Black "B"]\n\n1. e4 e5`;
  const model = ensureRequiredPgnHeaders(parsePgnToModel(raw));
  const { model: next, keysFilled } = hydratePgnModelFromResourceMetadata(model, {
    Type: "opening",
    Opening: "Italian",
    White: "ShouldNotOverwrite",
  });
  const sortedFilled: string[] = [...keysFilled].sort((a: string, b: string): number => a.localeCompare(b));
  const sortedExpected: string[] = ["Opening", "Type"].sort((a: string, b: string): number => a.localeCompare(b));
  assert.deepEqual(sortedFilled, sortedExpected);
  assert.equal(getHeaderValue(next, "White", ""), "A");
  assert.equal(getHeaderValue(next, "Type", ""), "opening");
  assert.equal(getHeaderValue(next, "Opening", ""), "Italian");
});
