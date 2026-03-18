/**
 * App shell UI adapters.
 *
 * Integration API:
 * - `createUiAdapters(deps)`
 *
 * Configuration API:
 * - Requires DOM refs and panel render helpers from caller.
 *
 * Communication API:
 * - Provides small adapter functions used by composition root and runtime modules.
 */

/**
 * Create UI adapter callbacks used across runtime components.
 *
 * @param {object} deps - Host dependencies.
 * @param {HTMLElement|null} deps.saveStatusEl - Save status element.
 * @param {HTMLSelectElement|null} deps.gameSelect - Game selection element.
 * @param {HTMLElement|null} deps.domViewEl - DOM panel target element.
 * @param {HTMLElement|null} deps.textEditorEl - Text editor source element for DOM snapshot rendering.
 * @param {object} deps.state - Shared application state.
 * @param {Function} deps.t - Translation function `(key, fallback) => string`.
 * @param {Function} deps.setPgnSaveStatusFn - Callback `(saveStatusEl, message, kind) => void`.
 * @param {Function} deps.renderPgnGameSelectFn - Callback `({ gameSelect, files, selectedFile, t }) => void`.
 * @param {Function} deps.renderDomPanelFn - Callback `(domViewEl, sourceEl) => void`.
 * @returns {{renderDomView: Function, renderGameSelect: Function, setSaveStatus: Function}} UI adapter functions.
 */
export const createUiAdapters = ({
  saveStatusEl,
  gameSelect,
  domViewEl,
  textEditorEl,
  state,
  t,
  setPgnSaveStatusFn,
  renderPgnGameSelectFn,
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
   * Render game selector options from shared state.
   */
  const renderGameSelect = () => {
    renderPgnGameSelectFn({
      gameSelect,
      files: state.gameFiles,
      selectedFile: state.selectedGameFile,
      t,
    });
  };

  /**
   * Render DOM panel preview from text editor content.
   */
  const renderDomView = () => {
    renderDomPanelFn(domViewEl, textEditorEl);
  };

  return {
    renderDomView,
    renderGameSelect,
    setSaveStatus,
  };
};
