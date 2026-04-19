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

import { useState } from "react";
import type { ReactElement } from "react";
import type { EngineVariation } from "../../../../../parts/engines/src/domain/analysis_types";
import type { OpeningResult } from "../../../resources/ext_databases/opening_types";
import type { TbProbeResult } from "../../../resources/ext_databases/endgame_types";
import { AnalysisPanel } from "../../../features/analysis/components/AnalysisPanel";
import { OpeningExplorerPanel } from "../../../features/analysis/components/OpeningExplorerPanel";
import { TablebasePanel } from "../../../features/analysis/components/TablebasePanel";
import { CollectionExplorerPanel } from "../../../features/resources/components/CollectionExplorerPanel";
import { GameSearchPanel } from "../../../features/resources/search/GameSearchPanel";
import { PositionSearchPanel } from "../../../features/resources/search/PositionSearchPanel";
import { TextSearchPanel } from "../../../features/resources/search/TextSearchPanel";
import { PlayersPanel } from "./PlayersPanel";
import { ResourceViewer } from "../../../features/resources/components/ResourceViewer";
import { SettingsPanel } from "../../../features/settings/components/SettingsPanel";
import { AstPanel } from "../../../features/editor/components/AstPanel";
import { RawPgnPanel } from "../../../features/editor/components/RawPgnPanel";
import type { ShapePrefs } from "../../../runtime/shape_prefs";
import { GUIDE_IDS } from "../../../features/guide/model/guide_ids";

export type PanelId =
  | "resources"
  | "analysis"
  | "opening"
  | "tablebase"
  | "collection"
  | "game-search"
  | "position-search"
  | "text-search"
  | "players"
  | "settings"
  | "dev-tools";

type RightPanelStackProps = {
  // Dev tools
  devToolsEnabled: boolean;
  // Engine analysis
  variations: EngineVariation[];
  isAnalyzing: boolean;
  engineName: string | null;
  sideToMove: "w" | "b";
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  onPvMoveHover?: (pvSans: string[], upToIndex: number, rect: DOMRect) => void;
  onPvMoveHoverEnd?: () => void;
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
  // Settings
  shapePrefs: ShapePrefs;
  onShapePrefsChange: (prefs: ShapePrefs) => void;
  // Panel navigation — controlled from outside
  activePanel: PanelId;
  onActivePanelChange: (panel: PanelId) => void;
  // Players panel
  onSearchPlayer: (query: string) => void;
  textSearchTrigger?: { query: string };
  // Common
  t: (key: string, fallback?: string) => string;
  onMoveClick: (uci: string) => void;
  onImportPgn: (pgnText: string) => void;
  onOpenGame: (sourceRef: unknown) => void;
};

const PANEL_TABS: Array<{ id: PanelId; label: string; labelKey: string; tabGuideId: string; devOnly?: boolean }> = [
  { id: "resources",       label: "Resources",    labelKey: "panel.resources",      tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_RESOURCES },
  { id: "analysis",        label: "Analysis",     labelKey: "panel.analysis",       tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_ANALYSIS },
  { id: "opening",         label: "Opening",      labelKey: "panel.opening",        tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_OPENING },
  { id: "tablebase",       label: "Endgame",      labelKey: "panel.tablebase",      tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_TABLEBASE },
  { id: "collection",      label: "Collection",   labelKey: "panel.collection",     tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_COLLECTION },
  { id: "game-search",     label: "Games",        labelKey: "panel.gameSearch",     tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_GAME_SEARCH },
  { id: "position-search", label: "Position",     labelKey: "panel.positionSearch", tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_POSITION_SEARCH },
  { id: "text-search",     label: "Text",         labelKey: "panel.textSearch",     tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_TEXT_SEARCH },
  { id: "players",         label: "Players",      labelKey: "panel.players",        tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_PLAYERS },
  { id: "settings",        label: "Settings",     labelKey: "panel.settings",       tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_SETTINGS },
  { id: "dev-tools",       label: "Dev Tools",    labelKey: "panel.devTools",       tabGuideId: GUIDE_IDS.RIGHT_PANEL_TAB_DEV_TOOLS, devOnly: true },
];

