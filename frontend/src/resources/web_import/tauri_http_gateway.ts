/**
 * tauri_http_gateway — Build a `NativeHttpGateway` backed by the Tauri
 * `native_http_get` command.
 *
 * Integration API:
 * - `buildTauriHttpGateway()` — call once; inject the result into `fetchFromRule`
 *   or `useWebImport` when running inside the Tauri desktop runtime.
 * - `isTauriRuntime()` — available from `tauri_gateways.ts`; use it to decide
 *   whether to build this gateway.
 *
 * Configuration API:
 * - No configuration; the Tauri `invoke` function is resolved from the global
 *   `window.__TAURI__` object at call time.
 *
 * Communication API:
 * - Outbound: invokes the Rust command `native_http_get` via Tauri IPC.
 * - Returns the raw response body as a UTF-8 string.
 */

import type { NativeHttpGateway } from "./rule_fetcher";
import type { TauriWindowLike } from "../tauri_gateways";

/**
 * Construct a `NativeHttpGateway` that routes GET requests through the Tauri
 * `native_http_get` Rust command.
 *
 * The returned gateway bypasses CORS restrictions and can send arbitrary
 * request headers (e.g. a browser User-Agent to avoid 403 responses).
 *
 * @throws At call time if the Tauri `invoke` function is unavailable.
 */
export const buildTauriHttpGateway = (): NativeHttpGateway => {
  const getInvoke = (): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) => {
    const runtimeWindow = window as TauriWindowLike;
    const fn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof fn !== "function") {
      throw new Error("Tauri invoke API is unavailable — cannot perform native HTTP request.");
    }
    return fn as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };

  return {
    get: async (url: string, headers: Record<string, string>): Promise<string> => {
      const result = await getInvoke()("native_http_get", { url, headers });
      return String(result);
    },
  };
};
