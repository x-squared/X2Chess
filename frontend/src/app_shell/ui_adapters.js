/**
 * App shell UI adapters.
 *
 * Integration API:
 * - Create adapter helpers with `createUiAdapters(deps)` and inject into modules
 *   that should not depend directly on concrete DOM/panel implementations.
 *
 * Configuration API:
 * - Configure by passing DOM targets (`saveStatusEl`, `domViewEl`, `textEditorEl`)
 *   and concrete renderer/status callbacks.
 *
 * Communication API:
 * - Outbound methods:
 *   - `setSaveStatus(message, kind)` updates save status text/style.
 *   - `renderDomView()` rebuilds DOM preview from the editor root.
 * - No internal state; acts as a thin translation layer.
 */

/**
 * Create UI adapter callbacks used across runtime components.
 *
 * @param {object} deps - Host dependencies.
 * @param {HTMLElement|null} deps.saveStatusEl - Save status element.
 * @param {HTMLElement|null} deps.domViewEl - DOM panel target element.
 * @param {HTMLElement|null} deps.textEditorEl - Text editor source element for DOM snapshot rendering.
 * @param {object} deps.state - Shared application state.
 * @param {Function} deps.t - Translation function `(key, fallback) => string`.
 * @param {Function} deps.setPgnSaveStatusFn - Callback `(saveStatusEl, message, kind) => void`.
 * @param {Function} deps.renderDomPanelFn - Callback `(domViewEl, sourceEl) => void`.
 * @returns {{renderDomView: Function, setSaveStatus: Function}} UI adapter functions.
 */
export const createUiAdapters = ({
  saveStatusEl,
  domViewEl,
  textEditorEl,
  setPgnSaveStatusFn,
  renderDomPanelFn,
}) => {
  /**
   * Update save status label and style.
   *
   * @param {string} [message=""] - Status message.
   * @param {string} [kind=""] - Status kind (`saving`, `saved`, `error`, or empty).
   */
  const setSaveStatus = (message = "", kind = "") => {
    setPgnSaveStatusFn(saveStatusEl, message, kind);
  };

  /**
   * Render DOM panel preview from text editor content.
   */
  const renderDomView = () => {
    renderDomPanelFn(domViewEl, textEditorEl);
  };

  return {
    renderDomView,
    setSaveStatus,
  };
};
