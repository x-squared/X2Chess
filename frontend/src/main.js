import { Chess } from "chess.js";
import { Chessground } from "chessground";
import "chessground/assets/chessground.base.css";
import "./styles.css";
import { text_editor } from "./text_editor";
import { parsePgnToModel } from "./pgn_model";
import {
  applyDefaultIndentDirectives,
  findExistingCommentIdAroundMove,
  insertCommentAroundMove,
  removeCommentById,
  setCommentTextById,
} from "./pgn_commands";
import { serializeModelToPgn } from "./pgn_serialize";
import { ast_view } from "./ast_view";

const translations = {
  "app.title": "X2Chess PGN Viewer",
  "controls.first": "|<",
  "controls.prev": "<",
  "controls.next": ">",
  "controls.last": ">|",
  "controls.speed": "Move speed (ms)",
  "controls.sound": "Sound",
  "toolbar.commentLeft": "Insert comment left",
  "toolbar.commentRight": "Insert comment right",
  "toolbar.linebreak": "Insert line break",
  "toolbar.indent": "Insert indent",
  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "status.label": "Position",
  "pgn.label": "PGN input",
  "pgn.placeholder":
    "Paste or drop PGN text here.\n\nExample:\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
  "pgn.load": "Load PGN",
  "pgn.defaultIndent": "Default indent",
  "pgn.loaded": "PGN loaded.",
  "pgn.error": "Unable to parse PGN.",
  "pgn.formatted.label": "text_editor",
  "pgn.ast.label": "ast_view",
  "pgn.dom.label": "dom_view",
  "pgn.comment.editPrompt": "Edit comment text",
  "moves.label": "Moves",
  "moves.none": "No moves loaded.",
};

const t = (key, englishDefault) => translations[key] ?? englishDefault;

const VISUAL_ASSET_STORAGE_PREFIX = "chess-app:visual-asset:v2:";
const VISUAL_ASSET_FETCH_TIMEOUT_MS = 4000;

const VISUAL_ASSETS = [
  {
    key: "board-image",
    cssVar: "--board-background-image",
    remoteUrl: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_board_openings.svg",
    localUrl: "/board-assets/img/boards/merida-blue.svg",
  },
  {
    key: "piece-wp",
    cssVar: "--piece-wp-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wP.png",
    localUrl: "/canvaschess/img/pieces/merida/wp.svg",
  },
  {
    key: "piece-wn",
    cssVar: "--piece-wn-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wN.png",
    localUrl: "/canvaschess/img/pieces/merida/wn.svg",
  },
  {
    key: "piece-wb",
    cssVar: "--piece-wb-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wB.png",
    localUrl: "/canvaschess/img/pieces/merida/wb.svg",
  },
  {
    key: "piece-wr",
    cssVar: "--piece-wr-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wR.png",
    localUrl: "/canvaschess/img/pieces/merida/wr.svg",
  },
  {
    key: "piece-wq",
    cssVar: "--piece-wq-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wQ.png",
    localUrl: "/canvaschess/img/pieces/merida/wq.svg",
  },
  {
    key: "piece-wk",
    cssVar: "--piece-wk-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/wK.png",
    localUrl: "/canvaschess/img/pieces/merida/wk.svg",
  },
  {
    key: "piece-bp",
    cssVar: "--piece-bp-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bP.png",
    localUrl: "/canvaschess/img/pieces/merida/bp.svg",
  },
  {
    key: "piece-bn",
    cssVar: "--piece-bn-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bN.png",
    localUrl: "/canvaschess/img/pieces/merida/bn.svg",
  },
  {
    key: "piece-bb",
    cssVar: "--piece-bb-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bB.png",
    localUrl: "/canvaschess/img/pieces/merida/bb.svg",
  },
  {
    key: "piece-br",
    cssVar: "--piece-br-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bR.png",
    localUrl: "/canvaschess/img/pieces/merida/br.svg",
  },
  {
    key: "piece-bq",
    cssVar: "--piece-bq-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bQ.png",
    localUrl: "/canvaschess/img/pieces/merida/bq.svg",
  },
  {
    key: "piece-bk",
    cssVar: "--piece-bk-image",
    remoteUrl: "https://chessboardjs.com/img/chesspieces/wikipedia/bK.png",
    localUrl: "/canvaschess/img/pieces/merida/bk.svg",
  },
];

