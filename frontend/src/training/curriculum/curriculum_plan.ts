/**
 * curriculum_plan — Domain types for the training curriculum (.x2plan).
 *
 * Integration API:
 * - `CurriculumPlan`, `Chapter`, `Task`, `TaskMethod`, `TaskRef` — value types
 *   shared across IO, storage, and UI layers.
 *
 * Configuration API:
 * - `TASK_METHODS` — ordered list of supported training method ids.
 *
 * Communication API:
 * - Pure type definitions and constants; no side effects.
 */

// ── Task method ───────────────────────────────────────────────────────────────

export const TASK_METHODS = ["replay", "opening", "find_move"] as const;

export type TaskMethod = (typeof TASK_METHODS)[number];

// ── Game reference embedded in a task ────────────────────────────────────────

/**
 * Identifies a single game in any resource.  Maps directly onto `PgnGameRef`
 * but is defined here to avoid importing from the resource layer into a
 * pure-training domain module.
 */
export type TaskRef = {
  kind: string;
  locator: string;
  recordId: string;
};

// ── Task ─────────────────────────────────────────────────────────────────────

export type Task = {
  /** Stable UUID. */
  id: string;
  title: string;
  method: TaskMethod;
  /** Method-specific options forwarded to the training launcher. */
  methodOptions?: Record<string, unknown>;
  /** Null when the task is not yet linked to a game. */
  ref: TaskRef | null;
  notes?: string;
};

// ── Chapter ───────────────────────────────────────────────────────────────────

export type Chapter = {
  /** Stable UUID. */
  id: string;
  title: string;
  tasks: Task[];
};

// ── Plan ─────────────────────────────────────────────────────────────────────

export type CurriculumPlan = {
  /** Schema version. */
  version: 1;
  /** Stable UUID. */
  id: string;
  title: string;
  chapters: Chapter[];
};
