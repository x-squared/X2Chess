/**
 * curriculum_io — JSON serialisation and parsing for `.x2plan` files.
 *
 * Integration API:
 * - `parseCurriculumPlan(json)` — safe parse; returns null on invalid input.
 * - `serializeCurriculumPlan(plan)` — produce pretty-printed JSON.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure functions; no I/O and no side effects.
 */

import type { CurriculumPlan, Chapter, Task, TaskMethod, TaskRef } from "./curriculum_plan";
import { TASK_METHODS } from "./curriculum_plan";

// ── Serialisation ─────────────────────────────────────────────────────────────

/**
 * Serialise a curriculum plan to a pretty-printed JSON string suitable for
 * writing to a `.x2plan` file.
 */
export const serializeCurriculumPlan = (plan: CurriculumPlan): string =>
  JSON.stringify(plan, null, 2);

// ── Parsing ───────────────────────────────────────────────────────────────────

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const parseTaskRef = (raw: unknown): TaskRef | null => {
  if (!isObject(raw)) return null;
  const kind = raw["kind"];
  const locator = raw["locator"];
  const recordId = raw["recordId"];
  if (!isString(kind) || !isString(locator) || !isString(recordId)) return null;
  return { kind, locator, recordId };
};

const parseTaskMethod = (raw: unknown): TaskMethod =>
  (TASK_METHODS as readonly string[]).includes(String(raw ?? "")) ? (raw as TaskMethod) : "replay";

const parseTask = (raw: unknown): Task | null => {
  if (!isObject(raw)) return null;
  const id = raw["id"];
  const title = raw["title"];
  if (!isString(id) || typeof title !== "string") return null;
  const task: Task = {
    id,
    title: String(title),
    method: parseTaskMethod(raw["method"]),
    ref: parseTaskRef(raw["ref"]),
  };
  if (isObject(raw["methodOptions"])) {
    task.methodOptions = raw["methodOptions"] as Record<string, unknown>;
  }
  if (typeof raw["notes"] === "string" && raw["notes"].length > 0) {
    task.notes = raw["notes"];
  }
  return task;
};

const parseChapter = (raw: unknown): Chapter | null => {
  if (!isObject(raw)) return null;
  const id = raw["id"];
  const title = raw["title"];
  if (!isString(id) || typeof title !== "string") return null;
  const rawTasks: unknown[] = Array.isArray(raw["tasks"]) ? (raw["tasks"] as unknown[]) : [];
  const tasks: Task[] = rawTasks.flatMap((t: unknown): Task[] => {
    const parsed = parseTask(t);
    return parsed ? [parsed] : [];
  });
  return { id, title: String(title), tasks };
};

/**
 * Parse a `.x2plan` JSON string into a `CurriculumPlan`.
 * Returns `null` if the input is missing required fields or is not valid JSON.
 */
export const parseCurriculumPlan = (json: string): CurriculumPlan | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;
  if (raw["version"] !== 1) return null;
  const id = raw["id"];
  const title = raw["title"];
  if (!isString(id) || typeof title !== "string") return null;
  const rawChapters: unknown[] = Array.isArray(raw["chapters"])
    ? (raw["chapters"] as unknown[])
    : [];
  const chapters: Chapter[] = rawChapters.flatMap((c: unknown): Chapter[] => {
    const parsed = parseChapter(c);
    return parsed ? [parsed] : [];
  });
  return { version: 1, id, title: String(title), chapters };
};
