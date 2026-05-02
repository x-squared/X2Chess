/**
 * Tests for game rendering profile resolution (GRP).
 */

import test from "node:test";
import assert from "node:assert/strict";
import type {
  GameRenderingProfile,
  MetadataFieldDefinition,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import {
  mergeResourceMetadataOverlayForGrp,
  resolveDisplay,
  resolveDisplayForReferenceChip,
  resolveDisplayForSessionTab,
} from "../../../../src/features/resources/services/game_rendering";

test("resolveDisplay falls back when matching rule has no slot but default does", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: ["Kind"],
    rules: [
      {
        when: { Kind: "Study" },
        display2: {
          line1: {
            items: [{ kind: "field", key: "Event" }],
            separator: " · ",
          },
        },
      },
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = { Kind: "Study", White: "A", Black: "B" };
  const d = resolveDisplay(meta, profile, "display1");
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "players");
});

test("resolveDisplay uses first matching rule when slot is present", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: { Result: "1-0" },
        display1: {
          line1: {
            items: [{ kind: "field", key: "Event" }],
            separator: " · ",
          },
        },
      },
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = { Result: "1-0", Event: "X", White: "A", Black: "B" };
  const d = resolveDisplay(meta, profile, "display1");
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "field");
});

test("resolveDisplayForReferenceChip uses display2 when display1 absent", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: {},
        display2: {
          line1: {
            items: [{ kind: "field", key: "Event" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = { Event: "London", White: "A", Black: "B" };
  const r = resolveDisplayForReferenceChip(meta, profile);
  assert.equal(r.source, "display2");
  assert.ok(r.display);
  assert.equal(r.display?.line1.items[0]?.kind, "field");
});

test("resolveDisplayForReferenceChip prefers display1 when both exist", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " · ",
          },
        },
        display2: {
          line1: {
            items: [{ kind: "field", key: "Event" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = { Event: "X", White: "A", Black: "B" };
  const r = resolveDisplayForReferenceChip(meta, profile);
  assert.equal(r.source, "display1");
  assert.equal(r.display?.line1.items[0]?.kind, "players");
});

test("resolveDisplayForSessionTab prefers display1 when both exist", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " · ",
          },
        },
        display2: {
          line1: {
            items: [{ kind: "field", key: "Event" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = { Event: "X", White: "A", Black: "B" };
  const d = resolveDisplayForSessionTab(meta, profile);
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "players");
});

test("resolveDisplayForSessionTab falls back to display2 when display1 absent", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: {},
        display2: {
          line1: {
            items: [{ kind: "field", key: "Event" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = { Event: "OnlyDetail", White: "A", Black: "B" };
  const d = resolveDisplayForSessionTab(meta, profile);
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "field");
});

test("resolveDisplay matches when rule key Type and metadata key type differ only by case", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: ["Type"],
    rules: [
      {
        when: { Type: "opening" },
        display1: {
          line1: {
            items: [{ kind: "field", key: "ECO" }],
            separator: " ",
          },
        },
      },
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " ",
          },
        },
      },
    ],
  };
  const typeField: MetadataFieldDefinition = {
    key: "Type",
    label: "Type",
    type: "select",
    required: false,
    orderIndex: 1,
    selectValues: ["opening", "model"],
  };
  const meta: Record<string, string> = {
    type: "opening",
    ECO: "B20",
    White: "A",
    Black: "B",
  };
  const d = resolveDisplay(meta, profile, "display1", [typeField]);
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "field");
});

test("resolveDisplay matches select when case-insensitively when schema fields provided", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: ["Type"],
    rules: [
      {
        when: { Type: "opening" },
        display1: {
          line1: {
            items: [{ kind: "field", key: "ECO" }],
            separator: " ",
          },
        },
      },
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " ",
          },
        },
      },
    ],
  };
  const typeField: MetadataFieldDefinition = {
    key: "Type",
    label: "Type",
    type: "select",
    required: false,
    orderIndex: 1,
    selectValues: ["opening", "model"],
  };
  const meta: Record<string, string> = {
    Type: "Opening",
    ECO: "B20",
    White: "A",
    Black: "B",
  };
  const d = resolveDisplay(meta, profile, "display1", [typeField]);
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "field");
});

test("mergeResourceMetadataOverlayForGrp replaces Type placeholder ? from index", () => {
  const pgn: Record<string, string> = { White: "A", Black: "B", Type: "?" };
  const overlay: Record<string, string> = { Type: "opening", White: "A", Black: "B" };
  const merged = mergeResourceMetadataOverlayForGrp(pgn, overlay);
  assert.equal(merged.Type, "opening");
  assert.equal(merged.White, "A");
});

test("mergeResourceMetadataOverlayForGrp does not clobber non-placeholder PGN Type", () => {
  const pgn: Record<string, string> = { Type: "model", White: "A", Black: "B" };
  const overlay: Record<string, string> = { Type: "opening" };
  const merged = mergeResourceMetadataOverlayForGrp(pgn, overlay);
  assert.equal(merged.Type, "model");
});

test("resolveDisplay keeps strict select equality without schema fields", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: ["Type"],
    rules: [
      {
        when: { Type: "opening" },
        display1: {
          line1: {
            items: [{ kind: "field", key: "ECO" }],
            separator: " ",
          },
        },
      },
      {
        when: {},
        display1: {
          line1: {
            items: [{ kind: "players" }],
            separator: " ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = {
    Type: "Opening",
    ECO: "B20",
    White: "A",
    Black: "B",
  };
  const d = resolveDisplay(meta, profile, "display1");
  assert.ok(d);
  assert.equal(d?.line1.items[0]?.kind, "players");
});
