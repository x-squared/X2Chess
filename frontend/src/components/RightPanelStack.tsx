/**
 * RightPanelStack — the column of analysis and search panels rendered to the
 * right of the board/editor split pane.
 *
 * Contains: AnalysisPanel, OpeningExplorerPanel, TablebasePanel,
 * CollectionExplorerPanel, GameSearchPanel, PositionSearchPanel, TextSearchPanel.
 * All state and callbacks flow in as props from AppShell.
 *
 * Integration API:
 * - `<RightPanelStack {...props} />` — rendered by AppShell in the app panel section.
 *
 * Communication API:
 * - All interactions fire the corresponding callback prop.
 */

import type { ReactElement } from "react";
import type { EngineVariation } from "../../../engines/domain/analysis_types";
import type { OpeningResult } from "../resources/ext_databases/opening_types";
import type { TbProbeResult } from "../resources/ext_databases/endgame_types";
import { AnalysisPanel } from "./AnalysisPanel";
import { OpeningExplorerPanel } from "./OpeningExplorerPanel";
import { TablebasePanel } from "./TablebasePanel";
import { CollectionExplorerPanel } from "./CollectionExplorerPanel";
import { GameSearchPanel } from "./GameSearchPanel";
import { PositionSearchPanel } from "./PositionSearchPanel";
import { TextSearchPanel } from "./TextSearchPanel";

type RightPanelStackProps = {
  // Engine analysis
  variations: EngineVariation[];
  isAnalyzing: boolean;
  engineName: string | null;
  sideToMove: "w" | "b";
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  // Opening explorer
  openingResult: OpeningResult | null;
  openingIsLoading: boolean;
  openingSource: "masters" | "lichess";
  openingEnabled: boolean;
  onOpeningSourceChange: (source: "masters" | "lichess") => void;
  onOpeningToggle: (enabled: boolean) => void;
  onOpenSettings: () => void;
  // Tablebase
  tbResult: TbProbeResult | null;
  tbIsLoading: boolean;
  tbEnabled: boolean;
  onTbToggle: (enabled: boolean) => void;
  // Common
  t: (key: string, fallback?: string) => string;
  onMoveClick: (uci: string) => void;
  onImportPgn: (pgnText: string) => void;
  onOpenGame: (sourceRef: unknown) => void;
};

export const RightPanelStack = ({
  variations, isAnalyzing, engineName, sideToMove,
  onStartAnalysis, onStopAnalysis,
  openingResult, openingIsLoading, openingSource, openingEnabled,
  onOpeningSourceChange, onOpeningToggle, onOpenSettings,
  tbResult, tbIsLoading, tbEnabled, onTbToggle,
  t, onMoveClick, onImportPgn, onOpenGame,
}: RightPanelStackProps): ReactElement => (
  <>
    <AnalysisPanel
      variations={variations}
      isAnalyzing={isAnalyzing}
      engineName={engineName}
      sideToMove={sideToMove}
      t={t}
      onStartAnalysis={onStartAnalysis}
      onStopAnalysis={onStopAnalysis}
    />

    <OpeningExplorerPanel
      result={openingResult}
      isLoading={openingIsLoading}
      source={openingSource}
      onSourceChange={onOpeningSourceChange}
      enabled={openingEnabled}
      onToggle={onOpeningToggle}
      onOpenSettings={onOpenSettings}
      t={t}
    />

    <TablebasePanel
      result={tbResult}
      isLoading={tbIsLoading}
      enabled={tbEnabled}
      onToggle={onTbToggle}
      onMoveClick={onMoveClick}
      t={t}
    />

    <CollectionExplorerPanel t={t} onMoveClick={onMoveClick} />

    <GameSearchPanel onImport={onImportPgn} t={t} />

    <PositionSearchPanel t={t} onOpenGame={onOpenGame} />

    <TextSearchPanel t={t} onOpenGame={onOpenGame} />
  </>
);
