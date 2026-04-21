import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldRenderCommentBlock,
  shouldFocusCommentBlock,
} from "../../src/features/editor/components/PgnEditorTokenView.js";
import { shouldAutoEnterEditModeOnFocus } from "../../src/features/editor/components/PgnEditorCommentBlock.js";
import { shouldRearmConsumedFocusForInsert } from "../../src/features/editor/components/PgnTextEditor.js";

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

test("shouldFocusCommentBlock allows refocus after consumed focus reset", () => {
  const initiallyConsumed: boolean = shouldFocusCommentBlock("c1", "c1", "c1");
  assert.equal(initiallyConsumed, false);

  const afterRearm: boolean = shouldFocusCommentBlock("c1", "c1", null);
  assert.equal(afterRearm, true);
});

test("shouldFocusCommentBlock stays focused for new target without rearming", () => {
  const result: boolean = shouldFocusCommentBlock("c2", "c2", "c1");
  assert.equal(result, true);
});

test("shouldFocusCommentBlock can be retriggered by consumed-id flip", () => {
  const disabled: boolean = shouldFocusCommentBlock("c1", "c1", "c1");
  assert.equal(disabled, false);

  const retriggered: boolean = shouldFocusCommentBlock("c1", "c1", null);
  assert.equal(retriggered, true);
});

test("shouldAutoEnterEditModeOnFocus opens empty focused view comment", () => {
  const result: boolean = shouldAutoEnterEditModeOnFocus(true, false, "");
  assert.equal(result, true);
});

test("shouldAutoEnterEditModeOnFocus does not open non-empty view comment", () => {
  const result: boolean = shouldAutoEnterEditModeOnFocus(true, false, "note");
  assert.equal(result, false);
});

test("shouldRearmConsumedFocusForInsert re-arms only repeated existing target", () => {
  const yes: boolean = shouldRearmConsumedFocusForInsert("c1", "c1", "c1");
  const noExisting: boolean = shouldRearmConsumedFocusForInsert(null, "c1", "c1");
  const noConsumedMatch: boolean = shouldRearmConsumedFocusForInsert("c1", "c1", null);
  assert.equal(yes, true);
  assert.equal(noExisting, false);
  assert.equal(noConsumedMatch, false);
});