const toCssUrlValue = (url) => `url("${String(url).replace(/"/g, '\\"')}")`;

const readAssetCache = (cacheKey) => {
  try {
    return window.localStorage.getItem(`${VISUAL_ASSET_STORAGE_PREFIX}${cacheKey}`);
  } catch {
    return null;
  }
};

const writeAssetCache = (cacheKey, value) => {
  try {
    window.localStorage.setItem(`${VISUAL_ASSET_STORAGE_PREFIX}${cacheKey}`, value);
  } catch {
    // Ignore quota/private-mode storage errors and keep runtime fallback behavior.
  }
};

const asDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(reader.error || new Error("Failed to read resource blob."));
  reader.readAsDataURL(blob);
});

const fetchAssetDataUrl = async (url) => {
  const response = await Promise.race([
    window.fetch(url, { cache: "no-store", mode: "cors" }),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Asset request timed out.")), VISUAL_ASSET_FETCH_TIMEOUT_MS);
    }),
  ]);
  if (!response.ok) {
    throw new Error(`Failed to load asset: ${url}`);
  }
  const blob = await response.blob();
  const dataUrl = await asDataUrl(blob);
  if (!dataUrl) throw new Error(`Empty asset data: ${url}`);
  return dataUrl;
};

const applyVisualAsset = (asset, cssUrlValue) => {
  if (!document.documentElement) return;
  document.documentElement.style.setProperty(asset.cssVar, cssUrlValue);
};

const hydrateVisualAsset = async (asset) => {
  try {
    const dataUrl = await fetchAssetDataUrl(asset.remoteUrl);
    writeAssetCache(asset.key, dataUrl);
    applyVisualAsset(asset, toCssUrlValue(dataUrl));
    return;
  } catch {
    // Fall through to cached and bundled local fallback sources.
  }

  const cached = readAssetCache(asset.key);
  if (cached) {
    applyVisualAsset(asset, toCssUrlValue(cached));
    return;
  }

  // Use bundled local path directly. This avoids data-URL issues for SVGs that
  // may include nested asset references and keeps fallback behavior deterministic.
  applyVisualAsset(asset, toCssUrlValue(asset.localUrl));
};

const hydrateVisualAssets = async () => {
  await Promise.allSettled(VISUAL_ASSETS.map((asset) => hydrateVisualAsset(asset)));
};

const DEFAULT_PGN = `[Event "Sample"]
[Site "Local"]
[Date "2026.03.10"]
[Round "-"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 (1. c4 e5) (1. d4 d5 (1... Nf6 2. c4 e6) 2. c4) e5
2. Nf3 (2. Nc3 Nf6 (2... Bb4 3. a3)) Nc6
3. Bb5 a6 (3... Nf6 4. O-O (4. d3))
4. Ba4 Nf6 *`;

const state = {
  moves: [],
  currentPly: 0,
  pgnText: DEFAULT_PGN,
  pgnModel: parsePgnToModel(DEFAULT_PGN),
  moveDelayMs: 220,
  soundEnabled: true,
  isAnimating: false,
  animationRunId: 0,
  verboseMoves: [],
  movePositionById: {},
  boardPreview: null,
  statusMessage: "",
  errorMessage: "",
  pendingFocusCommentId: null,
  selectedMoveId: null,
  undoStack: [],
  redoStack: [],
};

const app = document.querySelector("#app");
if (!app) throw new Error("App root missing.");

app.innerHTML = `
  <main class="app">
    <h1>${t("app.title", "X2Chess PGN Viewer")}</h1>
    <section class="app-panel">
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
      <div class="controls">
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
      <p id="status" class="status"></p>
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
        <div class="text-editor-wrap">
          <p class="text-editor-title">${t("pgn.ast.label", "ast_view")}</p>
          <div id="ast-view" class="ast-view"></div>
        </div>
        <div class="text-editor-wrap">
          <p class="text-editor-title">${t("pgn.dom.label", "dom_view")}</p>
          <pre id="dom-view" class="dom-view"></pre>
        </div>
      </div>
      <div id="moves" class="moves"></div>
    </section>
  </main>
`;

