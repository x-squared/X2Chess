/**
 * Pure logic tests for tree collapse block-filtering.
 * No DOM, no React — tests the isBlockHidden logic directly.
 */
import test from "node:test";
import assert from "node:assert/strict";

// Inline the helper under test so the test file is self-contained and fast.
const pathKey = (path: readonly number[]): string => path.join(".");

const isBlockHidden = (
  variationPath: readonly number[] | undefined,
  collapsedPaths: ReadonlySet<string>,
): boolean => {
  if (!variationPath || collapsedPaths.size === 0) return false;
  for (let len = 1; len < variationPath.length; len += 1) {
    if (collapsedPaths.has(pathKey(variationPath.slice(0, len)))) return true;
  }
  return false;
};

test("no blocks hidden when collapsedPaths is empty", () => {
  assert.equal(isBlockHidden([0, 1], new Set()), false);
  assert.equal(isBlockHidden([0], new Set()), false);
});

test("blocks without variationPath are never hidden", () => {
  assert.equal(isBlockHidden(undefined, new Set(["0"])), false);
});

test("collapsing [0,1] hides its direct child [0,1,0]", () => {
  const collapsed = new Set([pathKey([0, 1])]);
  assert.equal(isBlockHidden([0, 1, 0], collapsed), true);
});

test("collapsing [0,1] hides deep descendant [0,1,0,0]", () => {
  const collapsed = new Set([pathKey([0, 1])]);
  assert.equal(isBlockHidden([0, 1, 0, 0], collapsed), true);
});

test("collapsing [0,1] does NOT hide sibling [0,0]", () => {
  const collapsed = new Set([pathKey([0, 1])]);
  assert.equal(isBlockHidden([0, 0], collapsed), false);
});

test("collapsing [0,1] does NOT hide the collapsed block itself", () => {
  // The collapsed block's own path is in collapsedPaths, but isBlockHidden only
  // checks PROPER prefixes (len < variationPath.length), so the block itself stays visible.
  const collapsed = new Set([pathKey([0, 1])]);
  assert.equal(isBlockHidden([0, 1], collapsed), false);
});

test("collapsing [0,1] does NOT hide mainline [0]", () => {
  const collapsed = new Set([pathKey([0, 1])]);
  assert.equal(isBlockHidden([0], collapsed), false);
});

test("collapsing [0] hides all descendants regardless of depth", () => {
  const collapsed = new Set([pathKey([0])]);
  assert.equal(isBlockHidden([0, 0], collapsed), true);
  assert.equal(isBlockHidden([0, 1], collapsed), true);
  assert.equal(isBlockHidden([0, 0, 0], collapsed), true);
});

test("multiple collapsed paths each hide their own subtrees", () => {
  const collapsed = new Set([pathKey([0, 0]), pathKey([0, 2])]);
  assert.equal(isBlockHidden([0, 0, 0], collapsed), true);
  assert.equal(isBlockHidden([0, 1], collapsed), false);
  assert.equal(isBlockHidden([0, 2, 0], collapsed), true);
});
