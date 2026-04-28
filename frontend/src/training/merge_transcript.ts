/**
 * merge_transcript — applies training transcript annotations to a PGN model.
 *
 * Integration API:
 * - `applyMergeToModel(model, selection)` — returns an updated PgnModel.
 * - `mergeToNewPgn(model, selection)` — returns a new PGN string.
 *
 * Communication API:
 * - Pure functions; no side effects.
 */

import type { PgnModel, PgnEntryNode } from "../../../parts/pgnparser/src/pgn_model";
import { insertCommentAroundMove } from "../../../parts/pgnparser/src/pgn_commands";
import { serializeModelToPgn } from "../../../parts/pgnparser/src/pgn_serialize";
import type { MergeSelection } from "./domain/training_transcript";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a map from 0-based ply → move node id, walking the mainline only. */
const buildPlyToMoveId = (model: PgnModel): Map<number, string> => {
  const map = new Map<number, string>();
  let ply = 0;
  const walk = (entries: PgnEntryNode[]): void => {
    for (const entry of entries) {
      if (entry.type !== "move") continue;
      map.set(ply, entry.id);
      ply += 1;
    }
  };
  walk(model.root.entries);
  return map;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply the selected annotations from a merge selection to the PGN model.
 * Returns the updated model (original is unchanged if nothing was selected).
 */
export const applyMergeToModel = (
  model: PgnModel,
  selection: MergeSelection,
): PgnModel => {
  const plyMap = buildPlyToMoveId(model);
  let current: PgnModel = model;

  for (const { annotation, include } of selection.annotations) {
    if (!include) continue;
    const moveId = plyMap.get(annotation.ply);
    if (!moveId) continue;
    const { model: updated } = insertCommentAroundMove(
      current,
      moveId,
      "after",
      annotation.content,
    );
    current = updated;
  }

  return current;
};

/**
 * Apply the selected annotations to a copy of the model with modified headers,
 * then serialize to PGN text for opening as a new game.
 */
export const mergeToNewPgn = (
  model: PgnModel,
  selection: MergeSelection,
  eventSuffix: string = "Training",
): string => {
  // Clone headers, appending suffix to Event.
  const eventTag = eventSuffix ? ` (${eventSuffix})` : "";
  const headers = model.headers.map((h) =>
    h.key === "Event" ? { ...h, value: `${h.value || "?"}${eventTag}` } : h,
  );
  const cloned: PgnModel = { ...model, headers };
  const withAnnotations = applyMergeToModel(cloned, selection);
  return serializeModelToPgn(withAnnotations);
};
