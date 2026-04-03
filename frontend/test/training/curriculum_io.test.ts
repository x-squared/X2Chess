import test from "node:test";
import assert from "node:assert/strict";
import { parseCurriculumPlan, serializeCurriculumPlan } from "../../src/training/curriculum/curriculum_io.js";
import type { CurriculumPlan } from "../../src/training/curriculum/curriculum_plan.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const minimalPlan: CurriculumPlan = {
  version: 1,
  id: "plan-001",
  title: "Test Plan",
  chapters: [],
};

const fullPlan: CurriculumPlan = {
  version: 1,
  id: "plan-002",
  title: "Full Plan",
  chapters: [
    {
      id: "chapter-1",
      title: "Chapter One",
      tasks: [
        {
          id: "task-1",
          title: "Replay e4 openings",
          method: "replay",
          ref: { kind: "file", locator: "/games/e4.pgn", recordId: "1" },
        },
        {
          id: "task-2",
          title: "Opening drill",
          method: "opening",
          ref: null,
          notes: "Focus on Sicilian",
          methodOptions: { depth: 10 },
        },
      ],
    },
  ],
};

// ── serializeCurriculumPlan ────────────────────────────────────────────────────

test("serializeCurriculumPlan — produces valid JSON string", () => {
  const json = serializeCurriculumPlan(minimalPlan);
  assert.doesNotThrow(() => JSON.parse(json));
});

test("serializeCurriculumPlan — includes version, id, title", () => {
  const json = serializeCurriculumPlan(minimalPlan);
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.id, "plan-001");
  assert.equal(parsed.title, "Test Plan");
});

test("serializeCurriculumPlan — pretty-printed (indented)", () => {
  const json = serializeCurriculumPlan(minimalPlan);
  assert.ok(json.includes("\n"), "expected newlines in pretty-printed output");
});

test("serializeCurriculumPlan — round-trips full plan", () => {
  const json = serializeCurriculumPlan(fullPlan);
  const parsed = parseCurriculumPlan(json);
  assert.ok(parsed !== null);
  assert.equal(parsed!.id, fullPlan.id);
  assert.equal(parsed!.chapters.length, 1);
  assert.equal(parsed!.chapters[0].tasks.length, 2);
});

// ── parseCurriculumPlan ────────────────────────────────────────────────────────

test("parseCurriculumPlan — returns null for invalid JSON", () => {
  assert.equal(parseCurriculumPlan("{not json"), null);
});

test("parseCurriculumPlan — returns null when version is not 1", () => {
  const json = JSON.stringify({ version: 2, id: "x", title: "T", chapters: [] });
  assert.equal(parseCurriculumPlan(json), null);
});

test("parseCurriculumPlan — returns null when id is missing", () => {
  const json = JSON.stringify({ version: 1, title: "T", chapters: [] });
  assert.equal(parseCurriculumPlan(json), null);
});

test("parseCurriculumPlan — returns null when title is missing", () => {
  const json = JSON.stringify({ version: 1, id: "x", chapters: [] });
  assert.equal(parseCurriculumPlan(json), null);
});

test("parseCurriculumPlan — returns null for non-object input", () => {
  assert.equal(parseCurriculumPlan('"string"'), null);
  assert.equal(parseCurriculumPlan("42"), null);
  assert.equal(parseCurriculumPlan("null"), null);
});

test("parseCurriculumPlan — parses minimal plan", () => {
  const json = JSON.stringify({ version: 1, id: "p1", title: "My Plan", chapters: [] });
  const result = parseCurriculumPlan(json);
  assert.ok(result !== null);
  assert.equal(result!.version, 1);
  assert.equal(result!.id, "p1");
  assert.equal(result!.title, "My Plan");
  assert.deepEqual(result!.chapters, []);
});

test("parseCurriculumPlan — missing chapters field defaults to empty array", () => {
  const json = JSON.stringify({ version: 1, id: "p1", title: "T" });
  const result = parseCurriculumPlan(json);
  assert.ok(result !== null);
  assert.deepEqual(result!.chapters, []);
});

test("parseCurriculumPlan — parses chapter with tasks", () => {
  const json = serializeCurriculumPlan(fullPlan);
  const result = parseCurriculumPlan(json);
  assert.ok(result !== null);
  const chapter = result!.chapters[0];
  assert.equal(chapter.id, "chapter-1");
  assert.equal(chapter.title, "Chapter One");
  assert.equal(chapter.tasks.length, 2);
});

test("parseCurriculumPlan — unknown task method defaults to 'replay'", () => {
  const plan = {
    version: 1, id: "p1", title: "T",
    chapters: [{
      id: "c1", title: "C",
      tasks: [{ id: "t1", title: "T", method: "unknown-method", ref: null }],
    }],
  };
  const result = parseCurriculumPlan(JSON.stringify(plan));
  assert.equal(result!.chapters[0].tasks[0].method, "replay");
});

test("parseCurriculumPlan — task ref with missing fields parses as null", () => {
  const plan = {
    version: 1, id: "p1", title: "T",
    chapters: [{
      id: "c1", title: "C",
      tasks: [{ id: "t1", title: "T", method: "replay", ref: { kind: "file" } }],
    }],
  };
  const result = parseCurriculumPlan(JSON.stringify(plan));
  // ref missing locator/recordId → null
  assert.equal(result!.chapters[0].tasks[0].ref, null);
});

test("parseCurriculumPlan — task notes and methodOptions preserved", () => {
  const json = serializeCurriculumPlan(fullPlan);
  const result = parseCurriculumPlan(json);
  const task2 = result!.chapters[0].tasks[1];
  assert.equal(task2.notes, "Focus on Sicilian");
  assert.deepEqual(task2.methodOptions, { depth: 10 });
});

test("parseCurriculumPlan — invalid chapters entries are skipped", () => {
  const plan = {
    version: 1, id: "p1", title: "T",
    chapters: [null, { id: "c1", title: "C", tasks: [] }],
  };
  const result = parseCurriculumPlan(JSON.stringify(plan));
  assert.equal(result!.chapters.length, 1);
});

test("parseCurriculumPlan — invalid task entries within chapter are skipped", () => {
  const plan = {
    version: 1, id: "p1", title: "T",
    chapters: [{
      id: "c1", title: "C",
      tasks: [null, { id: "t1", title: "Good task", method: "replay", ref: null }],
    }],
  };
  const result = parseCurriculumPlan(JSON.stringify(plan));
  assert.equal(result!.chapters[0].tasks.length, 1);
});
