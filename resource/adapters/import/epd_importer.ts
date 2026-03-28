/**
 * epd_importer — converts EPD (Extended Position Description) files to PGN games.
 *
 * Integration API:
 * - Primary export: `createEpdImporter`.
 *
 * Configuration API:
 * - None; the importer is stateless.
 *
 * Communication API:
 * - Implements `FormatImporter`.
 * - Pure text processing; delegates file I/O to the injected `FormatImportGateway`.
 *
 * EPD format (one record per line):
 *   <piece-placement> <side-to-move> <castling> <en-passant> [opcode operand;]...
 *
 * The four positional fields form a FEN without move counters. Appending "0 1"
 * produces a valid 6-field FEN. Operations after the position fields are
 * semicolon-separated key-value pairs; string operands are double-quoted.
 *
 * Recognized opcodes:
 *   id   → [Event] PGN header (position label)
 *   bm   → [Annotator] header (best-move hint)
 *   c0–c9 → PGN comment attached to the position
 *   ce   → centipawn evaluation, appended to comment
 *   All other opcodes are silently ignored.
 */

import type { FormatImporter, FormatImportGateway, FormatImportResult, ImportedGame, ImportError } from "./format_import_types";

// ── EPD record parsing ────────────────────────────────────────────────────────

type EpdOpcodes = {
  id?: string;
  bm?: string;
  comments: string[];
  ce?: string;
};

/**
 * Expand a 4-field EPD position string to a full 6-field FEN.
 * If the input already has 6 fields it is returned unchanged.
 */
const expandToFen = (fourFieldFen: string): string => {
  const parts = fourFieldFen.trim().split(/\s+/);
  if (parts.length >= 6) return fourFieldFen.trim();
  // Pad missing halfmove clock and fullmove number.
  while (parts.length < 5) parts.push("0");
  if (parts.length === 5) parts.push("1");
  return parts.join(" ");
};

/**
 * Strip surrounding double-quotes from a string operand if present.
 * `"Sicilian Defense"` → `Sicilian Defense`
 */
const stripQuotes = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

/**
 * Parse the opcode section of an EPD record.
 * Input: everything after the 4-field position string.
 * Operations are separated by semicolons; each is `opcode operand?`.
 */
const parseOpcodes = (opSection: string): EpdOpcodes => {
  const result: EpdOpcodes = { comments: [] };
  const ops = opSection.split(";").map((s) => s.trim()).filter(Boolean);
  for (const op of ops) {
    const spaceIdx = op.indexOf(" ");
    if (spaceIdx === -1) continue; // Bare opcode without operand — skip.
    const code = op.slice(0, spaceIdx).trim();
    const operand = op.slice(spaceIdx + 1).trim();
    if (code === "id") {
      result.id = stripQuotes(operand);
    } else if (code === "bm") {
      result.bm = operand;
    } else if (code === "ce") {
      result.ce = operand;
    } else if (/^c\d$/.test(code)) {
      const text = stripQuotes(operand);
      if (text) result.comments.push(text);
    }
    // All other opcodes (am, acd, acn, acs, pv, …) are ignored.
  }
  return result;
};

/**
 * Parse one EPD line into its position string and opcodes section.
 * Returns null for blank lines and comment lines (starting with `#`).
 */
const parseEpdLine = (
  line: string,
): { position: string; opcodes: EpdOpcodes } | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  // Split off the first 4 whitespace-delimited tokens (the positional fields).
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 4) return null;

  const position = tokens.slice(0, 4).join(" ");
  const opSection = tokens.slice(4).join(" ");
  const opcodes = parseOpcodes(opSection);

  return { position, opcodes };
};

// ── PGN serialization ─────────────────────────────────────────────────────────

/**
 * Serialize a parsed EPD record as a minimal PGN game.
 *
 * Produces:
 *   [Event "..."]
 *   [SetUp "1"]
 *   [FEN "..."]
 *   [Annotator "bm: ..."]   (only if bm present)
 *
 *   { comment text }         (only if c0–c9 or ce present)
 *   *
 */
const epdToPgn = (
  position: string,
  opcodes: EpdOpcodes,
  fallbackLabel: string,
): string => {
  const fen = expandToFen(position);
  const eventName = opcodes.id ?? fallbackLabel;

  const headers: string[] = [
    `[Event "${eventName}"]`,
    `[SetUp "1"]`,
    `[FEN "${fen}"]`,
  ];

  if (opcodes.bm) {
    headers.push(`[Annotator "bm: ${opcodes.bm}"]`);
  }

  const commentParts: string[] = [...opcodes.comments];
  if (opcodes.ce) {
    commentParts.push(`eval: ${opcodes.ce}`);
  }

  const commentBlock =
    commentParts.length > 0 ? `{ ${commentParts.join(" | ")} }` : "";

  const bodyParts = [commentBlock, "*"].filter(Boolean);
  return [...headers, "", bodyParts.join(" ")].join("\n");
};

// ── Importer ──────────────────────────────────────────────────────────────────

const EPD_EXTENSIONS = ["epd"] as const;

/**
 * Create an EPD format importer.
 */
export const createEpdImporter = (): FormatImporter => ({
  supportedExtensions: EPD_EXTENSIONS,

  async importFile(
    filePath: string,
    gateway: FormatImportGateway,
  ): Promise<FormatImportResult> {
    let text: string;
    try {
      text = await gateway.readTextFile(filePath);
    } catch (err) {
      return {
        ok: false,
        error: `Could not read file: ${err instanceof Error ? err.message : String(err)}`,
        partial: [],
      };
    }

    const games: ImportedGame[] = [];
    const errors: ImportError[] = [];
    const lines = text.split(/\r?\n/);
    let recordIndex = 0;

    for (const line of lines) {
      const parsed = parseEpdLine(line);
      if (!parsed) continue;

      const currentIndex = recordIndex++;
      try {
        const pgn = epdToPgn(
          parsed.position,
          parsed.opcodes,
          `EPD position ${currentIndex + 1}`,
        );
        games.push({ pgn, sourcePath: filePath, sourceIndex: currentIndex });
      } catch (err) {
        errors.push({
          sourceIndex: currentIndex,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { ok: true, games, errors };
  },
});
