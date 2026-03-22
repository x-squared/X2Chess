/**
 * tauri_engine — Tauri adapter implementing the EngineProcess interface.
 *
 * Bridges Tauri IPC commands (spawn_engine, send_to_engine, kill_engine) and
 * the "engine-output" event stream to the EngineProcess interface consumed by
 * UciSession.
 *
 * Integration API:
 * - `createTauriEngine(config)` — creates an EngineProcess for a locally
 *   installed UCI executable. Call `ensureSpawned()` before first use.
 *
 * Configuration API:
 * - `config.id` — unique engine identifier; must match the id used in
 *   `spawn_engine` / `kill_engine` Tauri commands.
 * - `config.path` — absolute path to the UCI-compatible binary.
 *
 * Communication API:
 * - Implements `EngineProcess`; pass to `createUciSession`.
 * - Engine stdout is received via Tauri event "engine-output" filtered by id.
 *
 * Note: This module imports Tauri APIs at runtime via dynamic import to allow
 * the engines module to be tested without a Tauri context. The `tauri` guard
 * below falls back to a no-op in a browser/test environment.
 */

import type { EngineProcess } from "../uci/uci_session";
import type { EngineConfig } from "../domain/engine_config";

// ── Tauri globals (mirrors source_gateway.ts — no package import needed) ───────

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type TauriListen = (
  event: string,
  handler: (payload: { payload: unknown }) => void,
) => Promise<() => void>;
type TauriWindowLike = typeof globalThis & {
  __TAURI__?: {
    core?: { invoke?: TauriInvoke };
    event?: { listen?: TauriListen };
  };
  __TAURI_INTERNALS__?: unknown;
};

const noop: TauriInvoke = async (): Promise<unknown> => undefined;
const noopListen: TauriListen = async (): Promise<() => void> => (): void => undefined;

const getTauriApis = (): { invoke: TauriInvoke; listen: TauriListen } => {
  const g = globalThis as TauriWindowLike;
  const invoke = g.__TAURI__?.core?.invoke ?? noop;
  const listen = g.__TAURI__?.event?.listen ?? noopListen;
  return { invoke, listen };
};

// ── Output event payload ──────────────────────────────────────────────────────

type EngineOutputPayload = {
  id: string;
  line: string;
};

// ── Factory ───────────────────────────────────────────────────────────────────

type TauriEngineOptions = {
  config: EngineConfig;
};

/**
 * Create an EngineProcess that delegates to Tauri commands for engine I/O.
 *
 * The Tauri backend must expose:
 *   `spawn_engine(id: string, path: string) -> Result<(), String>`
 *   `send_to_engine(id: string, line: string) -> Result<(), String>`
 *   `kill_engine(id: string) -> Result<(), String>`
 *
 * And emit events:
 *   `engine-output` with payload `{ id: string; line: string }`
 */
export const createTauriEngine = (
  options: TauriEngineOptions,
): EngineProcess & { ensureSpawned(): Promise<void> } => {
  const { config } = options;
  const outputHandlers: Array<(line: string) => void> = [];
  let _unlistenFn: (() => void) | null = null;
  let _spawned = false;

  const subscribeToOutput = async (): Promise<void> => {
    if (_unlistenFn) return;
    const { listen } = await getTauriApis();
    _unlistenFn = await listen(
      "engine-output",
      (event: { payload: unknown }): void => {
        const payload = event.payload as EngineOutputPayload;
        if (payload.id !== config.id) return;
        for (const handler of outputHandlers) {
          handler(payload.line);
        }
      },
    );
  };

  return {
    async ensureSpawned(): Promise<void> {
      if (_spawned) return;
      await subscribeToOutput();
      const { invoke } = await getTauriApis();
      await invoke("spawn_engine", { id: config.id, path: config.path });
      _spawned = true;
    },

    async send(line: string): Promise<void> {
      const { invoke } = await getTauriApis();
      await invoke("send_to_engine", { id: config.id, line });
    },

    onOutput(handler: (line: string) => void): () => void {
      outputHandlers.push(handler);
      return (): void => {
        const idx = outputHandlers.indexOf(handler);
        if (idx >= 0) outputHandlers.splice(idx, 1);
      };
    },

    async kill(): Promise<void> {
      _spawned = false;
      if (_unlistenFn) { _unlistenFn(); _unlistenFn = null; }
      const { invoke } = await getTauriApis();
      await invoke("kill_engine", { id: config.id });
    },
  };
};
