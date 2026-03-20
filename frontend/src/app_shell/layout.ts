import { GAME_INFO_HEADER_FIELDS, PLAYER_NAME_HEADER_KEYS } from "./game_info";
import { SUPPORTED_LOCALES } from "./i18n";

type LayoutDeps = {
  t: (key: string, fallback?: string) => string;
  buildTimestampLabel: string;
  currentLocale: string;
  isDeveloperToolsEnabled: boolean;
};

type GameInfoField = (typeof GAME_INFO_HEADER_FIELDS)[number];

type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

/**
 * Layout module.
 *
 * Integration API:
 * - Primary exports from this module: `createAppLayout`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

/**
 * Render app shell HTML and return required DOM element references.
 *
 * @param {object} deps - Layout dependencies.
 * @param {Function} deps.t - Translation callback `(key, fallback) => string`.
 * @param {string} deps.buildTimestampLabel - Human-readable build timestamp.
 * @param {string} deps.currentLocale - Active locale code used for initial locale selector value.
 * @param {boolean} deps.isDeveloperToolsEnabled - Initial developer-tools toggle state.
 * @returns {object} Queried DOM references used by runtime components.
 */
export const createAppLayout = ({ t, buildTimestampLabel, currentLocale, isDeveloperToolsEnabled }: LayoutDeps) => {
  const app = document.querySelector("#app");
  if (!app) throw new Error("App root missing.");
  const gameInfoEditorFieldsMarkup = GAME_INFO_HEADER_FIELDS.map((field: GameInfoField): string => {
    const id = `game-info-${field.key.toLowerCase()}`;
    const control = field.control || "text";
    const placeholder = field.placeholder || field.label;
    const controlMarkup = control === "select"
      ? `
      <select id="${id}" data-header-key="${field.key}">
        ${(field.options || []).map((optionValue: string): string => `
          <option value="${optionValue}">${optionValue || "-"}</option>
        `).join("")}
      </select>
    `
      : `
      <input
        id="${id}"
        type="${control === "number" ? "number" : "text"}"
        data-header-key="${field.key}"
        ${PLAYER_NAME_HEADER_KEYS.includes(field.key) ? 'data-player-name-input="true"' : ""}
        placeholder="${placeholder}"
        ${control === "number" ? 'inputmode="numeric" step="1" min="0"' : ""}
      />
    `;
    const suggestionsMarkup = PLAYER_NAME_HEADER_KEYS.includes(field.key)
      ? `
        <div
          class="game-info-player-suggestions"
          data-player-suggestions-for="${field.key}"
          hidden
        ></div>
      `
      : "";
    return `
      <label class="game-info-editor-field" for="${id}">
        <span>${field.label}</span>
        ${controlMarkup}
        ${suggestionsMarkup}
      </label>
    `;
  }).join("");

  app.innerHTML = `
    <main class="app">
      <div id="menu-backdrop" class="app-menu-backdrop" hidden></div>
      <aside id="app-menu-panel" class="app-menu-panel" aria-hidden="true">
        <div class="app-menu-header">
          <p class="app-menu-title">${t("menu.title", "Menu")}</p>
          <button id="btn-menu-close" class="menu-close" type="button" aria-label="${t("menu.close", "Close menu")}">
            ×
          </button>
        </div>
        <div class="controls controls-menu">
          <label class="inline-control">
            ${t("controls.speed", "Move speed (ms)")}
            <input id="speed-input" type="range" min="0" max="800" step="20" value="220" />
            <span id="speed-value">220</span>
          </label>
          <label class="inline-control">
            <input id="sound-input" type="checkbox" checked />
            ${t("controls.sound", "Sound")}
          </label>
          <label class="inline-control">
            ${t("controls.language", "Language")}
            <select id="locale-input">
              ${SUPPORTED_LOCALES.map((localeCode: LocaleCode): string => (
    `<option value="${localeCode}" ${localeCode === currentLocale ? "selected" : ""}>${localeCode.toUpperCase()}</option>`
  )).join("")}
            </select>
          </label>
          <label class="inline-control">
            <input id="developer-tools-input" type="checkbox" ${isDeveloperToolsEnabled ? "checked" : ""} />
            ${t("controls.developerTools", "Developer Tools")}
          </label>
          <button id="btn-dev-dock-toggle" class="source-button" type="button">
            ${t("controls.openDeveloperDock", "Open Developer Dock")}
          </button>
          <label class="inline-control">
            ${t("controls.saveMode", "Save mode")}
            <select id="save-mode-input">
              <option value="auto">${t("controls.saveMode.auto", "Autosave")}</option>
              <option value="manual">${t("controls.saveMode.manual", "Manual")}</option>
            </select>
          </label>
          <button id="btn-save-active-game" class="source-button" type="button">
            ${t("controls.saveNow", "Save now")}
          </button>
        </div>
        <div class="app-menu-footer">
          <span
            id="runtime-build-badge"
            class="runtime-build-badge"
            title="Build timestamp (used to detect stale windows)"
          >
            Build ${buildTimestampLabel}
          </span>
        </div>
      </aside>
      <section class="app-panel">
        <div id="game-drop-overlay" class="game-drop-overlay" hidden aria-hidden="true">
          <p class="game-drop-overlay-label">${t("games.dropOverlay", "Drop PGN file to open game")}</p>
        </div>
        <button
          id="btn-menu"
          class="menu-trigger"
          type="button"
          aria-label="${t("menu.open", "Open menu")}"
          aria-expanded="false"
          aria-controls="app-menu-panel"
        >
          <span class="menu-trigger-icon" aria-hidden="true"></span>
        </button>
        <section class="game-tabs-card">
          <div class="game-tabs-header">
            <p class="game-tabs-title">${t("games.open", "Open games")}</p>
            <p class="game-tabs-hint">${t("games.hint", "Drop .pgn files or paste PGN text onto the app to open games.")}</p>
          </div>
          <div id="game-tabs" class="game-tabs" role="tablist" aria-label="${t("games.open", "Open games")}"></div>
        </section>
        <section class="game-info-card">
          <div class="game-info-summary-row">
            <div class="game-info-summary-grid">
              <p class="game-info-item">
                <span class="game-info-label">${t("gameInfo.players", "Players")}</span>
                <span id="game-info-players-value" class="game-info-value game-info-players-value">-</span>
              </p>
              <p class="game-info-item">
                <span class="game-info-label">${t("gameInfo.event", "Event")}</span>
                <span id="game-info-event-value" class="game-info-value">-</span>
              </p>
              <p class="game-info-item">
                <span class="game-info-label">${t("gameInfo.date", "Date")}</span>
                <span id="game-info-date-value" class="game-info-value">-</span>
              </p>
              <p class="game-info-item">
                <span class="game-info-label">${t("gameInfo.opening", "Opening")}</span>
                <span id="game-info-opening-value" class="game-info-value">-</span>
              </p>
            </div>
            <button
              id="btn-game-info-edit"
              class="game-info-edit-trigger"
              type="button"
              aria-label="${t("gameInfo.edit", "Edit game information")}"
              aria-expanded="false"
              aria-controls="game-info-editor"
              title="${t("gameInfo.edit", "Edit game information")}"
            >
              <span aria-hidden="true">▼</span>
            </button>
          </div>
          <div id="game-info-editor" class="game-info-editor" hidden>
            <div class="game-info-editor-grid">
              ${gameInfoEditorFieldsMarkup}
            </div>
          </div>
        </section>
        <div id="board-editor-box" class="board-editor-box">
          <div id="board" class="board merida"></div>
          <div id="board-editor-resize-handle" class="board-editor-resize-handle" aria-hidden="true"></div>
          <div class="text-editor-wrap board-editor-pane">
            <div class="toolbar-box">
              <div class="move-toolbar">
                <div class="toolbar-group toolbar-group-nav">
                  <button id="btn-first" class="icon-button" type="button" title="${t("controls.first", "|<")}">
                    <img src="/icons/toolbar/nav-first.svg" alt="${t("controls.first", "|<")}" />
                  </button>
                  <button id="btn-prev" class="icon-button" type="button" title="${t("controls.prev", "<")}">
                    <img src="/icons/toolbar/nav-prev.svg" alt="${t("controls.prev", "<")}" />
                  </button>
                  <button id="btn-next" class="icon-button" type="button" title="${t("controls.next", ">")}">
                    <img src="/icons/toolbar/nav-next.svg" alt="${t("controls.next", ">")}" />
                  </button>
                  <button id="btn-last" class="icon-button" type="button" title="${t("controls.last", ">|")}">
                    <img src="/icons/toolbar/nav-last.svg" alt="${t("controls.last", ">|")}" />
                  </button>
                </div>
                <div class="toolbar-group toolbar-group-edit">
                  <button id="btn-comment-bold" class="icon-button icon-button-text icon-button-format" type="button" title="${t("toolbar.commentBold", "Bold comment text")}" aria-label="${t("toolbar.commentBold", "Bold comment text")}">
                    <strong>B</strong>
                  </button>
                  <button id="btn-comment-italic" class="icon-button icon-button-text icon-button-format" type="button" title="${t("toolbar.commentItalic", "Italic comment text")}" aria-label="${t("toolbar.commentItalic", "Italic comment text")}">
                    <em>I</em>
                  </button>
                  <button id="btn-comment-underline" class="icon-button icon-button-text icon-button-format" type="button" title="${t("toolbar.commentUnderline", "Underline comment text")}" aria-label="${t("toolbar.commentUnderline", "Underline comment text")}">
                    <u>U</u>
                  </button>
                  <div class="toolbar-pgn-layout" role="radiogroup" aria-label="${t("toolbar.pgnLayout.group", "PGN layout")}">
                    <button id="btn-pgn-layout-plain" class="icon-button icon-button-text pgn-layout-btn" type="button" data-pgn-layout="plain" title="${t("toolbar.pgnLayout.plain", "Plain — literal PGN")}" aria-pressed="false">
                      ${t("toolbar.pgnLayout.plainShort", "Plain")}
                    </button>
                    <button id="btn-pgn-layout-text" class="icon-button icon-button-text pgn-layout-btn" type="button" data-pgn-layout="text" title="${t("toolbar.pgnLayout.text", "Text — narrative layout")}" aria-pressed="true">
                      ${t("toolbar.pgnLayout.textShort", "Text")}
                    </button>
                    <button id="btn-pgn-layout-tree" class="icon-button icon-button-text pgn-layout-btn" type="button" data-pgn-layout="tree" title="${t("toolbar.pgnLayout.tree", "Tree — structure view (same as Text for now)")}" aria-pressed="false">
                      ${t("toolbar.pgnLayout.treeShort", "Tree")}
                    </button>
                  </div>
                  <button id="btn-comment-left" class="icon-button" type="button" title="${t("toolbar.commentLeft", "Insert comment left")}">
                    <img src="/icons/toolbar/comment-left.svg" alt="${t("toolbar.commentLeft", "Insert comment left")}" />
                  </button>
                  <button id="btn-comment-right" class="icon-button" type="button" title="${t("toolbar.commentRight", "Insert comment right")}">
                    <img src="/icons/toolbar/comment-right.svg" alt="${t("toolbar.commentRight", "Insert comment right")}" />
                  </button>
                  <button id="btn-linebreak" class="icon-button" type="button" title="${t("toolbar.linebreak", "Insert line break")}">
                    <img src="/icons/toolbar/linebreak.svg" alt="${t("toolbar.linebreak", "Insert line break")}" />
                  </button>
                  <button id="btn-indent" class="icon-button" type="button" title="${t("toolbar.indent", "Insert indent")}">
                    <img src="/icons/toolbar/indent.svg" alt="${t("toolbar.indent", "Insert indent")}" />
                  </button>
                  <button id="btn-default-indent" class="icon-button" type="button" title="${t("pgn.defaultIndent", "Default indent")}">
                    <img src="/icons/toolbar/default-indent.svg" alt="${t("pgn.defaultIndent", "Default indent")}" />
                  </button>
                  <button id="btn-undo" class="icon-button" type="button" title="${t("toolbar.undo", "Undo")}">
                    <img src="/icons/toolbar/undo.svg" alt="${t("toolbar.undo", "Undo")}" />
                  </button>
                  <button id="btn-redo" class="icon-button" type="button" title="${t("toolbar.redo", "Redo")}">
                    <img src="/icons/toolbar/redo.svg" alt="${t("toolbar.redo", "Redo")}" />
                  </button>
                </div>
              </div>
            </div>
            <div class="editor-box">
              <div id="text-editor" class="text-editor"></div>
            </div>
          </div>
        </div>
        <section class="resource-viewer-card">
          <div id="resource-viewer-resize-handle" class="resource-viewer-resize-handle" aria-hidden="true"></div>
          <div class="resource-viewer-header">
            <div>
              <p class="resource-viewer-title">${t("resources.title", "Resources")}</p>
            </div>
            <div class="resource-viewer-actions">
              <button
                id="btn-resource-metadata"
                class="resource-icon-button"
                type="button"
                aria-label="${t("resources.metadata.button", "Choose metadata columns")}"
                title="${t("resources.metadata.button", "Choose metadata columns")}"
              >
                <span aria-hidden="true">⚙</span>
              </button>
              <button id="btn-open-resource" class="resource-action-button" type="button">
                ${t("resources.open", "Open resource")}
              </button>
            </div>
          </div>
          <div id="resource-tabs" class="resource-tabs" role="tablist" aria-label="${t("resources.title", "Resources")}"></div>
          <div id="resource-table-wrap" class="resource-table-wrap"></div>
          <dialog id="resource-metadata-dialog" class="resource-metadata-dialog">
            <form method="dialog" class="resource-metadata-form">
              <p class="resource-metadata-title">${t("resources.metadata.title", "Select metadata columns")}</p>
              <div id="resource-metadata-fields" class="resource-metadata-fields"></div>
              <label class="resource-metadata-apply-all">
                <input id="resource-metadata-apply-all" type="checkbox" />
                ${t("resources.metadata.applyAll", "Apply to all resources")}
              </label>
              <div class="resource-metadata-actions">
                <button id="btn-resource-metadata-reset" type="button">${t("resources.metadata.resetCurrent", "Reset columns for this resource")}</button>
                <button id="btn-resource-metadata-cancel" type="button">${t("resources.metadata.cancel", "Cancel")}</button>
                <button id="btn-resource-metadata-save" type="submit">${t("resources.metadata.save", "Apply")}</button>
              </div>
            </form>
          </dialog>
        </section>
        <p id="status" class="status"></p>
        <span id="save-status" class="save-status" hidden></span>
      </section>
      <section id="developer-dock" class="developer-dock" hidden>
        <div id="dev-dock-resize-handle" class="developer-dock-resize-handle" aria-hidden="true"></div>
        <div class="developer-dock-header">
          <p class="developer-dock-title">${t("controls.developerTools", "Developer Tools")}</p>
          <div class="developer-dock-controls">
            <div class="developer-dock-tabs" role="tablist" aria-label="${t("controls.developerTools", "Developer Tools")}">
              <button id="dev-tab-btn-ast" class="developer-dock-tab" type="button" role="tab" aria-selected="true" aria-controls="dev-tab-ast">${t("pgn.ast.label", "ast_view")}</button>
              <button id="dev-tab-btn-dom" class="developer-dock-tab" type="button" role="tab" aria-selected="false" aria-controls="dev-tab-dom">${t("pgn.dom.label", "dom_view")}</button>
              <button id="dev-tab-btn-pgn" class="developer-dock-tab" type="button" role="tab" aria-selected="false" aria-controls="dev-tab-pgn">${t("devDock.tab.rawPgn", "Raw PGN")}</button>
            </div>
            <button id="btn-dev-dock-close" class="menu-close" type="button" aria-label="${t("controls.closeDeveloperDock", "Close Developer Dock")}">×</button>
          </div>
        </div>
        <div class="developer-dock-body">
          <div id="dev-tab-ast" class="developer-dock-panel" role="tabpanel" aria-labelledby="dev-tab-btn-ast">
            <div id="ast-wrap" class="text-editor-wrap">
              <p class="text-editor-title">${t("pgn.ast.label", "ast_view")}</p>
              <div id="ast-view" class="ast-view"></div>
            </div>
          </div>
          <div id="dev-tab-dom" class="developer-dock-panel" role="tabpanel" aria-labelledby="dev-tab-btn-dom" hidden>
            <div id="dom-wrap" class="text-editor-wrap">
              <p class="text-editor-title">${t("pgn.dom.label", "dom_view")}</p>
              <pre id="dom-view" class="dom-view"></pre>
            </div>
          </div>
          <div id="dev-tab-pgn" class="developer-dock-panel" role="tabpanel" aria-labelledby="dev-tab-btn-pgn" hidden>
            <div class="pgn-area">
              <label for="pgn-input">${t("pgn.label", "PGN input")}</label>
              <textarea id="pgn-input" placeholder="${t(
                "pgn.placeholder",
                "Paste PGN text."
              )}"></textarea>
              <div class="pgn-actions">
                <button id="btn-load" type="button">${t("pgn.load", "Load PGN")}</button>
                <p id="error" class="error"></p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;

  return {
    boardEl: document.querySelector<HTMLElement>("#board"),
    statusEl: document.querySelector("#status"),
    movesEl: document.querySelector("#moves"),
    errorEl: document.querySelector("#error"),
    pgnInput: document.querySelector("#pgn-input"),
    btnFirst: document.querySelector("#btn-first"),
    btnPrev: document.querySelector("#btn-prev"),
    btnNext: document.querySelector("#btn-next"),
    btnLast: document.querySelector("#btn-last"),
    btnUndo: document.querySelector("#btn-undo"),
    btnRedo: document.querySelector("#btn-redo"),
    btnLoad: document.querySelector("#btn-load"),
    btnCommentBold: document.querySelector("#btn-comment-bold"),
    btnCommentItalic: document.querySelector("#btn-comment-italic"),
    btnCommentUnderline: document.querySelector("#btn-comment-underline"),
    btnDefaultIndent: document.querySelector("#btn-default-indent"),
    btnPgnLayoutPlain: document.querySelector("#btn-pgn-layout-plain"),
    btnPgnLayoutText: document.querySelector("#btn-pgn-layout-text"),
    btnPgnLayoutTree: document.querySelector("#btn-pgn-layout-tree"),
    btnCommentLeft: document.querySelector("#btn-comment-left"),
    btnCommentRight: document.querySelector("#btn-comment-right"),
    btnLinebreak: document.querySelector("#btn-linebreak"),
    btnIndent: document.querySelector("#btn-indent"),
    speedInput: document.querySelector<HTMLInputElement>("#speed-input"),
    speedValue: document.querySelector<HTMLElement>("#speed-value"),
    soundInput: document.querySelector<HTMLInputElement>("#sound-input"),
    localeInput: document.querySelector<HTMLSelectElement>("#locale-input"),
    developerToolsInput: document.querySelector<HTMLInputElement>("#developer-tools-input"),
    btnDevDockToggle: document.querySelector<HTMLButtonElement>("#btn-dev-dock-toggle"),
    btnDevDockClose: document.querySelector<HTMLButtonElement>("#btn-dev-dock-close"),
    saveModeInput: document.querySelector<HTMLSelectElement>("#save-mode-input"),
    btnSaveActiveGame: document.querySelector<HTMLButtonElement>("#btn-save-active-game"),
    saveStatusEl: document.querySelector<HTMLElement>("#save-status"),
    gameTabsEl: document.querySelector("#game-tabs"),
    gameDropOverlayEl: document.querySelector("#game-drop-overlay"),
    boardEditorBoxEl: document.querySelector<HTMLElement>("#board-editor-box"),
    boardEditorResizeHandleEl: document.querySelector<HTMLElement>("#board-editor-resize-handle"),
    boardEditorPaneEl: document.querySelector(".board-editor-pane"),
    resourceViewerCardEl: document.querySelector<HTMLElement>(".resource-viewer-card"),
    resourceViewerResizeHandleEl: document.querySelector<HTMLElement>("#resource-viewer-resize-handle"),
    btnOpenResource: document.querySelector("#btn-open-resource"),
    btnResourceMetadata: document.querySelector("#btn-resource-metadata"),
    resourceMetadataDialogEl: document.querySelector("#resource-metadata-dialog"),
    resourceMetadataFieldsEl: document.querySelector("#resource-metadata-fields"),
    resourceMetadataApplyAllEl: document.querySelector("#resource-metadata-apply-all"),
    btnResourceMetadataReset: document.querySelector("#btn-resource-metadata-reset"),
    btnResourceMetadataCancel: document.querySelector("#btn-resource-metadata-cancel"),
    btnResourceMetadataSave: document.querySelector("#btn-resource-metadata-save"),
    resourceTabsEl: document.querySelector("#resource-tabs"),
    resourceTableWrapEl: document.querySelector("#resource-table-wrap"),
    runtimeBuildBadgeEl: document.querySelector("#runtime-build-badge"),
    developerDockEl: document.querySelector<HTMLElement>("#developer-dock"),
    devDockResizeHandleEl: document.querySelector<HTMLElement>("#dev-dock-resize-handle"),
    devTabBtnAst: document.querySelector("#dev-tab-btn-ast"),
    devTabBtnDom: document.querySelector("#dev-tab-btn-dom"),
    devTabBtnPgn: document.querySelector("#dev-tab-btn-pgn"),
    devTabAstEl: document.querySelector("#dev-tab-ast"),
    devTabDomEl: document.querySelector("#dev-tab-dom"),
    devTabPgnEl: document.querySelector("#dev-tab-pgn"),
    astWrapEl: document.querySelector<HTMLElement>("#ast-wrap"),
    domWrapEl: document.querySelector<HTMLElement>("#dom-wrap"),
    btnMenu: document.querySelector<HTMLButtonElement>("#btn-menu"),
    btnMenuClose: document.querySelector<HTMLButtonElement>("#btn-menu-close"),
    menuPanel: document.querySelector<HTMLElement>("#app-menu-panel"),
    menuBackdrop: document.querySelector<HTMLElement>("#menu-backdrop"),
    btnGameInfoEdit: document.querySelector<HTMLElement>("#btn-game-info-edit"),
    gameInfoEditorEl: document.querySelector<HTMLElement>("#game-info-editor"),
    gameInfoPlayersValueEl: document.querySelector<HTMLElement>("#game-info-players-value"),
    gameInfoEventValueEl: document.querySelector<HTMLElement>("#game-info-event-value"),
    gameInfoDateValueEl: document.querySelector<HTMLElement>("#game-info-date-value"),
    gameInfoOpeningValueEl: document.querySelector<HTMLElement>("#game-info-opening-value"),
    gameInfoSuggestionEls: Array.from(document.querySelectorAll<HTMLElement>("[data-player-suggestions-for]")),
    gameInfoInputs: Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-header-key]")),
    textEditorEl: document.querySelector<HTMLElement>("#text-editor"),
    astViewEl: document.querySelector("#ast-view"),
    domViewEl: document.querySelector<HTMLElement>("#dom-view"),
  };
};
