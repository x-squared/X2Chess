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

export { ast_panel } from "./ast_panel";
export { renderDomPanel } from "./dom_panel";
export { renderMovesPanel } from "./moves_panel";
export { setPgnSaveStatus } from "./pgn_panel";
