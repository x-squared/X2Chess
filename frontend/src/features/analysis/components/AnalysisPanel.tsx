/**
 * AnalysisPanel — real-time engine analysis display panel.
 *
 * Shows the top N principal variations as visual cards (colored left border,
 * score badge, depth pill, PV moves). Inline controls let the user pick the
 * number of lines, thread count, active engine, and moves to search.
 * Each variation card has two action icons to insert the first move or the
 * full PV line into the game.
 *
 * Integration API:
 * - `<AnalysisPanel variations={...} isAnalyzing={...} engineName={...}
 *     engines={...} activeEngineId={...} multiPv={...} threads={...}
 *     searchMoves={...} discoveredOptions={...} legalMoves={...}
 *     sideToMove={...} onStartAnalysis={...} onStopAnalysis={...}
 *     onSetMultiPv={...} onSetThreads={...} onSetActiveEngine={...}
 *     onSetSearchMoves={...} onOpenEngineManager={...}
 *     onInsertFirstMove={...} onInsertLine={...}
 *     onPvMoveHover={...} onPvMoveHoverEnd={...} t={...} />`
 *
 * Communication API:
 * - `onPvClick(pvSans)` — variation line clicked for board preview.
 * - `onPvMoveHover(pvSans, upToIndex, rect)` — individual move hovered.
 * - `onPvMoveHoverEnd()` — hover ended.
 * - `onStartAnalysis()` / `onStopAnalysis()` — toggle analysis.
 * - `onSetMultiPv(n)` / `onSetThreads(n)` / `onSetActiveEngine(id)` — controls.
 * - `onSetSearchMoves(moves|null)` — restrict analysis to specific moves.
 * - `onInsertFirstMove(uci)` — insert the first PV move into the game.
 * - `onInsertLine(pvUci)` — insert the full PV as a game continuation.
 * - `onOpenEngineManager()` — gear icon clicked.
 */

import { useState, useCallback, type ReactElement, type ChangeEvent } from "react";
import type { EngineVariation } from "../../../../../parts/engines/src/domain/analysis_types";
import type { EngineScore, UciOption } from "../../../../../parts/engines/src/domain/uci_types";
import type { EngineConfig } from "../../../../../parts/engines/src/domain/engine_config";
import type { LegalMove } from "../../../board/move_position";
import { UI_IDS } from "../../../core/model/ui_ids";
import { buildPvMoveTokens, type PvDisplayToken } from "../pv_move_tokens";

// ── Score helpers ─────────────────────────────────────────────────────────────

const formatScore = (score: EngineScore, sideToMove: "w" | "b"): string => {
  const flip = sideToMove === "b" ? -1 : 1;
  if (score.type === "mate") {
    const m = score.value * flip;
    return m > 0 ? `M${m}` : `-M${Math.abs(m)}`;
  }
  const cp = score.value * flip;
  const pawns = (cp / 100).toFixed(2);
  return cp >= 0 ? `+${pawns}` : pawns;
};

const scoreColor = (score: EngineScore, sideToMove: "w" | "b"): string => {
  if (score.type === "mate") {
    const m = (sideToMove === "b" ? -1 : 1) * score.value;
    return m > 0 ? "#9333ea" : "#7c3aed";
  }
  const cp = score.value * (sideToMove === "b" ? -1 : 1);
  if (cp >= 300) return "#15803d";
  if (cp >= 100) return "#16a34a";
  if (cp >= 30)  return "#4ade80";
  if (cp >= -30) return "#6b7280";
  if (cp >= -100) return "#f87171";
  if (cp >= -300) return "#dc2626";
  return "#7f1d1d";
};

const scoreBg = (score: EngineScore, sideToMove: "w" | "b"): string => {
  if (score.type === "mate") return "rgba(147,51,234,0.06)";
  const cp = score.value * (sideToMove === "b" ? -1 : 1);
  if (cp >= 100) return "rgba(21,128,61,0.06)";
  if (cp >= 30)  return "rgba(74,222,128,0.06)";
  if (cp >= -30) return "transparent";
  if (cp >= -100) return "rgba(248,113,113,0.06)";
  return "rgba(220,38,38,0.07)";
};

