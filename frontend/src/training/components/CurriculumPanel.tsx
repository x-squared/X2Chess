/**
 * CurriculumPanel — slide-in panel for managing a training curriculum (.x2plan).
 *
 * Displays the chapter/task tree of a `CurriculumPlan`.  Each task shows its
 * method, any recorded best score from the training badge store, and a Launch
 * button.  The user can add, rename, and delete chapters and tasks inline, import
 * a plan from a `.x2plan` file, and export the current plan back to JSON.
 *
 * Integration API:
 * - `<CurriculumPanel onClose={...} onLaunchTask={...} t={...} />`
 *   Rendered by `AppShell` as a fixed right-side panel.
 *
 * Configuration API:
 * - No props beyond the three required callbacks.  Plan state is owned internally
 *   and persisted to localStorage via `curriculum_storage`.
 *
 * Communication API:
 * - `onLaunchTask(task)` — fired when the user clicks Launch on a task; the
 *   caller should navigate to the task's game ref and open the TrainingLauncher.
 * - `onClose()` — fired when the user dismisses the panel.
 * - Reads training badge history from `transcript_storage.loadBadgesForRefs`.
 */

import {
  useState,
  useRef,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";
import type { CurriculumPlan, Chapter, Task, TaskMethod } from "../curriculum/curriculum_plan";
import { TASK_METHODS } from "../curriculum/curriculum_plan";
import { parseCurriculumPlan, serializeCurriculumPlan } from "../curriculum/curriculum_io";
import { loadStoredPlan, storeCurrentPlan } from "../curriculum/curriculum_storage";
import { loadBadgesForRefs } from "../transcript_storage";
import type { TrainingBadge } from "../transcript_storage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const emptyPlan = (): CurriculumPlan => ({
  version: 1,
  id: makeId(),
  title: "Training Plan",
  chapters: [],
});

const taskRefKey = (task: Task): string | null => {
  if (!task.ref) return null;
  return `${task.ref.kind}:${task.ref.locator}:${task.ref.recordId}`;
};

const methodLabel = (method: TaskMethod): string => {
  if (method === "opening") return "Opening";
  return "Replay";
};

// ── Sub-components ────────────────────────────────────────────────────────────

type BadgeChipProps = { badge: TrainingBadge };
const BadgeChip = ({ badge }: BadgeChipProps): ReactElement => (
  <span className="cp-badge" title={`${badge.sessionCount} session(s) · best ${badge.bestScore}%`}>
    {badge.bestScore}%
  </span>
);

type TaskRowProps = {
  task: Task;
  badge: TrainingBadge | null;
  onLaunch: () => void;
  onDelete: () => void;
  onUpdate: (updated: Task) => void;
};

const TaskRow = ({ task, badge, onLaunch, onDelete, onUpdate }: TaskRowProps): ReactElement => {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftMethod, setDraftMethod] = useState<TaskMethod>(task.method);
  const [draftRefLocator, setDraftRefLocator] = useState<string>(task.ref?.locator ?? "");
  const [draftRefRecordId, setDraftRefRecordId] = useState<string>(task.ref?.recordId ?? "");
  const [draftRefKind, setDraftRefKind] = useState<string>(task.ref?.kind ?? "db");
  const [draftNotes, setDraftNotes] = useState<string>(task.notes ?? "");

  const commitEdit = useCallback((): void => {
    const ref =
      draftRefLocator.trim() && draftRefRecordId.trim()
        ? { kind: draftRefKind || "db", locator: draftRefLocator.trim(), recordId: draftRefRecordId.trim() }
        : null;
    onUpdate({
      ...task,
      title: draftTitle.trim() || task.title,
      method: draftMethod,
      ref,
      notes: draftNotes.trim() || undefined,
    });
    setEditing(false);
  }, [draftTitle, draftMethod, draftRefKind, draftRefLocator, draftRefRecordId, draftNotes, onUpdate, task]);

  if (editing) {
    return (
      <div className="cp-task-edit">
        <input
          className="cp-task-edit__input"
          value={draftTitle}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => setDraftTitle(e.target.value)}
          placeholder="Task title"
          autoFocus
        />
        <div className="cp-task-edit__row">
          <label className="cp-task-edit__label">Method</label>
          <select
            className="cp-task-edit__select"
            value={draftMethod}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void =>
              setDraftMethod(e.target.value as TaskMethod)
            }
          >
            {TASK_METHODS.map((m: TaskMethod): ReactElement => (
              <option key={m} value={m}>{methodLabel(m)}</option>
            ))}
          </select>
        </div>
        <div className="cp-task-edit__row">
          <label className="cp-task-edit__label">Game kind</label>
          <select
            className="cp-task-edit__select"
            value={draftRefKind}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void => setDraftRefKind(e.target.value)}
          >
            <option value="db">db (.x2chess)</option>
            <option value="file">file (.pgn)</option>
            <option value="directory">directory</option>
          </select>
        </div>
        <div className="cp-task-edit__row">
          <label className="cp-task-edit__label">Resource path</label>
          <input
            className="cp-task-edit__input cp-task-edit__input--wide"
            value={draftRefLocator}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => setDraftRefLocator(e.target.value)}
            placeholder="/path/to/resource"
          />
        </div>
        <div className="cp-task-edit__row">
          <label className="cp-task-edit__label">Record id</label>
          <input
            className="cp-task-edit__input cp-task-edit__input--wide"
            value={draftRefRecordId}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => setDraftRefRecordId(e.target.value)}
            placeholder="game-id or filename"
          />
        </div>
        <div className="cp-task-edit__row">
          <label className="cp-task-edit__label">Notes</label>
          <input
            className="cp-task-edit__input cp-task-edit__input--wide"
            value={draftNotes}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => setDraftNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>
        <div className="cp-task-edit__actions">
          <button type="button" className="cp-btn cp-btn--primary" onClick={commitEdit}>Save</button>
          <button type="button" className="cp-btn" onClick={(): void => setEditing(false)}>Cancel</button>
          <button type="button" className="cp-btn cp-btn--danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-task-row">
      <span className="cp-task-row__method">{methodLabel(task.method)}</span>
      <button
        type="button"
        className="cp-task-row__title"
        onClick={(): void => setEditing(true)}
        title="Click to edit"
      >
        {task.title}
      </button>
      {badge && <BadgeChip badge={badge} />}
      {task.ref && (
        <button
          type="button"
          className="cp-btn cp-btn--accent"
          onClick={onLaunch}
          title="Open game and start training"
        >
          Launch
        </button>
      )}
      {!task.ref && (
        <button
          type="button"
          className="cp-btn"
          onClick={(): void => setEditing(true)}
          title="Link a game to enable launch"
        >
          Link game
        </button>
      )}
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────

