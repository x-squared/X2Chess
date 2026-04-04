/**
 * EditorStyleDialog — visual style configurator for the PGN text editor.
 *
 * Shows a live preview of the current game alongside a panel of style controls.
 * Changes are applied to the preview immediately; confirmed changes are persisted
 * and applied to the main editor.
 *
 * Integration API:
 * - `<EditorStyleDialog prefs={...} pgnModel={...} onSave={...} onClose={...} />`
 *
 * Configuration API:
 * - `prefs` — current EditorStylePrefs (used as initial state).
 * - `pgnModel` — the active game; shown read-only in the preview pane.
 * - `initialLayoutMode` — layout mode to show in the preview switcher on open.
 *
 * Communication API:
 * - `onSave(prefs)` — fired with the updated preferences when the user confirms.
 * - `onClose()` — fired on cancel or backdrop click.
 */

import "./EditorStyleDialog.css";

import { useState, useCallback } from "react";
import type { ReactElement, ChangeEvent } from "react";
import type { PgnModel } from "../../model/pgn_model";
import type {
  EditorStylePrefs,
  EditorFontFamily,
  SidebarStyle,
  TextLevelStyle,
} from "../../runtime/editor_style_prefs";
import { editorStyleToCssVars } from "../../runtime/editor_style_prefs";
import { PgnEditorPreview } from "../game_editor/PgnEditorPreview";

// ── Options ───────────────────────────────────────────────────────────────────

const FONT_OPTIONS: { value: EditorFontFamily; label: string }[] = [
  { value: "inherit", label: "System default" },
  { value: "ui-sans-serif", label: "Sans-serif" },
  { value: "ui-serif", label: "Serif" },
  { value: "ui-monospace", label: "Monospace" },
];

// ── Small helper sub-components ───────────────────────────────────────────────

type LabeledRowProps = {
  label: string;
  hint?: string;
  children: ReactElement | ReactElement[];
};
const LabeledRow = ({ label, hint, children }: LabeledRowProps): ReactElement => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
    <div className="editor-style-row">
      <span className="editor-style-row-label">{label}</span>
      {children}
    </div>
    {hint && <span className="editor-style-row-hint">{hint}</span>}
  </div>
);

type SidebarControlProps = {
  value: SidebarStyle;
  onChange: (v: SidebarStyle) => void;
};
const SidebarControl = ({ value, onChange }: SidebarControlProps): ReactElement => (
  <div className="editor-style-subsection">
    <div className="editor-style-row">
      <span className="editor-style-row-label">Left sidebar</span>
      <input
        type="checkbox"
        checked={value.enabled}
        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
          onChange({ ...value, enabled: e.target.checked });
        }}
      />
    </div>
    {value.enabled && (
      <>
        <div className="editor-style-row">
          <span className="editor-style-row-label">Thickness</span>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={value.widthPx}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              onChange({ ...value, widthPx: Number(e.target.value) });
            }}
          />
          <span className="editor-style-value-badge">{value.widthPx}px</span>
        </div>
        <div className="editor-style-row">
          <span className="editor-style-row-label">Colour</span>
          <input
            type="color"
            value={cssColorToHex(value.color)}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              onChange({ ...value, color: e.target.value });
            }}
          />
        </div>
      </>
    )}
  </div>
);

type TextLevelControlProps = {
  value: TextLevelStyle;
  onChange: (v: TextLevelStyle) => void;
};
const TextLevelControl = ({ value, onChange }: TextLevelControlProps): ReactElement => (
  <div className="editor-style-section" style={{ gap: "0.3rem" }}>
    <LabeledRow label="Font size">
      <select
        value={String(value.fontSizeEm)}
        onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
          onChange({ ...value, fontSizeEm: Number(e.target.value) });
        }}
      >
        <option value="0.85">Smaller (85%)</option>
        <option value="0.90">Small (90%)</option>
        <option value="0.95">Slightly smaller (95%)</option>
        <option value="1.00">Normal (100%)</option>
        <option value="1.05">Slightly larger (105%)</option>
        <option value="1.10">Larger (110%)</option>
      </select>
    </LabeledRow>
    <SidebarControl
      value={value.sidebar}
      onChange={(s: SidebarStyle): void => { onChange({ ...value, sidebar: s }); }}
    />
    <LabeledRow label="Background colour">
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <input
          type="checkbox"
          checked={value.backgroundColor !== ""}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange({ ...value, backgroundColor: e.target.checked ? "rgba(100, 116, 139, 0.08)" : "" });
          }}
        />
        {value.backgroundColor !== "" && (
          <input
            type="color"
            value={cssColorToHex(value.backgroundColor)}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              onChange({ ...value, backgroundColor: e.target.value });
            }}
          />
        )}
      </div>
    </LabeledRow>
  </div>
);

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Best-effort conversion of a CSS color string to a hex value for `<input type="color">`.
 * Falls back to #888888 for colors that cannot be represented as a 6-digit hex.
 */
