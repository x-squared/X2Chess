/**
 * RawPgnPanel — editable raw PGN view for the Developer Dock.
 *
 * Shows the active session PGN text; edits apply on demand and replace the
 * in-memory game everywhere (board, editor, navigation) without scheduling autosave.
 *
 * Integration API:
 * - `<RawPgnPanel />` — render inside `DevDock` as one developer tab panel.
 *
 * Configuration API:
 * - No props. Reads `pgnText` from app state; writes via `applyDeveloperDockRawPgn`.
 *
 * Communication API:
 * - Inbound: re-renders when `pgnText` or active session changes.
 * - Outbound: `services.applyDeveloperDockRawPgn` on Apply; parse errors surface via app error message.
 */

import type { ChangeEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import { selectActiveSessionId, selectPgnText } from "../../../core/state/selectors";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import { useTranslator } from "../../../app/hooks/useTranslator";
import {
  autoFixPgnCompatibility,
  type PgnAutoFixReport,
  type PgnValidationIssue,
  type PgnValidationReport,
  type PgnValidationStatus,
  validatePgnQuality,
} from "../model/pgn_validation";

type UserFacingValidationLevel = "ok" | "warning" | "critical";

/** Editable raw PGN area with explicit apply (no autosave). */
export const RawPgnPanel = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const t: (key: string, fallback?: string) => string = useTranslator();
  const storePgn: string = selectPgnText(state);
  const activeSessionId: string | null = selectActiveSessionId(state);
  const [draft, setDraft] = useState<string>(storePgn);
  const [touched, setTouched] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [fixFeedback, setFixFeedback] = useState<string>("");
  const [showFixPreview, setShowFixPreview] = useState<boolean>(false);
  const [editorFlash, setEditorFlash] = useState<boolean>(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect((): void => {
    setTouched(false);
    setDraft(storePgn);
  }, [activeSessionId]);

  useEffect((): void => {
    if (!touched) {
      setDraft(storePgn);
    }
  }, [storePgn, touched]);

  useEffect((): void => {
    setCopyFeedback("idle");
    setFixFeedback("");
    setShowFixPreview(false);
  }, [draft]);

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setTouched(true);
    setDraft(event.target.value);
  };

  const onApply = (): void => {
    const ok: boolean = services.applyDeveloperDockRawPgn(draft);
    if (ok) {
      setTouched(false);
    }
  };

  const validationReport: PgnValidationReport = useMemo(
    (): PgnValidationReport => validatePgnQuality(draft),
    [draft],
  );
  const pendingAutoFix: PgnAutoFixReport = useMemo(
    (): PgnAutoFixReport => autoFixPgnCompatibility(draft),
    [draft],
  );
  const validationStatus: PgnValidationStatus = validationReport.status;
  const validationIssues: PgnValidationIssue[] = validationReport.issues;
  const levelByStatus: Record<PgnValidationStatus, UserFacingValidationLevel> = {
    strict_ok: "ok",
    normalized_ok: "warning",
    stripped_ok: "warning",
    failed: "critical",
  };
  const userLevel: UserFacingValidationLevel = levelByStatus[validationStatus];
  const levelLabelByLevel: Record<UserFacingValidationLevel, string> = {
    ok: t("devDock.rawPgn.validation.level.ok", "OK"),
    warning: t("devDock.rawPgn.validation.level.warning", "Warning"),
    critical: t("devDock.rawPgn.validation.level.critical", "Critical"),
  };
  const levelHintByLevel: Record<UserFacingValidationLevel, string> = {
    ok: t("devDock.rawPgn.validation.levelHint.ok", "PGN is fully supported."),
    warning: t(
      "devDock.rawPgn.validation.levelHint.warning",
      "There are issues, but the app can still use this PGN with recovery.",
    ),
    critical: t(
      "devDock.rawPgn.validation.levelHint.critical",
      "PGN cannot be parsed reliably and may not be usable in the app.",
    ),
  };
  const phaseLabelByPhase: Record<PgnValidationIssue["phase"], string> = {
    strict: t("devDock.rawPgn.validation.phase.strict", "Strict"),
    normalized: t("devDock.rawPgn.validation.phase.normalized", "Normalized"),
    stripped: t("devDock.rawPgn.validation.phase.stripped", "Stripped"),
  };
  let copyFeedbackLabel: string = "";
  if (copyFeedback === "copied") {
    copyFeedbackLabel = t("devDock.rawPgn.validation.copied", "Diagnostics copied.");
  } else if (copyFeedback === "failed") {
    copyFeedbackLabel = t("devDock.rawPgn.validation.copyFailed", "Copy failed.");
  }

  const copyDiagnostics = async (): Promise<void> => {
    const lines: string[] = validationIssues.map((issue: PgnValidationIssue): string => {
      const phase: string = phaseLabelByPhase[issue.phase];
      const location: string =
        issue.line != null && issue.column != null
          ? `L${issue.line}:C${issue.column}`
          : t("devDock.rawPgn.validation.locationUnknown", "Unknown location");
      return `[${phase}] ${location} — ${issue.message}`;
    });
    const text: string = [
      `${t("devDock.rawPgn.validation.statusLabel", "Status")}: ${levelLabelByLevel[userLevel]}`,
      levelHintByLevel[userLevel],
      ...lines,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }
  };

  const openFixPreview = (): void => {
    if (!pendingAutoFix.changed) {
      setFixFeedback(t("devDock.rawPgn.validation.fix.noChange", "No safe compatibility fix needed."));
      return;
    }
    setShowFixPreview(true);
  };

  const applyFixFromPreview = (): void => {
    if (!pendingAutoFix.changed) return;
    setDraft(pendingAutoFix.fixedPgn);
    setTouched(true);
    setShowFixPreview(false);
    setFixFeedback(
      t("devDock.rawPgn.validation.fix.applied", "Applied {{count}} compatibility fixes.")
        .replace("{{count}}", String(pendingAutoFix.changes.length)),
    );
  };

  const focusIssueLine = (issue: PgnValidationIssue): void => {
    if (issue.line == null) return;
    const text: string = draft;
    const targetLine: number = Math.max(1, issue.line);
    let offset: number = 0;
    let currentLine: number = 1;
    while (currentLine < targetLine && offset < text.length) {
      const nextNewline: number = text.indexOf("\n", offset);
      if (nextNewline < 0) {
        offset = text.length;
        break;
      }
      offset = nextNewline + 1;
      currentLine += 1;
    }
    let lineEnd: number = text.indexOf("\n", offset);
    if (lineEnd < 0) lineEnd = text.length;
    const textarea: HTMLTextAreaElement | null = editorRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(offset, lineEnd);
    const computed: CSSStyleDeclaration = globalThis.getComputedStyle(textarea);
    const lineHeightPx: number = Number.parseFloat(computed.lineHeight || "18");
    if (Number.isFinite(lineHeightPx)) {
      textarea.scrollTop = Math.max(0, (targetLine - 1) * lineHeightPx - lineHeightPx * 2);
    }
    setEditorFlash(true);
    globalThis.setTimeout((): void => setEditorFlash(false), 500);
  };

  return (
    <div className="raw-pgn-panel">
      {/* Apply — commits draft to session (no autosave) */}
      <div className="raw-pgn-actions">
        <button
          type="button"
          className="raw-pgn-apply"
          onClick={onApply}
        >
          {t("devDock.rawPgn.apply", "Apply to session")}
        </button>
        <p className="raw-pgn-hint">
          {t(
            "devDock.rawPgn.noAutosaveHint",
            "Replaces the open game in memory. Does not save to disk automatically.",
          )}
        </p>
      </div>

      <div className="raw-pgn-validation">
        <div className="raw-pgn-validation-summary">
          <span className={`raw-pgn-status-pill raw-pgn-status-pill-${userLevel}`}>
            {levelLabelByLevel[userLevel]}
          </span>
          <span className="raw-pgn-validation-status">{levelHintByLevel[userLevel]}</span>
          {validationIssues.length > 0 ? (
            <button
              type="button"
              className="raw-pgn-apply"
              onClick={(): void => {
                void copyDiagnostics();
              }}
            >
              {t("devDock.rawPgn.validation.copyDiagnostics", "Copy diagnostics")}
            </button>
          ) : null}
          <button
            type="button"
            className="raw-pgn-apply"
            onClick={openFixPreview}
          >
            {t("devDock.rawPgn.validation.fix.preview", "Preview auto-fix")}
          </button>
          {copyFeedbackLabel ? <span className="raw-pgn-hint">{copyFeedbackLabel}</span> : null}
          {fixFeedback ? <span className="raw-pgn-hint">{fixFeedback}</span> : null}
        </div>
        {showFixPreview && pendingAutoFix.changed ? (
          <div className="raw-pgn-fix-preview">
            <p className="raw-pgn-validation-status">
              {t("devDock.rawPgn.validation.fix.previewTitle", "Auto-fix preview")}
            </p>
            <ul className="raw-pgn-validation-issues-list">
              {pendingAutoFix.changes.map((change: string): ReactElement => (
                <li key={`fix-change-${change}`}>{change}</li>
              ))}
            </ul>
            <div className="raw-pgn-fix-preview-grid">
              <div>
                <p className="raw-pgn-validation-status">
                  {t("devDock.rawPgn.validation.fix.before", "Before")}
                </p>
                <pre className="raw-pgn-fix-preview-text">{draft}</pre>
              </div>
              <div>
                <p className="raw-pgn-validation-status">
                  {t("devDock.rawPgn.validation.fix.after", "After")}
                </p>
                <pre className="raw-pgn-fix-preview-text">{pendingAutoFix.fixedPgn}</pre>
              </div>
            </div>
            <div className="raw-pgn-actions">
              <button
                type="button"
                className="raw-pgn-apply"
                onClick={applyFixFromPreview}
              >
                {t("devDock.rawPgn.validation.fix.apply", "Apply fixes")}
              </button>
              <button
                type="button"
                className="raw-pgn-apply"
                onClick={(): void => setShowFixPreview(false)}
              >
                {t("devDock.rawPgn.validation.fix.cancel", "Cancel")}
              </button>
            </div>
          </div>
        ) : null}
        {validationIssues.length > 0 ? (
          <div className="raw-pgn-validation-issues">
            <ul className="raw-pgn-validation-issues-list">
              {validationIssues.map((issue: PgnValidationIssue, index: number): ReactElement => {
                const hasLocation: boolean = issue.line != null && issue.column != null;
                const locationLabel: string = hasLocation
                  ? t(
                      "devDock.rawPgn.validation.location",
                      "Line {{line}}, column {{column}}",
                    )
                      .replace("{{line}}", String(issue.line))
                      .replace("{{column}}", String(issue.column))
                  : t("devDock.rawPgn.validation.locationUnknown", "Unknown location");
                return (
                  <li key={`${issue.phase}-${index}`}>
                    <button
                      type="button"
                      className="raw-pgn-issue-jump"
                      onClick={(): void => {
                        focusIssueLine(issue);
                      }}
                    >
                      [{phaseLabelByPhase[issue.phase]}] {locationLabel}: {issue.message}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <textarea
        ref={editorRef}
        className="raw-pgn-view raw-pgn-editor"
        data-issue-highlighted={editorFlash ? "true" : "false"}
        aria-label={t("devDock.rawPgn.editorLabel", "Raw PGN editor")}
        spellCheck={false}
        value={draft}
        onChange={onChange}
      />
    </div>
  );
};
