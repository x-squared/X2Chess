import type { TauriInvokeFn } from "../tauri_invoke_types";
import { extractPgnMetadata, PGN_STANDARD_METADATA_KEYS } from "./pgn_metadata.js";

/**
 * File source adapter.
 *
 * Integration API:
 * - Register via `createFileSourceAdapter({ state })`.
 * - Use adapter methods from the source gateway: `pickSourceRoot`, `list`,
 *   `load`, `save`, and optional DEV-root detection helpers.
 *
 * Configuration API:
 * - Runtime behavior depends on environment:
 *   - Browser: File System Access API handles/permissions.
 *   - Tauri: command-based file operations (`list_pgn_files`, `load_game_file`, ...).
 * - Source roots are configured by updating state (`gameDirectoryHandle`,
 *   `gameDirectoryPath`, `gameRootPath`) through `applySourceRoot`.
 *
 * Communication API:
 * - `list()` returns normalized file records with `sourceRef`.
 * - `load(sourceRef)` returns `{ pgnText, revisionToken, titleHint }`.
 * - `save(sourceRef, pgnText)` persists content and returns new `revisionToken`.
 * - Throws explicit errors for missing permissions/unsupported runtime.
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

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;

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
 * Resolve base file name from a path string.
 *
 * @param {string} pathValue - Full file path.
 * @returns {string} Base name.
 */
const pathBaseUnix = (pathValue) => String(pathValue || "")
  .replace(/\\/g, "/")
  .split("/")
  .filter(Boolean)
  .pop() || "";

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
 * Sanitize title into a filesystem-friendly base name.
 *
 * @param {string} rawTitle - Input title.
 * @returns {string} Safe base name without extension.
 */
