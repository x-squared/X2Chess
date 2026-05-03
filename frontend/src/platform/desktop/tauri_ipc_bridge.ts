/**
 * tauri_ipc_bridge — thin IPC boundary between React/feature code and the Tauri desktop shell.
 *
 * Features and hooks must **not** import `@tauri-apps/*` directly; they call `tauriInvoke` /
 * `isTauri` here so engine/menu/resource code stays isolated from Tauri package APIs.
 *
 * Implementation resolves `invoke` via a cached dynamic import of `@tauri-apps/api/core`
 * (same mechanism as `tauri/tauri_gateways.ts`). Relying on `window.__TAURI__.core.invoke`
 * alone fails in Tauri v2 when `withGlobalTauri` is false: the webview exposes
 * `__TAURI_INTERNALS__` but not the legacy global object.
 *
 * Integration API:
 * - `isTauri()` — whether the current window looks like a Tauri-hosted webview.
 * - `tauriInvoke(cmd, args)` — async IPC to a Rust `#[tauri::command]` handler.
 */

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

let cachedInvokePromise: Promise<InvokeFn> | null = null;

const loadInvoke = async (): Promise<InvokeFn> => {
  cachedInvokePromise ??= import("@tauri-apps/api/core").then(
    (mod): InvokeFn => mod.invoke as InvokeFn,
  );
  return cachedInvokePromise;
};

/**
 * Returns true when the runtime appears to be the Tauri desktop webview (internals or legacy global).
 */
export const isTauri = (): boolean => {
  if (globalThis.window === undefined) return false;
  const w: Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown } = globalThis.window;
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
};

/**
 * Invokes a registered Tauri command by name. Prefer this over reading `window.__TAURI__` in features.
 *
 * @param cmd Registered command name (Rust `#[tauri::command]` fn name).
 * @param args Optional payload object (camelCase keys matching Rust parameters).
 * @returns Promise of the command return value deserialized for JS.
 */
export const tauriInvoke = async <T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  const invoke: InvokeFn = await loadInvoke();
  return invoke(cmd, args ?? {}) as Promise<T>;
};