const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const movesEl = document.querySelector("#moves");
const errorEl = document.querySelector("#error");
const pgnInput = document.querySelector("#pgn-input");
const btnFirst = document.querySelector("#btn-first");
const btnPrev = document.querySelector("#btn-prev");
const btnNext = document.querySelector("#btn-next");
const btnLast = document.querySelector("#btn-last");
const btnUndo = document.querySelector("#btn-undo");
const btnRedo = document.querySelector("#btn-redo");
const btnLoad = document.querySelector("#btn-load");
const btnDefaultIndent = document.querySelector("#btn-default-indent");
const btnCommentLeft = document.querySelector("#btn-comment-left");
const btnCommentRight = document.querySelector("#btn-comment-right");
const btnLinebreak = document.querySelector("#btn-linebreak");
const btnIndent = document.querySelector("#btn-indent");
const speedInput = document.querySelector("#speed-input");
const speedValue = document.querySelector("#speed-value");
const soundInput = document.querySelector("#sound-input");
const textEditorEl = document.querySelector("#text-editor");
const astViewEl = document.querySelector("#ast-view");
const domViewEl = document.querySelector("#dom-view");
let board = null;
let audioCtx = null;

const HISTORY_LIMIT = 200;
const cloneModelState = (model) => JSON.parse(JSON.stringify(model));
const captureEditorSnapshot = () => ({
  pgnModel: cloneModelState(state.pgnModel),
  pgnText: state.pgnText,
  currentPly: state.currentPly,
  selectedMoveId: state.selectedMoveId,
});

const pushUndoSnapshot = (snapshot) => {
  state.undoStack.push(snapshot);
  if (state.undoStack.length > HISTORY_LIMIT) state.undoStack.shift();
};

const applyEditorSnapshot = (snapshot) => {
  if (!snapshot) return;
  state.animationRunId += 1;
  state.isAnimating = false;
  state.boardPreview = null;
  state.pgnModel = cloneModelState(snapshot.pgnModel);
  state.pgnText = snapshot.pgnText;
  state.currentPly = snapshot.currentPly;
  state.selectedMoveId = snapshot.selectedMoveId ?? null;
  if (pgnInput) pgnInput.value = state.pgnText;
  syncChessParseState(state.pgnText);
  render();
};

const performUndo = () => {
  if (state.undoStack.length === 0) return;
  const previous = state.undoStack.pop();
  state.redoStack.push(captureEditorSnapshot());
  applyEditorSnapshot(previous);
};

const performRedo = () => {
  if (state.redoStack.length === 0) return;
  const next = state.redoStack.pop();
  pushUndoSnapshot(captureEditorSnapshot());
  applyEditorSnapshot(next);
};

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const ensureAudio = async () => {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  return audioCtx;
};

const playMoveSound = async (isForward, san) => {
  if (!state.soundEnabled) return;
  if (!san || typeof san !== "string") return;
  const ctx = await ensureAudio();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Attack click: short filtered noise for the "wood contact" transient.
  const noiseLength = Math.floor(ctx.sampleRate * 0.05);
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) {
    noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength);
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = isForward ? 1650 : 1450;
  noiseFilter.Q.value = 1.2;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.07, now + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(now);
  noiseSource.stop(now + 0.06);

  // Body resonance: brief low tone to mimic a wooden piece/body response.
  const bodyOsc = ctx.createOscillator();
  bodyOsc.type = "triangle";
  bodyOsc.frequency.setValueAtTime(isForward ? 360 : 310, now);
  bodyOsc.frequency.exponentialRampToValueAtTime(isForward ? 285 : 250, now + 0.09);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  bodyOsc.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  bodyOsc.start(now);
  bodyOsc.stop(now + 0.11);
};

const ensureBoard = async () => {
  if (!boardEl) return false;
  if (board) return true;
  board = Chessground(boardEl, {
    fen: "start",
    orientation: "white",
    coordinates: true,
    viewOnly: true,
    movable: { color: null },
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: state.moveDelayMs },
  });
  return true;
};

const buildGameAtPly = (ply) => {
  const game = new Chess();
  for (let i = 0; i < ply; i += 1) game.move(state.moves[i]);
  return game;
};

const cloneGame = (game) => {
  const next = new Chess();
  next.load(game.fen());
  return next;
};

