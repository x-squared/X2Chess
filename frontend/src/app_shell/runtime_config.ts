/**
 * App shell runtime configuration component.
 *
 * Integration API:
 * - Create once with `createRuntimeConfigCapabilities(...)`.
 * - Call `applyRuntimeConfig(config)` after config is loaded or when toggles
 *   affecting visibility/styles change.
 *
 * Configuration API:
 * - Reads `config.textEditor` keys:
 *   - `fontSizePx`, `lineHeight`, `maxHeightVh` (CSS variables)
 *   - `showAstView`, `showDomView` (dock tab visibility)
 * - Uses sane numeric bounds before applying values.
 *
 * Communication API:
 * - Writes merged config into `state.appConfig`.
 * - Updates CSS variables on `document.documentElement`.
 * - Shows/hides AST/DOM panels and normalizes `state.activeDevTab` when a tab
 *   becomes unavailable.
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
  const applyRuntimeConfig = (config: Record<string, unknown> = {}) => {
    state.appConfig = config;
    const textEditorConfig = config?.textEditor && typeof config.textEditor === "object"
      ? (config.textEditor as Record<string, unknown>)
      : ({} as Record<string, unknown>);
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
    const canShowDevTools = Boolean(state.isDeveloperToolsEnabled && state.isDevDockOpen);
    if (astWrapEl) astWrapEl.hidden = !canShowDevTools || !showAstView;
    if (domWrapEl) domWrapEl.hidden = !canShowDevTools || !showDomView;

    if (state.activeDevTab === "ast" && !showAstView) state.activeDevTab = showDomView ? "dom" : "pgn";
    if (state.activeDevTab === "dom" && !showDomView) state.activeDevTab = showAstView ? "ast" : "pgn";
  };

  return {
    applyRuntimeConfig,
  };
};
