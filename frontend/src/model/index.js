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
export {
  applyDefaultIndentDirectives,
  findExistingCommentIdAroundMove,
  insertCommentAroundMove,
  removeCommentById,
  setCommentTextById,
} from "./pgn_commands";
