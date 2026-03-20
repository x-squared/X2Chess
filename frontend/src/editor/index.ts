/**
 * Editor Component-Contract
 *
 * Integration API:
 * - `text_editor.render(container, pgnModel, options)`
 * - `parsePgnToModel(rawPgn)`
 * - `serializeModelToPgn(model)`
 *
 * Configuration API:
 * - `text_editor.render(..., options)` supports `layoutMode` (`plain`|`text`|`tree`), selection/highlight, callbacks.
 * - Editor appearance is configured via editor-owned styles in `editor/styles.css`
 *   and CSS variables (`--text-editor-font-size`, `--text-editor-line-height`,
 *   `--text-editor-max-height`).
 *
 * Communication API:
 * - Move/comment editing callbacks passed in `text_editor.render(..., options)`.
 * - Command helpers below communicate via immutable model transforms.
 */

export { text_editor } from "./text_editor";
export { parsePgnToModel } from "../model/pgn_model";
export { serializeModelToPgn } from "../model/pgn_serialize";
export {
  ECO_OPENING_CODES,
  REQUIRED_PGN_TAG_DEFAULTS,
  ensureRequiredPgnHeaders,
  resolveEcoOpeningName,
} from "../model";
export {
  applyDefaultIndentDirectives,
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
  setCommentTextById,
  toggleFirstCommentIntroRole,
  X2_STYLE_HEADER_KEY,
} from "../model";