const formatNodes = (nodes: number): string => {
  if (nodes > 1_000_000) return `${(nodes / 1_000_000).toFixed(1)}M`;
  if (nodes > 1_000) return `${(nodes / 1_000).toFixed(0)}k`;
  return String(nodes);
};

// ── Variation card ────────────────────────────────────────────────────────────

type VariationCardProps = {
  variation: EngineVariation;
  rank: number;
  sideToMove: "w" | "b";
  onPvClick?: (pvSans: string[]) => void;
  onPvMoveHover?: (pvSans: string[], upToIndex: number, rect: DOMRect) => void;
  onPvMoveHoverEnd?: () => void;
  onInsertFirstMove?: (uci: string) => void;
  onInsertLine?: (pvUci: string[]) => void;
  t: (key: string, fallback?: string) => string;
};

const VariationCard = ({
  variation: v,
  rank,
  sideToMove,
  onPvClick,
  onPvMoveHover,
  onPvMoveHoverEnd,
  onInsertFirstMove,
  onInsertLine,
  t,
}: VariationCardProps): ReactElement => {
  const pv = v.pvSan ?? v.pv;
  const pvUci = v.pv;
  const color = scoreColor(v.score, sideToMove);
  const bg = scoreBg(v.score, sideToMove);
  const scoreStr = formatScore(v.score, sideToMove);
  const tokens: PvDisplayToken[] = buildPvMoveTokens(pv.slice(0, 10), sideToMove);
  const clickable = pv.length > 0;

  return (
    <li className={`ap-card${rank === 0 ? " ap-card--top" : ""}`} style={{ borderLeftColor: color, background: bg }}>
      {/* Clickable overlay button (full-card click for PV preview) */}
      {clickable && (
        <button
          type="button"
          className="ap-card-click-target"
          onClick={(): void => { onPvClick?.(pv); }}
          title={t("analysis.panel.clickToPreview", "Click to preview")}
          aria-label={t("analysis.panel.clickToPreview", "Click to preview")}
        />
      )}

      {/* Action icons */}
      <span className="ap-card-actions">
        <button
          type="button"
          className="ap-card-action-btn"
          title={t("analysis.panel.insertFirstMove", "Insert first move")}
          aria-label={t("analysis.panel.insertFirstMove", "Insert first move")}
          disabled={pvUci.length === 0}
          onClick={(e): void => {
            e.stopPropagation();
            if (pvUci[0]) onInsertFirstMove?.(pvUci[0]);
          }}
        >
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 7h8M7 3l4 4-4 4" />
          </svg>
        </button>
        <button
          type="button"
          className="ap-card-action-btn"
          title={t("analysis.panel.insertLine", "Insert full line")}
          aria-label={t("analysis.panel.insertLine", "Insert full line")}
          disabled={pvUci.length === 0}
          onClick={(e): void => {
            e.stopPropagation();
            onInsertLine?.(pvUci);
          }}
        >
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 7h4M3 4l3 3-3 3" />
            <path d="M6 7h5M9 4l3 3-3 3" />
          </svg>
        </button>
      </span>

      {/* Score badge */}
      <span className="ap-card-score" style={{ color }}>{scoreStr}</span>

      {/* Depth pill */}
      <span className="ap-card-depth">
        d{v.depth}{v.selDepth ? `/${v.selDepth}` : ""}
      </span>

      {/* PV moves with move numbers */}
      <span className="ap-card-pv">
        {tokens.map((tok) =>
          tok.isNumber ? (
            <span key={tok.key} className="ap-pv-num">{tok.label}</span>
          ) : (
            <button
              key={tok.key}
              type="button"
              className="ap-pv-move"
              onMouseEnter={
                onPvMoveHover
                  ? (e): void => {
                      onPvMoveHover(
                        pv,
                        tok.moveIndex,
                        (e.currentTarget as HTMLButtonElement).getBoundingClientRect(),
                      );
                    }
                  : undefined
              }
              onMouseLeave={onPvMoveHoverEnd}
              onClick={(e): void => { e.stopPropagation(); onPvClick?.(pv.slice(0, tok.moveIndex + 1)); }}
            >
              {tok.label}
            </button>
          )
        )}
        {pv.length > 10 ? "…" : ""}
      </span>

      {/* Node count */}
      {v.nodes !== undefined && (
        <span className="ap-card-nodes">{formatNodes(v.nodes)}</span>
      )}
    </li>
  );
};