const buildMovePositionById = (pgnModel) => {
  const index = {};
  if (!pgnModel?.root) return index;

  const walkVariation = (variation, baseGame, isMainline, mainlinePly, parentMoveId = null) => {
    const game = cloneGame(baseGame);
    let ply = mainlinePly;
    let firstMoveId = null;
    let lastMoveId = parentMoveId;
    for (const entry of variation.entries) {
      if (entry.type === "variation") {
        const childFirstMoveId = walkVariation(entry, game, false, ply, lastMoveId);
        if (childFirstMoveId && lastMoveId && index[lastMoveId]) {
          const nextStarts = Array.isArray(index[lastMoveId].variationFirstMoveIds)
            ? index[lastMoveId].variationFirstMoveIds
            : [];
          index[lastMoveId].variationFirstMoveIds = [...nextStarts, childFirstMoveId];
        }
        continue;
      }
      if (entry.type !== "move") continue;
      const gameBeforeMove = cloneGame(game);
      let moved;
      try {
        moved = game.move(entry.san);
      } catch {
        moved = null;
      }
      if (!moved) continue;
      if (isMainline) ply += 1;
      if (!firstMoveId) firstMoveId = entry.id;
      const childVariationFirstMoveIds = [];
      const previousMoveId = lastMoveId;
      index[entry.id] = {
        fen: game.fen(),
        lastMove: moved.from && moved.to ? [moved.from, moved.to] : null,
        mainlinePly: isMainline ? ply : null,
        parentMoveId: isMainline ? null : parentMoveId,
        isVariationStart: !isMainline && firstMoveId === entry.id,
        variationFirstMoveIds: childVariationFirstMoveIds,
        previousMoveId,
        nextMoveId: null,
      };
      if (previousMoveId && index[previousMoveId]) {
        index[previousMoveId].nextMoveId = entry.id;
      }
      if (Array.isArray(entry.postItems)) {
        entry.postItems.forEach((item) => {
          if (item.type === "rav" && item.rav) {
            const childFirstMoveId = walkVariation(item.rav, gameBeforeMove, false, ply, entry.id);
            if (childFirstMoveId) childVariationFirstMoveIds.push(childFirstMoveId);
          }
        });
      } else if (Array.isArray(entry.ravs)) {
        entry.ravs.forEach((child) => {
          const childFirstMoveId = walkVariation(child, gameBeforeMove, false, ply, entry.id);
          if (childFirstMoveId) childVariationFirstMoveIds.push(childFirstMoveId);
        });
      }
      lastMoveId = entry.id;
    }
    return firstMoveId;
  };

  walkVariation(pgnModel.root, new Chess(), true, 0);
  return index;
};

const stripAnnotationsForBoardParser = (source) => {
  let out = "";
  let variationDepth = 0;
  let inComment = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inComment) {
      if (ch === "}") inComment = false;
      continue;
    }
    if (ch === "{") {
      inComment = true;
      continue;
    }
    if (ch === "(") {
      variationDepth += 1;
      continue;
    }
    if (ch === ")") {
      variationDepth = Math.max(0, variationDepth - 1);
      continue;
    }
    if (variationDepth > 0) continue;
    out += ch;
  }
  return out;
};

