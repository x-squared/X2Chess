/**
 * File source adapter.
 *
 * Integration API:
 * - `createFileSourceAdapter(deps)`
 *
 * Configuration API:
 * - Supports browser File System Access API and Tauri commands.
 *
 * Communication API:
 * - Returns source records and persists PGN content for file-backed games.
 */

/**
 * Determine whether browser directory picker API is available.
 *
 * @returns {boolean} True when `window.showDirectoryPicker` is supported.
 */
const supportsDirectoryPicker = () => typeof window.showDirectoryPicker === "function";

/**
 * Detect whether runtime is Tauri webview.
 *
 * @returns {boolean} True in Tauri runtime.
 */
const isTauriRuntime = () => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let tauriInvokeFnPromise = null;

/**
 * Lazily load Tauri invoke function.
 *
 * @returns {Promise<Function>} Invoke function.
 */
const getTauriInvoke = async () => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod) => mod.invoke);
  }
  return tauriInvokeFnPromise;
};

/**
 * Invoke a Tauri command.
 *
 * @param {string} command - Registered Rust command name.
 * @param {object} payload - Command payload.
 * @returns {Promise<unknown>} Command result.
 */
const tauriInvoke = async (command, payload = {}) => {
  const invoke = await getTauriInvoke();
  return invoke(command, payload);
};

/**
 * Ensure FS permission for browser file handles that expose permission methods.
 *
 * @param {FileSystemHandle|undefined|null} handle - Browser handle.
 * @param {"read"|"readwrite"} mode - Requested mode.
 * @returns {Promise<boolean>} True when permission is granted.
 */
const ensureFsPermission = async (handle, mode = "read") => {
  if (!handle || typeof handle.queryPermission !== "function" || typeof handle.requestPermission !== "function") {
    return true;
  }
  const descriptor = { mode };
  const current = await handle.queryPermission(descriptor);
  if (current === "granted") return true;
  const requested = await handle.requestPermission(descriptor);
  return requested === "granted";
};

/**
 * Join unix path segments.
 *
 * @param {...string} parts - Path segments.
 * @returns {string} Joined path.
 */
const pathJoinUnix = (...parts) => parts
  .filter(Boolean)
  .map((part, index) => {
    if (index === 0) return String(part).replace(/\/+$/, "");
    return String(part).replace(/^\/+|\/+$/g, "");
  })
  .filter(Boolean)
  .join("/");

/**
 * Resolve parent path.
 *
 * @param {string} pathValue - Input path.
 * @returns {string} Parent path.
 */
const pathParentUnix = (pathValue) => {
  const normalized = String(pathValue || "").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return normalized;
  return normalized.slice(0, index);
};

/**
 * Attempt to resolve nested directory handle.
 *
 * @param {FileSystemDirectoryHandle} parentHandle - Parent handle.
 * @param {string} childName - Child directory name.
 * @returns {Promise<FileSystemDirectoryHandle|null>} Child handle or null.
 */
const tryGetDirectoryHandle = async (parentHandle, childName) => {
  try {
    return await parentHandle.getDirectoryHandle(childName, { create: false });
  } catch {
    return null;
  }
};

/**
 * Resolve selected Tauri folder to root and games directory.
 *
 * @param {string} selectedPath - User-picked path.
 * @returns {Promise<{rootPath: string, gamesPath: string, folderName: string}|null>} Path metadata.
 */
const resolveTauriRootAndGamesDirectory = async (selectedPath) => {
  const selected = String(selectedPath || "").trim();
  if (!selected) return null;
  const selectedIsGames = selected.toLowerCase().endsWith("/games");
  if (selectedIsGames) {
    return {
      rootPath: pathParentUnix(selected),
      gamesPath: selected,
      folderName: selected.split("/").filter(Boolean).pop() || selected,
    };
  }
  const nestedGamesPath = pathJoinUnix(selected, "games");
  try {
    const nestedGames = await tauriInvoke("list_pgn_files", { gamesDirectory: nestedGamesPath });
    if (Array.isArray(nestedGames)) {
      return {
        rootPath: selected,
        gamesPath: nestedGamesPath,
        folderName: selected.split("/").filter(Boolean).pop() || selected,
      };
    }
  } catch {
    // Use selected folder as games root when nested folder does not exist.
  }
  return {
    rootPath: selected,
    gamesPath: selected,
    folderName: selected.split("/").filter(Boolean).pop() || selected,
  };
};

/**
 * Build a stable file source reference.
 *
 * @param {string} locator - Source locator (games directory).
 * @param {string} fileName - PGN file name.
 * @returns {{kind: string, locator: string, recordId: string}} File source reference.
 */
const createFileSourceRef = (locator, fileName) => ({
  kind: "file",
  locator,
  recordId: fileName,
});

/**
 * Create file source adapter.
 *
 * @param {object} deps - Adapter dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {object} File adapter with list/load/save/source-root helpers.
 */
