import { Chess } from "chess.js";
import { Chessground } from "chessground";
import "chessground/assets/chessground.base.css";
import "./styles.css";
import { text_editor } from "./text_editor";
import { parsePgnToModel } from "./pgn_model";
import {
  findExistingCommentIdAroundMove,
  insertCommentAroundMove,
  removeCommentById,
  setCommentTextById,
} from "./pgn_commands";
import { serializeModelToPgn } from "./pgn_serialize";
import { ast_view } from "./ast_view";

const translations = {
  "app.title": "Chess PGN Viewer",
  "controls.first": "|<",
  "controls.prev": "<",
  "controls.next": ">",
  "controls.last": ">|",
  "controls.speed": "Move speed (ms)",
  "controls.sound": "Sound",
  "status.label": "Position",
  "pgn.label": "PGN input",
  "pgn.placeholder":
    "Paste or drop PGN text here.\n\nExample:\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
  "pgn.load": "Load PGN",
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

const DEFAULT_PGN = `[Event "Sample"]
[Site "Local"]
[Date "2026.03.10"]
[Round "-"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 (1. d4 d5 (1... Nf6 2. c4 e6) 2. c4) e5
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
  statusMessage: "",
  errorMessage: "",
  pendingFocusCommentId: null,
};

const app = document.querySelector("#app");
if (!app) throw new Error("App root missing.");

app.innerHTML = `
  <main class="app">
    <h1>${t("app.title", "Chess PGN Viewer")}</h1>
    <section class="app-panel">
      <div id="board" class="board merida"></div>
      <div class="controls">
        <button id="btn-first" type="button">${t("controls.first", "|<")}</button>
        <button id="btn-prev" type="button">${t("controls.prev", "<")}</button>
        <button id="btn-next" type="button">${t("controls.next", ">")}</button>
        <button id="btn-last" type="button">${t("controls.last", ">|")}</button>
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
          <p class="text-editor-title">${t("pgn.formatted.label", "text_editor")}</p>
          <div id="text-editor" class="text-editor"></div>
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
const btnLoad = document.querySelector("#btn-load");
const speedInput = document.querySelector("#speed-input");
const speedValue = document.querySelector("#speed-value");
const soundInput = document.querySelector("#sound-input");
const textEditorEl = document.querySelector("#text-editor");
const astViewEl = document.querySelector("#ast-view");
const domViewEl = document.querySelector("#dom-view");
let board = null;
let audioCtx = null;

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

const getTextEditorOptions = () => ({
  highlightCommentId: state.pendingFocusCommentId,
  onResolveExistingComment: (moveId, position) => findExistingCommentIdAroundMove(state.pgnModel, moveId, position),
  onCommentEdit: (commentId, editedText) => {
    if (!editedText.trim()) {
      state.pgnModel = removeCommentById(state.pgnModel, commentId);
    } else {
      state.pgnModel = setCommentTextById(state.pgnModel, commentId, editedText);
    }
    state.pgnText = serializeModelToPgn(state.pgnModel);
    if (pgnInput) pgnInput.value = state.pgnText;
    syncChessParseState(state.pgnText);
    render();
  },
  onInsertComment: (moveId, position) => {
    const { model, insertedCommentId, created } = insertCommentAroundMove(state.pgnModel, moveId, position, "");
    state.pgnModel = model;
    state.pendingFocusCommentId = insertedCommentId;
    if (!created) {
      render();
      return;
    }
    state.pgnText = serializeModelToPgn(state.pgnModel);
    if (pgnInput) pgnInput.value = state.pgnText;
    syncChessParseState(state.pgnText);
    render();
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

  if (statusEl) {
    statusEl.textContent = `${t("status.label", "Position")}: ${state.currentPly}/${state.moves.length}`;
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
  if (speedValue) speedValue.textContent = String(state.moveDelayMs);
};

const gotoPly = async (nextPly) => {
  const bounded = Math.max(0, Math.min(nextPly, state.moves.length));
  if (bounded === state.currentPly) return;

  const direction = bounded > state.currentPly ? 1 : -1;
  const runId = ++state.animationRunId;
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
    state.errorMessage = "";
    return;
  }
  try {
    const parser = new Chess();
    parser.loadPgn(source);
    state.moves = parser.history();
    state.verboseMoves = parser.history({ verbose: true });
    state.currentPly = Math.min(state.currentPly, state.moves.length);
    state.errorMessage = "";
  } catch {
    try {
      const fallbackParser = new Chess();
      fallbackParser.loadPgn(stripAnnotationsForBoardParser(source));
      state.moves = fallbackParser.history();
      state.verboseMoves = fallbackParser.history({ verbose: true });
      state.currentPly = Math.min(state.currentPly, state.moves.length);
      state.errorMessage = "";
    } catch {
      if (clearOnFailure) {
        state.errorMessage = "";
      } else {
        state.errorMessage = t("pgn.error", "Unable to parse PGN.");
        state.moves = [];
        state.verboseMoves = [];
        state.currentPly = 0;
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

if (btnFirst) btnFirst.addEventListener("click", () => gotoPly(0));
if (btnPrev) btnPrev.addEventListener("click", () => gotoPly(state.currentPly - 1));
if (btnNext) btnNext.addEventListener("click", () => gotoPly(state.currentPly + 1));
if (btnLast) btnLast.addEventListener("click", () => gotoPly(state.moves.length));
if (btnLoad) btnLoad.addEventListener("click", loadPgn);

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

ensureBoard().then(() => initializeWithDefaultPgn());
