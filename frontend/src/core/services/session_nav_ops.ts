/**
 * createNavOps — board navigation and orientation operations.
 *
 * Integration API:
 * - `createNavOps(bundle, dispatchRef, stateRef, flushSessionState)` — call from
 *   `createSessionOrchestrator`; spread the result into `AppStartupServices`.
 *   Pure factory function; no React imports.
 *
 * Communication API:
 * - Navigation ops delegate to `bundle.navigation` and read/write
 *   `bundle.activeSessionRef.current` for selection and preview state.
 * - `flipBoard` dispatches `set_board_flipped` and writes the orientation header
 *   via `bundle.applyModelUpdate`.
 */

import {
  X2_BOARD_ORIENTATION_HEADER_KEY,
  deriveInitialBoardFlipped,
  getHeaderValue,
  setHeaderValue,
} from "../../model";
import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import type { BoardPreviewLike } from "../../board/runtime";
import type { AppAction } from "../state/actions";
import type { AppStoreState } from "../state/app_reducer";
import type { AppStartupServices } from "../contracts/app_services";
import type { ServicesBundle } from "./createAppServices";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import { log } from "../../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

type NavOps = Pick<
  AppStartupServices,
  | "gotoFirst"
  | "gotoPrev"
  | "gotoNext"
  | "gotoLast"
  | "gotoMoveById"
  | "handleEditorArrowHotkey"
  | "flipBoard"
  | "applyPgnModelEdit"
>;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns board navigation and orientation operations wired to the given bundle.
 *
 * @param bundle Fully-wired services bundle.
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param stateRef Mutable ref mirroring the latest React state.
 * @param flushSessionState Flush active session state to React.
 */
export const createNavOps = (
  bundle: ServicesBundle,
  dispatchRef: { current: (action: AppAction) => void },
  stateRef: { current: AppStoreState },
  flushSessionState: () => void,
): NavOps => ({
  gotoFirst: (): void => {
    void bundle.navigation.gotoPly(0, { animate: false });
  },
  gotoPrev: (): void => {
    void bundle.navigation.gotoRelativeStep(-1);
  },
  gotoNext: (): void => {
    void bundle.navigation.gotoRelativeStep(1);
  },
  gotoLast: (): void => {
    void bundle.navigation.gotoPly(bundle.activeSessionRef.current.moves.length, { animate: false });
  },
  gotoMoveById: (moveId: string): void => {
    try {
      const g: GameSessionState = bundle.activeSessionRef.current;
      const pos = g.movePositionById?.[moveId] as
        | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
        | undefined;
      if (pos && typeof pos.mainlinePly === "number") {
        g.selectedMoveId = moveId;
        g.boardPreview = null;
        flushSessionState();
        void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false }).catch((err: unknown): void => {
          const message: string = err instanceof Error ? err.message : String(err);
          log.error("session_nav_ops", `gotoMoveById/gotoPly failed: ${message}`);
        });
        return;
      }
      g.selectedMoveId = moveId;
      g.boardPreview = pos?.fen
        ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as BoardPreviewLike)
        : null;
      flushSessionState();
    } catch (err: unknown) {
      const message: string = err instanceof Error ? err.message : String(err);
      log.error("session_nav_ops", `gotoMoveById failed: ${message}`);
      dispatchRef.current({ type: "set_error_message", message });
    }
  },
  handleEditorArrowHotkey: (event: KeyboardEvent): boolean =>
    bundle.navigation.handleSelectedMoveArrowHotkey(event),

  flipBoard: (): void => {
    const newFlipped: boolean = !stateRef.current.boardFlipped;
    dispatchRef.current({ type: "set_board_flipped", flipped: newFlipped });
    const g: GameSessionState = bundle.activeSessionRef.current;
    const isSetUp: boolean = getHeaderValue(g.pgnModel, "SetUp", "") === "1";
    const isChess960: boolean =
      getHeaderValue(g.pgnModel, "Variant", "").trim().toLowerCase() === "chess960";
    if (!isSetUp || isChess960) {
      // Default / Chess960: persist as XSqrChessBoardOrientation header.
      // Empty value removes the header (= white, the default).
      const newModel = setHeaderValue(
        g.pgnModel as PgnModel,
        X2_BOARD_ORIENTATION_HEADER_KEY,
        newFlipped ? "black" : "",
      );
      bundle.applyModelUpdate(newModel, null, { recordHistory: true });
    }
  },

  applyPgnModelEdit: (newModel: PgnModel, targetMoveId: string | null): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    bundle.applyModelUpdate(newModel, null, {
      recordHistory: true,
      preferredLayoutMode: g.pgnLayoutMode,
    });
    log.debug("session_nav_ops", () => `applyPgnModelEdit: targetMoveId=${targetMoveId ?? "null"} moves=${g.moves.length} ply=${g.currentPly}`);
    if (targetMoveId) {
      const posMap = g.movePositionById as Record<string, { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null } | undefined> | undefined;
      const pos = posMap?.[targetMoveId];
      if (pos && typeof pos.mainlinePly === "number") {
        g.selectedMoveId = targetMoveId;
        g.boardPreview = null;
        void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
      } else if (pos?.fen) {
        g.selectedMoveId = targetMoveId;
        g.boardPreview = { fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as BoardPreviewLike;
        flushSessionState();
      }
    }
  },
});

// ── Shared utility ────────────────────────────────────────────────────────────

/**
 * Derive an initial board-flip state from the orientation header and return the
 * dispatch action. Exported for use in session-open operations.
 */
export const makeBoardFlipAction = (
  pgnModel: unknown,
): AppAction => ({
  type: "set_board_flipped",
  flipped: deriveInitialBoardFlipped(pgnModel),
});
