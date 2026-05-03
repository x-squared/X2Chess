/**
 * AnalysisPanel — real-time engine analysis display panel.
 *
 * Shows the top N principal variations as visual cards (colored left border,
 * score badge, depth pill, PV moves). Inline controls let the user pick the
 * number of lines, thread count, and active engine without leaving the panel.
 * Hovering individual PV moves previews the board position.
 *
 * Integration API:
 * - `<AnalysisPanel variations={...} isAnalyzing={...} engineName={...}
 *     engines={...} activeEngineId={...} multiPv={...} threads={...}
 *     sideToMove={...} onStartAnalysis={...} onStopAnalysis={...}
 *     onSetMultiPv={...} onSetThreads={...} onSetActiveEngine={...}
 *     onOpenEngineManager={...} onPvMoveHover={...} onPvMoveHoverEnd={...}
 *     t={...} />`
 *
 * Communication API:
 * - `onPvClick(pvSans)` — variation line clicked for board preview.
 * - `onPvMoveHover(pvSans, upToIndex, rect)` — individual move hovered.
 * - `onPvMoveHoverEnd()` — hover ended.
 * - `onStartAnalysis()` / `onStopAnalysis()` — toggle analysis.
 * - `onSetMultiPv(n)` / `onSetThreads(n)` / `onSetActiveEngine(id)` — controls.
 * - `onOpenEngineManager()` — gear icon clicked.
 */

import { useCallback, type ReactElement, type ChangeEvent } from "react";
import type { EngineVariation } from "../../../../../parts/engines/src/domain/analysis_types";
import type { EngineScore } from "../../../../../parts/engines/src/domain/uci_types";
import type { EngineConfig } from "../../../../../parts/engines/src/domain/engine_config";
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
  t: (key: string, fallback?: string) => string;
};

const VariationCard = ({
  variation: v,
  rank,
  sideToMove,
  onPvClick,
  onPvMoveHover,
  onPvMoveHoverEnd,
  t,
}: VariationCardProps): ReactElement => {
  const pv = v.pvSan ?? v.pv;
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

// ── Props ─────────────────────────────────────────────────────────────────────

type AnalysisPanelProps = {
  variations: EngineVariation[];
  isAnalyzing: boolean;
  engineName: string | null;
  activeEngineId: string | undefined;
  engines: EngineConfig[];
  multiPv: number;
  threads: number;
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
  onOpenEngineManager: () => void;
};

// ── Controls row (extracted to keep AnalysisPanel complexity in bounds) ────────

type ControlsRowProps = {
  engines: EngineConfig[];
  activeEngineId: string | undefined;
  multiPv: number;
  threads: number;
  t: (key: string, fallback?: string) => string;
  onSetActiveEngine: (id: string) => void;
  onSetMultiPv: (n: number) => void;
  onSetThreads: (n: number) => void;
  onOpenEngineManager: () => void;
};

const ControlsRow = ({
  engines,
  activeEngineId,
  multiPv,
  threads,
  t,
  onSetActiveEngine,
  onSetMultiPv,
  onSetThreads,
  onOpenEngineManager,
}: ControlsRowProps): ReactElement => (
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

    <fieldset className="ap-lines-fieldset">
      <legend className="ap-control-label">{t("analysis.panel.lines", "Lines")}</legend>
      <div className="ap-lines-buttons">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`ap-lines-btn${multiPv === n ? " ap-lines-btn--active" : ""}`}
            onClick={(): void => { onSetMultiPv(n); }}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>

    <span className="ap-control-label">{t("analysis.panel.threads", "Threads")}</span>
    <input
      type="number"
      className="ap-threads-input"
      value={threads}
      min={1}
      max={64}
      onChange={(e: ChangeEvent<HTMLInputElement>): void => {
        onSetThreads(Math.max(1, Number(e.target.value)));
      }}
      title={t("analysis.panel.threadsTitle", "CPU threads")}
    />

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
);

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
  onOpenEngineManager,
}: AnalysisPanelProps): ReactElement => {
  const handlePvClick = useCallback(
    (pvSans: string[]): void => { onPvClick?.(pvSans); },
    [onPvClick],
  );

  const topVariation = variations[0];
  const evalStr = topVariation ? formatScore(topVariation.score, sideToMove) : null;
  const evalColor = topVariation ? scoreColor(topVariation.score, sideToMove) : "#6b7280";

  const titleText = engineName
    ? `${t("analysis.panel.title", "Analysis")}: ${engineName} – ${multiPv} ${t("analysis.panel.lines", "lines")}`
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
        t={t}
        onSetActiveEngine={onSetActiveEngine}
        onSetMultiPv={onSetMultiPv}
        onSetThreads={onSetThreads}
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
              t={t}
            />
          ))}
        </ol>
      ) : emptyState}
    </div>
  );
};
