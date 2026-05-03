/**
 * tauri_engine_adapter — Tauri `EngineProcess` implementation for the desktop app.
 *
 * Implements the `EngineProcess` contract from `parts/engines` by delegating to
 * Rust `spawn_engine` / `send_to_engine` / `kill_engine` and subscribing to
 * per-engine `engine://output/{id}` events. Kept in `frontend` so `parts/engines`
 * stays free of `@tauri-apps/*` and other shell dependencies.
 *
 * Integration API:
 * - `createTauriEngine({ config })` — pass to `createEngineManager(registry, createTauriEngine)`.
 *
 * Configuration API:
 * - `config.id` / `config.path` — must match the UCI engine binary and id used in Rust.
 *
 * Communication API:
 * - Outbound: `tauriInvoke` (bridge) and `@tauri-apps/api/event` `listen` for stdout lines.
 * - Inbound: engine events from the Tauri host.
 */

import type { EngineConfig } from "../../../../parts/engines/src/domain/engine_config";
import type { EngineProcess } from "../../../../parts/engines/src/uci/uci_session";
import { tauriInvoke } from "./tauri_ipc_bridge";

// ── Output event payload (matches Rust `emit` JSON) ───────────────────────────

type EngineOutputPayload = {
  /** The UCI output line, or null when the engine process exits. */
  line: string | null;
};

type TauriEngineOptions = {
  config: EngineConfig;
};

/**
 * Create an `EngineProcess` that runs the UCI engine through the Tauri host.
 *
 * The backend must expose `spawn_engine`, `send_to_engine`, and `kill_engine`, and
 * emit `engine://output/{engineId}` with payload `{ line: string | null }`.
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
    const { listen } = await import("@tauri-apps/api/event");
    const eventName: string = `engine://output/${config.id}`;
    _unlistenFn = await listen<EngineOutputPayload>(eventName, (event): void => {
      const payload: EngineOutputPayload = event.payload;
      if (payload.line === null) return; // engine exited sentinel
      for (const handler of outputHandlers) {
        handler(payload.line);
      }
    });
  };

  return {
    async ensureSpawned(): Promise<void> {
      if (_spawned) return;
      await subscribeToOutput();
      await tauriInvoke("spawn_engine", { engineId: config.id, path: config.path });
      _spawned = true;
    },

    async send(line: string): Promise<void> {
      await tauriInvoke("send_to_engine", { engineId: config.id, line });
    },

    onOutput(handler: (line: string) => void): () => void {
      outputHandlers.push(handler);
      return (): void => {
        const idx: number = outputHandlers.indexOf(handler);
        if (idx >= 0) outputHandlers.splice(idx, 1);
      };
    },

    async kill(): Promise<void> {
      _spawned = false;
      if (_unlistenFn) {
        _unlistenFn();
        _unlistenFn = null;
      }
      await tauriInvoke("kill_engine", { engineId: config.id });
    },
  };
};
