import type { FsGateway } from "../../../../../parts/resource/src/io/fs_gateway";
import type { DbGateway } from "../../../../../parts/resource/src/io/db_gateway";
import type { FormatImportGateway } from "../../../../../parts/resource/src/adapters/import/format_import_types";

export type TauriWindowLike = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: {
    core?: {
      invoke?: (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

type CoreInvokeFn = (command: string, payload?: Record<string, unknown>) => Promise<unknown>;

/**
 * Resolved `invoke` from `@tauri-apps/api/core`, which calls `window.__TAURI_INTERNALS__.invoke`.
 * Prefer this over reading `window.__TAURI__.core.invoke` alone: Tauri v2 webviews often
 * expose the IPC bridge via internals only unless `withGlobalTauri` is enabled, which
 * otherwise breaks `buildTauriFsGateway` while the file picker (`tauriInvoke` in
 * `picker_fs_helpers`) still works.
 */
let cachedCoreInvokePromise: Promise<CoreInvokeFn> | null = null;

const getCoreInvoke = async (): Promise<CoreInvokeFn> => {
  cachedCoreInvokePromise ??= import("@tauri-apps/api/core").then(
    (mod): CoreInvokeFn => mod.invoke as CoreInvokeFn,
  );
  return cachedCoreInvokePromise;
};

export const isTauriRuntime = (): boolean => {
  if (globalThis.window === undefined) return false;
  const runtimeWindow = globalThis.window as TauriWindowLike;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

export const buildTauriFsGateway = (): FsGateway => ({
  readTextFile: async (path: string): Promise<string> => {
    const invoke = await getCoreInvoke();
    return String(await invoke("load_text_file", { filePath: path }));
  },
  writeTextFile: async (path: string, content: string): Promise<void> => {
    const invoke = await getCoreInvoke();
    await invoke("write_text_file", { filePath: path, content });
  },
});

/** Opens the Tauri webview developer tools panel. No-op if the invoke API is unavailable. */
export const openDevTools = async (): Promise<void> => {
  try {
    const invoke = await getCoreInvoke();
    await invoke("open_devtools");
  } catch {
    /* Outside Tauri or command unavailable — ignore. */
  }
};

/** Build the production `FormatImportGateway` for Tauri desktop builds. */
export const buildTauriFormatImportGateway = (): FormatImportGateway => ({
  readTextFile: async (path: string): Promise<string> => {
    const invoke = await getCoreInvoke();
    return String(await invoke("load_text_file", { filePath: path }));
  },
  invokeTauriCommand: async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
    const invoke = await getCoreInvoke();
    return invoke(cmd, args) as Promise<T>;
  },
});

export const buildTauriDbGateway = (dbPath: string): DbGateway => ({
  query: async (sql: string, params?: unknown[]): Promise<unknown[]> => {
    const invoke = await getCoreInvoke();
    const result: unknown = await invoke("query_db", { dbPath, sql, params: params ?? [] });
    return Array.isArray(result) ? result : [];
  },
  execute: async (sql: string, params?: unknown[]): Promise<void> => {
    const invoke = await getCoreInvoke();
    await invoke("execute_db", { dbPath, sql, params: params ?? [] });
  },
});
