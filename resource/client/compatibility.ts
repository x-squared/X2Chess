import type { PgnListGamesResult } from "../domain/actions";
import type { PgnResourceAdapter, PgnSaveOptions } from "../domain/contracts";
import type { PgnGameRef } from "../domain/game_ref";
import { PGN_RESOURCE_KINDS, type PgnResourceKind } from "../domain/kinds";
import type { PgnResourceRef } from "../domain/resource_ref";

/**
 * Legacy compatibility bridge.
 *
 * Integration API:
 * - Primary exports: legacy DTO types plus mapping/adaptation helpers.
 * - Used by frontend transitional gateways to consume canonical resource client APIs.
 *
 * Configuration API:
 * - Driven by `LegacySourceRef`, `LegacyAdapter`, and canonical kind values.
 *
 * Communication API:
 * - Pure mapping layer; delegates I/O to provided legacy adapters.
 */
export type LegacySourceRef = {
  kind?: string;
  locator?: string;
  recordId?: string;
};

export type LegacyListEntry = {
  sourceRef: LegacySourceRef;
  titleHint: string;
  revisionToken: string;
  metadata?: Record<string, string | string[]>;
  availableMetadataKeys?: readonly string[];
};

export type LegacyLoadResult = {
  pgnText: string;
  revisionToken: string;
  titleHint: string;
};

export type LegacySaveResult = {
  revisionToken: string;
};

export type LegacyCreateResult = {
  sourceRef: LegacySourceRef;
  revisionToken: string;
  titleHint: string;
};

export type LegacyAdapter = {
  kind: string;
  list: (options?: { sourceRef?: LegacySourceRef | null }) => Promise<LegacyListEntry[]>;
  load: (sourceRef: LegacySourceRef) => Promise<LegacyLoadResult>;
  save: (
    sourceRef: LegacySourceRef,
    pgnText: string,
    revisionToken: string,
    options?: Record<string, unknown>,
  ) => Promise<LegacySaveResult>;
  createInResource?: (
    resourceRef: LegacySourceRef,
    pgnText: string,
    title: string,
  ) => Promise<LegacyCreateResult>;
};

/**
 * Map a legacy kind string to a canonical kind.
 *
 * @param kind Legacy source kind token.
 * @returns Canonical resource kind.
 * @throws Error when an unknown kind is supplied.
 */
export const mapLegacyKind = (kind: string): PgnResourceKind => {
  if (kind === "pgn-db") return "file";
  if (kind === "sqlite") return "db";
  if ((PGN_RESOURCE_KINDS as readonly string[]).includes(kind)) return kind as PgnResourceKind;
  throw new Error(`Unknown resource kind: ${kind}`);
};

/**
 * Map a canonical kind to its legacy compatibility token.
 *
 * @param kind Canonical kind.
 * @returns Legacy kind token currently used by transitional frontend code.
 */
export const toLegacyKind = (kind: PgnResourceKind): string => {
  if (kind === "file") return "pgn-db";
  if (kind === "directory") return "file";
  return "sqlite";
};

/**
 * Convert a legacy resource reference to canonical shape.
 *
 * @param sourceRef Legacy source reference.
 * @returns Canonical resource reference.
 */
export const toCanonicalResourceRef = (sourceRef: LegacySourceRef): PgnResourceRef => ({
  kind: mapLegacyKind(String(sourceRef.kind || "directory")),
  locator: String(sourceRef.locator || ""),
});

/**
 * Convert a legacy game reference to canonical shape.
 *
 * @param sourceRef Legacy source reference.
 * @returns Canonical game reference.
 */
export const toCanonicalGameRef = (sourceRef: LegacySourceRef): PgnGameRef => ({
  kind: mapLegacyKind(String(sourceRef.kind || "directory")),
  locator: String(sourceRef.locator || ""),
  recordId: String(sourceRef.recordId || ""),
});

/**
 * Convert canonical refs back to legacy shape.
 *
 * @param sourceRef Canonical resource/game reference.
 * @returns Legacy source reference.
 */
export const toLegacySourceRef = (sourceRef: PgnResourceRef | PgnGameRef): LegacySourceRef => ({
  kind: toLegacyKind(sourceRef.kind),
  locator: String(sourceRef.locator || ""),
  recordId: "recordId" in sourceRef ? String(sourceRef.recordId || "") : undefined,
});

/**
 * Wrap a legacy adapter with canonical adapter interface.
 *
 * @param kind Canonical kind this wrapper should expose.
 * @param legacy Legacy adapter implementation.
 * @returns Canonical adapter that maps requests/responses between shapes.
 * @throws Error when `create` is called but the legacy adapter lacks `createInResource`.
 */
export const createCanonicalAdapter = (
  kind: PgnResourceKind,
  legacy: LegacyAdapter,
): PgnResourceAdapter => ({
  kind,
  list: async (resourceRef: PgnResourceRef): Promise<PgnListGamesResult> => {
    const rows: LegacyListEntry[] = await legacy.list({ sourceRef: toLegacySourceRef(resourceRef) });
    return {
      entries: rows.map((row: LegacyListEntry) => ({
        gameRef: toCanonicalGameRef(row.sourceRef || {}),
        title: String(row.titleHint || ""),
        revisionToken: String(row.revisionToken || ""),
        metadata: row.metadata || {},
        availableMetadataKeys: Array.isArray(row.availableMetadataKeys)
          ? [...row.availableMetadataKeys].map((key: string): string => String(key))
          : [],
      })),
    };
  },
  load: async (gameRef: PgnGameRef) => {
    const loaded: LegacyLoadResult = await legacy.load(toLegacySourceRef(gameRef));
    return {
      gameRef,
      pgnText: loaded.pgnText,
      revisionToken: loaded.revisionToken,
      title: loaded.titleHint,
    };
  },
  save: async (gameRef: PgnGameRef, pgnText: string, options?: PgnSaveOptions) => {
    const saved: LegacySaveResult = await legacy.save(
      toLegacySourceRef(gameRef),
      pgnText,
      String(options?.expectedRevisionToken || ""),
      {},
    );
    return {
      gameRef,
      revisionToken: String(saved.revisionToken || ""),
    };
  },
  create: async (resourceRef: PgnResourceRef, pgnText: string, title: string) => {
    if (typeof legacy.createInResource !== "function") {
      throw new Error(`Source kind '${kind}' cannot create new games yet.`);
    }
    const created: LegacyCreateResult = await legacy.createInResource(toLegacySourceRef(resourceRef), pgnText, title);
    const createdGameRef: PgnGameRef = toCanonicalGameRef(created.sourceRef || {});
    return {
      gameRef: createdGameRef,
      revisionToken: String(created.revisionToken || ""),
      title: String(created.titleHint || ""),
    };
  },
});


/** Neutral compatibility aliases for transitional callers. */
export type CompatSourceRef = LegacySourceRef;
export type CompatListEntry = LegacyListEntry;
export type CompatLoadResult = LegacyLoadResult;
export type CompatSaveResult = LegacySaveResult;
export type CompatCreateResult = LegacyCreateResult;
export type CompatAdapter = LegacyAdapter;
export const mapCompatKind = mapLegacyKind;
export const toCompatKind = toLegacyKind;
export const toCanonicalResourceRefFromCompat = toCanonicalResourceRef;
export const toCanonicalGameRefFromCompat = toCanonicalGameRef;
export const toCompatSourceRef = toLegacySourceRef;
