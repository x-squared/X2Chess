/**
 * Resources component.
 *
 * Integration API:
 * - `createResourcesCapabilities(deps)` returns runtime resource/file access methods.
 *
 * Configuration API:
 * - Uses built-in default app config merged with optional `user-config.json` overrides.
 * - Debounce timing is configurable via `deps.autosaveDebounceMs`.
 *
 * Communication API:
 * - Mutates shared runtime state (`deps.state`) and calls host callbacks for UI updates.
 * - Uses browser File System Access API and Tauri commands for local file handling.
 */

const DEFAULT_APP_CONFIG = {
  textEditor: {
    fontSizePx: 14,
    lineHeight: 1.45,
    maxHeightVh: 62,
    showAstView: true,
    showDomView: true,
  },
};

/**
 * Recursively merge plain object values from `partial` into `base`.
 *
 * @param {object} base - Baseline object used as merge root.
 * @param {object} partial - Partial override values.
 * @returns {object} New merged object.
 */
const deepMergeObject = (base, partial) => {
  const left = base && typeof base === "object" && !Array.isArray(base) ? base : {};
  const right = partial && typeof partial === "object" && !Array.isArray(partial) ? partial : {};
  const merged = { ...left };
  Object.keys(right).forEach((key) => {
    const leftVal = left[key];
    const rightVal = right[key];
    const shouldRecurse = (
      leftVal
      && typeof leftVal === "object"
      && !Array.isArray(leftVal)
      && rightVal
      && typeof rightVal === "object"
      && !Array.isArray(rightVal)
    );
    merged[key] = shouldRecurse ? deepMergeObject(leftVal, rightVal) : rightVal;
  });
  return merged;
};

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
 * @param {object} payload - Command payload object.
 * @returns {Promise<unknown>} Command result.
 */
const tauriInvoke = async (command, payload = {}) => {
  const invoke = await getTauriInvoke();
  return invoke(command, payload);
};

/**
 * Join path segments with unix separators.
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
 * Resolve parent directory path.
 *
 * @param {string} pathValue - Input unix path.
 * @returns {string} Parent path.
 */
const pathParentUnix = (pathValue) => {
  const normalized = String(pathValue || "").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return normalized;
  return normalized.slice(0, index);
};

/**
 * Ensure file-system permission for file handles that support permission APIs.
 *
 * @param {FileSystemHandle} handle - Browser file/directory handle.
 * @param {"read"|"readwrite"} mode - Requested permission mode.
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
 * Attempt to read nested directory handle.
 *
 * @param {FileSystemDirectoryHandle} parentHandle - Parent directory handle.
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
 * Attempt to read nested file handle.
 *
 * @param {FileSystemDirectoryHandle} parentHandle - Parent directory handle.
 * @param {string} childName - Child file name.
 * @returns {Promise<FileSystemFileHandle|null>} Child file handle or null.
 */
const tryGetFileHandle = async (parentHandle, childName) => {
  try {
    return await parentHandle.getFileHandle(childName, { create: false });
  } catch {
    return null;
  }
};

/**
 * Create runtime resource capabilities.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state object.
 * @param {Function} deps.t - Translation resolver `(key, fallback) => string`.
 * @param {Function} deps.onRenderGameSelect - Callback to re-render game select UI.
 * @param {Function} deps.onSetSaveStatus - Callback `(message, kind)` for save status.
 * @param {Function} deps.onApplyRuntimeConfig - Callback receiving merged runtime config.
 * @param {Function} deps.onLoadPgn - Callback to parse and render loaded PGN.
 * @param {Function} deps.onInitializeWithDefaultPgn - Callback to initialize default PGN.
 * @param {Function} deps.getPgnText - Callback returning latest PGN text to persist.
 * @param {HTMLTextAreaElement|null} deps.pgnInput - PGN textarea element.
 * @param {HTMLSelectElement|null} deps.gameSelect - Game select element.
 * @param {number} deps.autosaveDebounceMs - Autosave debounce delay in milliseconds.
 * @returns {object} Runtime file/config capabilities.
 */