const renderMoveList = () => {
  if (!movesEl) return;
  movesEl.replaceChildren();

  const label = document.createElement("span");
  label.className = "moves-label";
  label.textContent = `${t("moves.label", "Moves")}:`;
  movesEl.appendChild(label);

  if (state.moves.length === 0) {
    const empty = document.createElement("span");
    empty.className = "moves-empty";
    empty.textContent = ` ${t("moves.none", "No moves loaded.")}`;
    movesEl.appendChild(empty);
    return;
  }

  const startsWithBlack = (() => {
    const entries = state.pgnModel?.root?.entries;
    if (!Array.isArray(entries)) return false;
    for (const entry of entries) {
      if (entry?.type === "move_number") {
        return /^\d+\.\.\.?$/.test(String(entry.text ?? ""));
      }
      if (entry?.type === "move") return false;
    }
    return false;
  })();

  const list = document.createElement("div");
  list.className = "moves-list";

  if (startsWithBlack) {
    const first = document.createElement("span");
    first.className = "move";

    const nr = document.createElement("span");
    nr.className = "move-number";
    nr.textContent = "1";

    const white = document.createElement("span");
    white.className = "move-white skip";
    white.textContent = "";

    const black = document.createElement("span");
    black.className = "move-black";
    black.textContent = state.moves[0] ?? "";

    first.append(nr, white, black);
    list.appendChild(first);

    for (let i = 1; i < state.moves.length; i += 2) {
      const fullMove = Math.floor((i + 1) / 2) + 1;
      const whiteSan = state.moves[i] ?? "";
      const blackSan = state.moves[i + 1] ?? "";

      const move = document.createElement("span");
      move.className = "move";

      const moveNr = document.createElement("span");
      moveNr.className = "move-number";
      moveNr.textContent = String(fullMove);

      const moveWhite = document.createElement("span");
      moveWhite.className = "move-white";
      moveWhite.textContent = whiteSan;

      const moveBlack = document.createElement("span");
      moveBlack.className = "move-black";
      moveBlack.textContent = blackSan;

      move.append(moveNr, moveWhite, moveBlack);
      list.appendChild(move);
    }
  } else {
    for (let i = 0; i < state.moves.length; i += 2) {
      const fullMove = i / 2 + 1;
      const white = state.moves[i] ?? "";
      const black = state.moves[i + 1] ?? "";

      const move = document.createElement("span");
      move.className = "move";

      const moveNr = document.createElement("span");
      moveNr.className = "move-number";
      moveNr.textContent = String(fullMove);

      const moveWhite = document.createElement("span");
      moveWhite.className = "move-white";
      if (!white && black) moveWhite.classList.add("skip");
      moveWhite.textContent = white;

      const moveBlack = document.createElement("span");
      moveBlack.className = "move-black";
      moveBlack.textContent = black;

      move.append(moveNr, moveWhite, moveBlack);
      list.appendChild(move);
    }
  }

  movesEl.appendChild(list);
};

const renderBoard = (game) => {
  if (!board) return;
  if (state.boardPreview) {
    board.set({
      fen: state.boardPreview.fen,
      lastMove: state.boardPreview.lastMove || undefined,
      animation: { enabled: true, duration: state.moveDelayMs },
    });
    return;
  }
  const lastMove = state.currentPly > 0
    ? (() => {
      const vm = state.verboseMoves[state.currentPly - 1];
      return vm?.from && vm?.to ? [vm.from, vm.to] : undefined;
    })()
    : undefined;
  board.set({
    fen: game.fen(),
    lastMove,
    animation: { enabled: true, duration: state.moveDelayMs },
  });
};

const formatDomNode = (node, depth = 0) => {
  const indent = "  ".repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";
    if (!value) return "";
    if (/^\s+$/.test(value)) return `${indent}#text(${JSON.stringify(value)})`;
    return `${indent}#text(${JSON.stringify(value)})`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  const attrs = Array.from(node.attributes)
    .map((attr) => `${attr.name}=${JSON.stringify(attr.value)}`)
    .join(" ");
  const open = attrs ? `${indent}<${tag} ${attrs}>` : `${indent}<${tag}>`;
  const childLines = Array.from(node.childNodes)
    .map((child) => formatDomNode(child, depth + 1))
    .filter(Boolean);
  const close = `${indent}</${tag}>`;
  if (childLines.length === 0) {
    return `${open}${close.slice(indent.length)}`;
  }
  return [open, ...childLines, close].join("\n");
};

const renderDomView = () => {
  if (!domViewEl || !textEditorEl) return;
  domViewEl.textContent = formatDomNode(textEditorEl);
};

const applyPgnModelUpdate = (nextModel, focusCommentId = null, { recordHistory = true } = {}) => {
  const nextPgnText = serializeModelToPgn(nextModel);
  if (recordHistory && nextPgnText !== state.pgnText) {
    pushUndoSnapshot(captureEditorSnapshot());
    state.redoStack = [];
  }
  state.pgnModel = nextModel;
  state.pgnText = nextPgnText;
  if (pgnInput) pgnInput.value = state.pgnText;
  if (focusCommentId) state.pendingFocusCommentId = focusCommentId;
  syncChessParseState(state.pgnText);
  render();
};

const insertAroundSelectedMove = (position, rawText = "") => {
  const moveId = state.selectedMoveId;
  if (!moveId) return;
  const { model, insertedCommentId } = insertCommentAroundMove(state.pgnModel, moveId, position, rawText);
  applyPgnModelUpdate(model, insertedCommentId);
};

