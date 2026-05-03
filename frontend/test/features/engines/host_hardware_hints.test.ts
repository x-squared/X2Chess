/**
 * Tests for host hardware hint heuristics (Hash / Threads clamps).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampHashMegabytesToEngineSpin,
  clampThreadsToEngineSpin,
  suggestedEngineLimits,
} from "../../../src/features/engines/host_hardware_hints";
import type { UciOption } from "../../../../parts/engines/src/domain/uci_types";

const hashOpt: UciOption = {
  name: "Hash",
  type: "spin",
  default: 16,
  min: 1,
  max: 2048,
};

const threadsOpt: UciOption = {
  name: "Threads",
  type: "spin",
  default: 1,
  min: 1,
  max: 512,
};

test("suggestedEngineLimits: 8 cores and 8GB RAM gives threads 6 and hash clamped to engine max", () => {
  const hints = {
    logicalProcessors: 8,
    totalRamMegabytes: 8192,
  };
  const h = suggestedEngineLimits(hints, hashOpt);
  const t = suggestedEngineLimits(hints, threadsOpt);
  assert.equal(t.threads, 6);
  assert.equal(h.hashMegabytes, 2048);
});

test("clampHashMegabytesToEngineSpin respects spin min/max", () => {
  assert.equal(clampHashMegabytesToEngineSpin(50, hashOpt), 50);
  assert.equal(clampHashMegabytesToEngineSpin(5000, hashOpt), 2048);
  assert.equal(clampHashMegabytesToEngineSpin(0, hashOpt), 1);
});

test("clampThreadsToEngineSpin respects spin min/max", () => {
  assert.equal(clampThreadsToEngineSpin(4, threadsOpt), 4);
  assert.equal(clampThreadsToEngineSpin(900, threadsOpt), 512);
});