export const createFileSourceAdapter = ({ state }) => {
  /**
   * Pick client games root in browser or Tauri runtime.
   *
   * @returns {Promise<{kind: string, rootPath: string, gamesPath: string, rootHandle?: FileSystemDirectoryHandle}|null>} Source root descriptor.
   */
  const pickSourceRoot = async () => {
    if (supportsDirectoryPicker()) {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const hasPermission = await ensureFsPermission(dirHandle, "readwrite");
      if (!hasPermission) throw new Error("Folder permission denied.");
      const gamesSubdir = await tryGetDirectoryHandle(dirHandle, "games");
      return {
        kind: "browser",
        rootPath: "",
        gamesPath: gamesSubdir ? "games" : "",
        rootHandle: dirHandle,
      };
    }
    if (isTauriRuntime()) {
      const selectedPath = await tauriInvoke("pick_games_directory");
      if (!selectedPath) return null;
      const resolved = await resolveTauriRootAndGamesDirectory(String(selectedPath));
      if (!resolved) return null;
      return {
        kind: "tauri",
        rootPath: resolved.rootPath,
        gamesPath: resolved.gamesPath,
      };
    }
    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  /**
   * Apply source root to state.
   *
   * @param {object} sourceRoot - Source root descriptor.
   */
  const applySourceRoot = (sourceRoot) => {
    if (!sourceRoot) return;
    if (sourceRoot.kind === "browser") {
      state.gameDirectoryHandle = sourceRoot.rootHandle || null;
      state.gameDirectoryPath = sourceRoot.gamesPath || "";
      state.gameRootPath = "";
      return;
    }
    state.gameDirectoryHandle = null;
    state.gameDirectoryPath = sourceRoot.gamesPath || "";
    state.gameRootPath = sourceRoot.rootPath || "";
  };

  /**
   * Detect default DEV games source root in Tauri runtime.
   *
   * @returns {Promise<object|null>} Source root descriptor or null.
   */
  const detectDefaultSourceRoot = async () => {
    if (!isTauriRuntime()) return null;
    const detectedGamesPath = await tauriInvoke("detect_default_games_directory");
    if (!detectedGamesPath) return null;
    const resolved = await resolveTauriRootAndGamesDirectory(String(detectedGamesPath));
    if (!resolved) return null;
    return {
      kind: "tauri",
      rootPath: resolved.rootPath,
      gamesPath: resolved.gamesPath,
    };
  };

  /**
   * List file-backed games from current source root.
   *
   * @returns {Promise<Array<{sourceRef: object, titleHint: string, revisionToken: string}>>} List of game descriptors.
   */
  const list = async () => {
    if (state.gameDirectoryHandle) {
      const gamesSubdir = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDir = gamesSubdir || state.gameDirectoryHandle;
      const entries = [];
      for await (const entry of gamesDir.values()) {
        if (!entry || entry.kind !== "file") continue;
        const fileName = String(entry.name || "");
        if (!fileName.toLowerCase().endsWith(".pgn")) continue;
        entries.push({
          sourceRef: createFileSourceRef("browser-handle", fileName),
          titleHint: fileName.replace(/\.[^.]+$/, ""),
          revisionToken: "",
        });
      }
      entries.sort((left, right) => left.titleHint.localeCompare(right.titleHint));
      return entries;
    }
    if (state.gameDirectoryPath && isTauriRuntime()) {
      const names = await tauriInvoke("list_pgn_files", { gamesDirectory: state.gameDirectoryPath });
      return (Array.isArray(names) ? names : [])
        .map((name) => String(name || ""))
        .filter(Boolean)
        .map((name) => ({
          sourceRef: createFileSourceRef(state.gameDirectoryPath, name),
          titleHint: name.replace(/\.[^.]+$/, ""),
          revisionToken: "",
        }));
    }
    return [];
  };

  /**
   * Load file-backed game content.
   *
   * @param {{locator?: string, recordId?: string}} sourceRef - File source reference.
   * @returns {Promise<{pgnText: string, revisionToken: string, titleHint: string}>} Loaded PGN payload.
   */
  const load = async (sourceRef) => {
    const fileName = String(sourceRef?.recordId || "");
    if (!fileName) throw new Error("File source is missing recordId.");
    if (state.gameDirectoryHandle) {
      const gamesSubdir = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDir = gamesSubdir || state.gameDirectoryHandle;
      const fileHandle = await gamesDir.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const pgnText = await file.text();
      return {
        pgnText,
        revisionToken: String(file.lastModified || ""),
        titleHint: fileName.replace(/\.[^.]+$/, ""),
      };
    }
    if (state.gameDirectoryPath && isTauriRuntime()) {
      const pgnText = await tauriInvoke("load_game_file", {
        gamesDirectory: state.gameDirectoryPath,
        fileName,
      });
      return {
        pgnText: String(pgnText || ""),
        revisionToken: String(Date.now()),
        titleHint: fileName.replace(/\.[^.]+$/, ""),
      };
    }
    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  /**
   * Save file-backed game content.
   *
   * @param {{locator?: string, recordId?: string}} sourceRef - File source reference.
   * @param {string} pgnText - Serialized PGN text.
   * @returns {Promise<{revisionToken: string}>} Save result.
   */
  const save = async (sourceRef, pgnText) => {
    const fileName = String(sourceRef?.recordId || "");
    if (!fileName) throw new Error("File source is missing recordId.");
    if (state.gameDirectoryHandle) {
      const gamesSubdir = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDir = gamesSubdir || state.gameDirectoryHandle;
      const fileHandle = await gamesDir.getFileHandle(fileName, { create: false });
      const hasPermission = await ensureFsPermission(fileHandle, "readwrite");
      if (!hasPermission) throw new Error("Write permission denied.");
      const writable = await fileHandle.createWritable();
      await writable.write(String(pgnText || ""));
      await writable.close();
      const file = await fileHandle.getFile();
      return { revisionToken: String(file.lastModified || Date.now()) };
    }
    if (state.gameDirectoryPath && isTauriRuntime()) {
      await tauriInvoke("save_game_file", {
        gamesDirectory: state.gameDirectoryPath,
        fileName,
        content: String(pgnText || ""),
      });
      return { revisionToken: String(Date.now()) };
    }
    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  return {
    kind: "file",
    applySourceRoot,
    detectDefaultSourceRoot,
    list,
    load,
    pickSourceRoot,
    save,
  };
};

