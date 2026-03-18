/**
 * App shell runtime configuration component.
 *
 * Integration API:
 * - `createRuntimeConfigCapabilities({ state, astWrapEl, domWrapEl })`
 *
 * Configuration API:
 * - Applies text editor style variables from `config.textEditor`.
 *
 * Communication API:
 * - Mutates shared `state.appConfig` and updates DOM style/visibility.
 */

/**
 * Create runtime configuration capabilities for UI-facing config application.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {HTMLElement|null} deps.astWrapEl - AST panel wrapper element.
 * @param {HTMLElement|null} deps.domWrapEl - DOM panel wrapper element.
 * @returns {{applyRuntimeConfig: Function}} Runtime config methods.
 */
export const createRuntimeConfigCapabilities = ({ state, astWrapEl, domWrapEl }) => {
  /**
   * Apply merged runtime config to app state and UI.
   *
   * @param {object} [config={}] - Merged runtime config.
   */
  const applyRuntimeConfig = (config = {}) => {
    state.appConfig = config;
    const textEditorConfig = config?.textEditor && typeof config.textEditor === "object"
      ? config.textEditor
      : {};
    const rootStyle = document.documentElement?.style;
    if (rootStyle) {
      const fontSizePx = Number(textEditorConfig.fontSizePx);
      if (Number.isFinite(fontSizePx) && fontSizePx >= 10 && fontSizePx <= 28) {
        rootStyle.setProperty("--text-editor-font-size", `${fontSizePx}px`);
      }
      const lineHeight = Number(textEditorConfig.lineHeight);
      if (Number.isFinite(lineHeight) && lineHeight >= 1.1 && lineHeight <= 2.2) {
        rootStyle.setProperty("--text-editor-line-height", String(lineHeight));
      }
      const maxHeightVh = Number(textEditorConfig.maxHeightVh);
      if (Number.isFinite(maxHeightVh) && maxHeightVh >= 24 && maxHeightVh <= 92) {
        rootStyle.setProperty("--text-editor-max-height", `${maxHeightVh}vh`);
      }
    }
    const showAstView = textEditorConfig.showAstView !== false;
    const showDomView = textEditorConfig.showDomView !== false;
    if (astWrapEl) astWrapEl.hidden = !showAstView;
    if (domWrapEl) domWrapEl.hidden = !showDomView;
  };

  return {
    applyRuntimeConfig,
  };
};
