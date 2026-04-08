/**
 * Index module for format importers.
 *
 * Integration API:
 * - Primary exports: `formatImporterFor`, `buildTauriFormatImportGateway`.
 * - Re-exports: `FormatImporter`, `FormatImportGateway`, `FormatImportResult`,
 *   `ImportedGame`, `ImportError`.
 *
 * Configuration API:
 * - None; importers are instantiated on first use via `formatImporterFor`.
 *
 * Communication API:
 * - `formatImporterFor(extension)` returns the appropriate `FormatImporter` or
 *   `null` if the extension is not supported.
 * - `buildTauriFormatImportGateway` constructs the production gateway for
 *   Tauri desktop builds.
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
import type { FormatImporter, FormatImportGateway } from "./format_import_types";

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

// ── Gateway builder ───────────────────────────────────────────────────────────

type TauriWindowLike = Window & {
  __TAURI__?: {
    core?: {
      invoke?: (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

/**
 * Build the production `FormatImportGateway` for Tauri desktop builds.
 *
 * Text reads delegate to the same Tauri `load_text_file` command used by the
 * file adapter. Binary-format invocations go through `__TAURI__.core.invoke`
 * directly.
 */
export const buildTauriFormatImportGateway = (): FormatImportGateway => {
  const getInvoke = (): (cmd: string, args?: Record<string, unknown>) => Promise<unknown> => {
    const win = window as TauriWindowLike;
    const fn = win.__TAURI__?.core?.invoke;
    if (typeof fn !== "function") throw new Error("Tauri invoke API is unavailable.");
    return fn as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };

  return {
    readTextFile: async (path: string): Promise<string> => {
      return String(await getInvoke()("load_text_file", { filePath: path }));
    },
    invokeTauriCommand: async <T>(
      cmd: string,
      args: Record<string, unknown>,
    ): Promise<T> => {
      return getInvoke()(cmd, args) as Promise<T>;
    },
  };
};
