/**
 * uci_writer — format UCI commands as strings for engine stdin.
 *
 * Integration API:
 * - Exports: `formatUciCommand`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure function; no I/O or side effects.
 * - Each returned string is a complete UCI command line (no trailing newline).
 */

import type { UciCommand } from "../domain/uci_types";

/**
 * Format a `UciCommand` as a UCI protocol string ready to be written to the
 * engine's stdin (followed by a newline by the caller).
 */
export const formatUciCommand = (cmd: UciCommand): string => {
  switch (cmd.type) {
    case "uci":
      return "uci";

    case "debug":
      return `debug ${cmd.on ? "on" : "off"}`;

    case "isready":
      return "isready";

    case "setoption":
      return cmd.value !== undefined
        ? `setoption name ${cmd.name} value ${cmd.value}`
        : `setoption name ${cmd.name}`;

    case "ucinewgame":
      return "ucinewgame";

    case "position": {
      const posStr = cmd.startpos ? "startpos" : `fen ${cmd.fen ?? ""}`;
      const movesStr =
        cmd.moves.length > 0 ? ` moves ${cmd.moves.join(" ")}` : "";
      return `position ${posStr}${movesStr}`;
    }

    case "go": {
      const parts: string[] = ["go"];
      if (cmd.searchmoves && cmd.searchmoves.length > 0)
        parts.push("searchmoves", ...cmd.searchmoves);
      if (cmd.ponder)         parts.push("ponder");
      if (cmd.wtime !== undefined)   parts.push("wtime",   String(cmd.wtime));
      if (cmd.btime !== undefined)   parts.push("btime",   String(cmd.btime));
      if (cmd.winc !== undefined)    parts.push("winc",    String(cmd.winc));
      if (cmd.binc !== undefined)    parts.push("binc",    String(cmd.binc));
      if (cmd.movestogo !== undefined) parts.push("movestogo", String(cmd.movestogo));
      if (cmd.depth !== undefined)   parts.push("depth",   String(cmd.depth));
      if (cmd.nodes !== undefined)   parts.push("nodes",   String(cmd.nodes));
      if (cmd.mate !== undefined)    parts.push("mate",    String(cmd.mate));
      if (cmd.movetime !== undefined) parts.push("movetime", String(cmd.movetime));
      if (cmd.infinite)              parts.push("infinite");
      return parts.join(" ");
    }

    case "stop":
      return "stop";

    case "ponderhit":
      return "ponderhit";

    case "quit":
      return "quit";
  }
};
