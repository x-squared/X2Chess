/**
 * boards — Physical chess board integration module.
 *
 * Re-exports the public API of all sub-modules.
 */

// Domain types
export type {
  PieceCode,
  SquareId,
  BoardState,
  LedCommand,
  LedFrame,
  LedSignal,
  BoardSignalKind,
  MoveCandidate,
  BoardConnection,
} from "./domain/board_types";

export type {
  BoardGateway,
  SerialHandle,
  BleHandle,
  PortInfo,
  BlePeripheral,
} from "./domain/board_gateway";

export type { BoardProfile } from "./domain/board_profile";
export {
  MILLENNIUM_CHESSLINK_V1,
  DGT_USB_V3,
  BUILT_IN_PROFILES,
  findProfile,
} from "./domain/board_profile";

// Protocol utilities
export {
  boardDiff,
  computeSyncSignal,
  computeMoveSignal,
} from "./protocol/board_diff";

// Simulator
export type { BoardSimulator } from "./adapters/simulator_adapter";
export {
  createBoardSimulator,
  parseFenPlacement,
} from "./adapters/simulator_adapter";
