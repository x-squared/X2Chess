/**
 * Index module for format importers.
 *
 * Integration API:
 * - Primary export: `formatImporterFor`.
 * - Re-exports: `FormatImporter`, `FormatImportGateway`, `FormatImportResult`,
 *   `ImportedGame`, `ImportError`.
 *
 * Configuration API:
 * - None; importers are instantiated on first use via `formatImporterFor`.
 *
 * Communication API:
 * - `formatImporterFor(extension)` returns the appropriate `FormatImporter` or
 *   `null` if the extension is not supported.
 * - The Tauri-backed `FormatImportGateway` implementation lives in the frontend
 *   integration point (`tauri_gateways.ts`), not here.
 */

export type {
  FormatImporter,
  FormatImportGateway,
  FormatImportResult,
  ImportedGame,
  ImportError,
} from "./format_import_types";

import { createEpdImporter } from "./epd_importer";
import { createChessbaseImporter } from "./chessbase_import_gateway";
import type { FormatImporter } from "./format_import_types";

// ── Registry ──────────────────────────────────────────────────────────────────

// Importers are singletons — they are stateless and safe to share.
const _epd = createEpdImporter();
const _chessbase = createChessbaseImporter();

const ALL_IMPORTERS: FormatImporter[] = [_epd, _chessbase];

/**
 * Return the importer for `extension` (lower-case, without leading dot),
 * or `null` if no importer supports it.
 *
 * @example
 * const importer = formatImporterFor("epd");
 * if (importer) {
 *   const result = await importer.importFile(path, gateway);
 * }
 */
export const formatImporterFor = (extension: string): FormatImporter | null => {
  const ext = extension.toLowerCase().replace(/^\./, "");
  return (
    ALL_IMPORTERS.find((imp) => imp.supportedExtensions.includes(ext)) ?? null
  );
};

