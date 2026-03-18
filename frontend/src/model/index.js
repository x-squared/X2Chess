/**
 * Model Component-Contract
 *
 * Integration API:
 * - `parsePgnToModel(rawPgn)`
 * - `serializeModelToPgn(model)`
 * - Model command helpers for comment/indent transforms.
 *
 * Configuration API:
 * - Stateless transform functions accept model and explicit arguments.
 * - No hidden global runtime configuration.
 *
 * Communication API:
 * - Functions return updated model objects or query values.
 * - Consumers communicate through function calls and returned values only.
 */

export { parsePgnToModel, parseCommentRuns } from "./pgn_model";
export { serializeModelToPgn } from "./pgn_serialize";
export { ECO_OPENING_CODES, resolveEcoOpeningName } from "./eco_openings";
export {
  applyDefaultIndentDirectives,
  findExistingCommentIdAroundMove,
  getFirstCommentMetadata,
  insertCommentAroundMove,
  removeCommentById,
  resolveOwningMoveIdForCommentId,
  setCommentTextById,
  setFirstCommentIntroRole,
  toggleFirstCommentIntroRole,
} from "./pgn_commands";
export {
  REQUIRED_PGN_TAG_DEFAULTS,
  ensureRequiredPgnHeaders,
  getHeaderValue,
  setHeaderValue,
} from "./pgn_headers";
