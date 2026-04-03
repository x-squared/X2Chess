/**
 * transcript_storage — localStorage-backed training badge and session history
 * store (T13, T16).
 *
 * Integration API:
 * - `saveTranscriptBadge(sourceGameRef, scorePercent, protocol)` — persist a
 *   completed training session result (updates aggregate badge + appends session).
 * - `loadBadgesForRefs(refs)` — bulk-load badges for a set of game refs.
 * - `loadSessionHistory(sourceGameRef)` — load per-session records for one game.
 *
 * Configuration API:
 * - Badge aggregate storage key: `"x2chess.training-badges"` in localStorage.
 * - Session history storage key: `"x2chess.training-sessions"` in localStorage.
 * - `sourceGameRef` format: `"${kind}:${locator}:${recordId}"`.
 *
 * Communication API:
 * - Pure functions; no React dependencies.
 */

import { createVersionedStore } from "../storage";

// ── Badge store ───────────────────────────────────────────────────────────────

const BADGE_KEY = "x2chess.training-badges";
const SESSION_KEY = "x2chess.training-sessions";

export type TrainingBadge = {
  /** Number of completed training sessions for this game. */
  sessionCount: number;
  /** Best score achieved across all sessions (0–100). */
  bestScore: number;
  /** ISO 8601 timestamp of the most recent completed session. */
  lastSessionAt: string;
};

/** One completed training session record, stored for T16 history panel. */
export type SessionRecord = {
  /** ISO 8601 timestamp when the session was completed. */
  date: string;
  /** Protocol id, e.g. "replay". */
  protocol: string;
  /** Score 0–100. */
  scorePercent: number;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  /** Human-readable grade label, e.g. "Excellent". */
  gradeLabel: string;
};

type BadgeStore = Record<string, TrainingBadge>;
type SessionStore = Record<string, SessionRecord[]>;

// ── Versioned stores ──────────────────────────────────────────────────────────

const badgeStore = createVersionedStore<BadgeStore>({
  key: BADGE_KEY,
  version: 1,
  defaultValue: {},
  migrations: [
    // v0→v1: raw payload was already a plain Record — pass through.
    (raw) => (raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
  ],
});

const sessionStore = createVersionedStore<SessionStore>({
  key: SESSION_KEY,
  version: 1,
  defaultValue: {},
  migrations: [
    // v0→v1: raw payload was already a plain Record — pass through.
    (raw) => (raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
  ],
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a completed training session for a game.
 * Updates the aggregate badge and appends to the session history.
 * No-op when `sourceGameRef` is empty (unsaved/anonymous session).
 */
type SessionStats = { correct: number; wrong: number; skipped: number; total: number; gradeLabel: string };
const EMPTY_STATS: SessionStats = { correct: 0, wrong: 0, skipped: 0, total: 0, gradeLabel: "" };

export const saveTranscriptBadge = (
  sourceGameRef: string,
  scorePercent: number,
  protocol: string = "",
  stats: SessionStats = EMPTY_STATS,
): void => {
  if (!sourceGameRef) return;
  const now = new Date().toISOString();

  // Update badge aggregate.
  const badges = badgeStore.read();
  const existing = badges[sourceGameRef];
  badges[sourceGameRef] = {
    sessionCount: (existing?.sessionCount ?? 0) + 1,
    bestScore: Math.max(existing?.bestScore ?? 0, scorePercent),
    lastSessionAt: now,
  };
  badgeStore.write(badges);

  // Append session record.
  const sessions = sessionStore.read();
  const history = sessions[sourceGameRef] ?? [];
  history.push({
    date: now,
    protocol,
    scorePercent,
    correct: stats.correct,
    wrong: stats.wrong,
    skipped: stats.skipped,
    total: stats.total,
    gradeLabel: stats.gradeLabel,
  });
  sessions[sourceGameRef] = history;
  sessionStore.write(sessions);
};

/**
 * Load badges for a set of game refs in a single localStorage read.
 * Returns a Map keyed by `sourceGameRef`; refs with no badge are absent.
 */
export const loadBadgesForRefs = (refs: string[]): Map<string, TrainingBadge> => {
  if (refs.length === 0) return new Map();
  const store = badgeStore.read();
  const result = new Map<string, TrainingBadge>();
  for (const ref of refs) {
    const badge = store[ref];
    if (badge) result.set(ref, badge);
  }
  return result;
};

/**
 * Load per-session records for one game ref.
 * Returns an empty array when no history exists.
 * Sessions are ordered newest-first.
 */
export const loadSessionHistory = (sourceGameRef: string): SessionRecord[] => {
  if (!sourceGameRef) return [];
  const store = sessionStore.read();
  const sessions = store[sourceGameRef] ?? [];
  return [...sessions].reverse();
};
