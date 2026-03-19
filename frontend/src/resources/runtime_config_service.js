/**
 * Runtime config service.
 *
 * Integration API:
 * - `createRuntimeConfigService(deps)`
 *
 * Configuration API:
 * - Merges default config with optional user override from local runtime data.
 *
 * Communication API:
 * - Returns config objects; caller applies them to UI runtime.
 */

const DEFAULT_APP_CONFIG = {
  ui: {
    locale: "en",
  },
  textEditor: {
    fontSizePx: 14,
    lineHeight: 1.45,
    maxHeightVh: 62,
    showAstView: true,
    showDomView: true,
  },
};

/**
 * Deep-merge plain-object overrides.
 *
 * @param {object} base - Baseline object.
 * @param {object} partial - Partial override.
 * @returns {object} Merged object.
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
 * Invoke Tauri command.
 *
 * @param {string} command - Command name.
 * @param {object} payload - Command payload.
 * @returns {Promise<unknown>} Command result.
 */
const tauriInvoke = async (command, payload = {}) => {
  const invoke = await getTauriInvoke();
  return invoke(command, payload);
};

/**
 * Attempt to read nested directory handle.
 *
 * @param {FileSystemDirectoryHandle} parentHandle - Parent directory.
 * @param {string} childName - Child directory name.
 * @returns {Promise<FileSystemDirectoryHandle|null>} Child or null.
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
 * @param {FileSystemDirectoryHandle} parentHandle - Parent directory.
 * @param {string} childName - Child file name.
 * @returns {Promise<FileSystemFileHandle|null>} Child or null.
 */
const tryGetFileHandle = async (parentHandle, childName) => {
  try {
    return await parentHandle.getFileHandle(childName, { create: false });
  } catch {
    return null;
  }
};

/**
 * Read text from path segments under a browser directory handle.
 *
 * @param {FileSystemDirectoryHandle} rootDirHandle - Root directory handle.
 * @param {string[]} pathSegments - Relative path.
 * @returns {Promise<string|null>} File text or null.
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
 * Create runtime config service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {{loadRuntimeConfigFromClientData: Function, loadRuntimeConfigFromClientDataAndDefaults: Function}} Service API.
 */
export const createRuntimeConfigService = ({ state }) => {
  /**
   * Load config from local runtime data area.
   *
   * @returns {Promise<object>} Resolved runtime config object.
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
      return resolvedConfig;
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
      return resolvedConfig;
    }
    return resolvedConfig;
  };

  /**
   * Load runtime config after source-root preloading has been attempted.
   *
   * @returns {Promise<object>} Resolved runtime config.
   */
  const loadRuntimeConfigFromClientDataAndDefaults = async () => loadRuntimeConfigFromClientData();

  return {
    loadRuntimeConfigFromClientData,
    loadRuntimeConfigFromClientDataAndDefaults,
  };
};

