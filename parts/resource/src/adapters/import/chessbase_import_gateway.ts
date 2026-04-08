/**
 * chessbase_import_gateway — ChessBase CBH/CBV format importer via Tauri command.
 *
 * Integration API:
 * - Primary export: `createChessbaseImporter`.
 *
 * Configuration API:
 * - None; I/O is fully delegated to the injected `FormatImportGateway`.
 *
 * Communication API:
 * - Implements `FormatImporter`.
 * - Delegates all binary parsing to the Tauri command `import_chessbase_file`
 *   which must be implemented on the Rust/backend side (see contract below).
 * - The TypeScript layer is complete; this module requires no further frontend
 *   changes once the Rust command is available.
 *
 * Supported extensions:
 *   cbh  — ChessBase database header file (the entry point for a CBH set)
 *   cbv  — ChessBase compressed archive (wraps a full CBH set in one file)
 *
 * ── Rust command contract ────────────────────────────────────────────────────
 *
 * The backend must expose:
 *
 *   #[tauri::command]
 *   fn import_chessbase_file(file_path: String) -> Result<ChessbaseImportResponse, String>
 *
 * Where `ChessbaseImportResponse` serializes to:
 *
 *   {
 *     "games":  string[],          // PGN text for each successfully parsed game
 *     "errors": { "index": number, "message": string }[]
 *   }
 *
 * The command must accept both `.cbh` (treating it as the database root) and
 * `.cbv` (decompressing in-memory before parsing). It must not write any files
 * to disk; all output flows through the return value.
 *
 * Recommended Rust crates: `cb_reader` or equivalent reverse-engineered parser.
 * Supported ChessBase versions: CB 14 and later (earlier versions may parse
 * partially; the command should return partial results rather than failing).
 */

import type {
  FormatImporter,
  FormatImportGateway,
  FormatImportResult,
  ImportedGame,
  ImportError,
} from "./format_import_types";

// ── Tauri response shape ──────────────────────────────────────────────────────

type ChessbaseImportResponse = {
  games: string[];
  errors: Array<{ index: number; message: string }>;
};

const isChessbaseImportResponse = (value: unknown): value is ChessbaseImportResponse => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v["games"]) &&
    Array.isArray(v["errors"]) &&
    (v["games"] as unknown[]).every((g) => typeof g === "string")
  );
};

// ── Importer ──────────────────────────────────────────────────────────────────

const CHESSBASE_EXTENSIONS = ["cbh", "cbv"] as const;

/**
 * Create a ChessBase format importer.
 *
 * Calls the Tauri backend command `import_chessbase_file` to perform binary
 * parsing in Rust. Returns a stub error when Tauri is unavailable (browser
 * builds, unit tests without a mocked gateway).
 */
export const createChessbaseImporter = (): FormatImporter => ({
  supportedExtensions: CHESSBASE_EXTENSIONS,

  async importFile(
    filePath: string,
    gateway: FormatImportGateway,
  ): Promise<FormatImportResult> {
    let raw: unknown;
    try {
      raw = await gateway.invokeTauriCommand<unknown>(
        "import_chessbase_file",
        { filePath },
      );
    } catch (err) {
      return {
        ok: false,
        error: `ChessBase import command failed: ${err instanceof Error ? err.message : String(err)}`,
        partial: [],
      };
    }

    if (!isChessbaseImportResponse(raw)) {
      return {
        ok: false,
        error: "Unexpected response shape from import_chessbase_file command.",
        partial: [],
      };
    }

    const games: ImportedGame[] = raw.games.map(
      (pgn, index): ImportedGame => ({ pgn, sourcePath: filePath, sourceIndex: index }),
    );

    const errors: ImportError[] = raw.errors.map(
      ({ index, message }): ImportError => ({ sourceIndex: index, message }),
    );

    return { ok: true, games, errors };
  },
});
