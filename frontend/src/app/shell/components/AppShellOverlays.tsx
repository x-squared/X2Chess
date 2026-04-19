/**
 * AppShellOverlays — all modal dialogs and overlay panels for AppShell.
 *
 * Integration API:
 * - `<AppShellOverlays {...props} />` — render inside `<ServiceContextProvider>`.
 *
 * Configuration API:
 * - Props carry all dialog visibility flags, their close callbacks, and the
 *   relevant hook-return objects (vsEngine, training, moveEntry, etc.).
 *
 * Communication API:
 * - Outbound: all interactions delegate to callbacks passed via props.
 * - No context reads; purely prop-driven.
 */

import type { ReactElement, RefObject } from "react";
import type { MoveEntryState } from "../../../features/editor/hooks/useMoveEntry";
import type { NavigateGuardState } from "../../../features/sessions/guards/useNavigateGuard";
import type { ExtDatabaseSettingsState } from "../../../features/resources/hooks/useExtDatabaseSettings";
import type { TrainingDialogControls } from "../../../features/training/hooks/useTrainingDialogState";
import type { TrainingSessionControls } from "../../../training/hooks/useTrainingSession";
import type { TrainingGameContext } from "../../../training/domain/training_game_context";
import type { GameAnnotationState } from "../../../features/analysis/hooks/useGameAnnotation";
import type { VsEngineState } from "../../../features/analysis/hooks/useVsEngine";
import type { AppStartupServices } from "../../../core/contracts/app_services";
import type { AppStoreState, SessionItemState } from "../../../core/state/app_reducer";
import type { BrowserPanelGateway } from "../../../resources/web_import/browser_panel_gateway";
import {
  selectEditorStylePrefs,
  selectDefaultLayoutPrefs,
  selectPgnModel,
} from "../../../core/state/selectors";
import { DisambiguationDialog } from "../../../components/board/DisambiguationDialog";
import { PromotionPicker } from "../../../components/board/PromotionPicker";
import { EditStartPositionDialog } from "../../../components/dialogs/EditStartPositionDialog";
import { ExtractPositionDialog } from "../../../components/dialogs/ExtractPositionDialog";
import { EditorStyleDialog } from "../../../features/settings/components/EditorStyleDialog";
import { DefaultLayoutDialog } from "../../../features/settings/components/DefaultLayoutDialog";
import { ExtDatabaseSettingsDialog } from "../../../features/settings/components/ExtDatabaseSettingsDialog";
import { TrainingHistoryPanel } from "../../../training/components/TrainingHistoryPanel";
import { TrainingLauncher } from "../../../training/components/TrainingLauncher";
import { TrainingResult } from "../../../training/components/TrainingResult";
import { CurriculumPanel } from "../../../training/components/CurriculumPanel";
import { AnnotateGameDialog } from "../../../components/dialogs/AnnotateGameDialog";
import { PlayVsEngineDialog } from "../../../components/dialogs/PlayVsEngineDialog";
import { WebImportBrowserPanel } from "../../../features/resources/components/WebImportBrowserPanel";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getVsEngineOutcomeText = (
  winner: string,
  playerSide: string | undefined,
  t: (key: string, fallback?: string) => string,
): string => {
  if (winner === "draw") return t("vsEngine.draw", "Draw");
  if (winner === playerSide) return t("vsEngine.youWon", "You won!");
  return t("vsEngine.engineWon", "Engine wins");
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type AppShellOverlaysProps = {
  // Move entry
  moveEntry: MoveEntryState;
  onMoveCancel: () => void;
  // Edit start position (NG7)
  showEditStartPos: boolean;
  onCloseEditStartPos: () => void;
  currentStartingFen: string;
  activeSessionId: string | null;
  // Extract position (UV5)
  showExtractDialog: boolean;
  onCloseExtractDialog: () => void;
  currentFen: string;
  currentPly: number;
  sanMoves: string[];
  activeSession: SessionItemState | undefined;
  // Navigate-away guard (M8)
  navigateGuard: NavigateGuardState;
  confirmDialogRef: RefObject<HTMLDialogElement | null>;
  rawServices: AppStartupServices;
  // Settings dialogs
  showEditorStyleDialog: boolean;
  onCloseEditorStyleDialog: () => void;
  showDefaultLayoutDialog: boolean;
  onCloseDefaultLayoutDialog: () => void;
  layoutMode: "plain" | "text" | "tree";
  state: AppStoreState;
  // External database settings
  showExtDbSettings: boolean;
  onCloseExtDbSettings: () => void;
  extDbSettings: ExtDatabaseSettingsState;
  // Training
  training: TrainingDialogControls;
  trainingControls: TrainingSessionControls;
  trainingSourceRef: string;
  trainingGameTitle: string;
  trainingGameContext: TrainingGameContext;
  pgnText: string;
  // Annotate game (G9)
  showAnnotateDialog: boolean;
  onCloseAnnotateDialog: () => void;
  gameAnnotation: GameAnnotationState;
  engineName: string | null;
  // Play vs engine (G8)
  showVsEngineDialog: boolean;
  onCloseVsEngineDialog: () => void;
  vsEngine: VsEngineState;
  // Web import
  browserPanelState: { gateway: BrowserPanelGateway; url: string; captureScript?: string } | null;
  onCaptureResult: (value: string) => void;
  onCloseBrowserPanel: () => void;
  // Shared
  services: AppStartupServices;
  t: (key: string, fallback?: string) => string;
};

// ── AppShellOverlays ──────────────────────────────────────────────────────────

/** Renders all modal dialogs and overlay panels for the AppShell. */
export const AppShellOverlays = ({
  moveEntry,
  onMoveCancel,
  showEditStartPos,
  onCloseEditStartPos,
  currentStartingFen,
  activeSessionId,
  showExtractDialog,
  onCloseExtractDialog,
  currentFen,
  currentPly,
  sanMoves,
  activeSession,
  navigateGuard,
  confirmDialogRef,
  rawServices,
  showEditorStyleDialog,
  onCloseEditorStyleDialog,
  showDefaultLayoutDialog,
  onCloseDefaultLayoutDialog,
  layoutMode,
  state,
  showExtDbSettings,
  onCloseExtDbSettings,
  extDbSettings,
  training,
  trainingControls,
  trainingSourceRef,
  trainingGameTitle,
  trainingGameContext,
  pgnText,
  showAnnotateDialog,
  onCloseAnnotateDialog,
  gameAnnotation,
  engineName,
  showVsEngineDialog,
  onCloseVsEngineDialog,
  vsEngine,
  browserPanelState,
  onCaptureResult,
  onCloseBrowserPanel,
  services,
  t,
}: AppShellOverlaysProps): ReactElement => (
  <>
    {/* ── Move entry dialogs ── */}
    {moveEntry.pendingFork && (
      <DisambiguationDialog
        playedSan={moveEntry.pendingFork.san}
        existingSan={moveEntry.pendingFork.existingNextSan}
        t={t}
        onDecide={moveEntry.handleForkDecide}
        onCancel={onMoveCancel}
      />
    )}
    {moveEntry.pendingPromotion && (
      <PromotionPicker
        color={moveEntry.pendingPromotion.color}
        t={t}
        onPick={moveEntry.handlePromotionPick}
        onCancel={onMoveCancel}
      />
    )}

    {/* ── Edit starting position dialog (NG7) ── */}
    {showEditStartPos && (
      <EditStartPositionDialog
        initialFen={currentStartingFen}
        t={t}
        onSave={(fen): void => {
          onCloseEditStartPos();
          if (!activeSessionId) return;
          services.updateGameInfoHeader(activeSessionId, "SetUp", "1");
          services.updateGameInfoHeader(activeSessionId, "FEN", fen);
        }}
        onClose={onCloseEditStartPos}
      />
    )}

    {/* ── Extract position dialog (UV5) ── */}
    {showExtractDialog && (
      <ExtractPositionDialog
        fen={currentFen}
        ply={currentPly}
        sanMoves={sanMoves}
        metadata={{
          white: activeSession?.white,
          black: activeSession?.black,
          event: activeSession?.event,
          date: activeSession?.date,
        }}
        t={t}
        onCreate={(pgn): void => {
          onCloseExtractDialog();
          services.openPgnText(pgn);
        }}
        onClose={onCloseExtractDialog}
      />
    )}

    {/* ── Navigate-away guard (M8) ── */}
    {navigateGuard.pendingNavigate && (
      <dialog
        ref={confirmDialogRef}
        className="x2-dialog"
        onClose={navigateGuard.clearPendingNavigate}
      >
        <div className="x2-dialog-body">
          <h2 className="x2-dialog-title">
            {t("editor.unsavedChangesTitle", "Unsaved changes")}
          </h2>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            {t("editor.unsavedChanges", "You have unsaved changes. Save before leaving?")}
          </p>
          <div className="x2-dialog-footer">
            <button
              type="button"
              className="x2-dialog-btn x2-dialog-btn--danger"
              onClick={(): void => {
                const nav = navigateGuard.pendingNavigate;
                navigateGuard.clearPendingNavigate();
                if (!nav) return;
                if (nav.kind === "close") {
                  rawServices.closeSession(nav.sessionId);
                  return;
                }
                // switch: reload the dirty session from source, then switch to target
                void rawServices.discardActiveSessionChanges().then((): void => {
                  rawServices.switchSession(nav.sessionId);
                });
              }}
            >
              {t("editor.discardChanges", "Discard & Leave")}
            </button>
            <button
              type="button"
              className="x2-dialog-btn x2-dialog-btn--ghost"
              onClick={navigateGuard.clearPendingNavigate}
            >
              {t("editor.cancelLeave", "Cancel")}
            </button>
            <button
              type="button"
              className="x2-dialog-btn x2-dialog-btn--primary"
              onClick={(): void => {
                rawServices.saveActiveGameNow();
                const nav = navigateGuard.pendingNavigate;
                navigateGuard.clearPendingNavigate();
                if (!nav) return;
                if (nav.kind === "switch") rawServices.switchSession(nav.sessionId);
                else rawServices.closeSession(nav.sessionId);
              }}
            >
              {t("editor.saveAndLeave", "Save & Leave")}
            </button>
          </div>
        </div>
      </dialog>
    )}

    {/* ── Editor style dialog ── */}
    {showEditorStyleDialog && (
      <EditorStyleDialog
        prefs={selectEditorStylePrefs(state)}
        pgnModel={selectPgnModel(state)}
        initialLayoutMode={layoutMode}
        onSave={(prefs): void => { services.setEditorStylePrefs(prefs); }}
        onClose={onCloseEditorStyleDialog}
      />
    )}

    {/* ── Default Layout dialog ── */}
    {showDefaultLayoutDialog && (
      <DefaultLayoutDialog
        prefs={selectDefaultLayoutPrefs(state)}
        onSave={(prefs): void => { services.setDefaultLayoutPrefs(prefs); }}
        onClose={onCloseDefaultLayoutDialog}
      />
    )}

    {/* ── External database settings ── */}
    {showExtDbSettings && (
      <ExtDatabaseSettingsDialog
        settings={extDbSettings.settings}
        onSave={(speeds, ratings): void => {
          extDbSettings.setOpeningExplorerSpeeds(speeds);
          extDbSettings.setOpeningExplorerRatings(ratings);
        }}
        onClose={onCloseExtDbSettings}
        t={t}
      />
    )}

    {/* ── Training dialogs ── */}
    {training.showTrainingHistory && (
      <TrainingHistoryPanel
        sourceGameRef={trainingSourceRef}
        onClose={(): void => { training.setShowTrainingHistory(false); }}
        onTrainAgain={(): void => {
          training.setShowTrainingHistory(false);
          training.setShowTrainingLauncher(true);
        }}
        t={t}
      />
    )}
    {training.showTrainingLauncher && (
      <TrainingLauncher
        gameTitle={trainingGameTitle}
        pgnText={pgnText}
        sourceRef={trainingSourceRef}
        gameContext={trainingGameContext}
        t={t}
        onStart={(config): void => {
          training.setShowTrainingLauncher(false);
          trainingControls.start(config);
        }}
        onCancel={(): void => { training.setShowTrainingLauncher(false); }}
      />
    )}
    {training.pendingTrainingPromotion && (
      <PromotionPicker
        color={
          trainingControls.sessionState?.position.fen.split(" ")[1] === "b"
            ? "b"
            : "w"
        }
        t={t}
        onPick={training.handleTrainingPromotionPick}
        onCancel={(): void => { training.setPendingTrainingPromotion(null); }}
      />
    )}
    {trainingControls.phase === "reviewing" &&
      trainingControls.summary &&
      trainingControls.transcript && (
        <TrainingResult
          summary={trainingControls.summary}
          transcript={trainingControls.transcript}
          t={t}
          onMerge={training.handleMergeResult}
          onDiscard={trainingControls.discard}
        />
      )}

    {/* ── Annotate game dialog (G9) ── */}
    {showAnnotateDialog && (
      <AnnotateGameDialog
        phase={gameAnnotation.phase}
        progress={gameAnnotation.progress}
        annotatedModel={gameAnnotation.annotatedModel}
        engineName={engineName}
        t={t}
        onStart={(opts): void => {
          gameAnnotation.start(
            selectPgnModel(state) ?? (() => { throw new Error("No PGN model available"); })(),
            opts,
          );
        }}
        onApply={(model): void => {
          onCloseAnnotateDialog();
          rawServices.applyPgnModelEdit(model, null);
        }}
        onCancel={gameAnnotation.cancel}
        onClose={onCloseAnnotateDialog}
      />
    )}

    {/* ── Play vs engine dialog (G8) ── */}
    {showVsEngineDialog && (
      <PlayVsEngineDialog
        engineName={engineName}
        t={t}
        onStart={(config): void => {
          onCloseVsEngineDialog();
          vsEngine.start(config);
        }}
        onCancel={onCloseVsEngineDialog}
      />
    )}
    {vsEngine.active && vsEngine.gameOver && (
      <dialog open className="vs-engine-gameover-dialog">
        <div className="vs-engine-gameover-content">
          <p className="vs-engine-gameover-message">
            {getVsEngineOutcomeText(vsEngine.gameOver.winner, vsEngine.playerSide, t)}{" "}
            <span className="vs-engine-gameover-reason">
              ({vsEngine.gameOver.reason})
            </span>
          </p>
          <button
            type="button"
            className="vs-engine-gameover-btn"
            onClick={(): void => { vsEngine.stop(); }}
          >
            {t("vsEngine.close", "Close")}
          </button>
        </div>
      </dialog>
    )}

    {/* ── Training curriculum panel ── */}
    {training.showCurriculumPanel && (
      <CurriculumPanel
        onClose={(): void => { training.setShowCurriculumPanel(false); }}
        onLaunchTask={training.handleLaunchTaskFromCurriculum}
        t={t}
      />
    )}

    {/* ── Web import browser panel (W4 — Tier 3) ── */}
    {browserPanelState !== null && (
      <WebImportBrowserPanel
        gateway={browserPanelState.gateway}
        url={browserPanelState.url}
        captureScript={browserPanelState.captureScript}
        onCaptureResult={onCaptureResult}
        onClose={onCloseBrowserPanel}
      />
    )}
  </>
);
