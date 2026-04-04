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

export { parsePgnToModel, parseCommentRuns } from "./pgn_model";
export { serializeModelToPgn } from "./pgn_serialize";
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
} from "./pgn_commands";
export { findMoveNode, findMoveSideById } from "./pgn_move_ops";
export {
  NAG_DEFS,
  NAG_BY_CODE,
  NAG_MOVE_QUALITY,
  NAG_EVALUATION,
  NAG_POSITIONAL,
  nagGlyph,
  nagGroup,
  colorPairCode,
} from "./nag_defs";
export {
  REQUIRED_PGN_TAG_DEFAULTS,
  X2_STYLE_HEADER_KEY,
  ensureRequiredPgnHeaders,
  getHeaderValue,
  getX2StyleFromModel,
  normalizeX2StyleValue,
  setHeaderValue,
} from "./pgn_headers";
