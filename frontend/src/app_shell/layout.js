import { GAME_INFO_HEADER_FIELDS, PLAYER_NAME_HEADER_KEYS } from "./game_info";
import { SUPPORTED_LOCALES } from "./i18n";

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
 * @param {string} deps.currentLocale - Active locale code used for initial locale selector value.
 * @returns {object} Queried DOM references used by runtime components.
 */
export const createAppLayout = ({ t, buildTimestampLabel, currentLocale }) => {
  const app = document.querySelector("#app");
  if (!app) throw new Error("App root missing.");
  const gameInfoEditorFieldsMarkup = GAME_INFO_HEADER_FIELDS.map((field) => {
    const id = `game-info-${field.key.toLowerCase()}`;
    const control = field.control || "text";
    const placeholder = field.placeholder || field.label;
    const controlMarkup = control === "select"
      ? `
      <select id="${id}" data-header-key="${field.key}">
        ${(field.options || []).map((optionValue) => `
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
              ${SUPPORTED_LOCALES.map((localeCode) => (
    `<option value="${localeCode}" ${localeCode === currentLocale ? "selected" : ""}>${localeCode.toUpperCase()}</option>`
  )).join("")}
            </select>
          </label>
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
                  <button id="btn-comment-bold" class="icon-button icon-button-text icon-button-format" type="button" title="${t("toolbar.commentBold", "Bold comment text")}" aria-label="${t("toolbar.commentBold", "Bold comment text")}">
                    <strong>B</strong>
                  </button>
                  <button id="btn-comment-italic" class="icon-button icon-button-text icon-button-format" type="button" title="${t("toolbar.commentItalic", "Italic comment text")}" aria-label="${t("toolbar.commentItalic", "Italic comment text")}">
                    <em>I</em>
                  </button>
                  <button id="btn-comment-underline" class="icon-button icon-button-text icon-button-format" type="button" title="${t("toolbar.commentUnderline", "Underline comment text")}" aria-label="${t("toolbar.commentUnderline", "Underline comment text")}">
                    <u>U</u>
                  </button>
                  <button id="btn-first-comment-intro" class="icon-button icon-button-text" type="button" title="${t("toolbar.firstCommentIntro", "First comment intro")}" aria-label="${t("toolbar.firstCommentIntro", "First comment intro")}" aria-pressed="false">
                    ${t("toolbar.introShort", "Intro")}
                  </button>
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
    btnCommentBold: document.querySelector("#btn-comment-bold"),
    btnCommentItalic: document.querySelector("#btn-comment-italic"),
    btnCommentUnderline: document.querySelector("#btn-comment-underline"),
    btnDefaultIndent: document.querySelector("#btn-default-indent"),
    btnFirstCommentIntro: document.querySelector("#btn-first-comment-intro"),
    btnCommentLeft: document.querySelector("#btn-comment-left"),
    btnCommentRight: document.querySelector("#btn-comment-right"),
    btnLinebreak: document.querySelector("#btn-linebreak"),
    btnIndent: document.querySelector("#btn-indent"),
    speedInput: document.querySelector("#speed-input"),
    speedValue: document.querySelector("#speed-value"),
    soundInput: document.querySelector("#sound-input"),
    localeInput: document.querySelector("#locale-input"),
    gameSelect: document.querySelector("#game-select"),
    btnPickGamesFolder: document.querySelector("#btn-pick-games-folder"),
    saveStatusEl: document.querySelector("#save-status"),
    astWrapEl: document.querySelector("#ast-wrap"),
    domWrapEl: document.querySelector("#dom-wrap"),
    btnMenu: document.querySelector("#btn-menu"),
    btnMenuClose: document.querySelector("#btn-menu-close"),
    menuPanel: document.querySelector("#app-menu-panel"),
    menuBackdrop: document.querySelector("#menu-backdrop"),
    btnGameInfoEdit: document.querySelector("#btn-game-info-edit"),
    gameInfoEditorEl: document.querySelector("#game-info-editor"),
    gameInfoPlayersValueEl: document.querySelector("#game-info-players-value"),
    gameInfoEventValueEl: document.querySelector("#game-info-event-value"),
    gameInfoDateValueEl: document.querySelector("#game-info-date-value"),
    gameInfoOpeningValueEl: document.querySelector("#game-info-opening-value"),
    gameInfoSuggestionEls: Array.from(document.querySelectorAll("[data-player-suggestions-for]")),
    gameInfoInputs: Array.from(document.querySelectorAll("[data-header-key]")),
    textEditorEl: document.querySelector("#text-editor"),
    astViewEl: document.querySelector("#ast-view"),
    domViewEl: document.querySelector("#dom-view"),
  };
};
