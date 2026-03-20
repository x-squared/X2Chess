import type { TauriInvokeFn } from "./tauri_invoke_types";

type RuntimeConfig = {
  ui: {
    locale: string;
  };
  textEditor: {
    fontSizePx: number;
    lineHeight: number;
    maxHeightVh: number;
    showAstView: boolean;
    showDomView: boolean;
  };
};

type RuntimeConfigState = {
  gameDirectoryHandle: unknown | null;
  gameRootPath: string;
};

type DirectoryHandleLike = {
  getDirectoryHandle?: (name: string, options: { create: boolean }) => Promise<unknown>;
  getFileHandle?: (name: string, options: { create: boolean }) => Promise<unknown>;
};

type FileHandleLike = {
  getFile?: () => Promise<{ text: () => Promise<string> }>;
};

type RuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
};

const DEFAULT_APP_CONFIG: RuntimeConfig = {
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const deepMergeObject = (base: Record<string, unknown>, partial: unknown): Record<string, unknown> => {
  const left: Record<string, unknown> = isPlainObject(base) ? base : {};
  const right: Record<string, unknown> = isPlainObject(partial) ? partial : {};
  const merged: Record<string, unknown> = { ...left };
  Object.keys(right).forEach((key: string): void => {
    const leftVal: unknown = left[key];
    const rightVal: unknown = right[key];
    const shouldRecurse: boolean = isPlainObject(leftVal) && isPlainObject(rightVal);
    merged[key] = shouldRecurse
      ? deepMergeObject(leftVal as Record<string, unknown>, rightVal)
      : rightVal;
  });
  return merged;
};

const isTauriRuntime = (): boolean => {
  const runtimeWindow: RuntimeWindow = window as RuntimeWindow;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;

const getTauriInvoke = async (): Promise<TauriInvokeFn> => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod): TauriInvokeFn => mod.invoke as TauriInvokeFn);
  }
  return tauriInvokeFnPromise;
};

const tauriInvoke = async (command: string, payload: Record<string, unknown> = {}): Promise<unknown> => {
  const invokeFn: TauriInvokeFn = await getTauriInvoke();
  return invokeFn(command, payload);
};

const asDirectoryHandle = (value: unknown): DirectoryHandleLike | null => {
  if (!value || typeof value !== "object") return null;
  const candidate: DirectoryHandleLike = value as DirectoryHandleLike;
  if (typeof candidate.getDirectoryHandle !== "function" || typeof candidate.getFileHandle !== "function") {
    return null;
  }
  return candidate;
};

const asFileHandle = (value: unknown): FileHandleLike | null => {
  if (!value || typeof value !== "object") return null;
  const candidate: FileHandleLike = value as FileHandleLike;
  if (typeof candidate.getFile !== "function") return null;
  return candidate;
};

const tryGetDirectoryHandle = async (parentHandle: unknown, childName: string): Promise<unknown | null> => {
  const directoryHandle: DirectoryHandleLike | null = asDirectoryHandle(parentHandle);
  if (!directoryHandle || typeof directoryHandle.getDirectoryHandle !== "function") return null;
  try {
    return await directoryHandle.getDirectoryHandle(childName, { create: false });
  } catch {
    return null;
  }
};

const tryGetFileHandle = async (parentHandle: unknown, childName: string): Promise<unknown | null> => {
  const directoryHandle: DirectoryHandleLike | null = asDirectoryHandle(parentHandle);
  if (!directoryHandle || typeof directoryHandle.getFileHandle !== "function") return null;
  try {
    return await directoryHandle.getFileHandle(childName, { create: false });
  } catch {
    return null;
  }
};

const readTextFromHandlePath = async (rootDirHandle: unknown, pathSegments: string[]): Promise<string | null> => {
  let dir: unknown = rootDirHandle;
  for (let index: number = 0; index < pathSegments.length - 1; index += 1) {
    dir = await tryGetDirectoryHandle(dir, pathSegments[index]);
    if (!dir) return null;
  }
  const fileHandleRaw: unknown | null = await tryGetFileHandle(dir, pathSegments[pathSegments.length - 1]);
  const fileHandle: FileHandleLike | null = asFileHandle(fileHandleRaw);
  if (!fileHandle || typeof fileHandle.getFile !== "function") return null;
  const file = await fileHandle.getFile();
  return file.text();
};

export const createRuntimeConfigService = ({ state }: { state: RuntimeConfigState }) => {
  const loadRuntimeConfigFromClientData = async (): Promise<Record<string, unknown>> => {
    let resolvedConfig: Record<string, unknown> = deepMergeObject({}, DEFAULT_APP_CONFIG as Record<string, unknown>);

    if (state.gameDirectoryHandle) {
      try {
        const rawUserConfig: string | null = await readTextFromHandlePath(state.gameDirectoryHandle, [
          "config",
          "user-config.json",
        ]);
        if (rawUserConfig) {
          const partial: unknown = JSON.parse(rawUserConfig);
          resolvedConfig = deepMergeObject(resolvedConfig, partial);
        }
      } catch (error: unknown) {
        console.warn("[X2Chess] user config ignored:", error);
      }
      return resolvedConfig;
    }

    if (state.gameRootPath && isTauriRuntime()) {
      try {
        const rawUserConfig: unknown = await tauriInvoke("load_user_config", { rootDirectory: state.gameRootPath });
        if (rawUserConfig) {
          const partial: unknown = JSON.parse(String(rawUserConfig));
          resolvedConfig = deepMergeObject(resolvedConfig, partial);
        }
      } catch (error: unknown) {
        console.warn("[X2Chess] user config ignored:", error);
      }
      return resolvedConfig;
    }

    return resolvedConfig;
  };

  const loadRuntimeConfigFromClientDataAndDefaults = async (): Promise<Record<string, unknown>> =>
    loadRuntimeConfigFromClientData();

  return {
    loadRuntimeConfigFromClientData,
    loadRuntimeConfigFromClientDataAndDefaults,
  };
};
