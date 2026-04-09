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

export { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model";
export { serializeModelToPgn } from "../../../parts/pgnparser/src/pgn_serialize";
export {
  ECO_OPENING_CODES,
  REQUIRED_PGN_TAG_DEFAULTS,
  ensureRequiredPgnHeaders,
  resolveEcoOpeningName,
} from "../model";
export {
  applyDefaultIndentDirectives,
  applyDefaultLayout,
  findExistingCommentIdAroundMove,
  getFirstCommentMetadata,
  getHeaderValue,
  getX2StyleFromModel,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  removeCommentById,
  resolveOwningMoveIdForCommentId,
  setFirstCommentIntroRole,
  setHeaderValue,
  getCommentRawById,
  setCommentTextById,
  toggleFirstCommentIntroRole,
  X2_STYLE_HEADER_KEY,
} from "../model";
