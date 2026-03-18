/**
 * App shell layout component.
 *
 * Integration API:
 * - `createAppLayout({ t, buildTimestampLabel })` renders shell markup and returns queried DOM refs.
 *
 * Configuration API:
 * - Uses translation callback and build timestamp label injected by caller.
 *
 * Communication API:
 * - Writes app HTML into `#app` root and exposes refs for other components.
 */

/**
 * Render app shell HTML and return required DOM element references.
 *
 * @param {object} deps - Layout dependencies.
 * @param {Function} deps.t - Translation callback `(key, fallback) => string`.
 * @param {string} deps.buildTimestampLabel - Human-readable build timestamp.
 * @returns {object} Queried DOM references used by runtime components.
 */
export const createAppLayout = ({ t, buildTimestampLabel }) => {
  const app = document.querySelector("#app");
  if (!app) throw new Error("App root missing.");

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
        </div>
      </aside>
      <section class="app-panel">
        <span
          id="runtime-build-badge"
          class="runtime-build-badge"
          title="Build timestamp (used to detect stale windows)"
        >
          Build ${buildTimestampLabel}
        </span>
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
        <div class="board-editor-box">
          <div id="board" class="board merida"></div>
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
        <p id="status" class="status"></p>
        <div class="pgn-area">
          <div class="pgn-source-row">
            <label for="game-select">${t("pgn.source.label", "Game file")}</label>
            <select id="game-select">
              <option value="">${t("pgn.source.placeholder", "Manual / unsaved")}</option>
            </select>
            <button id="btn-pick-games-folder" class="source-button" type="button">
              ${t("pgn.source.chooseFolder", "Choose folder")}
            </button>
            <span id="save-status" class="save-status"></span>
          </div>
          <label for="pgn-input">${t("pgn.label", "PGN input")}</label>
          <textarea id="pgn-input" placeholder="${t(
            "pgn.placeholder",
            "Paste PGN text."
          )}"></textarea>
          <div class="pgn-actions">
            <button id="btn-load" type="button">${t("pgn.load", "Load PGN")}</button>
            <p id="error" class="error"></p>
          </div>
          <div id="ast-wrap" class="text-editor-wrap">
            <p class="text-editor-title">${t("pgn.ast.label", "ast_view")}</p>
            <div id="ast-view" class="ast-view"></div>
          </div>
          <div id="dom-wrap" class="text-editor-wrap">
            <p class="text-editor-title">${t("pgn.dom.label", "dom_view")}</p>
            <pre id="dom-view" class="dom-view"></pre>
          </div>
        </div>
        <div id="moves" class="moves"></div>
      </section>
    </main>
  `;

  return {
    boardEl: document.querySelector("#board"),
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
    btnDefaultIndent: document.querySelector("#btn-default-indent"),
    btnCommentLeft: document.querySelector("#btn-comment-left"),
    btnCommentRight: document.querySelector("#btn-comment-right"),
    btnLinebreak: document.querySelector("#btn-linebreak"),
    btnIndent: document.querySelector("#btn-indent"),
    speedInput: document.querySelector("#speed-input"),
    speedValue: document.querySelector("#speed-value"),
    soundInput: document.querySelector("#sound-input"),
    gameSelect: document.querySelector("#game-select"),
    btnPickGamesFolder: document.querySelector("#btn-pick-games-folder"),
    saveStatusEl: document.querySelector("#save-status"),
    astWrapEl: document.querySelector("#ast-wrap"),
    domWrapEl: document.querySelector("#dom-wrap"),
    btnMenu: document.querySelector("#btn-menu"),
    btnMenuClose: document.querySelector("#btn-menu-close"),
    menuPanel: document.querySelector("#app-menu-panel"),
    menuBackdrop: document.querySelector("#menu-backdrop"),
    textEditorEl: document.querySelector("#text-editor"),
    astViewEl: document.querySelector("#ast-view"),
    domViewEl: document.querySelector("#dom-view"),
  };
};
