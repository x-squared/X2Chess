/**
 * engine_option_help — composes static + machine-specific UCI option tooltip text.
 */

import type { UciOption } from "../../../../parts/engines/src/domain/uci_types";
import type { HostHardwareSnapshot } from "./host_hardware_hints";
import { suggestedEngineLimits } from "./host_hardware_hints";

type Translator = (key: string, fallback?: string) => string;

const OPTION_HELP_STATIC: Record<string, string> = {
  Hash:
    "Transposition table size in MB. The engine caches analyzed positions here to avoid re-analyzing them. " +
    "Larger values improve analysis depth for the same time. Rule of thumb: use ~25 % of available RAM.",
  Threads:
    "Number of CPU threads the engine may use. More threads = faster analysis on multi-core machines. " +
    "Leave one or two cores free for the operating system.",
  MultiPV:
    "Number of principal variations (lines) the engine calculates simultaneously. " +
    "1 = strongest play; 3–5 = useful for studying alternative moves.",
  "Skill Level":
    "Engine playing strength (Stockfish). 0 = weakest, 20 = full strength. " +
    "Lower values introduce deliberate mistakes, useful for practice.",
  "Move Overhead":
    "Extra time (ms) reserved per move for network/GUI latency. Rarely needs changing in local analysis.",
  "UCI_LimitStrength":
    "When enabled, the engine restricts its strength to the configured Elo rating.",
  "UCI_Elo":
    "Target Elo rating when UCI_LimitStrength is on. Supported range is roughly 1320–3190.",
  "SyzygyPath":
    "Path to Syzygy endgame tablebase files. Tablebases provide perfect play in positions " +
    "with few pieces; point this to the directory containing .rtbw/.rtbz files.",
  "SyzygyProbeDepth":
    "Minimum search depth before the engine consults the tablebase. Lower values probe more often.",
  "SyzygyProbeLimit":
    "Maximum number of pieces (including kings) for tablebase lookups. 7 requires 7-piece tablebases.",
  "Syzygy50MoveRule":
    "Respect the fifty-move rule when probing Syzygy tablebases.",
  EvalFile:
    "Path to the NNUE evaluation network file (.nnue). Leave empty to use the bundled network.",
  nodestime:
    "Use node count instead of real time for time management (useful for reproducible testing).",
  NumaPolicy:
    "NUMA memory policy for multi-socket systems. 'auto' works for most users.",
  Ponder:
    "Allow the engine to think during the opponent's turn (pondering). Requires explicit support from the GUI.",
};

const hashHelpWithMachine = (
  base: string,
  opt: UciOption,
  hints: HostHardwareSnapshot,
  t: Translator,
): string => {
  const engineMaxMb: number = opt.type === "spin" ? Math.floor(Number(opt.max)) : 0;
  const { hashMegabytes } = suggestedEngineLimits(hints, opt);
  if (
    hints.totalRamMegabytes !== null &&
    hashMegabytes !== null &&
    engineMaxMb > 0
  ) {
    const ramGb: string = (hints.totalRamMegabytes / 1024).toFixed(1);
    return (
      `${base}\n\n` +
      t(
        "engines.config.help.hashMachine",
        "This system has about {{ramGb}} GB RAM ({{ramMb}} MB). A practical Hash target is often around {{suggestMb}} MB (~25% of that memory), up to this engine’s maximum of {{engineMaxMb}} MB.",
      )
        .replace("{{ramGb}}", ramGb)
        .replace("{{ramMb}}", String(Math.round(hints.totalRamMegabytes)))
        .replace("{{suggestMb}}", String(hashMegabytes))
        .replace("{{engineMaxMb}}", String(engineMaxMb))
    );
  }
  if (engineMaxMb > 0) {
    return (
      `${base}\n\n` +
      t(
        "engines.config.help.hashMachineNoRam",
        "Installed RAM is not available from this environment. As a rule of thumb, set Hash to about 25% of physical memory, not above this engine’s maximum of {{engineMaxMb}} MB.",
      ).replace("{{engineMaxMb}}", String(engineMaxMb))
    );
  }
  return base;
};

const threadsHelpWithMachine = (
  base: string,
  opt: UciOption,
  hints: HostHardwareSnapshot,
  t: Translator,
): string => {
  const engineMaxThreads: number =
    opt.type === "spin" ? Math.floor(Number(opt.max)) : 0;
  const { threads } = suggestedEngineLimits(hints, opt);
  if (
    hints.logicalProcessors !== null &&
    threads !== null &&
    engineMaxThreads > 0
  ) {
    return (
      `${base}\n\n` +
      t(
        "engines.config.help.threadsMachine",
        "This system reports {{cores}} logical processors. Reserving two for the OS suggests up to about {{suggest}} threads for analysis (within this engine’s maximum of {{engineMax}}).",
      )
        .replace("{{cores}}", String(hints.logicalProcessors))
        .replace("{{suggest}}", String(threads))
        .replace("{{engineMax}}", String(engineMaxThreads))
    );
  }
  if (engineMaxThreads > 0) {
    return (
      `${base}\n\n` +
      t(
        "engines.config.help.threadsMachineNoCores",
        "This environment does not expose CPU count. Leave one or two cores free for the OS; this engine allows at most {{engineMax}} threads.",
      ).replace("{{engineMax}}", String(engineMaxThreads))
    );
  }
  return base;
};

/**
 * Full tooltip body for a named option (base copy + machine hints when applicable).
 *
 * @param optName UCI option name (e.g. `Hash`, `Threads`).
 * @param opt Parsed option metadata from the engine.
 * @param hints Host RAM/CPU snapshot or null while loading.
 * @param t Translator for user-visible strings.
 * @returns Tooltip text, or undefined when no built-in help exists for this option.
 */
export const composeOptionHelpText = (
  optName: string,
  opt: UciOption,
  hints: HostHardwareSnapshot | null,
  t: Translator,
): string | undefined => {
  const base: string | undefined = OPTION_HELP_STATIC[optName];
  if (base === undefined) {
    return undefined;
  }

  if (hints === null || (optName !== "Hash" && optName !== "Threads")) {
    return base;
  }

  if (optName === "Hash") {
    return hashHelpWithMachine(base, opt, hints, t);
  }

  return threadsHelpWithMachine(base, opt, hints, t);
};