const sanitizeFileTitle = (rawTitle) => {
  const normalized = String(rawTitle || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `imported-${Date.now()}`;
};

/**
 * Create file source adapter.
 *
 * @param {object} deps - Adapter dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {object} File adapter with list/load/save/source-root helpers.
 */
export const createFileSourceAdapter = ({ state }) => {
  const isPlaceholderLocator = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "" || normalized === "local-files";
  };

  const resolveLocator = (sourceRef) => {
    const locator = String(sourceRef?.locator || "").trim();
    if (locator && !isPlaceholderLocator(locator)) return locator;
    return String(state.gameDirectoryPath || "").trim();
  };

  /**
   * Pick client games root in browser or Tauri runtime.
   *
   * @returns {Promise<{kind: string, rootPath: string, gamesPath: string, rootHandle?: FileSystemDirectoryHandle}|null>} Source root descriptor.
   */
  const pickSourceRoot = async () => {
    if (supportsDirectoryPicker()) {
      const pickDir = window.showDirectoryPicker;
      if (!pickDir) throw new Error("Directory picker is not available.");
      const dirHandle = await pickDir({ mode: "readwrite" });
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
   * Pick resource target from a single button flow:
   * - first file picker (`.pgn`, `.sqlite`, `.db`, `.sqlite3`),
   * - then folder picker when file selection is canceled.
   *
   * @returns {Promise<{type: "folder", title: string, sourceRoot: object}|{type: "pgn-db"|"sqlite", title: string, locator: string}|null>} Picked target descriptor.
   */
  const pickResourceTarget = async () => {
    if (isTauriRuntime()) {
      const selectedFilePath = await tauriInvoke("pick_resource_file");
      const filePath = String(selectedFilePath || "").trim();
      if (filePath) {
        const baseName = pathBaseUnix(filePath);
        const extension = baseName.includes(".") ? (baseName.split(".").pop() || "").toLowerCase() : "";
        if (extension === "pgn") {
          return { type: "pgn-db", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
        }
        if (extension === "sqlite" || extension === "db" || extension === "sqlite3") {
          return { type: "sqlite", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
        }
        throw new Error("Unsupported resource file. Choose .pgn or SQLite (.sqlite/.db/.sqlite3).");
      }
      const folderRoot = await pickSourceRoot();
      if (!folderRoot) return null;
      const folderTitle = String(folderRoot.rootPath || folderRoot.gamesPath || "Local files")
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean)
        .pop() || "Local files";
      return {
        type: "folder",
        title: folderTitle,
        sourceRoot: folderRoot,
      };
    }
    if (supportsDirectoryPicker()) {
      const folderRoot = await pickSourceRoot();
      if (!folderRoot) return null;
      return {
        type: "folder",
        title: "Local files",
        sourceRoot: folderRoot,
      };
    }
    throw new Error("Local folder/file access is not supported in this browser runtime.");
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
  const list = async (options: Record<string, unknown> = {}) => {
    const sourceRef = options?.sourceRef as { locator?: string } | undefined;
    const preferredLocatorRaw = String(sourceRef?.locator || "").trim();
    const preferredLocator = isPlaceholderLocator(preferredLocatorRaw) ? "" : preferredLocatorRaw;
    const canUseBrowserHandle = !preferredLocator || preferredLocator === "browser-handle";
    if (state.gameDirectoryHandle) {
      if (!canUseBrowserHandle) return [];
      const gamesSubdir = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDir = gamesSubdir || state.gameDirectoryHandle;
      const entries: Array<{
        sourceRef: ReturnType<typeof createFileSourceRef>;
        titleHint: string;
        revisionToken: string;
        metadata: Record<string, string>;
        availableMetadataKeys: readonly string[];
      }> = [];
      for await (const entry of gamesDir.values()) {
        if (!entry || entry.kind !== "file") continue;
        const fileName = String(entry.name || "");
        if (!fileName.toLowerCase().endsWith(".pgn")) continue;
        let metadataPayload = {
          metadata: {},
          availableMetadataKeys: [...PGN_STANDARD_METADATA_KEYS],
        };
        try {
          const file = await entry.getFile();
          metadataPayload = extractPgnMetadata(await file.text());
        } catch {
          // Keep listing robust; metadata is optional.
        }
        entries.push({
          sourceRef: createFileSourceRef("browser-handle", fileName),
          titleHint: fileName.replace(/\.[^.]+$/, ""),
          revisionToken: "",
          metadata: metadataPayload.metadata,
          availableMetadataKeys: metadataPayload.availableMetadataKeys,
        });
      }
      entries.sort((left, right) => left.titleHint.localeCompare(right.titleHint));
      return entries;
    }
    const effectiveDirectory = preferredLocator || state.gameDirectoryPath;
    if (effectiveDirectory && isTauriRuntime()) {
      const names = await tauriInvoke("list_pgn_files", { gamesDirectory: effectiveDirectory });
      const normalizedNames = (Array.isArray(names) ? names : [])
        .map((name) => String(name || ""))
        .filter(Boolean);
      const results: Array<{
        sourceRef: ReturnType<typeof createFileSourceRef>;
        titleHint: string;
        revisionToken: string;
        metadata: Record<string, string>;
        availableMetadataKeys: readonly string[];
      }> = [];
      // Resolve metadata per file to enable formal metadata contract.
      for (const name of normalizedNames) {
        let metadataPayload = {
          metadata: {},
          availableMetadataKeys: [...PGN_STANDARD_METADATA_KEYS],
        };
        try {
          const content = await tauriInvoke("load_game_file", {
            gamesDirectory: effectiveDirectory,
            fileName: name,
          });
          metadataPayload = extractPgnMetadata(String(content || ""));
        } catch {
          // Continue listing when metadata extraction fails for a single file.
        }
        results.push({
          sourceRef: createFileSourceRef(effectiveDirectory, name),
          titleHint: name.replace(/\.[^.]+$/, ""),
          revisionToken: "",
          metadata: metadataPayload.metadata,
          availableMetadataKeys: metadataPayload.availableMetadataKeys,
        });
      }
      return results;
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
    const locator = resolveLocator(sourceRef);
    if (state.gameDirectoryHandle) {
      if (locator && locator !== "browser-handle") {
        throw new Error("Browser runtime cannot load dropped files from arbitrary paths.");
      }
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
    if (locator && isTauriRuntime()) {
      const pgnText = await tauriInvoke("load_game_file", {
        gamesDirectory: locator,
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
    const locator = resolveLocator(sourceRef);
    const createIfMissing = Boolean(sourceRef?.createIfMissing);
    if (state.gameDirectoryHandle) {
      if (locator && locator !== "browser-handle") {
        throw new Error("Browser runtime cannot save dropped files from arbitrary paths.");
      }
      const gamesSubdir = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDir = gamesSubdir || state.gameDirectoryHandle;
      const fileHandle = await gamesDir.getFileHandle(fileName, { create: createIfMissing });
      const hasPermission = await ensureFsPermission(fileHandle, "readwrite");
      if (!hasPermission) throw new Error("Write permission denied.");
      const writable = await fileHandle.createWritable();
      await writable.write(String(pgnText || ""));
      await writable.close();
      const file = await fileHandle.getFile();
      return { revisionToken: String(file.lastModified || Date.now()) };
    }
    if (locator && isTauriRuntime()) {
      await tauriInvoke("save_game_file", {
        gamesDirectory: locator,
        fileName,
        content: String(pgnText || ""),
      });
      return { revisionToken: String(Date.now()) };
    }
    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  /**
   * Create and persist a new game in a target file resource.
   *
   * @param {{locator?: string}|null} resourceRef - Target file resource.
   * @param {string} pgnText - PGN content.
   * @param {string} [titleHint=""] - Preferred title for new filename.
   * @returns {Promise<{sourceRef: object, revisionToken: string, titleHint: string}>} Created game descriptor.
   */
  const createInResource = async (resourceRef, pgnText, titleHint = "") => {
    const locator = String(resourceRef?.locator || "").trim() || String(state.gameDirectoryPath || "").trim();
    if (!locator && !state.gameDirectoryHandle) {
      throw new Error("No active file resource is available to store imported text.");
    }
    const baseName = sanitizeFileTitle(titleHint || "imported-game");
    const fileName = `${baseName}.pgn`;
    const sourceRef = createFileSourceRef(locator || "browser-handle", fileName);
    await save({ ...sourceRef, createIfMissing: true }, pgnText);
    return {
      sourceRef,
      revisionToken: String(Date.now()),
      titleHint: baseName,
    };
  };

  return {
    kind: "file",
    applySourceRoot,
    detectDefaultSourceRoot,
    list,
    load,
    createInResource,
    pickResourceTarget,
    pickSourceRoot,
    save,
  };
};

