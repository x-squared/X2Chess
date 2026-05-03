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
import { log } from "../../logger";

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
    log.info("tauri_engine_adapter", `subscribing to output event`, { engineId: config.id, eventName });
    _unlistenFn = await listen<EngineOutputPayload>(eventName, (event): void => {
      const payload: EngineOutputPayload = event.payload;
      if (payload.line === null) {
        log.info("tauri_engine_adapter", "engine process exited (null sentinel)", { engineId: config.id });
        return;
      }
      log.debug("tauri_engine_adapter", () => `engine stdout [${config.id}]: ${payload.line}`);
      for (const handler of outputHandlers) {
        handler(payload.line);
      }
    });
    log.info("tauri_engine_adapter", "output event listener registered", { engineId: config.id });
  };

  return {
    async ensureSpawned(): Promise<void> {
      if (_spawned) {
        log.debug("tauri_engine_adapter", () => `ensureSpawned: already spawned — ${config.id}`);
        return;
      }
      log.info("tauri_engine_adapter", `spawning engine`, { engineId: config.id, path: config.path });
      try {
        await subscribeToOutput();
        await tauriInvoke("spawn_engine", { engineId: config.id, path: config.path });
        _spawned = true;
        log.info("tauri_engine_adapter", "engine spawned", { engineId: config.id });
      } catch (err) {
        log.error("tauri_engine_adapter", "spawn_engine failed", { engineId: config.id, message: String(err) });
        throw err;
      }
    },

    async send(line: string): Promise<void> {
      log.debug("tauri_engine_adapter", () => `send [${config.id}]: ${line}`);
      try {
        await tauriInvoke("send_to_engine", { engineId: config.id, line });
      } catch (err) {
        log.error("tauri_engine_adapter", "send_to_engine failed", { engineId: config.id, line, message: String(err) });
        throw err;
      }
    },

    onOutput(handler: (line: string) => void): () => void {
      outputHandlers.push(handler);
      log.debug("tauri_engine_adapter", () => `onOutput: handler registered (total=${outputHandlers.length}) — ${config.id}`);
      return (): void => {
        const idx: number = outputHandlers.indexOf(handler);
        if (idx >= 0) outputHandlers.splice(idx, 1);
        log.debug("tauri_engine_adapter", () => `onOutput: handler removed (total=${outputHandlers.length}) — ${config.id}`);
      };
    },

    async kill(): Promise<void> {
      log.info("tauri_engine_adapter", "killing engine", { engineId: config.id });
      _spawned = false;
      if (_unlistenFn) {
        _unlistenFn();
        _unlistenFn = null;
      }
      try {
        await tauriInvoke("kill_engine", { engineId: config.id });
        log.info("tauri_engine_adapter", "engine killed", { engineId: config.id });
      } catch (err) {
        log.error("tauri_engine_adapter", "kill_engine failed", { engineId: config.id, message: String(err) });
      }
    },
  };
};