const cssColorToHex = (color: string): string => {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  // For rgba/named colors: use a canvas to resolve to hex at runtime.
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#888888";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return "#" + [d[0], d[1], d[2]].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("");
  } catch {
    return "#888888";
  }
};

// ── Props ─────────────────────────────────────────────────────────────────────

type EditorStyleDialogProps = {
  prefs: EditorStylePrefs;
  pgnModel: PgnModel | null;
  initialLayoutMode: "plain" | "text" | "tree";
  onSave: (prefs: EditorStylePrefs) => void;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const EditorStyleDialog = ({
  prefs,
  pgnModel,
  initialLayoutMode,
  onSave,
  onClose,
}: EditorStyleDialogProps): ReactElement => {
  const [local, setLocal] = useState<EditorStylePrefs>(prefs);
  const [previewMode, setPreviewMode] = useState<"plain" | "text" | "tree">(initialLayoutMode);
  const [activeTextLevel, setActiveTextLevel] = useState<1 | 2 | 3>(1);

  const set = useCallback(
    (patch: Partial<EditorStylePrefs>): void => { setLocal((p) => ({ ...p, ...patch })); },
    [],
  );
  const setIntro = useCallback(
    (patch: Partial<EditorStylePrefs["intro"]>): void => {
      setLocal((p) => ({ ...p, intro: { ...p.intro, ...patch } }));
    },
    [],
  );
  const setText = useCallback(
    (patch: Partial<EditorStylePrefs["text"]>): void => {
      setLocal((p) => ({ ...p, text: { ...p.text, ...patch } }));
    },
    [],
  );
  const setTree = useCallback(
    (patch: Partial<EditorStylePrefs["tree"]>): void => {
      setLocal((p) => ({ ...p, tree: { ...p.tree, ...patch } }));
    },
    [],
  );

  const styleVars = editorStyleToCssVars(local);

  const activeLevel: TextLevelStyle =
    activeTextLevel === 1
      ? local.text.level1
      : activeTextLevel === 2
        ? local.text.level2
        : local.text.level3plus;

  const setActiveLevel = (v: TextLevelStyle): void => {
    if (activeTextLevel === 1) setText({ level1: v });
    else if (activeTextLevel === 2) setText({ level2: v });
    else setText({ level3plus: v });
  };

  return (
    <div className="editor-style-backdrop" onClick={onClose}>
      <div
        className="editor-style-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Editor style"
        onClick={(e): void => { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="editor-style-header">
          <span className="editor-style-title">Editor style</span>
          <button type="button" className="editor-style-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className="editor-style-body">
          {/* Controls */}
          <div className="editor-style-controls">
            {/* Mode switcher */}
            <div className="editor-style-mode-group" role="radiogroup" aria-label="Preview mode">
              {(["plain", "text", "tree"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`editor-style-mode-btn${previewMode === m ? " active" : ""}`}
                  aria-pressed={previewMode === m}
                  onClick={(): void => { setPreviewMode(m); }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Global ──────────────────────────────────────────────── */}
            <div className="editor-style-section">
              <span className="editor-style-section-title">Font</span>
              <LabeledRow label="Font family">
                <select
                  value={local.fontFamily}
                  onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                    set({ fontFamily: e.target.value as EditorFontFamily });
                  }}
                >
                  {FONT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </LabeledRow>
              <LabeledRow label="Font size">
                <input
                  type="range"
                  min={10}
                  max={22}
                  step={1}
                  value={local.fontSizePx}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    set({ fontSizePx: Number(e.target.value) });
                  }}
                />
                <span className="editor-style-value-badge">{local.fontSizePx}px</span>
              </LabeledRow>
              <LabeledRow label="Line spacing">
                <input
                  type="range"
                  min={1.1}
                  max={2.2}
                  step={0.05}
                  value={local.lineHeight}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    set({ lineHeight: Number(e.target.value) });
                  }}
                />
                <span className="editor-style-value-badge">{local.lineHeight.toFixed(2)}</span>
              </LabeledRow>
            </div>

            {/* ── Intro section (text + tree) ──────────────────────────── */}
            {previewMode !== "plain" && (
              <div className="editor-style-section">
                <span className="editor-style-section-title">Intro section</span>
                <SidebarControl
                  value={local.intro.sidebar}
                  onChange={(s: SidebarStyle): void => { setIntro({ sidebar: s }); }}
                />
                <LabeledRow label="Background colour">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input
                      type="checkbox"
                      checked={local.intro.backgroundColor !== ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                        setIntro({ backgroundColor: e.target.checked ? "#f4f8ff" : "" });
                      }}
                    />
                    {local.intro.backgroundColor !== "" && (
                      <input
                        type="color"
                        value={cssColorToHex(local.intro.backgroundColor)}
                        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                          setIntro({ backgroundColor: e.target.value });
                        }}
                      />
                    )}
                  </div>
                </LabeledRow>
                <LabeledRow label="Gap below intro" hint="Space between intro and first move">
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={local.intro.paddingBottomRem}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setIntro({ paddingBottomRem: Number(e.target.value) });
                    }}
                  />
                  <span className="editor-style-value-badge">{local.intro.paddingBottomRem.toFixed(2)}rem</span>
                </LabeledRow>
                <LabeledRow label="Bold main-line moves">
                  <input
                    type="checkbox"
                    checked={local.intro.mainLineBold}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setIntro({ mainLineBold: e.target.checked });
                    }}
                  />
                </LabeledRow>
              </div>
            )}

            {/* ── Text mode controls ───────────────────────────────────── */}
            {previewMode === "text" && (
              <div className="editor-style-section">
                <span className="editor-style-section-title">Text mode</span>
                <LabeledRow label="Indent width per level" hint="Horizontal offset added per nesting level">
                  <input
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.1}
                    value={local.text.indentStepRem}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setText({ indentStepRem: Number(e.target.value) });
                    }}
                  />
                  <span className="editor-style-value-badge">{local.text.indentStepRem.toFixed(1)}rem</span>
                </LabeledRow>

                {/* Per-level styling tabs */}
                <span className="editor-style-section-title" style={{ marginTop: "0.3rem" }}>
                  Indentation level styles
                </span>
                <div className="editor-style-level-tabs">
                  {([1, 2, 3] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`editor-style-level-tab${activeTextLevel === lvl ? " active" : ""}`}
                      onClick={(): void => { setActiveTextLevel(lvl); }}
                    >
                      {lvl === 3 ? "Level 3+" : `Level ${lvl}`}
                    </button>
                  ))}
                </div>
                <TextLevelControl value={activeLevel} onChange={setActiveLevel} />
              </div>
            )}

            {/* ── Tree mode controls ───────────────────────────────────── */}
            {previewMode === "tree" && (
              <div className="editor-style-section">
                <span className="editor-style-section-title">Tree mode</span>
                <LabeledRow label="Indent width per level" hint="Horizontal offset per variation depth">
                  <input
                    type="range"
                    min={0.6}
                    max={2.5}
                    step={0.1}
                    value={local.tree.indentStepEm}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setTree({ indentStepEm: Number(e.target.value) });
                    }}
                  />
                  <span className="editor-style-value-badge">{local.tree.indentStepEm.toFixed(1)}em</span>
                </LabeledRow>
                <span className="editor-style-section-title" style={{ marginTop: "0.3rem" }}>
                  Variation-label pills
                </span>
                <LabeledRow label="Background">
                  <input
                    type="color"
                    value={cssColorToHex(local.tree.pillBackgroundColor)}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setTree({ pillBackgroundColor: e.target.value });
                    }}
                  />
                </LabeledRow>
                <LabeledRow label="Border">
                  <input
                    type="color"
                    value={cssColorToHex(local.tree.pillBorderColor)}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setTree({ pillBorderColor: e.target.value });
                    }}
                  />
                </LabeledRow>
                <LabeledRow label="Text">
                  <input
                    type="color"
                    value={cssColorToHex(local.tree.pillTextColor)}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      setTree({ pillTextColor: e.target.value });
                    }}
                  />
                </LabeledRow>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="editor-style-preview">
            <p className="editor-style-preview-label">Preview</p>
            <PgnEditorPreview
              pgnModel={pgnModel}
              layoutMode={previewMode}
              styleVars={styleVars}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="editor-style-footer">
          <button
            type="button"
            className="editor-style-btn editor-style-btn--ghost"
            onClick={(): void => { setLocal(prefs); }}
            title="Reset to saved settings"
          >
            Reset
          </button>
          <button
            type="button"
            className="editor-style-btn editor-style-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="editor-style-btn editor-style-btn--primary"
            onClick={(): void => { onSave(local); onClose(); }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
