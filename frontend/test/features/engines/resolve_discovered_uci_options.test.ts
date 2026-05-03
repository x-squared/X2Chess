/**
 * Tests for same-path fallback when resolving cached UCI option lists (copied engines).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDiscoveredUciOptionsForEngine } from "../../../src/features/engines/resolve_discovered_uci_options";
import type { EngineConfig } from "../../../../parts/engines/src/domain/engine_config";
import type { UciOption } from "../../../../parts/engines/src/domain/uci_types";

const mk = (id: string, label: string, path: string): EngineConfig => ({
  id,
  label,
  path,
  options: {},
});

const hashOpt: UciOption = {
  name: "Hash",
  type: "spin",
  default: 16,
  min: 1,
  max: 8192,
};

test("resolveDiscoveredUciOptionsForEngine: copy id falls back to same-path sibling cache", () => {
  const a: EngineConfig = mk("eng_a", "Stockfish", "/opt/bin/stockfish");
  const b: EngineConfig = mk("eng_b", "Stockfish (copy)", "/opt/bin/stockfish");
  const byId: Map<string, UciOption[]> = new Map([["eng_a", [hashOpt]]]);
  const resolved: UciOption[] = resolveDiscoveredUciOptionsForEngine(b, [a, b], byId);
  assert.deepEqual(resolved, [hashOpt]);
});

test("resolveDiscoveredUciOptionsForEngine: prefers own id when populated", () => {
  const a: EngineConfig = mk("eng_a", "A", "/x/sf");
  const own: UciOption = { ...hashOpt, default: 32 };
  const byId: Map<string, UciOption[]> = new Map([
    ["eng_a", [own]],
    ["eng_other", [hashOpt]],
  ]);
  const resolved: UciOption[] = resolveDiscoveredUciOptionsForEngine(a, [a], byId);
  assert.deepEqual(resolved, [own]);
});
