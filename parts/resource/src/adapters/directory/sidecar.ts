/**
 * Directory sidecar — reads and writes `.x2chess-meta.json` alongside PGN directories.
 *
 * The sidecar stores per-game order and extra metadata that PGN files cannot
 * carry natively. It is a simple JSON file placed next to the directory it
 * annotates (or inside a `config/` sub-directory if preferred in future).
 *
 * Integration API:
 * - Primary exports: `readSidecar`, `writeSidecar`, `sidecarPath`.
 *
 * Configuration API:
 * - Sidecar filename is `SIDECAR_FILENAME` constant.
 *
 * Communication API:
 * - All I/O delegated to the injected `FsGateway`.
 */

import type { FsGateway } from "../../io/fs_gateway";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SIDECAR_FILENAME = ".x2chess-meta.json";

// ── Schema ────────────────────────────────────────────────────────────────────

export type SidecarGameMeta = {
  /** Explicit display order index (lower = first). */
  orderIndex?: number;
  /** Arbitrary extra key/value pairs not in the PGN headers. */
  extra?: Record<string, string>;
};

export type SidecarData = {
  version: 1;
  /** Schema UUID associated with this directory resource. Travels with the resource when copied. */
  schemaId?: string;
  games: Record<string, SidecarGameMeta>;
};

const emptySidecar = (): SidecarData => ({ version: 1, games: {} });

const isSidecarData = (v: unknown): v is SidecarData => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && o.games !== null && typeof o.games === "object";
};

// ── Path helper ───────────────────────────────────────────────────────────────

/**
 * Derive the sidecar path for a given directory locator.
 *
 * @param directoryLocator Absolute directory path (the games folder).
 * @returns Absolute path to the sidecar file.
 */
export const sidecarPath = (directoryLocator: string): string => {
  const dir = directoryLocator.replace(/[\\/]+$/, "");
  return `${dir}/${SIDECAR_FILENAME}`;
};

// ── I/O helpers ───────────────────────────────────────────────────────────────

/**
 * Read the sidecar for a directory, returning an empty sidecar on any error.
 *
 * @param fsGateway Filesystem gateway.
 * @param directoryLocator Games directory path.
 * @returns Parsed sidecar data.
 */
export const readSidecar = async (
  fsGateway: FsGateway,
  directoryLocator: string,
): Promise<SidecarData> => {
  try {
    const raw = await fsGateway.readTextFile(sidecarPath(directoryLocator));
    const parsed: unknown = JSON.parse(raw);
    return isSidecarData(parsed) ? parsed : emptySidecar();
  } catch {
    return emptySidecar();
  }
};

/**
 * Write the sidecar for a directory.
 *
 * @param fsGateway Filesystem gateway.
 * @param directoryLocator Games directory path.
 * @param data Sidecar payload to persist.
 */
export const writeSidecar = async (
  fsGateway: FsGateway,
  directoryLocator: string,
  data: SidecarData,
): Promise<void> => {
  const path = sidecarPath(directoryLocator);
  await fsGateway.writeTextFile(path, JSON.stringify(data, null, 2));
};
