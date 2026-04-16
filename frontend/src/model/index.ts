/**
 * Index module.
 *
 * Integration API:
 * - Primary exports from this module: `(no direct exports)`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through typed return values and callbacks; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

export { parsePgnToModel, parseCommentRuns } from "../../../parts/pgnparser/src/pgn_model";
export { serializeModelToPgn } from "../../../parts/pgnparser/src/pgn_serialize";
export { ECO_OPENING_CODES, resolveEcoOpeningName } from "./eco_openings";
export {
  applyDefaultIndentDirectives,
  applyDefaultLayout,
  findExistingCommentIdAroundMove,
  getFirstCommentMetadata,
  insertCommentAroundMove,
  removeCommentById,
  resolveOwningMoveIdForCommentId,
  getCommentRawById,
  setCommentTextById,
  setFirstCommentIntroRole,
  toggleFirstCommentIntroRole,
  toggleMoveNag,
} from "../../../parts/pgnparser/src/pgn_commands";
export { findMoveNode, findMoveSideById } from "../../../parts/pgnparser/src/pgn_move_ops";
export {
  NAG_DEFS,
  NAG_BY_CODE,
  NAG_MOVE_QUALITY,
  NAG_EVALUATION,
  NAG_POSITIONAL,
  nagGlyph,
  nagGroup,
  colorPairCode,
} from "../../../parts/pgnparser/src/nag_defs";
export {
  REQUIRED_PGN_TAG_DEFAULTS,
  X2_STYLE_HEADER_KEY,
  X2_BOARD_ORIENTATION_HEADER_KEY,
  LEGACY_X2_STYLE_HEADER_KEY,
  LEGACY_X2_BOARD_ORIENTATION_HEADER_KEY,
  ensureRequiredPgnHeaders,
  getHeaderValue,
  getX2StyleFromModel,
  normalizeX2StyleValue,
  setHeaderValue,
  deriveInitialBoardFlipped,
} from "../../../parts/pgnparser/src/pgn_headers";
