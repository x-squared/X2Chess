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

export const isTauriRuntime = (): boolean => {
  if (globalThis.window === undefined) return false;
  const runtimeWindow = window as TauriWindowLike;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

export const buildTauriFsGateway = (): FsGateway => ({
  readTextFile: async (path: string): Promise<string> => {
    const runtimeWindow = window as TauriWindowLike;
    const invokeFn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof invokeFn !== "function") {
      throw new Error("Tauri invoke API is unavailable.");
    }
    return String(await invokeFn("load_text_file", { filePath: path }));
  },
  writeTextFile: async (path: string, content: string): Promise<void> => {
    const runtimeWindow = window as TauriWindowLike;
    const invokeFn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof invokeFn !== "function") {
      throw new Error("Tauri invoke API is unavailable.");
    }
    await invokeFn("write_text_file", { filePath: path, content });
  },
});

/** Opens the Tauri webview developer tools panel. No-op if the invoke API is unavailable. */
export const openDevTools = async (): Promise<void> => {
  const runtimeWindow = globalThis.window as TauriWindowLike | undefined;
  const invokeFn = runtimeWindow?.__TAURI__?.core?.invoke;
  if (typeof invokeFn !== "function") return;
  await invokeFn("open_devtools").catch(() => {});
};

/** Build the production `FormatImportGateway` for Tauri desktop builds. */
export const buildTauriFormatImportGateway = (): FormatImportGateway => {
  const getInvoke = (): (cmd: string, args?: Record<string, unknown>) => Promise<unknown> => {
    const runtimeWindow = window as TauriWindowLike;
    const fn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof fn !== "function") throw new Error("Tauri invoke API is unavailable.");
    return fn as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };

  return {
    readTextFile: async (path: string): Promise<string> => {
      return String(await getInvoke()("load_text_file", { filePath: path }));
    },
    invokeTauriCommand: async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
      return getInvoke()(cmd, args) as Promise<T>;
    },
  };
};

export const buildTauriDbGateway = (dbPath: string): DbGateway => {
  const invoke = (): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) => {
    const runtimeWindow = window as TauriWindowLike;
    const fn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof fn !== "function") throw new Error("Tauri invoke API is unavailable.");
    return fn as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
  return {
    query: async (sql: string, params?: unknown[]): Promise<unknown[]> => {
      const result = await invoke()("query_db", { dbPath, sql, params: params ?? [] });
      return Array.isArray(result) ? result : [];
    },
    execute: async (sql: string, params?: unknown[]): Promise<void> => {
      await invoke()("execute_db", { dbPath, sql, params: params ?? [] });
    },
  };
};