const selectMoveById = (moveId) => {
  state.selectedMoveId = moveId;
  const target = state.movePositionById?.[moveId];
  if (!target) return false;
  if (Number.isInteger(target.mainlinePly)) {
    if (target.mainlinePly === state.currentPly) {
      state.boardPreview = null;
      render();
      return true;
    }
    // Move selection should jump immediately, without replay animation.
    state.animationRunId += 1;
    state.isAnimating = false;
    state.boardPreview = null;
    state.currentPly = target.mainlinePly;
    render();
    return true;
  }
  state.boardPreview = {
    fen: target.fen,
    lastMove: target.lastMove,
  };
  render();
  return true;
};

const handleSelectedMoveArrowHotkey = (event) => {
  const moveId = state.selectedMoveId;
  const movePosition = moveId ? state.movePositionById?.[moveId] : null;
  if (!moveId || !movePosition) return false;
  const isLeft = event.key === "ArrowLeft";
  const isRight = event.key === "ArrowRight";
  const isDown = event.key === "ArrowDown";
  if (!isLeft && !isRight && !isDown) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  if (event.shiftKey && (isLeft || isRight)) {
    event.preventDefault();
    const position = isLeft ? "before" : "after";
    const commentId = findExistingCommentIdAroundMove(state.pgnModel, moveId, position);
    if (commentId) {
      focusCommentById(commentId);
    }
    return true;
  }

  if (!event.shiftKey && isDown) {
    const firstVariationMoveId = Array.isArray(movePosition.variationFirstMoveIds)
      ? movePosition.variationFirstMoveIds[0]
      : null;
    if (!firstVariationMoveId) return false;
    event.preventDefault();
    selectMoveById(firstVariationMoveId);
    return true;
  }

  if (!event.shiftKey && isLeft && movePosition.isVariationStart && movePosition.parentMoveId) {
    event.preventDefault();
    selectMoveById(movePosition.parentMoveId);
    return true;
  }

  if (!isLeft && !isRight) return false;
  event.preventDefault();

  if (!Number.isInteger(movePosition.mainlinePly)) {
    if (isLeft) {
      const previousMoveId = movePosition.previousMoveId;
      if (previousMoveId) selectMoveById(previousMoveId);
      return true;
    }
    const nextMoveId = movePosition.nextMoveId;
    if (nextMoveId) selectMoveById(nextMoveId);
    return true;
  }

  const direction = isLeft ? -1 : 1;
  void gotoPly(state.currentPly + direction, { animate: false });
  return true;
};

const getTextEditorOptions = () => ({
  highlightCommentId: state.pendingFocusCommentId,
  selectedMoveId: state.selectedMoveId,
  onResolveExistingComment: (moveId, position) => findExistingCommentIdAroundMove(state.pgnModel, moveId, position),
  onCommentEdit: (commentId, editedText) => {
    const nextModel = !editedText.trim()
      ? removeCommentById(state.pgnModel, commentId)
      : setCommentTextById(state.pgnModel, commentId, editedText);
    applyPgnModelUpdate(nextModel);
  },
  onInsertComment: (moveId, position) => {
    const { model, insertedCommentId, created } = insertCommentAroundMove(state.pgnModel, moveId, position, "");
    state.selectedMoveId = moveId;
    state.pendingFocusCommentId = insertedCommentId;
    if (!created) {
      render();
      return;
    }
    applyPgnModelUpdate(model, insertedCommentId);
  },
  onMoveSelect: (moveId) => {
    selectMoveById(moveId);
  },
});

