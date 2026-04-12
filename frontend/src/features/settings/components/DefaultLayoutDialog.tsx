/**
 * DefaultLayoutDialog — configure the behaviour of the "Default Layout" toolbar button.
 *
 * Shows a live preview of the configured game with the selected options applied,
 * alongside a panel of behaviour controls.  The preview game is editable so users
 * can test with their own PGN.
 *
 * Integration API:
 * - `<DefaultLayoutDialog prefs={...} onSave={...} onClose={...} />`
 *
 * Configuration API:
 * - `prefs` — current DefaultLayoutPrefs (used as initial state).
 *
 * Communication API:
 * - `onSave(prefs)` — fired with the updated preferences when the user confirms.
 * - `onClose()` — fired on cancel or backdrop click.
 */

import "./DefaultLayoutDialog.css";

import { useState, useCallback, useMemo } from "react";
import type { ReactElement, ChangeEvent } from "react";
import type { DefaultLayoutPrefs } from "../../../runtime/default_layout_prefs";
import { DEFAULT_DEFAULT_LAYOUT_PREFS } from "../../../runtime/default_layout_prefs";
import { parsePgnToModel } from "../../../../../parts/pgnparser/src/pgn_model";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import { applyDefaultLayout } from "../../../model";
import { PgnEditorPreview } from "../../editor/components/PgnEditorPreview";

// ── Sub-components ────────────────────────────────────────────────────────────

type LabeledRowProps = {
  label: string;
  hint?: string;
  children: ReactElement | ReactElement[];
};
const LabeledRow = ({ label, hint, children }: LabeledRowProps): ReactElement => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
    <div className="default-layout-row">
      <span className="default-layout-row-label">{label}</span>
      {children}
    </div>
    {hint && <span className="default-layout-row-hint">{hint}</span>}
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

type DefaultLayoutDialogProps = {
  prefs: DefaultLayoutPrefs;
  onSave: (prefs: DefaultLayoutPrefs) => void;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DefaultLayoutDialog = ({
  prefs,
  onSave,
  onClose,
}: DefaultLayoutDialogProps): ReactElement => {
  const [local, setLocal] = useState<DefaultLayoutPrefs>(prefs);
  const [previewMode, setPreviewMode] = useState<"plain" | "text" | "tree">("text");
  const [pgnError, setPgnError] = useState<string | null>(null);

  const patch = useCallback(
    (p: Partial<DefaultLayoutPrefs>): void => { setLocal((prev) => ({ ...prev, ...p })); },
    [],
  );

  // Parse the preview PGN and apply the current options — recomputed whenever
  // local prefs change.
  const previewModel = useMemo((): PgnModel | null => {
    try {
      const parsed = parsePgnToModel(local.previewPgn);
      setPgnError(null);
      return applyDefaultLayout(parsed, {
        addIntroIfMissing: local.addIntroIfMissing,
        introText: local.introText,
        addBrToMainLineComments: local.addBrToMainLineComments,
      }) as unknown as PgnModel;
    } catch {
      setPgnError("Could not parse PGN — check the preview game text.");
      return null;
    }
  }, [local]);

  return (
    <div className="default-layout-backdrop" onClick={onClose}>
      <div
        className="default-layout-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Default Layout configuration"
        onClick={(e): void => { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="default-layout-header">
          <span className="default-layout-title">Default Layout</span>
          <button type="button" className="default-layout-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className="default-layout-body">
          {/* Controls */}
          <div className="default-layout-controls">

            {/* ── Intro ─────────────────────────────────────────────── */}
            <div className="default-layout-section">
              <span className="default-layout-section-title">Intro comment</span>
              <LabeledRow
                label="Add if missing"
                hint="Inserts an intro comment at the start of the game when none exists"
              >
                <input
                  type="checkbox"
                  checked={local.addIntroIfMissing}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    patch({ addIntroIfMissing: e.target.checked });
                  }}
                />
              </LabeledRow>
              {local.addIntroIfMissing && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <span className="default-layout-row-label">Intro text</span>
                  <input
                    type="text"
                    className="default-layout-intro-text"
                    value={local.introText}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      patch({ introText: e.target.value });
                    }}
                    placeholder="Introduction goes here..."
                  />
                </div>
              )}
            </div>

            {/* ── Main-line comments ────────────────────────────────── */}
            <div className="default-layout-section">
              <span className="default-layout-section-title">Main-line comments</span>
              <LabeledRow
                label="Add line break"
                hint="Prepends [[br]] to each main-line comment so it starts on its own line"
              >
                <input
                  type="checkbox"
                  checked={local.addBrToMainLineComments}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    patch({ addBrToMainLineComments: e.target.checked });
                  }}
                />
              </LabeledRow>
              <span className="default-layout-row-hint">
                Comments inside variations are not affected.
              </span>
            </div>

            {/* ── Preview game ──────────────────────────────────────── */}
            <div className="default-layout-section">
              <span className="default-layout-section-title">Preview game</span>
              <span className="default-layout-row-hint">
                Edit the PGN below to test with your own game.
              </span>
              <textarea
                className="default-layout-pgn-textarea"
                value={local.previewPgn}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>): void => {
                  patch({ previewPgn: e.target.value });
                }}
                spellCheck={false}
              />
              {pgnError && (
                <span className="default-layout-pgn-error">{pgnError}</span>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="default-layout-preview">
            <p className="default-layout-preview-label">Preview</p>
            <div className="default-layout-mode-group" role="radiogroup" aria-label="Preview mode">
              {(["plain", "text", "tree"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`default-layout-mode-btn${previewMode === m ? " active" : ""}`}
                  aria-pressed={previewMode === m}
                  onClick={(): void => { setPreviewMode(m); }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <div className="default-layout-preview-pane">
              <PgnEditorPreview
                pgnModel={previewModel}
                layoutMode={previewMode}
                commentLineBreakPolicy="mainline_only"
                styleVars={{}}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="default-layout-footer">
          <button
            type="button"
            className="default-layout-btn default-layout-btn--ghost"
            onClick={(): void => { setLocal(DEFAULT_DEFAULT_LAYOUT_PREFS); }}
            title="Reset to factory defaults"
          >
            Reset
          </button>
          <button
            type="button"
            className="default-layout-btn default-layout-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="default-layout-btn default-layout-btn--primary"
            onClick={(): void => { onSave(local); onClose(); }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
