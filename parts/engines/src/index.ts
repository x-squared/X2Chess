/**
 * engines — chess engine integration module.
 *
 * Exports the public API surface for integrating UCI chess engines.
 * All modules are pure-logic; I/O is injected via EngineProcess.
 */

export type {
  UciOutputMessage,
  UciCommand,
  UciOption,
  EngineScore,
} from "./domain/uci_types";

export type {
  EngineConfig,
  EngineRegistry,
} from "./domain/engine_config";

export type {
  EnginePosition,
  AnalysisOptions,
  MoveSearchOptions,
  EngineVariation,
  EngineBestMove,
} from "./domain/analysis_types";

export { parseUciLine } from "./uci/uci_parser";
export { formatUciCommand } from "./uci/uci_writer";
export type { EngineProcess, UciSession } from "./uci/uci_session";
export { createUciSession } from "./uci/uci_session";

export { createTauriEngine } from "./adapters/tauri_engine";
export {
  createEngineManager,
  parseEngineRegistry,
} from "./client/engine_manager";
export type { EngineManager, ProcessFactory } from "./client/engine_manager";
