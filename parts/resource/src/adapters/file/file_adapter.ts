import type { PgnResourceAdapter } from "../../domain/contracts";
import type { PgnGameRef } from "../../domain/game_ref";
import {
  extractPgnMetadata,
  extractPgnMetadataFromSource,
  mergeMetadataCatalogKeys,
} from "../../domain/metadata";
import type { PgnResourceRef } from "../../domain/resource_ref";
import type { FsGateway } from "../../io/fs_gateway";

/**
 * Canonical file-resource adapter (single file, multiple games).
 *
 * Integration API:
 * - Primary export: `createFileAdapter`.
 * - Serves canonical `file` kind in the resource client.
 *
 * Configuration API:
 * - `fsGateway` must be injected at construction; Tauri-backed implementations
 *   are supplied by the frontend integration point (`source_gateway.ts`).
 *
 * Communication API:
 * - Delegates all file I/O to the injected `FsGateway`.
 * - Implements `list` and `load`; `save`/`create` are intentionally deferred.
 */

/**
 * Split one multi-game PGN text into game chunks.
 *
 * @param sourceText PGN source content.
 * @returns Non-empty game segments.
 */
const splitPgnDatabaseGames = (sourceText: string): string[] => {
  const normalized = String(sourceText || "").replaceAll("\r\n", "\n").trim();
  if (!normalized) return [];
  const chunks = normalized
    .split(/(?=^\s*\[Event\s+")/m)
    .map((part: string): string => part.trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks;
  return [normalized];
};

/**
 * Derive display title from PGN headers.
 *
 * @param pgnText One game PGN text.
 * @param index Zero-based fallback index.
 * @returns Display title for UI listing.
 */
const deriveGameTitle = (pgnText: string, index: number): string => {
  const { metadata } = extractPgnMetadata(pgnText);
  const eventName = String(metadata.Event || "").trim();
  const white = String(metadata.White || "").trim();
  const black = String(metadata.Black || "").trim();
  if (eventName && white && black) return `${eventName}: ${white} - ${black}`;
  if (white && black) return `${white} - ${black}`;
  if (eventName) return eventName;
  return `Game ${index + 1}`;
};

/**
 * Create canonical file adapter.
 *
 * @param options Adapter dependencies.
 * @param options.fsGateway I/O gateway for reading files; supplied by the frontend.
 * @returns Canonical adapter implementing kind `file`.
 * @throws PgnResourceError for missing identifiers.
 */
export const createFileAdapter = ({ fsGateway }: { fsGateway: FsGateway }): PgnResourceAdapter => ({
  kind: "file",
  list: async (resourceRef: PgnResourceRef) => {
    const locator = String(resourceRef.locator || "").trim();
    if (!locator) return { entries: [] };
    const sourceText = await fsGateway.readTextFile(locator);
    const games = splitPgnDatabaseGames(String(sourceText || ""));
    return {
      entries: games.map((gameText: string, index: number) => {
        const fromSource = extractPgnMetadataFromSource(gameText);
        return {
          gameRef: {
            kind: "file" as const,
            locator,
            recordId: String(index + 1),
          },
          title: deriveGameTitle(gameText, index),
          revisionToken: "",
          metadata: fromSource.metadata,
          availableMetadataKeys: mergeMetadataCatalogKeys(fromSource.discoveredKeysInOrder),
        };
      }),
    };
  },
  load: async (gameRef: PgnGameRef) => {
    const locator = String(gameRef.locator || "").trim();
    const recordId = Number.parseInt(String(gameRef.recordId || ""), 10);
    if (!locator) throw new PgnResourceError("validation_failed", "File resource is missing locator.");
    if (!Number.isInteger(recordId) || recordId < 1) {
      throw new PgnResourceError("validation_failed", "File resource is missing recordId.");
    }
    const sourceText = await fsGateway.readTextFile(locator);
    const games = splitPgnDatabaseGames(String(sourceText || ""));
    const gameText = games[recordId - 1];
    if (!gameText) throw new PgnResourceError("not_found", "Selected game could not be found in file resource.");
    return {
      gameRef,
      pgnText: gameText,
      revisionToken: String(Date.now()),
      title: deriveGameTitle(gameText, recordId - 1),
    };
  },
});
