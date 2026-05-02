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
  buildRenderedGameMap,
  buildSessionMetadataForGrp,
  enrichMetadataWithEcoDerivedOpening,
  mergeResourceMetadataOverlayForGrp,
  resolveDisplay,
  resolveDisplayForReferenceChip,
  resolveDisplayForSessionTab,
  renderSessionTabGrpText,
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

test("buildRenderedGameMap merges display2 into line2 like renderSessionTabGrpText", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: { Type: "Opening" },
        display1: {
          line1: {
            items: [{ kind: "field", key: "ECO" }],
            separator: " · ",
          },
        },
        display2: {
          line1: {
            items: [{ kind: "field", key: "Head" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const row = {
    game: "title",
    metadata: {
      Type: "Opening",
      ECO: "D30",
      Head: "1.d4 d5 2.c4",
      White: "A",
      Black: "B",
    },
  };
  const map = buildRenderedGameMap([row], profile);
  const r = map.get(row);
  assert.ok(r);
  assert.equal(r?.line1, "D30");
  assert.equal(r?.line2, "1.d4 d5 2.c4");
  assert.ok(r?.filterText.includes("D30"));
  assert.ok(r?.filterText.includes("1.d4"));
});

test("renderSessionTabGrpText fills session line2 from display2 when display1 has only line1", () => {
  const profile: GameRenderingProfile = {
    conditionKeys: [],
    rules: [
      {
        when: { Type: "Opening" },
        display1: {
          line1: {
            items: [{ kind: "field", key: "ECO" }],
            separator: " · ",
          },
        },
        display2: {
          line1: {
            items: [{ kind: "field", key: "Opening" }],
            separator: " · ",
          },
        },
      },
    ],
  };
  const meta: Record<string, string> = {
    Type: "Opening",
    ECO: "D30",
    Opening: "Queen's Gambit",
    White: "A",
    Black: "B",
  };
  const r = renderSessionTabGrpText(meta, profile);
  assert.equal(r.matched, true);
  assert.equal(r.line1, "D30");
  assert.equal(r.line2, "Queen's Gambit");
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

test("mergeResourceMetadataOverlayForGrp resolves overlay keys case-insensitively to existing PGN keys", () => {
  const pgn: Record<string, string> = {
    White: "A",
    Black: "B",
    opening: "",
  };
  const overlay: Record<string, string> = {
    Opening: "London System",
    Type: "Opening",
  };
  const merged: Record<string, string> = mergeResourceMetadataOverlayForGrp(pgn, overlay);
  assert.equal(merged.opening, "London System");
  assert.equal(merged.Opening, undefined);
});

test("mergeResourceMetadataOverlayForGrp writes overlay into canonical PGN key casing when present", () => {
  const pgn: Record<string, string> = { Opening: "", White: "x", Black: "y" };
  const overlay: Record<string, string> = { opening: "Réti" };
  const merged: Record<string, string> = mergeResourceMetadataOverlayForGrp(pgn, overlay);
  assert.equal(merged.Opening, "Réti");
});

test("buildSessionMetadataForGrp includes bracket tags from pgnText when model headers omit keys", () => {
  const pgnText: string = '[Opening "Réti Opening"]\n[White "a"][Black "b"]\n\n1. Nf3';
  const pgnModel: { headers: Array<{ key: string; value: string }> } = {
    headers: [
      { key: "White", value: "a" },
      { key: "Black", value: "b" },
    ],
  };
  const meta: Record<string, string> = buildSessionMetadataForGrp(pgnModel, pgnText, null);
  assert.equal(meta.Opening, "Réti Opening");
});

test("buildSessionMetadataForGrp lets live model headers override bracket extract", () => {
  const pgnText: string = '[Opening "Old"]\n';
  const pgnModel: { headers: Array<{ key: string; value: string }> } = {
    headers: [{ key: "Opening", value: "New" }],
  };
  const meta: Record<string, string> = buildSessionMetadataForGrp(pgnModel, pgnText, null);
  assert.equal(meta.Opening, "New");
});

test("enrichMetadataWithEcoDerivedOpening fills Opening from mainline when tag absent", () => {
  const base: Record<string, string> = {
    White: "w",
    Black: "b",
    Type: "Opening",
  };
  const enriched: Record<string, string> = enrichMetadataWithEcoDerivedOpening(base, ["e4", "c5"]);
  assert.ok(enriched.Opening != null && enriched.Opening.length > 0);
  assert.ok(enriched.ECO != null && enriched.ECO.length > 0);
});

test("enrichMetadataWithEcoDerivedOpening leaves explicit Opening unchanged", () => {
  const base: Record<string, string> = { Opening: "Manual name", White: "w", Black: "b" };
  const enriched: Record<string, string> = enrichMetadataWithEcoDerivedOpening(base, ["e4", "c5"]);
  assert.equal(enriched.Opening, "Manual name");
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
