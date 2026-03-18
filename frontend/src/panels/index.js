/**
 * Panels Component-Contract
 *
 * Integration API:
 * - `ast_panel.render(container, pgnModel)`
 * - `renderDomPanel(domViewEl, sourceEl)`
 * - `renderMovesPanel({ movesEl, moves, pgnModel, t })`
 * - `renderPgnGameSelect({ gameSelect, files, selectedFile, t })`
 * - `setPgnSaveStatus(saveStatusEl, message, kind)`
 *
 * Configuration API:
 * - Panel presentation is owned by `panels/styles.css`.
 * - Consumer supplies target elements and translation function.
 *
 * Communication API:
 * - PGN panel helpers communicate through DOM updates and explicit arguments.
 * - AST/DOM panels communicate through render function calls.
 */

export { ast_panel } from "./ast_panel";
export { renderDomPanel } from "./dom_panel";
export { renderMovesPanel } from "./moves_panel";
export { renderPgnGameSelect, setPgnSaveStatus } from "./pgn_panel";
