/**
 * Player Store Service module.
 *
 * Integration API:
 * - Primary exports from this module: `createPlayerStoreService`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, external I/O; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import type { PlayerRecord } from "../app_shell/app_state";
import type { TauriInvokeFn } from "./tauri_invoke_types";

const normalizePlayerNameField = (value: any): any => String(value ?? "").trim();

const normalizePlayerRecord = (record: any): any => {
  if (!record || typeof record !== "object") return null;
  const lastName = normalizePlayerNameField(record.lastName || record.name || "");
  const firstName = normalizePlayerNameField(record.firstName || "");
  if (!lastName) return null;
  return { lastName, firstName };
};

const normalizePlayerRecords = (records: any): any => {
  const byKey = new Map();
  (Array.isArray(records) ? records : []).forEach((record: any): any => {
    const normalized = normalizePlayerRecord(record);
    if (!normalized) return;
    const key = `${normalized.lastName.toLowerCase()}|${normalized.firstName.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, normalized);
  });
  return [...byKey.values()].sort((left: any, right: any): any => {
    const lastCmp = left.lastName.localeCompare(right.lastName);
    if (lastCmp !== 0) return lastCmp;
    return left.firstName.localeCompare(right.firstName);
  });
};

/**
 * Detect whether runtime is Tauri webview.
 *
 * @returns {boolean} True in Tauri runtime.
 */
const isTauriRuntime = (): any => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;
/**
 * Lazily load Tauri invoke function.
 *
 * @returns {Promise<Function>} Invoke function.
 */
const getTauriInvoke = async (): Promise<any> => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod: any): any => mod.invoke);
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
const tauriInvoke = async (command: any, payload: any = {}): Promise<any> => {
  const invoke = await getTauriInvoke();
  return invoke(command, payload);
};

/**
 * Create player store service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {{loadPlayerStoreFromClientData: Function, savePlayerStoreToClientData: Function}} Service API.
 */
export const createPlayerStoreService = ({ state }: any): any => {
  /**
   * Persist player store into active local data area.
   *
   * @param {Array<{lastName: string, firstName: string}>} players - Player records to persist.
   */
  const savePlayerStoreToClientData = async (players: any): Promise<any> => {
    const normalizedPlayers = normalizePlayerRecords(players);
    if (!(state.gameRootPath && isTauriRuntime())) return;
    try {
      await tauriInvoke("save_player_list", {
        rootDirectory: state.gameRootPath,
        content: JSON.stringify(normalizedPlayers, null, 2),
      });
    } catch (error) {
      console.warn("[X2Chess] unable to save player list:", error);
    }
  };

  /**
   * Load player store from local data area, with seed fallback.
   *
   * @param {Array<{lastName: string, firstName: string}>} seedPlayers - Seed list.
   * @returns {Promise<Array<{lastName: string, firstName: string}>>} Loaded/initialized players.
   */
  const loadPlayerStoreFromClientData = async (seedPlayers: PlayerRecord[] = []): Promise<any> => {
    const normalizedSeedPlayers = normalizePlayerRecords(seedPlayers);
    if (!(state.gameRootPath && isTauriRuntime())) {
      state.playerStore = normalizedSeedPlayers;
      return state.playerStore;
    }
    try {
      const rawPlayerList = await tauriInvoke("load_player_list", {
        rootDirectory: state.gameRootPath,
      });
      if (rawPlayerList) {
        const parsed = JSON.parse(String(rawPlayerList));
        state.playerStore = normalizePlayerRecords(parsed);
      } else {
        state.playerStore = normalizedSeedPlayers;
      }
    } catch (error) {
      console.warn("[X2Chess] unable to load player list, using seed list:", error);
      state.playerStore = normalizedSeedPlayers;
    }
    if (state.playerStore.length === 0 && normalizedSeedPlayers.length > 0) {
      state.playerStore = normalizedSeedPlayers;
    }
    await savePlayerStoreToClientData(state.playerStore);
    return state.playerStore;
  };

  return {
    loadPlayerStoreFromClientData,
    savePlayerStoreToClientData,
  };
};