export const RightPanelStack = ({
  devToolsEnabled,
  variations, isAnalyzing, engineName, sideToMove,
  onStartAnalysis, onStopAnalysis,
  onPvMoveHover, onPvMoveHoverEnd,
  openingResult, openingIsLoading, openingSource, openingEnabled,
  onOpeningSourceChange, onOpeningToggle, onOpenSettings,
  tbResult, tbIsLoading, tbEnabled, onTbToggle,
  shapePrefs, onShapePrefsChange,
  activePanel, onActivePanelChange,
  onSearchPlayer, textSearchTrigger,
  t, onMoveClick, onImportPgn, onOpenGame,
}: RightPanelStackProps): ReactElement => {
  const setActivePanel = onActivePanelChange;
  const [devSubTab, setDevSubTab] = useState<"ast" | "pgn">("ast");
  const visibleTabs = devToolsEnabled ? PANEL_TABS : PANEL_TABS.filter((tab) => !tab.devOnly);

  return (
    <div className="right-panel-stack" data-guide-id={GUIDE_IDS.RIGHT_PANEL_STACK}>
      {/* Tab bar */}
      <div className="right-panel-tabs" role="tablist" data-guide-id={GUIDE_IDS.RIGHT_PANEL_TABS}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activePanel === tab.id}
            aria-controls={`right-panel-${tab.id}`}
            className={`right-panel-tab${activePanel === tab.id ? " active" : ""}`}
            data-guide-id={tab.tabGuideId}
            onClick={(): void => { setActivePanel(tab.id); }}
          >
            {t(tab.labelKey, tab.label)}
          </button>
        ))}
      </div>

      {/* Panel contents — only the active one is visible */}
      <div className="right-panel-body" data-guide-id={GUIDE_IDS.RIGHT_PANEL_BODY}>
        <div
          id="right-panel-resources"
          role="tabpanel"
          hidden={activePanel !== "resources"}
          className="right-panel-content right-panel-content-resources"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_RESOURCES}
        >
          <ResourceViewer />
        </div>

        <div
          id="right-panel-analysis"
          role="tabpanel"
          hidden={activePanel !== "analysis"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_ANALYSIS}
        >
          <AnalysisPanel
            variations={variations}
            isAnalyzing={isAnalyzing}
            engineName={engineName}
            sideToMove={sideToMove}
            t={t}
            onStartAnalysis={onStartAnalysis}
            onStopAnalysis={onStopAnalysis}
            onPvMoveHover={onPvMoveHover}
            onPvMoveHoverEnd={onPvMoveHoverEnd}
          />
        </div>

        <div
          id="right-panel-opening"
          role="tabpanel"
          hidden={activePanel !== "opening"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_OPENING}
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
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_TABLEBASE}
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
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_COLLECTION}
        >
          <CollectionExplorerPanel t={t} onMoveClick={onMoveClick} />
        </div>

        <div
          id="right-panel-game-search"
          role="tabpanel"
          hidden={activePanel !== "game-search"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_GAME_SEARCH}
        >
          <GameSearchPanel onImport={onImportPgn} t={t} />
        </div>

        <div
          id="right-panel-position-search"
          role="tabpanel"
          hidden={activePanel !== "position-search"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_POSITION_SEARCH}
        >
          <PositionSearchPanel t={t} onOpenGame={onOpenGame} />
        </div>

        <div
          id="right-panel-text-search"
          role="tabpanel"
          hidden={activePanel !== "text-search"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_TEXT_SEARCH}
        >
          <TextSearchPanel t={t} onOpenGame={onOpenGame} externalSearch={textSearchTrigger} />
        </div>

        <div
          id="right-panel-players"
          role="tabpanel"
          hidden={activePanel !== "players"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_PLAYERS}
        >
          <PlayersPanel t={t} onSearchPlayer={onSearchPlayer} />
        </div>

        <div
          id="right-panel-settings"
          role="tabpanel"
          hidden={activePanel !== "settings"}
          className="right-panel-content"
          data-guide-id={GUIDE_IDS.RIGHT_PANEL_SETTINGS}
        >
          <SettingsPanel prefs={shapePrefs} onPrefsChange={onShapePrefsChange} t={t} />
        </div>

        {devToolsEnabled && (
          <div
            id="right-panel-dev-tools"
            role="tabpanel"
            hidden={activePanel !== "dev-tools"}
            className="right-panel-content"
            data-guide-id={GUIDE_IDS.RIGHT_PANEL_DEV_TOOLS}
          >
            <div className="developer-dock-tabs" role="tablist" aria-label={t("controls.developerTools", "Developer Tools")}>
              <button
                className="developer-dock-tab"
                type="button"
                role="tab"
                aria-selected={devSubTab === "ast"}
                onClick={(): void => { setDevSubTab("ast"); }}
              >
                {t("pgn.ast.label", "AST")}
              </button>
              <button
                className="developer-dock-tab"
                type="button"
                role="tab"
                aria-selected={devSubTab === "pgn"}
                onClick={(): void => { setDevSubTab("pgn"); }}
              >
                {t("devDock.tab.rawPgn", "Raw PGN")}
              </button>
            </div>
            <div className="developer-dock-body">
              <div
                className="developer-dock-panel"
                hidden={devSubTab !== "ast"}
                role="tabpanel"
              >
                <AstPanel />
              </div>
              <div
                className="developer-dock-panel"
                hidden={devSubTab !== "pgn"}
                role="tabpanel"
              >
                <RawPgnPanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
