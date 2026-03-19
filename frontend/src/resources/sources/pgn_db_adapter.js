import { extractPgnMetadata, PGN_STANDARD_METADATA_KEYS } from "./pgn_metadata.js";

/**
 * PGN database file source adapter.
 *
 * Integration API:
 * - Register via `createPgnDbSourceAdapter()` in source gateway.
 * - Supports `list({ sourceRef })` and `load(sourceRef)` for single `.pgn` files
 *   that store multiple games.
 *
 * Configuration API:
 * - `locator` is the absolute PGN file path.
 * - `recordId` is the 1-based game index inside that file.
 * - Runtime requires Tauri command `load_text_file`.
 *
 * Communication API:
 * - `list()` returns one row per game in the PGN file.
 * - `load()` returns PGN text for the selected game index.
 * - `save()` currently throws explicit not-implemented error.
 */

const isTauriRuntime = () => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let tauriInvokeFnPromise = null;

const getTauriInvoke = async () => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod) => mod.invoke);
  }
  return tauriInvokeFnPromise;
};

const tauriInvoke = async (command, payload = {}) => {
  const invoke = await getTauriInvoke();
  return invoke(command, payload);
};

const splitPgnDatabaseGames = (sourceText) => {
  const normalized = String(sourceText || "").replaceAll("\r\n", "\n").trim();
  if (!normalized) return [];
  const chunks = normalized.split(/(?=^\s*\[Event\s+")/m)
    .map((part) => part.trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks;
  return [normalized];
};

const deriveGameTitle = (pgnText, index) => {
  const { metadata } = extractPgnMetadata(pgnText);
  const eventName = String(metadata.Event || "").trim();
  const white = String(metadata.White || "").trim();
  const black = String(metadata.Black || "").trim();
  if (eventName && white && black) return `${eventName}: ${white} - ${black}`;
  if (white && black) return `${white} - ${black}`;
  if (eventName) return eventName;
  return `Game ${index + 1}`;
};

export const createPgnDbSourceAdapter = ({ invokeFn = null } = {}) => {
  const invokeResourceCommand = async (command, payload = {}) => {
    if (typeof invokeFn === "function") return invokeFn(command, payload);
    return tauriInvoke(command, payload);
  };

  const list = async (options = {}) => {
    const locator = String(options?.sourceRef?.locator || "").trim();
    if (!locator) return [];
    if (!isTauriRuntime()) {
      throw new Error("PGN database resources require Tauri runtime.");
    }
    const sourceText = await invokeResourceCommand("load_text_file", { filePath: locator });
    const games = splitPgnDatabaseGames(String(sourceText || ""));
    return games.map((gameText, index) => ({
      sourceRef: {
        kind: "pgn-db",
        locator,
        recordId: String(index + 1),
      },
      titleHint: deriveGameTitle(gameText, index),
      revisionToken: "",
      metadata: extractPgnMetadata(gameText).metadata,
      availableMetadataKeys: [...PGN_STANDARD_METADATA_KEYS],
    }));
  };

  const load = async (sourceRef) => {
    const locator = String(sourceRef?.locator || "").trim();
    const recordId = Number.parseInt(String(sourceRef?.recordId || ""), 10);
    if (!locator) throw new Error("PGN database source is missing locator.");
    if (!Number.isInteger(recordId) || recordId < 1) {
      throw new Error("PGN database source is missing recordId.");
    }
    if (!isTauriRuntime()) {
      throw new Error("PGN database resources require Tauri runtime.");
    }
    const sourceText = await invokeResourceCommand("load_text_file", { filePath: locator });
    const games = splitPgnDatabaseGames(String(sourceText || ""));
    const gameText = games[recordId - 1];
    if (!gameText) throw new Error("Selected game could not be found in PGN database file.");
    return {
      pgnText: gameText,
      revisionToken: String(Date.now()),
      titleHint: deriveGameTitle(gameText, recordId - 1),
    };
  };

  const save = async () => {
    throw new Error("Saving to PGN database files is not implemented yet.");
  };

  return {
    kind: "pgn-db",
    list,
    load,
    save,
  };
};

