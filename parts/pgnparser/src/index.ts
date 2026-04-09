/**
 * pgnparser — PGN parsing, serialization, and model mutation library.
 *
 * Exports the public API surface for working with PGN game data.
 * All modules are pure-logic; no React, DOM, or Tauri dependencies.
 */

export { parsePgnToModel, parseCommentRuns } from "./pgn_model";
export type {
  PgnModel,
  PgnVariationNode,
  PgnMoveNode,
  PgnMoveNumberNode,
  PgnResultNode,
  PgnNagNode,
  PgnCommentNode,
  PgnEntryNode,
  PgnPostItem,
  CommentRun,
} from "./pgn_model";

export { serializeModelToPgn } from "./pgn_serialize";

export {
  REQUIRED_PGN_TAG_DEFAULTS,
  X2_STYLE_HEADER_KEY,
  X2_BOARD_ORIENTATION_HEADER_KEY,
  normalizeX2StyleValue,
  getHeaderValue,
  getX2StyleFromModel,
  setHeaderValue,
  ensureRequiredPgnHeaders,
  deriveInitialBoardFlipped,
  normalizeForChessJs,
} from "./pgn_headers";
export type { X2StyleValue } from "./pgn_headers";

export {
  appendMove,
  insertVariation,
  replaceMove,
  truncateAfter,
  truncateBefore,
  deleteVariation,
  deleteVariationsAfter,
  promoteToMainline,
  findCursorForMoveId,
  findMoveNode,
  findMoveSideById,
} from "./pgn_move_ops";
export type { PgnCursor } from "./pgn_move_ops";

export {
  setCommentTextById,
  removeCommentById,
  getFirstCommentMetadata,
  setFirstCommentIntroRole,
  toggleFirstCommentIntroRole,
  resolveOwningMoveIdForCommentId,
  findExistingCommentIdAroundMove,
  applyDefaultIndentDirectives,
  applyDefaultLayout,
  insertCommentAroundMove,
  toggleMoveNag,
  getCommentRawById,
} from "./pgn_commands";

export {
  NAG_DEFS,
  NAG_BY_CODE,
  NAG_MOVE_QUALITY,
  NAG_EVALUATION,
  NAG_POSITIONAL,
  nagGlyph,
  nagGroup,
  colorPairCode,
  siblingCodesInGroup,
} from "./nag_defs";
export type { NagDef, NagGroup } from "./nag_defs";