export const createResourcesCapabilities = ({
  state,
  t,
  onRenderGameSelect,
  onSetSaveStatus,
  onApplyRuntimeConfig,
  onLoadPgn,
  onInitializeWithDefaultPgn,
  getPgnText,
  pgnInput,
  gameSelect,
  autosaveDebounceMs = 700,
}) => {
  /**
   * Resolve current browser-selected games directory (`games/` or root).
   *
   * @returns {Promise<FileSystemDirectoryHandle|null>} Directory handle containing PGN files.
   */
  const getGamesDirectoryHandle = async () => {
    const rootDir = state.gameDirectoryHandle;
    if (!rootDir) return null;
    const gamesSubdir = await tryGetDirectoryHandle(rootDir, "games");
    return gamesSubdir || rootDir;
  };

  /**
   * Read text file relative to root handle.
   *
   * @param {FileSystemDirectoryHandle} rootDirHandle - Root directory handle.
   * @param {string[]} pathSegments - Relative path segments.
   * @returns {Promise<string|null>} File text content or null when not found.
   */
  const readTextFromHandlePath = async (rootDirHandle, pathSegments) => {
    let dir = rootDirHandle;
    for (let i = 0; i < pathSegments.length - 1; i += 1) {
      dir = await tryGetDirectoryHandle(dir, pathSegments[i]);
      if (!dir) return null;
    }
    const fileHandle = await tryGetFileHandle(dir, pathSegments[pathSegments.length - 1]);
    if (!fileHandle) return null;
    const file = await fileHandle.getFile();
    return file.text();
  };

  /**
   * Resolve selected Tauri folder to root and games directory paths.
   *
   * @param {string} selectedPath - User-selected directory path.
   * @returns {Promise<{rootPath: string, gamesPath: string, folderName: string}|null>} Resolved path info.
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
      // Fall through to selected folder as games directory.
    }
    return {
      rootPath: selected,
      gamesPath: selected,
      folderName: selected.split("/").filter(Boolean).pop() || selected,
    };
  };

  /**
   * Load and apply runtime config from default + optional user override.
   */
  const loadRuntimeConfigFromClientData = async () => {
    let resolvedConfig = deepMergeObject({}, DEFAULT_APP_CONFIG);
    if (state.gameDirectoryHandle) {
      try {
        const rawUserConfig = await readTextFromHandlePath(state.gameDirectoryHandle, ["config", "user-config.json"]);
        if (rawUserConfig) {
          const partial = JSON.parse(rawUserConfig);
          resolvedConfig = deepMergeObject(resolvedConfig, partial);
        }
      } catch (error) {
        console.warn("[X2Chess] user config ignored:", error);
      }
      onApplyRuntimeConfig(resolvedConfig);
      return;
    }
    if (state.gameRootPath && isTauriRuntime()) {
      try {
        const rawUserConfig = await tauriInvoke("load_user_config", { rootDirectory: state.gameRootPath });
        if (rawUserConfig) {
          const partial = JSON.parse(String(rawUserConfig));
          resolvedConfig = deepMergeObject(resolvedConfig, partial);
        }
      } catch (error) {
        console.warn("[X2Chess] user config ignored:", error);
      }
      onApplyRuntimeConfig(resolvedConfig);
      return;
    }
    onApplyRuntimeConfig(resolvedConfig);
  };

  /**
   * Clear game file index in shared state and refresh select UI.
   */
  const clearGameLibraryState = () => {
    state.gameFileHandles = {};
    state.gameFiles = [];
    onRenderGameSelect();
  };

  /**
   * Fetch PGN file list from browser-selected folder.
   *
   * @returns {Promise<string[]>} Sorted PGN file names.
   */
  const fetchBrowserGameFilesFromClientData = async () => {
    const gamesDir = await getGamesDirectoryHandle();
    if (!gamesDir) {
      clearGameLibraryState();
      return [];
    }
    const files = [];
    const handlesByName = {};
    for await (const entry of gamesDir.values()) {
      if (!entry || entry.kind !== "file") continue;
      const fileName = String(entry.name || "");
      if (!fileName.toLowerCase().endsWith(".pgn")) continue;
      handlesByName[fileName] = entry;
      files.push(fileName);
    }
    files.sort((a, b) => a.localeCompare(b));
    state.gameFileHandles = handlesByName;
    state.gameFiles = files;
    onRenderGameSelect();
    return files;
  };

  /**
   * Fetch PGN file list from Tauri-selected folder.
   *
   * @returns {Promise<string[]>} PGN file names.
   */
  const fetchTauriGameFilesFromClientData = async () => {
    if (!state.gameDirectoryPath) {
      clearGameLibraryState();
      return [];
    }
    const files = await tauriInvoke("list_pgn_files", { gamesDirectory: state.gameDirectoryPath });
    const names = Array.isArray(files) ? files.map((value) => String(value || "")).filter(Boolean) : [];
    const index = {};
    names.forEach((name) => {
      index[name] = name;
    });
    state.gameFileHandles = index;
    state.gameFiles = names;
    onRenderGameSelect();
    return names;
  };

  /**
   * Fetch PGN file list from currently configured local source.
   *
   * @returns {Promise<string[]>} PGN file names.
   */
  const fetchGameFilesFromClientData = async () => {
    if (state.gameDirectoryHandle) return fetchBrowserGameFilesFromClientData();
    if (state.gameDirectoryPath && isTauriRuntime()) return fetchTauriGameFilesFromClientData();
    clearGameLibraryState();
    return [];
  };

  /**
   * Set browser-selected client data root and refresh config/game list.
   *
   * @param {FileSystemDirectoryHandle} dirHandle - Selected directory handle.
   * @returns {Promise<string[]>} Available PGN files.
   */
  const setClientDataRootBrowser = async (dirHandle) => {
    state.gameDirectoryHandle = dirHandle;
    state.gameDirectoryPath = "";
    state.gameRootPath = "";
    state.selectedGameFile = "";
    await loadRuntimeConfigFromClientData();
    return fetchGameFilesFromClientData();
  };

  /**
   * Set Tauri-selected client data root and refresh config/game list.
   *
   * @param {string} selectedPath - Selected directory path.
   * @returns {Promise<string[]>} Available PGN files.
   */
  const setClientDataRootTauri = async (selectedPath) => {
    const resolved = await resolveTauriRootAndGamesDirectory(selectedPath);
    if (!resolved) return [];
    state.gameDirectoryHandle = null;
    state.gameDirectoryPath = resolved.gamesPath;
    state.gameRootPath = resolved.rootPath;
    state.selectedGameFile = "";
    await loadRuntimeConfigFromClientData();
    return fetchGameFilesFromClientData();
  };

  /**
   * Preload default Tauri DEV games folder when available.
   *
   * @returns {Promise<boolean>} True when preload succeeded with at least one game.
   */
  const loadDefaultTauriDevFolder = async () => {
    if (!isTauriRuntime()) return false;
    try {
      const detectedGamesPath = await tauriInvoke("detect_default_games_directory");
      if (!detectedGamesPath) return false;
      const files = await setClientDataRootTauri(String(detectedGamesPath));
      if (files.length === 0) return false;
      await loadGameByName(files[0]);
      onSetSaveStatus(`${t("pgn.source.folderSelected", "Folder")}: ${String(detectedGamesPath)}`, "");
      return true;
    } catch (error) {
      console.warn("[X2Chess] unable to preload DEV games folder:", error);
      return false;
    }
  };

  /**
   * Initialize runtime config, including default Tauri preload attempt.
   */
  const loadRuntimeConfigFromClientDataAndDefaults = async () => {
    await loadDefaultTauriDevFolder();
    await loadRuntimeConfigFromClientData();
  };

  /**
   * Load selected PGN file from configured local source.
   *
   * @param {string} fileName - Selected PGN file name.
   */
  const loadGameByName = async (fileName) => {
    if (!fileName) return;
    const fileRef = state.gameFileHandles[fileName];
    if (!fileRef) {
      throw new Error(t("pgn.source.fileMissing", "Selected game file is no longer available."));
    }
    const content = await (async () => {
      if (state.gameDirectoryHandle) {
        const file = await fileRef.getFile();
        return file.text();
      }
      if (state.gameDirectoryPath && isTauriRuntime()) {
        return tauriInvoke("load_game_file", {
          gamesDirectory: state.gameDirectoryPath,
          fileName,
        });
      }
      throw new Error(t("pgn.source.unsupported", "Local folder access is not supported in this browser runtime."));
    })();
    state.isHydratingGame = true;
    try {
      state.selectedGameFile = fileName;
      if (gameSelect) gameSelect.value = fileName;
      if (pgnInput) pgnInput.value = content;
      onLoadPgn();
      onSetSaveStatus("", "");
    } finally {
      state.isHydratingGame = false;
    }
  };

  /**
   * Persist currently selected game file content immediately.
   */
  const persistSelectedGameNow = async () => {
    const fileName = state.selectedGameFile;
    if (!fileName) return;
    const fileRef = state.gameFileHandles[fileName];
    if (!fileRef) {
      onSetSaveStatus(t("pgn.source.fileMissing", "Selected game file is no longer available."), "error");
      return;
    }
    const requestId = ++state.saveRequestSeq;
    onSetSaveStatus(t("pgn.save.saving", "Saving..."), "saving");
    try {
      if (state.gameDirectoryHandle) {
        const hasPermission = await ensureFsPermission(fileRef, "readwrite");
        if (!hasPermission) throw new Error("Write permission denied.");
        const writable = await fileRef.createWritable();
        await writable.write(getPgnText());
        await writable.close();
      } else if (state.gameDirectoryPath && isTauriRuntime()) {
        await tauriInvoke("save_game_file", {
          gamesDirectory: state.gameDirectoryPath,
          fileName,
          content: getPgnText(),
        });
      } else {
        throw new Error(t("pgn.source.unsupported", "Local folder access is not supported in this browser runtime."));
      }
      if (requestId !== state.saveRequestSeq) return;
      onSetSaveStatus(t("pgn.save.saved", "Saved"), "saved");
    } catch (error) {
      if (requestId !== state.saveRequestSeq) return;
      onSetSaveStatus(
        `${t("pgn.save.error", "Autosave failed")}: ${String(error?.message || "")}`.trim(),
        "error",
      );
    }
  };

  /**
   * Debounce autosave for selected local game file.
   */
  const scheduleAutosave = () => {
    if (state.isHydratingGame) return;
    if (!state.selectedGameFile) return;
    if (state.autosaveTimer) {
      window.clearTimeout(state.autosaveTimer);
      state.autosaveTimer = null;
    }
    state.autosaveTimer = window.setTimeout(() => {
      state.autosaveTimer = null;
      void persistSelectedGameNow();
    }, autosaveDebounceMs);
  };

  /**
   * Open local folder picker and initialize game list from selected folder.
   */
  const chooseClientGamesFolder = async () => {
    try {
      let files = [];
      let folderLabel = "";
      if (supportsDirectoryPicker()) {
        const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        const hasPermission = await ensureFsPermission(dirHandle, "readwrite");
        if (!hasPermission) throw new Error("Folder permission denied.");
        files = await setClientDataRootBrowser(dirHandle);
        folderLabel = `${t("pgn.source.folderSelected", "Folder")}: ${dirHandle.name}`;
      } else if (isTauriRuntime()) {
        const selectedPath = await tauriInvoke("pick_games_directory");
        if (!selectedPath) return;
        files = await setClientDataRootTauri(String(selectedPath));
        folderLabel = `${t("pgn.source.folderSelected", "Folder")}: ${String(selectedPath)}`;
      } else {
        onSetSaveStatus(
          t("pgn.source.unsupported", "Local folder access is not supported in this browser runtime."),
          "error",
        );
        return;
      }
      if (files.length > 0) {
        await loadGameByName(files[0]);
        onSetSaveStatus(folderLabel, "");
      } else {
        onSetSaveStatus(`${folderLabel} (${t("pgn.source.folderHint", "Choose a local folder (for example run/DEV).")})`, "");
        onInitializeWithDefaultPgn();
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      onSetSaveStatus(String(error?.message || t("pgn.save.error", "Autosave failed")), "error");
    }
  };

  return {
    chooseClientGamesFolder,
    fetchGameFilesFromClientData,
    loadGameByName,
    loadRuntimeConfigFromClientDataAndDefaults,
    scheduleAutosave,
  };
};
