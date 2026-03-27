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

const PLAN_KEY = "x2chess.curriculum-plan";

/** Load the plan stored in localStorage. Returns null when absent or corrupt. */
export const loadStoredPlan = (): CurriculumPlan | null => {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    return parseCurriculumPlan(raw);
  } catch {
    return null;
  }
};

/** Persist a plan to localStorage. */
export const storeCurrentPlan = (plan: CurriculumPlan): void => {
  try {
    localStorage.setItem(PLAN_KEY, serializeCurriculumPlan(plan));
  } catch {
    // localStorage may be unavailable; fail silently.
  }
};

/** Remove the stored plan from localStorage. */
export const clearStoredPlan = (): void => {
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {
    // Ignore.
  }
};