const focusCommentById = (commentId) => {
  if (!textEditorEl || !commentId) return false;
  const el = textEditorEl.querySelector(`[data-comment-id="${commentId}"]`);
  if (!el) return false;
  el.focus();
  const selection = window.getSelection();
  if (!selection) return true;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const render = () => {
  const game = buildGameAtPly(state.currentPly);
  renderBoard(game);

  if (!state.boardPreview) {
    if (state.currentPly <= 0) {
      state.selectedMoveId = null;
    } else {
      const selectedFromPly = Object.entries(state.movePositionById || {})
        .find(([, position]) => Number.isInteger(position?.mainlinePly) && position.mainlinePly === state.currentPly)?.[0] ?? null;
      state.selectedMoveId = selectedFromPly;
    }
  }

  if (statusEl) {
    statusEl.textContent = state.boardPreview
      ? `${t("status.label", "Position")}: preview`
      : `${t("status.label", "Position")}: ${state.currentPly}/${state.moves.length}`;
  }
  renderMoveList();
  if (errorEl) {
    errorEl.textContent = state.errorMessage;
  }
  text_editor.render(textEditorEl, state.pgnModel, getTextEditorOptions());
  ast_view.render(astViewEl, state.pgnModel);
  renderDomView();
  if (state.pendingFocusCommentId) {
    const focusTarget = state.pendingFocusCommentId;
    window.requestAnimationFrame(() => {
      if (focusCommentById(focusTarget)) {
        window.setTimeout(() => {
          const current = textEditorEl?.querySelector(`[data-comment-id="${focusTarget}"]`);
          if (current) current.classList.remove("text-editor-comment-new");
        }, 1600);
      }
    });
    state.pendingFocusCommentId = null;
  }

  const atStart = state.currentPly === 0;
  const atEnd = state.currentPly === state.moves.length;
  if (btnFirst) btnFirst.disabled = atStart || state.isAnimating;
  if (btnPrev) btnPrev.disabled = atStart || state.isAnimating;
  if (btnNext) btnNext.disabled = atEnd || state.isAnimating;
  if (btnLast) btnLast.disabled = atEnd || state.isAnimating;
  if (btnUndo) btnUndo.disabled = state.undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = state.redoStack.length === 0;
  if (speedValue) speedValue.textContent = String(state.moveDelayMs);
  const hasSelectedMove = Boolean(state.selectedMoveId && state.movePositionById?.[state.selectedMoveId]);
  if (btnCommentLeft) btnCommentLeft.disabled = !hasSelectedMove;
  if (btnCommentRight) btnCommentRight.disabled = !hasSelectedMove;
  if (btnLinebreak) btnLinebreak.disabled = !hasSelectedMove;
  if (btnIndent) btnIndent.disabled = !hasSelectedMove;
};

const gotoPly = async (nextPly, { animate = true } = {}) => {
  const bounded = Math.max(0, Math.min(nextPly, state.moves.length));
  if (bounded === state.currentPly) return;

  if (!animate) {
    state.animationRunId += 1;
    state.isAnimating = false;
    state.boardPreview = null;
    state.currentPly = bounded;
    render();
    return;
  }

  const direction = bounded > state.currentPly ? 1 : -1;
  const runId = ++state.animationRunId;
  state.boardPreview = null;
  state.isAnimating = true;
  render();

  try {
    while (state.currentPly !== bounded) {
      if (runId !== state.animationRunId) return;
      // Apply move immediately, then wait for the configured transition interval.
      state.currentPly += direction;
      render();
      const movedSan = direction > 0
        ? state.moves[state.currentPly - 1]
        : state.moves[state.currentPly];
      await playMoveSound(direction > 0, movedSan);
      if (state.moveDelayMs > 0) {
        await sleep(state.moveDelayMs);
      }
    }
  } finally {
    if (runId === state.animationRunId) {
      state.isAnimating = false;
      render();
    }
  }
};

const syncChessParseState = (source, { clearOnFailure = false } = {}) => {
  if (!source) {
    state.moves = [];
    state.verboseMoves = [];
    state.currentPly = 0;
    state.movePositionById = {};
    state.boardPreview = null;
    state.selectedMoveId = null;
    state.errorMessage = "";
    return;
  }
  try {
    const parser = new Chess();
    parser.loadPgn(source);
    state.moves = parser.history();
    state.verboseMoves = parser.history({ verbose: true });
    state.currentPly = Math.min(state.currentPly, state.moves.length);
    state.movePositionById = buildMovePositionById(state.pgnModel);
    if (state.selectedMoveId && !state.movePositionById[state.selectedMoveId]) state.selectedMoveId = null;
    state.boardPreview = null;
    state.errorMessage = "";
  } catch {
    try {
      const fallbackParser = new Chess();
      fallbackParser.loadPgn(stripAnnotationsForBoardParser(source));
      state.moves = fallbackParser.history();
      state.verboseMoves = fallbackParser.history({ verbose: true });
      state.currentPly = Math.min(state.currentPly, state.moves.length);
      state.movePositionById = buildMovePositionById(state.pgnModel);
      if (state.selectedMoveId && !state.movePositionById[state.selectedMoveId]) state.selectedMoveId = null;
      state.boardPreview = null;
      state.errorMessage = "";
    } catch {
      if (clearOnFailure) {
        state.errorMessage = "";
      } else {
        state.errorMessage = t("pgn.error", "Unable to parse PGN.");
        state.moves = [];
        state.verboseMoves = [];
        state.currentPly = 0;
        state.movePositionById = {};
        state.boardPreview = null;
        state.selectedMoveId = null;
      }
    }
  }
};

const loadPgn = () => {
  state.animationRunId += 1;
  state.isAnimating = false;
  const source = pgnInput ? pgnInput.value.trim() : "";
  state.pgnText = source;
  state.pgnModel = parsePgnToModel(source);
  syncChessParseState(source);
  state.statusMessage = state.errorMessage ? "" : t("pgn.loaded", "PGN loaded.");
  render();
};

const initializeWithDefaultPgn = () => {
  if (pgnInput) pgnInput.value = DEFAULT_PGN;
  loadPgn();
};

if (btnFirst) btnFirst.addEventListener("click", () => gotoPly(0, { animate: false }));
if (btnPrev) btnPrev.addEventListener("click", () => gotoPly(state.currentPly - 1));
if (btnNext) btnNext.addEventListener("click", () => gotoPly(state.currentPly + 1));
if (btnLast) btnLast.addEventListener("click", () => gotoPly(state.moves.length, { animate: false }));
if (btnLoad) btnLoad.addEventListener("click", loadPgn);
if (btnUndo) btnUndo.addEventListener("click", performUndo);
if (btnRedo) btnRedo.addEventListener("click", performRedo);
if (btnCommentLeft) btnCommentLeft.addEventListener("click", () => insertAroundSelectedMove("before", ""));
if (btnCommentRight) btnCommentRight.addEventListener("click", () => insertAroundSelectedMove("after", ""));
if (btnLinebreak) btnLinebreak.addEventListener("click", () => insertAroundSelectedMove("after", "\\n"));
if (btnIndent) btnIndent.addEventListener("click", () => insertAroundSelectedMove("after", "\\i"));
if (btnDefaultIndent) {
  btnDefaultIndent.addEventListener("click", () => {
    const nextModel = applyDefaultIndentDirectives(state.pgnModel);
    applyPgnModelUpdate(nextModel);
  });
}

if (speedInput) {
  speedInput.addEventListener("input", () => {
    state.moveDelayMs = Number(speedInput.value) || 0;
    if (speedValue) speedValue.textContent = String(state.moveDelayMs);
  });
}
if (soundInput) {
  soundInput.addEventListener("change", () => {
    state.soundEnabled = soundInput.checked;
  });
}

if (pgnInput) {
  pgnInput.addEventListener("input", () => {
    state.pgnText = pgnInput.value;
    state.pgnModel = parsePgnToModel(state.pgnText);
    // Do not keep stale parse errors while user is actively editing.
    syncChessParseState(state.pgnText.trim(), { clearOnFailure: true });
    text_editor.render(textEditorEl, state.pgnModel, getTextEditorOptions());
    ast_view.render(astViewEl, state.pgnModel);
    renderDomView();
    renderBoard(buildGameAtPly(state.currentPly));
    if (statusEl) {
      statusEl.textContent = `${t("status.label", "Position")}: ${state.currentPly}/${state.moves.length}`;
    }
    renderMoveList();
    if (errorEl) {
      errorEl.textContent = state.errorMessage;
    }
  });
  pgnInput.addEventListener("drop", () => {
    window.setTimeout(() => {
      loadPgn();
    }, 0);
  });
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLElement
    && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  ) {
    return;
  }
  if (handleSelectedMoveArrowHotkey(event)) return;
  const isModifierPressed = event.metaKey || event.ctrlKey;
  if (!isModifierPressed || event.altKey) return;
  const key = event.key.toLowerCase();
  const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
  const wantsUndo = key === "z" && !event.shiftKey;
  if (wantsUndo) {
    event.preventDefault();
    performUndo();
  } else if (wantsRedo) {
    event.preventDefault();
    performRedo();
  }
});

void hydrateVisualAssets();
ensureBoard().then(() => initializeWithDefaultPgn());
