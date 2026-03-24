/**
 * RightPanelStack — tabbed panel area below the board/editor split pane.
 *
 * Renders Analysis, Opening Explorer, Tablebase, Collection Explorer,
 * Game Search, Position Search, and Text Search on named tabs. Only the
 * active tab's content is rendered; tabs are preserved across panel switches
 * via CSS visibility so stateful panels (analysis, search) don't reset.
 *
 * Integration API:
 * - `<RightPanelStack {...props} />` — rendered by AppShell in the app panel section.
 *
 * Communication API:
 * - All interactions fire the corresponding callback prop.
 */

import { useState, type ReactElement } from "react";
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
import { ResourceViewer } from "./ResourceViewer";

type PanelId =
  | "resources"
  | "analysis"
  | "opening"
  | "tablebase"
  | "collection"
  | "game-search"
  | "position-search"
  | "text-search";

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

const PANEL_TABS: Array<{ id: PanelId; label: string; labelKey: string }> = [
  { id: "resources",       label: "Resources",    labelKey: "panel.resources" },
  { id: "analysis",        label: "Analysis",     labelKey: "panel.analysis" },
  { id: "opening",         label: "Opening",      labelKey: "panel.opening" },
  { id: "tablebase",       label: "Endgame",      labelKey: "panel.tablebase" },
  { id: "collection",      label: "Collection",   labelKey: "panel.collection" },
  { id: "game-search",     label: "Games",        labelKey: "panel.gameSearch" },
  { id: "position-search", label: "Position",     labelKey: "panel.positionSearch" },
  { id: "text-search",     label: "Text",         labelKey: "panel.textSearch" },
];

export const RightPanelStack = ({
  variations, isAnalyzing, engineName, sideToMove,
  onStartAnalysis, onStopAnalysis,
  openingResult, openingIsLoading, openingSource, openingEnabled,
  onOpeningSourceChange, onOpeningToggle, onOpenSettings,
  tbResult, tbIsLoading, tbEnabled, onTbToggle,
  t, onMoveClick, onImportPgn, onOpenGame,
}: RightPanelStackProps): ReactElement => {
  const [activePanel, setActivePanel] = useState<PanelId>("resources");

  return (
    <div className="right-panel-stack">
      {/* Tab bar */}
      <div className="right-panel-tabs" role="tablist">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activePanel === tab.id}
            aria-controls={`right-panel-${tab.id}`}
            className={`right-panel-tab${activePanel === tab.id ? " active" : ""}`}
            onClick={(): void => { setActivePanel(tab.id); }}
          >
            {t(tab.labelKey, tab.label)}
          </button>
        ))}
      </div>

      {/* Panel contents — only the active one is visible */}
      <div className="right-panel-body">
        <div
          id="right-panel-resources"
          role="tabpanel"
          hidden={activePanel !== "resources"}
          className="right-panel-content right-panel-content-resources"
        >
          <ResourceViewer />
        </div>

        <div
          id="right-panel-analysis"
          role="tabpanel"
          hidden={activePanel !== "analysis"}
          className="right-panel-content"
        >
          <AnalysisPanel
            variations={variations}
            isAnalyzing={isAnalyzing}
            engineName={engineName}
            sideToMove={sideToMove}
            t={t}
            onStartAnalysis={onStartAnalysis}
            onStopAnalysis={onStopAnalysis}
          />
        </div>

        <div
          id="right-panel-opening"
          role="tabpanel"
          hidden={activePanel !== "opening"}
          className="right-panel-content"
        >
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
        </div>

        <div
          id="right-panel-tablebase"
          role="tabpanel"
          hidden={activePanel !== "tablebase"}
          className="right-panel-content"
        >
          <TablebasePanel
            result={tbResult}
            isLoading={tbIsLoading}
            enabled={tbEnabled}
            onToggle={onTbToggle}
            onMoveClick={onMoveClick}
            t={t}
          />
        </div>

        <div
          id="right-panel-collection"
          role="tabpanel"
          hidden={activePanel !== "collection"}
          className="right-panel-content"
        >
          <CollectionExplorerPanel t={t} onMoveClick={onMoveClick} />
        </div>

        <div
          id="right-panel-game-search"
          role="tabpanel"
          hidden={activePanel !== "game-search"}
          className="right-panel-content"
        >
          <GameSearchPanel onImport={onImportPgn} t={t} />
        </div>

        <div
          id="right-panel-position-search"
          role="tabpanel"
          hidden={activePanel !== "position-search"}
          className="right-panel-content"
        >
          <PositionSearchPanel t={t} onOpenGame={onOpenGame} />
        </div>

        <div
          id="right-panel-text-search"
          role="tabpanel"
          hidden={activePanel !== "text-search"}
          className="right-panel-content"
        >
          <TextSearchPanel t={t} onOpenGame={onOpenGame} />
        </div>
      </div>
    </div>
  );
};
