/**
 * Ui Adapters module.
 *
 * Integration API:
 * - Primary exports from this module: `createUiAdapters`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type UiAdapterDeps = {
  saveStatusEl: HTMLElement | null;
  domViewEl: HTMLElement | null;
  textEditorEl: HTMLElement | null;
  setPgnSaveStatusFn: (saveStatusEl: HTMLElement | null, message: string, kind: string) => void;
  renderDomPanelFn: (domViewEl: HTMLElement | null, sourceEl: HTMLElement | null) => void;
};

type UiAdapters = {
  renderDomView: () => void;
  setSaveStatus: (message?: string, kind?: string) => void;
};

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
}: UiAdapterDeps): UiAdapters => {
  /**
   * Update save status label and style.
   *
   * @param {string} [message=""] - Status message.
   * @param {string} [kind=""] - Status kind (`saving`, `saved`, `error`, or empty).
   */
  const setSaveStatus = (message: string = "", kind: string = ""): void => {
    setPgnSaveStatusFn(saveStatusEl, message, kind);
  };

  /**
   * Render DOM panel preview from text editor content.
   */
  const renderDomView = (): void => {
    renderDomPanelFn(domViewEl, textEditorEl);
  };

  return {
    renderDomView,
    setSaveStatus,
  };
};