type CurriculumPanelProps = {
  onClose: () => void;
  onLaunchTask: (task: Task) => void;
  t: (key: string, fallback?: string) => string;
};

/** Training curriculum panel — manages a `.x2plan` training curriculum. */
export const CurriculumPanel = ({ onClose, onLaunchTask, t }: CurriculumPanelProps): ReactElement => {
  const [plan, setPlan] = useState<CurriculumPlan>((): CurriculumPlan => loadStoredPlan() ?? emptyPlan());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived: badge map keyed by "kind:locator:recordId" ─────────────────────
  const allRefKeys: string[] = plan.chapters
    .flatMap((ch: Chapter): Task[] => ch.tasks)
    .flatMap((task: Task): string[] => {
      const key = taskRefKey(task);
      return key ? [key] : [];
    });
  const badgeMap: Map<string, TrainingBadge> = loadBadgesForRefs(allRefKeys);

  // ── Plan mutations ────────────────────────────────────────────────────────────

  const updatePlan = useCallback((updated: CurriculumPlan): void => {
    storeCurrentPlan(updated);
    setPlan(updated);
  }, []);

  const addChapter = useCallback((): void => {
    const newChapter: Chapter = { id: makeId(), title: "New Chapter", tasks: [] };
    updatePlan({ ...plan, chapters: [...plan.chapters, newChapter] });
  }, [plan, updatePlan]);

  const updateChapterTitle = useCallback((chapterId: string, title: string): void => {
    updatePlan({
      ...plan,
      chapters: plan.chapters.map((ch: Chapter): Chapter =>
        ch.id === chapterId ? { ...ch, title } : ch,
      ),
    });
  }, [plan, updatePlan]);

  const deleteChapter = useCallback((chapterId: string): void => {
    updatePlan({
      ...plan,
      chapters: plan.chapters.filter((ch: Chapter): boolean => ch.id !== chapterId),
    });
  }, [plan, updatePlan]);

  const addTask = useCallback((chapterId: string): void => {
    const newTask: Task = { id: makeId(), title: "New Task", method: "replay", ref: null };
    updatePlan({
      ...plan,
      chapters: plan.chapters.map((ch: Chapter): Chapter =>
        ch.id === chapterId ? { ...ch, tasks: [...ch.tasks, newTask] } : ch,
      ),
    });
  }, [plan, updatePlan]);

  const updateTask = useCallback((chapterId: string, updated: Task): void => {
    updatePlan({
      ...plan,
      chapters: plan.chapters.map((ch: Chapter): Chapter =>
        ch.id === chapterId
          ? { ...ch, tasks: ch.tasks.map((t: Task): Task => (t.id === updated.id ? updated : t)) }
          : ch,
      ),
    });
  }, [plan, updatePlan]);

  const deleteTask = useCallback((chapterId: string, taskId: string): void => {
    updatePlan({
      ...plan,
      chapters: plan.chapters.map((ch: Chapter): Chapter =>
        ch.id === chapterId
          ? { ...ch, tasks: ch.tasks.filter((t: Task): boolean => t.id !== taskId) }
          : ch,
      ),
    });
  }, [plan, updatePlan]);

  const updatePlanTitle = useCallback((title: string): void => {
    updatePlan({ ...plan, title });
  }, [plan, updatePlan]);

  // ── Import / Export ───────────────────────────────────────────────────────────

  const handleImport = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (): void => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseCurriculumPlan(text);
      if (!parsed) {
        alert(t("curriculum.importError", "Could not read training plan. Make sure it is a valid .x2plan file."));
        return;
      }
      updatePlan(parsed);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported.
    e.target.value = "";
  }, [t, updatePlan]);

  const handleExport = useCallback((): void => {
    const json = serializeCurriculumPlan(plan);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.title.replace(/[^\w-]/g, "_")}.x2plan`;
    a.click();
    URL.revokeObjectURL(url);
  }, [plan]);

  const handleNewPlan = useCallback((): void => {
    const fresh = emptyPlan();
    updatePlan(fresh);
  }, [updatePlan]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="cp-panel">
      {/* Header */}
      <div className="cp-panel__header">
        <input
          className="cp-plan-title-input"
          value={plan.title}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => updatePlanTitle(e.target.value)}
          aria-label="Plan title"
        />
        <div className="cp-panel__header-actions">
          <button
            type="button"
            className="cp-btn"
            title={t("curriculum.import", "Import .x2plan")}
            onClick={(): void => fileInputRef.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="cp-btn"
            title={t("curriculum.export", "Export .x2plan")}
            onClick={handleExport}
          >
            Export
          </button>
          <button
            type="button"
            className="cp-btn"
            title={t("curriculum.newPlan", "New plan")}
            onClick={handleNewPlan}
          >
            New
          </button>
          <button
            type="button"
            className="cp-panel__close"
            onClick={onClose}
            aria-label={t("curriculum.close", "Close training plan")}
          >
            ×
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".x2plan"
          style={{ display: "none" }}
          onChange={handleImport}
        />
      </div>

      {/* Chapter list */}
      <div className="cp-panel__body">
        {plan.chapters.length === 0 && (
          <p className="cp-panel__empty">
            {t("curriculum.empty", "No chapters yet. Add one below.")}
          </p>
        )}
        {plan.chapters.map((chapter: Chapter): ReactElement => (
          <ChapterSection
            key={chapter.id}
            chapter={chapter}
            badgeMap={badgeMap}
            onRenameChapter={(title: string): void => updateChapterTitle(chapter.id, title)}
            onDeleteChapter={(): void => deleteChapter(chapter.id)}
            onAddTask={(): void => addTask(chapter.id)}
            onUpdateTask={(updated: Task): void => updateTask(chapter.id, updated)}
            onDeleteTask={(taskId: string): void => deleteTask(chapter.id, taskId)}
            onLaunchTask={onLaunchTask}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="cp-panel__footer">
        <button type="button" className="cp-btn cp-btn--accent" onClick={addChapter}>
          + Add Chapter
        </button>
      </div>
    </div>
  );
};

// ── ChapterSection ────────────────────────────────────────────────────────────

type ChapterSectionProps = {
  chapter: Chapter;
  badgeMap: Map<string, TrainingBadge>;
  onRenameChapter: (title: string) => void;
  onDeleteChapter: () => void;
  onAddTask: () => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onLaunchTask: (task: Task) => void;
};

const ChapterSection = ({
  chapter,
  badgeMap,
  onRenameChapter,
  onDeleteChapter,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onLaunchTask,
}: ChapterSectionProps): ReactElement => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chapter.title);

  const commitTitle = useCallback((): void => {
    onRenameChapter(draftTitle.trim() || chapter.title);
    setEditingTitle(false);
  }, [draftTitle, chapter.title, onRenameChapter]);

  return (
    <div className="cp-chapter">
      <div className="cp-chapter__header">
        {editingTitle ? (
          <input
            className="cp-chapter__title-input"
            value={draftTitle}
            autoFocus
            onChange={(e: ChangeEvent<HTMLInputElement>): void => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e): void => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="cp-chapter__title"
            onClick={(): void => setEditingTitle(true)}
            title="Click to rename"
          >
            {chapter.title}
          </button>
        )}
        <div className="cp-chapter__actions">
          <button type="button" className="cp-btn cp-btn--sm" onClick={onAddTask}>+ Task</button>
          <button
            type="button"
            className="cp-btn cp-btn--sm cp-btn--danger"
            onClick={onDeleteChapter}
            title="Delete chapter"
          >
            ×
          </button>
        </div>
      </div>
      <div className="cp-chapter__tasks">
        {chapter.tasks.length === 0 && (
          <p className="cp-chapter__empty">No tasks yet.</p>
        )}
        {chapter.tasks.map((task: Task): ReactElement => {
          const key = taskRefKey(task);
          const badge = key ? (badgeMap.get(key) ?? null) : null;
          return (
            <TaskRow
              key={task.id}
              task={task}
              badge={badge}
              onLaunch={(): void => onLaunchTask(task)}
              onDelete={(): void => onDeleteTask(task.id)}
              onUpdate={onUpdateTask}
            />
          );
        })}
      </div>
    </div>
  );
};