// ── Search-moves dialog ───────────────────────────────────────────────────────

type SearchMovesDialogProps = {
  legalMoves: LegalMove[];
  searchMoves: string[] | null;
  onConfirm: (moves: string[] | null) => void;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
};

const SearchMovesDialog = ({
  legalMoves,
  searchMoves,
  onConfirm,
  onClose,
  t,
}: SearchMovesDialogProps): ReactElement => {
  const initialSelected = searchMoves ? new Set(searchMoves) : new Set<string>();
  const [selected, setSelected] = useState<Set<string>>(initialSelected);

  const toggle = (uci: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uci)) next.delete(uci); else next.add(uci);
      return next;
    });
  };

  const handleConfirm = (): void => {
    onConfirm(selected.size > 0 ? Array.from(selected) : null);
    onClose();
  };

  return (
    <dialog
      className="ap-sm-dialog"
      open
      aria-label={t("analysis.panel.searchMoves.title", "Moves to analyse")}
      onKeyDown={(e): void => { if (e.key === "Escape") onClose(); }}
    >
      <div className="ap-sm-header">
        <span className="ap-sm-title">{t("analysis.panel.searchMoves.title", "Moves to analyse")}</span>
        <button type="button" className="ap-sm-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>
      <p className="ap-sm-hint">
        {t("analysis.panel.searchMoves.hint", "Select moves to restrict engine search. Leave empty for all.")}
      </p>
      <div className="ap-sm-moves">
        {legalMoves.map((m) => (
          <button
            key={m.uci}
            type="button"
            className={`ap-sm-move-btn${selected.has(m.uci) ? " ap-sm-move-btn--on" : ""}`}
            onClick={(): void => { toggle(m.uci); }}
          >
            {m.san}
          </button>
        ))}
      </div>
      <div className="ap-sm-footer">
        <button
          type="button"
          className="ap-sm-btn-secondary"
          onClick={(): void => { setSelected(new Set()); }}
        >
          {t("analysis.panel.searchMoves.clearAll", "Clear all")}
        </button>
        <button type="button" className="ap-sm-btn-primary" onClick={handleConfirm}>
          {t("analysis.panel.searchMoves.apply", "Apply")}
        </button>
      </div>
    </dialog>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

type AnalysisPanelProps = {
  variations: EngineVariation[];
  isAnalyzing: boolean;
  engineName: string | null;
  activeEngineId: string | undefined;
  engines: EngineConfig[];
  multiPv: number;
  threads: number;
  searchMoves: string[] | null;
  discoveredOptions: Map<string, UciOption[]>;
  legalMoves: LegalMove[];
  sideToMove: "w" | "b";
  t: (key: string, fallback?: string) => string;
  onPvClick?: (pvSans: string[]) => void;
  onPvMoveHover?: (pvSans: string[], upToIndex: number, rect: DOMRect) => void;
  onPvMoveHoverEnd?: () => void;
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  onSetMultiPv: (n: number) => void;
  onSetThreads: (n: number) => void;
  onSetActiveEngine: (id: string) => void;
  onSetSearchMoves: (moves: string[] | null) => void;
  onOpenEngineManager: () => void;
  onInsertFirstMove?: (uci: string) => void;
  onInsertLine?: (pvUci: string[]) => void;
};

// ── Controls row ──────────────────────────────────────────────────────────────

type ControlsRowProps = {
  engines: EngineConfig[];
  activeEngineId: string | undefined;
  multiPv: number;
  threads: number;
  searchMoves: string[] | null;
  discoveredOptions: Map<string, UciOption[]>;
  legalMoves: LegalMove[];
  t: (key: string, fallback?: string) => string;
  onSetActiveEngine: (id: string) => void;
  onSetMultiPv: (n: number) => void;
  onSetThreads: (n: number) => void;
  onSetSearchMoves: (moves: string[] | null) => void;
  onOpenEngineManager: () => void;
};

const LINES_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0] as const;

