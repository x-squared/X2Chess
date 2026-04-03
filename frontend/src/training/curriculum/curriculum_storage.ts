/**
 * curriculum_storage — localStorage persistence for the active curriculum plan.
 *
 * Integration API:
 * - `loadStoredPlan()` — return the last saved plan, or null.
 * - `storeCurrentPlan(plan)` — persist the plan.
 * - `clearStoredPlan()` — remove the stored plan.
 *
 * Configuration API:
 * - Storage key: `"x2chess.curriculum-plan"` in localStorage.
 *
 * Communication API:
 * - Pure functions; no React dependencies.
 */

import type { CurriculumPlan } from "./curriculum_plan";
import { parseCurriculumPlan, serializeCurriculumPlan } from "./curriculum_io";
import { createVersionedStore } from "../../storage";

const PLAN_KEY = "x2chess.curriculum-plan";

// The store holds the serialized plan string; parsing/serialization is owned
// by curriculum_io so the versioned store deals only in opaque strings.
const planStore = createVersionedStore<string | null>({
  key: PLAN_KEY,
  version: 1,
  defaultValue: null,
  migrations: [
    // v0→v1: raw payload was the serialized plan string directly — pass through.
    (raw) => (typeof raw === "string" ? raw : null),
  ],
});

/** Load the plan stored in localStorage. Returns null when absent or corrupt. */
export const loadStoredPlan = (): CurriculumPlan | null => {
  const raw = planStore.read();
  if (!raw) return null;
  try {
    return parseCurriculumPlan(raw);
  } catch {
    return null;
  }
};

/** Persist a plan to localStorage. */
export const storeCurrentPlan = (plan: CurriculumPlan): void => {
  planStore.write(serializeCurriculumPlan(plan));
};

/** Remove the stored plan from localStorage. */
export const clearStoredPlan = (): void => {
  planStore.reset();
};
