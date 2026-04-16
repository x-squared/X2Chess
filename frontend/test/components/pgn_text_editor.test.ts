import test from "node:test";
import assert from "node:assert/strict";
import { shouldRenderCommentBlock } from "../../src/features/editor/components/PgnEditorTokenView.js";

test("shouldRenderCommentBlock renders non-empty comments", () => {
  const result: boolean = shouldRenderCommentBlock(true, true, "c1", null, null);
  assert.equal(result, true);
});

test("shouldRenderCommentBlock renders focused empty inserted comment", () => {
  const result: boolean = shouldRenderCommentBlock(false, false, "c1", "c1", null);
  assert.equal(result, true);
});

test("shouldRenderCommentBlock keeps empty comments rendered after focus consumed", () => {
  const result: boolean = shouldRenderCommentBlock(false, false, "c1", "c1", "c1");
  assert.equal(result, true);
});

test("shouldRenderCommentBlock hides non-empty comment only when not focused and no display text", () => {
  const result: boolean = shouldRenderCommentBlock(false, true, "c1", "other", "other");
  assert.equal(result, false);
});