const ControlsRow = ({
  engines,
  activeEngineId,
  multiPv,
  threads,
  searchMoves,
  discoveredOptions,
  legalMoves,
  t,
  onSetActiveEngine,
  onSetMultiPv,
  onSetThreads,
  onSetSearchMoves,
  onOpenEngineManager,
}: ControlsRowProps): ReactElement => {
  const [showSearchDialog, setShowSearchDialog] = useState(false);

  const activeEngine = engines.find((e) => e.id === activeEngineId);
  const configuredThreads = Number(activeEngine?.options["Threads"]);
  const activeOpts = discoveredOptions.get(activeEngineId ?? "");
  const threadsOpt = activeOpts?.find(
    (o): o is Extract<UciOption, { type: "spin" }> => o.type === "spin" && o.name === "Threads",
  );
  const maxThreads = configuredThreads > 0 ? configuredThreads : (threadsOpt?.max ?? 16);
  const threadOptions = Array.from({ length: maxThreads }, (_, i) => i + 1);

  const hasFilter = searchMoves !== null && searchMoves.length > 0;

  return (
    <>
      <div className="ap-controls">
        {engines.length > 0 ? (
          <select
            className="ap-engine-select"
            value={activeEngineId ?? ""}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void => { onSetActiveEngine(e.target.value); }}
            title={t("analysis.panel.engineSelect", "Active engine")}
          >
            {engines.map((eng) => (
              <option key={eng.id} value={eng.id}>{eng.label}</option>
            ))}
          </select>
        ) : (
          <span className="ap-no-engine-hint">{t("analysis.panel.noEngineHint", "No engine")}</span>
        )}

        <span className="ap-ctrl-label">{t("analysis.panel.lines", "Lines")}</span>
        <select
          className="ap-ctrl-select"
          value={multiPv}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void => { onSetMultiPv(Number(e.target.value)); }}
          title={t("analysis.panel.linesTitle", "Number of lines")}
        >
          {LINES_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? t("analysis.panel.linesAll", "All") : String(n)}
            </option>
          ))}
        </select>

        <span className="ap-ctrl-label">{t("analysis.panel.threads", "Threads")}</span>
        <select
          className="ap-ctrl-select"
          value={threads}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void => { onSetThreads(Number(e.target.value)); }}
          title={t("analysis.panel.threadsTitle", "CPU threads")}
        >
          {threadOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Moves to analyse filter button */}
        <button
          type="button"
          className={`ap-filter-btn${hasFilter ? " ap-filter-btn--active" : ""}`}
          onClick={(): void => { setShowSearchDialog(true); }}
          title={t("analysis.panel.searchMovesBtn", "Moves to analyse")}
          aria-label={t("analysis.panel.searchMovesBtn", "Moves to analyse")}
          disabled={legalMoves.length === 0}
        >
          <svg viewBox="0 0 14 14" width="13" height="13" fill="none"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1,2 13,2 8.5,7.5 8.5,12 5.5,12 5.5,7.5" />
          </svg>
          {hasFilter && <span className="ap-filter-count">{searchMoves?.length}</span>}
        </button>

        <button
          type="button"
          className="ap-mgr-btn"
          onClick={onOpenEngineManager}
          title={t("analysis.panel.manageEngines", "Manage engines…")}
          aria-label={t("analysis.panel.manageEngines", "Manage engines…")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {showSearchDialog && (
        <SearchMovesDialog
          legalMoves={legalMoves}
          searchMoves={searchMoves}
          onConfirm={onSetSearchMoves}
          onClose={(): void => { setShowSearchDialog(false); }}
          t={t}
        />
      )}
    </>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Analysis panel: card-based PV display with inline controls.
 */
export const AnalysisPanel = ({
  variations,
  isAnalyzing,
  engineName,
  activeEngineId,
  engines,
  multiPv,
  threads,
  searchMoves,
  discoveredOptions,
  legalMoves,
  sideToMove,
  t,
  onPvClick,
  onPvMoveHover,
  onPvMoveHoverEnd,
  onStartAnalysis,
  onStopAnalysis,
  onSetMultiPv,
  onSetThreads,
  onSetActiveEngine,
  onSetSearchMoves,
  onOpenEngineManager,
  onInsertFirstMove,
  onInsertLine,
}: AnalysisPanelProps): ReactElement => {
  const handlePvClick = useCallback(
    (pvSans: string[]): void => { onPvClick?.(pvSans); },
    [onPvClick],
  );

  const topVariation = variations[0];
  const evalStr = topVariation ? formatScore(topVariation.score, sideToMove) : null;
  const evalColor = topVariation ? scoreColor(topVariation.score, sideToMove) : "#6b7280";

  const titleText = engineName
    ? `${t("analysis.panel.title", "Analysis")}: ${engineName}`
    : t("analysis.panel.title", "Engine Analysis");

  const idleText = engineName
    ? t("analysis.panel.idle", "Press Analyze to start")
    : t("analysis.panel.noEngineHint", "Configure an engine to enable analysis.");

  const emptyState = isAnalyzing
    ? <p className="ap-waiting">{t("analysis.panel.waiting", "Waiting for engine…")}</p>
    : <p className="ap-idle">{idleText}</p>;

  return (
    <div className="ap-panel" data-ui-id={UI_IDS.ANALYSIS_PANEL}>

      {/* ── Header ── */}
      <div className="ap-header" data-ui-id={UI_IDS.ANALYSIS_PANEL_HEADER}>
        <span className="ap-title">{titleText}</span>
        {evalStr && (
          <span className="ap-eval" style={{ color: evalColor }}>{evalStr}</span>
        )}
        <button
          type="button"
          className={`ap-toggle-btn${isAnalyzing ? " ap-toggle-btn--stop" : ""}`}
          onClick={isAnalyzing ? onStopAnalysis : onStartAnalysis}
          disabled={engineName === null}
          title={engineName === null ? t("analysis.panel.noEngine", "No engine configured") : undefined}
        >
          {isAnalyzing
            ? t("analysis.panel.stop", "Stop")
            : t("analysis.panel.analyze", "Analyze")}
        </button>
      </div>

      {/* ── Controls row ── */}
      <ControlsRow
        engines={engines}
        activeEngineId={activeEngineId}
        multiPv={multiPv}
        threads={threads}
        searchMoves={searchMoves}
        discoveredOptions={discoveredOptions}
        legalMoves={legalMoves}
        t={t}
        onSetActiveEngine={onSetActiveEngine}
        onSetMultiPv={onSetMultiPv}
        onSetThreads={onSetThreads}
        onSetSearchMoves={onSetSearchMoves}
        onOpenEngineManager={onOpenEngineManager}
      />

      {/* ── Variation cards ── */}
      {variations.length > 0 ? (
        <ol className="ap-cards" data-ui-id={UI_IDS.ANALYSIS_PANEL_VARIATIONS}>
          {variations.map((v, rank) => (
            <VariationCard
              key={v.multipvIndex}
              variation={v}
              rank={rank}
              sideToMove={sideToMove}
              onPvClick={handlePvClick}
              onPvMoveHover={onPvMoveHover}
              onPvMoveHoverEnd={onPvMoveHoverEnd}
              onInsertFirstMove={onInsertFirstMove}
              onInsertLine={onInsertLine}
              t={t}
            />
          ))}
        </ol>
      ) : emptyState}
    </div>
  );
};
