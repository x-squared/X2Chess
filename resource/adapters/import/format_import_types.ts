/**
 * format_import_types — shared types for chess database format importers.
 *
 * Integration API:
 * - Primary exports: `FormatImporter`, `FormatImportGateway`, `FormatImportResult`,
 *   `ImportedGame`.
 *
 * Configuration API:
 * - None; all configuration is via injected `FormatImportGateway`.
 *
 * Communication API:
 * - Pure data types; no side effects.
 */

// ── Per-game result ───────────────────────────────────────────────────────────

/** One game extracted from a source file. */
export type ImportedGame = {
  /** PGN text for this game, ready for parsing by the canonical resource layer. */
  pgn: string;
  /** Absolute path of the source file (for error attribution). */
  sourcePath: string;
  /** 0-based index of this record within the source file. */
  sourceIndex: number;
};

/** A game that could not be parsed. */
export type ImportError = {
  /** 0-based index of the failing record within the source file. */
  sourceIndex: number;
  message: string;
};

// ── Import result ─────────────────────────────────────────────────────────────

export type FormatImportResult =
  | { ok: true; games: ImportedGame[]; errors: ImportError[] }
  | { ok: false; error: string; partial: ImportedGame[] };

// ── Gateway ───────────────────────────────────────────────────────────────────

/**
 * I/O abstraction injected into format importers.
 * Allows importers to be tested without Tauri or a real filesystem.
 */
export type FormatImportGateway = {
  /** Read a file as UTF-8 text (EPD and other text formats). */
  readTextFile: (path: string) => Promise<string>;
  /**
   * Invoke a Tauri command that returns structured JSON data.
   * Used by binary-format importers (CBH, CBV) that delegate parsing to Rust.
   */
  invokeTauriCommand: <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
};

// ── Importer contract ─────────────────────────────────────────────────────────

/**
 * A format importer converts a single file into an array of PGN game strings.
 * Importers are one-shot converters; they do not implement `PgnResourceAdapter`.
 */
export interface FormatImporter {
  /** File extensions this importer handles, lower-case without leading dot. */
  readonly supportedExtensions: readonly string[];
  /**
   * Import all games from `filePath`.
   *
   * @param filePath  Absolute path to the source file.
   * @param gateway   Injected I/O gateway.
   */
  importFile(
    filePath: string,
    gateway: FormatImportGateway,
  ): Promise<FormatImportResult>;
}
