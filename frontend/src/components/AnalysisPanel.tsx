/**
 * AnalysisPanel — real-time engine analysis display panel.
 *
 * Shows the top N principal variations from the engine with depth, score, and
 * PV moves. Evaluation is displayed from White's perspective. PV moves are
 * clickable to preview the variation on the board.
 *
 * Integration API:
 * - `<AnalysisPanel variations={...} isAnalyzing={...} engineName={...}
 *     onPvClick={...} onStartAnalysis={...} onStopAnalysis={...} t={...} />`
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onPvClick(pvSans)` fires when a PV variation line is clicked for preview.
 * - `onStartAnalysis()` / `onStopAnalysis()` toggle engine analysis.
 */

import { useCallback, type ReactElement } from "react";
import type { EngineVariation } from "../../../engines/domain/analysis_types";
import type { EngineScore } from "../../../engines/domain/uci_types";

type AnalysisPanelProps = {
  /** Current top variations from the engine. */
  variations: EngineVariation[];
  /** True while the engine is actively analyzing. */
  isAnalyzing: boolean;
  /** Display name of the active engine, or null if none configured. */
  engineName: string | null;
  /** Side to move in the current position: "w" or "b". */
  sideToMove: "w" | "b";
  t: (key: string, fallback?: string) => string;
  onPvClick?: (pvSans: string[]) => void;
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
};

// ── Score formatting ──────────────────────────────────────────────────────────

const formatScore = (score: EngineScore, sideToMove: "w" | "b"): string => {
  // Convert from side-to-move perspective to White's perspective.
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
  if (cp >= 30) return "#4ade80";
  if (cp >= -30) return "#6b7280";
  if (cp >= -100) return "#f87171";
  if (cp >= -300) return "#dc2626";
  return "#7f1d1d";
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Collapsible panel showing engine analysis lines.
 * Evaluation bar, top N variations, depth indicator.
 */
export const AnalysisPanel = ({
  variations,
  isAnalyzing,
  engineName,
  sideToMove,
  t,
  onPvClick,
  onStartAnalysis,
  onStopAnalysis,
}: AnalysisPanelProps): ReactElement => {
  const handlePvClick = useCallback(
    (pvSans: string[]): void => {
      onPvClick?.(pvSans);
    },
    [onPvClick],
  );

  const topVariation = variations[0];
  const evalStr = topVariation
    ? formatScore(topVariation.score, sideToMove)
    : null;
  const evalColor = topVariation
    ? scoreColor(topVariation.score, sideToMove)
    : "#6b7280";

  return (
    <div className="analysis-panel">
      {/* Header */}
      <div className="analysis-panel-header">
        <span className="analysis-panel-title">
          {t("analysis.panel.title", "Engine Analysis")}
          {engineName && (
            <span className="analysis-panel-engine-name"> — {engineName}</span>
          )}
        </span>

        {evalStr && (
          <span
            className="analysis-panel-eval"
            style={{ color: evalColor }}
          >
            {evalStr}
          </span>
        )}

        <button
          type="button"
          className={`analysis-panel-toggle-btn${isAnalyzing ? " analysis-panel-toggle-btn--stop" : ""}`}
          onClick={isAnalyzing ? onStopAnalysis : onStartAnalysis}
          disabled={!engineName}
          title={
            !engineName
              ? t("analysis.panel.noEngine", "No engine configured")
              : undefined
          }
        >
          {isAnalyzing
            ? t("analysis.panel.stop", "Stop")
            : t("analysis.panel.analyze", "Analyze")}
        </button>
      </div>

      {/* Variations */}
      {variations.length > 0 ? (
        <ol className="analysis-panel-variations">
          {variations.map((v) => (
            <li
              key={v.multipvIndex}
              className="analysis-panel-variation"
              onClick={
                v.pvSan && v.pvSan.length > 0
                  ? (): void => { handlePvClick(v.pvSan!); }
                  : undefined
              }
              style={v.pvSan ? { cursor: "pointer" } : undefined}
              title={
                v.pvSan
                  ? t("analysis.panel.clickToPreview", "Click to preview")
                  : undefined
              }
            >
              <span
                className="analysis-panel-variation-score"
                style={{ color: scoreColor(v.score, sideToMove) }}
              >
                {formatScore(v.score, sideToMove)}
              </span>

              <span className="analysis-panel-variation-depth">
                d{v.depth}
                {v.selDepth ? `/${v.selDepth}` : ""}
              </span>

              <span className="analysis-panel-variation-pv">
                {(v.pvSan ?? v.pv).slice(0, 8).join(" ")}
                {(v.pvSan ?? v.pv).length > 8 ? " …" : ""}
              </span>

              {v.nodes !== undefined && (
                <span className="analysis-panel-variation-nodes">
                  {v.nodes > 1_000_000
                    ? `${(v.nodes / 1_000_000).toFixed(1)}M`
                    : v.nodes > 1_000
                      ? `${(v.nodes / 1_000).toFixed(0)}k`
                      : String(v.nodes)}{" "}
                  {t("analysis.panel.nodes", "nodes")}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : isAnalyzing ? (
        <p className="analysis-panel-waiting">
          {t("analysis.panel.waiting", "Waiting for engine…")}
        </p>
      ) : (
        <p className="analysis-panel-idle">
          {engineName
            ? t("analysis.panel.idle", "Press Analyze to start")
            : t("analysis.panel.noEngineHint", "Configure an engine in settings to enable analysis.")}
        </p>
      )}
    </div>
  );
};
