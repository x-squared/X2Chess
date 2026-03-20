import type { TauriInvokeFn } from "../tauri_invoke_types";
import { extractPgnMetadata, PGN_STANDARD_METADATA_KEYS } from "../../../../resource/domain/metadata";

/**
 * Frontend file-resource adapter (single file, multiple games).
 *
 * Integration API:
 * - Primary export: `createFileResourceSourceAdapter`.
 * - Used only as transitional compatibility for legacy frontend flows.
 *
 * Configuration API:
 * - Optional `invokeFn` override can be injected for tests.
 *
 * Communication API:
 * - Uses Tauri command `load_text_file` for file reads.
 * - Supports `list` and `load`; `save` is intentionally deferred.
 */

const isTauriRuntime = (): any => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;

const getTauriInvoke = async (): Promise<any> => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod: any): any => mod.invoke);
  }
  return tauriInvokeFnPromise;
};

const tauriInvoke = async (command: any, payload: any = {}): Promise<any> => {
  const invoke = await getTauriInvoke();
  return invoke(command, payload);
};

const splitPgnDatabaseGames = (sourceText: any): any => {
  const normalized = String(sourceText || "").replaceAll("\r\n", "\n").trim();
  if (!normalized) return [];
  const chunks = normalized.split(/(?=^\s*\[Event\s+")/m)
    .map((part: any): any => part.trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks;
  return [normalized];
};

const deriveGameTitle = (pgnText: any, index: any): any => {
  const { metadata } = extractPgnMetadata(pgnText);
  const meta = metadata as Record<string, string>;
  const eventName = String(meta.Event || "").trim();
  const white = String(meta.White || "").trim();
  const black = String(meta.Black || "").trim();
  if (eventName && white && black) return `${eventName}: ${white} - ${black}`;
  if (white && black) return `${white} - ${black}`;
  if (eventName) return eventName;
  return `Game ${index + 1}`;
};

/**
 * Create compatibility adapter for canonical `file` resources.
 *
 * @param options Optional adapter options.
 * @param options.invokeFn Optional invoke override for tests.
 * @returns Adapter-like object implementing `kind`, `list`, `load`, and `save`.
 * @throws Error When runtime is unsupported or identifiers are invalid.
 */
export const createFileResourceSourceAdapter = ({ invokeFn = null }: { invokeFn?: TauriInvokeFn | null } = {}): any => {
  const invokeResourceCommand = async (command: any, payload: any = {}): Promise<any> => {
    if (typeof invokeFn === "function") return invokeFn(command, payload);
    return tauriInvoke(command, payload);
  };

  const list = async (options: Record<string, unknown> = {}): Promise<any> => {
    const sourceRef = options?.sourceRef as { locator?: string } | undefined;
    const locator = String(sourceRef?.locator || "").trim();
    if (!locator) return [];
    if (!isTauriRuntime()) {
      throw new Error("File resources require Tauri runtime.");
    }
    const sourceText = await invokeResourceCommand("load_text_file", { filePath: locator });
    const games = splitPgnDatabaseGames(String(sourceText || ""));
    return games.map((gameText: any, index: any): any => ({
      sourceRef: {
        kind: "file",
        locator,
        recordId: String(index + 1),
      },
      titleHint: deriveGameTitle(gameText, index),
      revisionToken: "",
      metadata: extractPgnMetadata(gameText).metadata,
      availableMetadataKeys: [...PGN_STANDARD_METADATA_KEYS],
    }));
  };

  const load = async (sourceRef: any): Promise<any> => {
    const locator = String(sourceRef?.locator || "").trim();
    const recordId = Number.parseInt(String(sourceRef?.recordId || ""), 10);
    if (!locator) throw new Error("File resource is missing locator.");
    if (!Number.isInteger(recordId) || recordId < 1) {
      throw new Error("File resource is missing recordId.");
    }
    if (!isTauriRuntime()) {
      throw new Error("File resources require Tauri runtime.");
    }
    const sourceText = await invokeResourceCommand("load_text_file", { filePath: locator });
    const games = splitPgnDatabaseGames(String(sourceText || ""));
    const gameText = games[recordId - 1];
    if (!gameText) throw new Error("Selected game could not be found in file resource.");
    return {
      pgnText: gameText,
      revisionToken: String(Date.now()),
      titleHint: deriveGameTitle(gameText, recordId - 1),
    };
  };

  const save = async (): Promise<any> => {
    throw new Error("Saving to file resources is not implemented yet.");
  };

  return {
    kind: "file",
    list,
    load,
    save,
  };
};

