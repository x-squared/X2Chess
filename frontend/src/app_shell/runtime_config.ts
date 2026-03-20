/**
 * Runtime Config module.
 *
 * Integration API:
 * - Primary exports from this module: `createRuntimeConfigCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type RuntimeConfigState = {
  appConfig: Record<string, unknown>;
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: string;
};

type RuntimeConfigDeps = {
  state: RuntimeConfigState;
  astWrapEl: HTMLElement | null;
  domWrapEl: HTMLElement | null;
};

type RuntimeConfigCapabilities = {
  applyRuntimeConfig: (config?: Record<string, unknown>) => void;
};

/**
 * Create runtime configuration capabilities for UI-facing config application.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {HTMLElement|null} deps.astWrapEl - AST panel wrapper element.
 * @param {HTMLElement|null} deps.domWrapEl - DOM panel wrapper element.
 * @returns {{applyRuntimeConfig: Function}} Runtime config methods.
 */
export const createRuntimeConfigCapabilities = ({ state, astWrapEl, domWrapEl }: RuntimeConfigDeps): RuntimeConfigCapabilities => {
  /**
   * Apply merged runtime config to app state and UI.
   *
   * @param {object} [config={}] - Merged runtime config.
   */
  const applyRuntimeConfig = (config: Record<string, unknown> = {}): void => {
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
