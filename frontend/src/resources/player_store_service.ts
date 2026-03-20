/**
 * Player store service.
 *
 * Integration API:
 * - Create with `createPlayerStoreService({ state })`.
 * - Use `loadPlayerStoreFromClientData(seedPlayers)` during startup and
 *   `savePlayerStoreToClientData(players)` after edits.
 *
 * Configuration API:
 * - Storage target is configured by `state.gameRootPath` (Tauri runtime data root).
 * - Seed/fallback data is provided by caller as `seedPlayers`.
 *
 * Communication API:
 * - Reads player list from local runtime storage, normalizes/deduplicates entries,
 *   writes back normalized content.
 * - Updates `state.playerStore` with loaded or fallback values.
 */

import type { PlayerRecord } from "../app_shell/app_state";
import type { TauriInvokeFn } from "./tauri_invoke_types";

const normalizePlayerNameField = (value) => String(value ?? "").trim();

const normalizePlayerRecord = (record) => {
  if (!record || typeof record !== "object") return null;
  const lastName = normalizePlayerNameField(record.lastName || record.name || "");
  const firstName = normalizePlayerNameField(record.firstName || "");
  if (!lastName) return null;
  return { lastName, firstName };
};

const normalizePlayerRecords = (records) => {
  const byKey = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const normalized = normalizePlayerRecord(record);
    if (!normalized) return;
    const key = `${normalized.lastName.toLowerCase()}|${normalized.firstName.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, normalized);
  });
  return [...byKey.values()].sort((left, right) => {
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
const isTauriRuntime = () => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;
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
 * Create player store service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {{loadPlayerStoreFromClientData: Function, savePlayerStoreToClientData: Function}} Service API.
 */
export const createPlayerStoreService = ({ state }) => {
  /**
   * Persist player store into active local data area.
   *
   * @param {Array<{lastName: string, firstName: string}>} players - Player records to persist.
   */
  const savePlayerStoreToClientData = async (players) => {
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
  const loadPlayerStoreFromClientData = async (seedPlayers: PlayerRecord[] = []) => {
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

