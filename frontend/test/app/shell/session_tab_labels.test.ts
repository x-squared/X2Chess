/**
 * Regression: GRP-applied sessions must not fall back to player names when rendered lines are empty.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionTabPrimaryLabel,
  buildSessionTabSecondaryLabel,
} from "../../../src/app/shell/session_tab_labels";
import type { SessionItemState } from "../../../src/core/state/app_reducer";

const base: SessionItemState = {
  sessionId: "s1",
  title: "T",
  dirtyState: "clean",
  saveMode: "auto",
  isActive: true,
  isUnsaved: false,
  white: "W",
  black: "B",
  event: "E",
  date: "D",
  sourceLocator: "",
  sourceGameRef: "",
};

test("grpProfileApplied: empty line1/2 does not substitute player names for primary", () => {
  const s: SessionItemState = {
    ...base,
    renderedLine1: "",
    renderedLine2: undefined,
    grpProfileApplied: true,
  };
  const primary: string = buildSessionTabPrimaryLabel(s);
  assert.equal(primary, "T");
  assert.notEqual(primary, "W — B");
});

test("grpProfileApplied: non-empty line2 promotes to primary when line1 blank", () => {
  const s: SessionItemState = {
    ...base,
    renderedLine1: "",
    renderedLine2: "Opening text",
    grpProfileApplied: true,
  };
  assert.equal(buildSessionTabPrimaryLabel(s), "Opening text");
});

test("grpProfileApplied: both lines set → secondary shows line2 only", () => {
  const s: SessionItemState = {
    ...base,
    renderedLine1: "A",
    renderedLine2: "B",
    grpProfileApplied: true,
  };
  assert.equal(buildSessionTabSecondaryLabel(s, "unsaved"), "B");
});

test("no grp: legacy behaviour — empty renderedLine1 falls through to players", () => {
  const s: SessionItemState = {
    ...base,
    renderedLine1: "",
    grpProfileApplied: undefined,
  };
  assert.equal(buildSessionTabPrimaryLabel(s), "W — B");
});
