import test from "node:test";
import assert from "node:assert/strict";
import { resolveDeleteGameConfirmNext } from "../../../../src/features/resources/components/ResourceViewer.js";

test("resolveDeleteGameConfirmNext arms confirmation on first delete click", () => {
  const next: { nextArmed: boolean; shouldDelete: boolean } = resolveDeleteGameConfirmNext(false);
  assert.equal(next.nextArmed, true);
  assert.equal(next.shouldDelete, false);
});

test("resolveDeleteGameConfirmNext deletes on confirmed second click", () => {
  const next: { nextArmed: boolean; shouldDelete: boolean } = resolveDeleteGameConfirmNext(true);
  assert.equal(next.nextArmed, false);
  assert.equal(next.shouldDelete, true);
});
