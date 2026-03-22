/**
 * uci_parser — parse UCI engine output lines into typed message objects.
 *
 * Integration API:
 * - Exports: `parseUciLine`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure function; no I/O or side effects.
 * - Returns `null` for lines that are not recognized UCI output.
 */

import type {
  UciOutputMessage,
  UciOption,
  EngineScore,
} from "../domain/uci_types";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Split a line into whitespace-separated tokens. */
const tokens = (line: string): string[] =>
  line.trim().split(/\s+/).filter(Boolean);

/**
 * Extract the value of a named field from a token array.
 * The field name is expected to be followed immediately by its value token(s).
 * Returns `undefined` if the field is not present.
 */
const field = (toks: string[], name: string): string | undefined => {
  const idx = toks.indexOf(name);
  if (idx === -1 || idx + 1 >= toks.length) return undefined;
  return toks[idx + 1];
};

/**
 * Extract a multi-token value from a named field up to (but not including)
 * the next known keyword in `stopWords`.
 */
const fieldUntil = (
  toks: string[],
  name: string,
  stopWords: readonly string[],
): string[] => {
  const idx = toks.indexOf(name);
  if (idx === -1) return [];
  const start = idx + 1;
  let end = toks.length;
  for (let i = start; i < toks.length; i++) {
    if (stopWords.includes(toks[i])) {
      end = i;
      break;
    }
  }
  return toks.slice(start, end);
};

// ── option line parser ────────────────────────────────────────────────────────

/**
 * Parse an `option name ... type ...` line.
 * Returns `null` if the line cannot be parsed as a valid option.
 */
const parseOption = (toks: string[]): UciOption | null => {
  // option name <name> type <type> [default <x>] [min <x>] [max <x>] [var <v>]*
  const typeIdx = toks.indexOf("type");
  const nameIdx = toks.indexOf("name");
  if (nameIdx === -1 || typeIdx === -1 || typeIdx <= nameIdx) return null;

  const name = toks.slice(nameIdx + 1, typeIdx).join(" ");
  const optType = toks[typeIdx + 1];

  switch (optType) {
    case "check": {
      const def = field(toks, "default");
      return { type: "check", name, default: def === "true" };
    }
    case "spin": {
      const def = Number.parseInt(field(toks, "default") ?? "0", 10);
      const min = Number.parseInt(field(toks, "min") ?? "0", 10);
      const max = Number.parseInt(field(toks, "max") ?? "0", 10);
      return { type: "spin", name, default: def, min, max };
    }
    case "combo": {
      const def = field(toks, "default") ?? "";
      const vars: string[] = [];
      for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i] === "var") vars.push(toks[i + 1]);
      }
      return { type: "combo", name, default: def, vars };
    }
    case "button":
      return { type: "button", name };
    case "string": {
      const defToks = fieldUntil(toks, "default", []);
      return { type: "string", name, default: defToks.join(" ") };
    }
    default:
      return null;
  }
};

// ── info line parser ──────────────────────────────────────────────────────────

const INFO_STOP_WORDS = Object.freeze([
  "depth", "seldepth", "multipv", "score", "nodes", "nps", "hashfull",
  "tbhits", "time", "pv", "currmove", "currmovenumber", "string",
]);

const parseScore = (toks: string[]): EngineScore | undefined => {
  const scoreIdx = toks.indexOf("score");
  if (scoreIdx === -1) return undefined;
  const kind = toks[scoreIdx + 1];
  const raw = Number.parseInt(toks[scoreIdx + 2] ?? "0", 10);
  if (kind === "cp") return { type: "cp", value: raw };
  if (kind === "mate") return { type: "mate", value: raw };
  return undefined;
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a single line of UCI engine output into a typed message.
 * Returns `null` for unrecognized lines (e.g. empty lines, debug output).
 */
export const parseUciLine = (line: string): UciOutputMessage | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const toks = tokens(trimmed);
  const cmd = toks[0];

  switch (cmd) {
    case "uciok":
      return { type: "uciok" };

    case "readyok":
      return { type: "readyok" };

    case "id": {
      const fieldName = toks[1];
      if (fieldName !== "name" && fieldName !== "author") return null;
      const value = toks.slice(2).join(" ");
      return { type: "id", field: fieldName, value };
    }

    case "option": {
      const opt = parseOption(toks.slice(1));
      if (!opt) return null;
      return { type: "option", option: opt };
    }

    case "info": {
      const rest = toks.slice(1);
      const pvToks = fieldUntil(rest, "pv", []);
      const stringToks = fieldUntil(rest, "string", []);
      return {
        type: "info",
        depth:            field(rest, "depth")            !== undefined ? Number.parseInt(field(rest, "depth")!, 10)            : undefined,
        selDepth:         field(rest, "seldepth")         !== undefined ? Number.parseInt(field(rest, "seldepth")!, 10)         : undefined,
        multipv:          field(rest, "multipv")          !== undefined ? Number.parseInt(field(rest, "multipv")!, 10)          : undefined,
        nodes:            field(rest, "nodes")            !== undefined ? Number.parseInt(field(rest, "nodes")!, 10)            : undefined,
        nps:              field(rest, "nps")              !== undefined ? Number.parseInt(field(rest, "nps")!, 10)              : undefined,
        hashFull:         field(rest, "hashfull")         !== undefined ? Number.parseInt(field(rest, "hashfull")!, 10)         : undefined,
        tbHits:           field(rest, "tbhits")           !== undefined ? Number.parseInt(field(rest, "tbhits")!, 10)           : undefined,
        time:             field(rest, "time")             !== undefined ? Number.parseInt(field(rest, "time")!, 10)             : undefined,
        currmovenumber:   field(rest, "currmovenumber")   !== undefined ? Number.parseInt(field(rest, "currmovenumber")!, 10)   : undefined,
        currmove:         field(rest, "currmove"),
        score:            parseScore(rest),
        pv:               pvToks.length > 0 ? pvToks : undefined,
        string:           stringToks.length > 0 ? stringToks.join(" ") : undefined,
      };
    }

    case "bestmove": {
      const move = toks[1];
      if (!move || move === "(none)") return null;
      const ponder = toks[2] === "ponder" ? toks[3] : undefined;
      return { type: "bestmove", move, ponder };
    }

    default:
      return null;
  }
};
