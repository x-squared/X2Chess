/**
 * study_items — pure-logic helper for collecting Q/A study prompts from a PGN model.
 *
 * Integration API:
 * - Exports: `StudyItem`, `collectStudyItems`.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

import type { PgnModel, PgnMoveNode, PgnEntryNode, PgnCommentNode } from "../../../parts/pgnparser/src/pgn_model";
import { parseQaAnnotations, hasQaAnnotations } from "../features/resources/services/qa_parser";
import type { QaAnnotation } from "../features/resources/services/qa_parser";
import { getMoveCommentsAfter } from "../../../parts/pgnparser/src/pgn_move_attachments";

export type StudyItem = {
  /** Mainline ply index (1-based; ply N = after N half-moves). */
  ply: number;
  /** PGN move node ID (for navigation). */
  moveId: string;
  /** SAN of the move preceding the question position. */
  san: string;
  /** All Q/A annotations attached to this ply. */
  annotations: QaAnnotation[];
};

/**
 * Walk the mainline of a PGN model and collect every move position
 * that has at least one `[%qa ...]` annotation in its `commentsAfter`.
 * Variations are not traversed — study mode follows the mainline only.
 */
export const collectStudyItems = (model: PgnModel | null): StudyItem[] => {
  if (!model) return [];
  const items: StudyItem[] = [];
  let ply = 0;

  const walk = (entries: PgnEntryNode[]): void => {
    for (const entry of entries) {
      if (entry.type !== "move") continue;
      const move = entry as PgnMoveNode;
      ply += 1;

      // Collect Q/A from comments after this move.
      const qaAnnotations: QaAnnotation[] = [];
      for (const comment of getMoveCommentsAfter(move) as PgnCommentNode[]) {
        if (hasQaAnnotations(comment.raw)) {
          qaAnnotations.push(...parseQaAnnotations(comment.raw));
        }
      }
      if (qaAnnotations.length > 0) {
        items.push({ ply, moveId: move.id, san: move.san, annotations: qaAnnotations });
      }
    }
  };

  walk(model.root.entries);
  return items;
};
