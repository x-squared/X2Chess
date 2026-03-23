/**
 * WebImportRulesPanel — settings dialog for managing user-defined web import rules.
 *
 * Shows two sections: user-defined rules (editable) and built-in rules (read-only).
 * Provides a JSON editor for adding/editing rules and a Test URL input that
 * runs the rule engine inline and shows the resolved result or error.
 *
 * Integration API:
 * - `<WebImportRulesPanel onClose={fn} />` — render as a modal dialog.
 *
 * Configuration API:
 * - No props beyond `onClose`; reads/writes user rules via `user_rules_storage`.
 *
 * Communication API:
 * - Writes to localStorage via `saveUserRules`; fires `x2chess:userRulesChanged`.
 * - Inbound: reads rules from `loadUserRules()` and `BUILT_IN_RULES`.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { WebImportRule } from "../resources/web_import/web_import_types";
import { BUILT_IN_RULES } from "../resources/web_import/built_in_rules";
import {
  loadUserRules,
  saveUserRules,
  validateRule,
} from "../resources/web_import/user_rules_storage";
import { buildRegistry } from "../resources/web_import/rule_registry";
import { matchRule } from "../resources/web_import/rule_matcher";
import { fetchFromRule } from "../resources/web_import/rule_fetcher";

// ── Types ─────────────────────────────────────────────────────────────────────

type WebImportRulesPanelProps = {
  onClose: () => void;
};

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "matched"; label: string }
  | { status: "fetching" }
  | { status: "success"; kind: "pgn" | "fen"; preview: string }
  | { status: "no-match" }
  | { status: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  api: "API (Tier 1)",
  direct: "Direct (Tier 1)",
  "native-html": "Native HTML (Tier 2)",
  webview: "WebView (Tier 3)",
};

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : s.slice(0, max - 1) + "…";

// ── Component ─────────────────────────────────────────────────────────────────

/** Dialog for viewing and editing web import rules. */
export const WebImportRulesPanel = ({ onClose }: WebImportRulesPanelProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [userRules, setUserRules] = useState<WebImportRule[]>(() => loadUserRules());

  // JSON editor state
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editorJson, setEditorJson] = useState<string>("");
  const [editorError, setEditorError] = useState<string>("");

  // Test URL state
  const [testUrl, setTestUrl] = useState<string>("");
  const [testState, setTestState] = useState<TestState>({ status: "idle" });

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleClose = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  // ── Editor helpers ──────────────────────────────────────────────────────────

  const openAddEditor = useCallback((): void => {
    setEditingIndex(null);
    setEditorJson(JSON.stringify(
      {
        id: "",
        label: "",
        urlPattern: "",
        strategy: "api",
        fetchUrl: "",
        responseType: "pgn",
      } satisfies Partial<WebImportRule>,
      null,
      2,
    ));
    setEditorError("");
    setEditorOpen(true);
  }, []);

  const openEditEditor = useCallback((index: number): void => {
    setEditingIndex(index);
    setEditorJson(JSON.stringify(userRules[index], null, 2));
    setEditorError("");
    setEditorOpen(true);
  }, [userRules]);

  const handleEditorSave = useCallback((): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editorJson);
    } catch {
      setEditorError("Invalid JSON — check syntax.");
      return;
    }
    const err = validateRule(parsed);
    if (err) {
      setEditorError(err);
      return;
    }
    const rule = parsed as WebImportRule;
    const updated =
      editingIndex === null
        ? [...userRules, rule]
        : userRules.map((r, i) => (i === editingIndex ? rule : r));
    setUserRules(updated);
    saveUserRules(updated);
    setEditorOpen(false);
  }, [editorJson, editingIndex, userRules]);

  const handleDelete = useCallback((index: number): void => {
    const updated = userRules.filter((_, i) => i !== index);
    setUserRules(updated);
    saveUserRules(updated);
  }, [userRules]);

  const handleMoveUp = useCallback((index: number): void => {
    if (index === 0) return;
    const updated = [...userRules];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setUserRules(updated);
    saveUserRules(updated);
  }, [userRules]);

  const handleMoveDown = useCallback((index: number): void => {
    if (index >= userRules.length - 1) return;
    const updated = [...userRules];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setUserRules(updated);
    saveUserRules(updated);
  }, [userRules]);

  // ── Test URL ────────────────────────────────────────────────────────────────

  const handleTest = useCallback(async (): Promise<void> => {
    const url = testUrl.trim();
    if (!url) return;

    const registry = buildRegistry(userRules);
    const match = matchRule(url, registry);

    if (!match) {
      setTestState({ status: "no-match" });
      return;
    }

    setTestState({ status: "matched", label: match.rule.label });

    const result = await fetchFromRule(match.rule, match.captures);
    if (!result) {
      setTestState({
        status: "error",
        message: `Rule matched "${match.rule.label}" but fetch returned no result.`,
      });
      return;
    }

    setTestState({
      status: "success",
      kind: result.kind,
      preview: truncate(result.value, 200),
    });
  }, [testUrl, userRules]);

  const handleTestKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") void handleTest();
  }, [handleTest]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <dialog ref={dialogRef} className="web-import-rules-dialog" onClose={onClose}>
      <div className="web-import-rules-header">
        <h2 className="web-import-rules-title">Web Import Rules</h2>
        <button
          className="web-import-rules-close"
          type="button"
          aria-label="Close"
          onClick={handleClose}
        >
          ×
        </button>
      </div>

      <div className="web-import-rules-body">
        {/* ── Test URL ─────────────────────────────────────────────────────── */}
        <section className="web-import-rules-section">
          <h3 className="web-import-rules-section-title">Test a URL</h3>
          <div className="web-import-test-row">
            <input
              className="web-import-test-input"
              type="url"
              placeholder="https://lichess.org/abCdEfGh"
              value={testUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setTestUrl(e.target.value);
                setTestState({ status: "idle" });
              }}
              onKeyDown={handleTestKeyDown}
            />
            <button
              className="web-import-btn web-import-btn-primary"
              type="button"
              onClick={(): void => { void handleTest(); }}
              disabled={!testUrl.trim()}
            >
              Test
            </button>
          </div>
          {testState.status === "no-match" && (
            <p className="web-import-test-result web-import-test-no-match">
              No rule matches this URL.
            </p>
          )}
          {testState.status === "matched" && (
            <p className="web-import-test-result">
              Rule matched: <strong>{testState.label}</strong> — fetching…
            </p>
          )}
          {testState.status === "success" && (
            <div className="web-import-test-result web-import-test-success">
              <span className="web-import-test-kind">
                {testState.kind === "pgn" ? "PGN" : "FEN"} extracted:
              </span>
              <pre className="web-import-test-preview">{testState.preview}</pre>
            </div>
          )}
          {testState.status === "error" && (
            <p className="web-import-test-result web-import-test-error">
              {testState.message}
            </p>
          )}
        </section>

        {/* ── User Rules ───────────────────────────────────────────────────── */}
        <section className="web-import-rules-section">
          <div className="web-import-rules-section-header">
            <h3 className="web-import-rules-section-title">
              Your rules ({userRules.length})
            </h3>
            <button
              className="web-import-btn web-import-btn-primary"
              type="button"
              onClick={openAddEditor}
            >
              + Add rule
            </button>
          </div>

          {userRules.length === 0 ? (
            <p className="web-import-rules-empty">
              No user rules. Add one above to override a built-in rule or add a new site.
            </p>
          ) : (
            <table className="web-import-rules-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Strategy</th>
                  <th>URL pattern</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {userRules.map((rule, i): ReactElement => (
                  <tr key={rule.id}>
                    <td>
                      <span className="web-import-rule-label">{rule.label}</span>
                      <span className="web-import-rule-id">{rule.id}</span>
                    </td>
                    <td>
                      <span className="web-import-rule-strategy">
                        {STRATEGY_LABELS[rule.strategy] ?? rule.strategy}
                      </span>
                    </td>
                    <td>
                      <code className="web-import-rule-pattern">
                        {truncate(rule.urlPattern, 50)}
                      </code>
                    </td>
                    <td className="web-import-rule-actions">
                      <button
                        className="web-import-btn-icon"
                        type="button"
                        title="Move up"
                        disabled={i === 0}
                        onClick={(): void => { handleMoveUp(i); }}
                      >
                        ↑
                      </button>
                      <button
                        className="web-import-btn-icon"
                        type="button"
                        title="Move down"
                        disabled={i >= userRules.length - 1}
                        onClick={(): void => { handleMoveDown(i); }}
                      >
                        ↓
                      </button>
                      <button
                        className="web-import-btn-icon"
                        type="button"
                        title="Edit rule"
                        onClick={(): void => { openEditEditor(i); }}
                      >
                        ✎
                      </button>
                      <button
                        className="web-import-btn-icon web-import-btn-danger"
                        type="button"
                        title="Delete rule"
                        onClick={(): void => { handleDelete(i); }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Built-in Rules ───────────────────────────────────────────────── */}
        <section className="web-import-rules-section">
          <h3 className="web-import-rules-section-title">
            Built-in rules ({BUILT_IN_RULES.length}) — read-only
          </h3>
          <table className="web-import-rules-table web-import-rules-table-readonly">
            <thead>
              <tr>
                <th>Label</th>
                <th>Strategy</th>
                <th>URL pattern</th>
              </tr>
            </thead>
            <tbody>
              {BUILT_IN_RULES.map((rule): ReactElement => (
                <tr key={rule.id}>
                  <td>
                    <span className="web-import-rule-label">{rule.label}</span>
                    <span className="web-import-rule-id">{rule.id}</span>
                  </td>
                  <td>
                    <span className="web-import-rule-strategy">
                      {STRATEGY_LABELS[rule.strategy] ?? rule.strategy}
                    </span>
                  </td>
                  <td>
                    <code className="web-import-rule-pattern">
                      {truncate(rule.urlPattern, 50)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* ── JSON Editor dialog ───────────────────────────────────────────────── */}
      {editorOpen && (
        <div className="web-import-editor-overlay">
          <div className="web-import-editor-box" role="dialog" aria-modal="true">
            <div className="web-import-editor-header">
              <h3 className="web-import-editor-title">
                {editingIndex === null ? "Add rule" : "Edit rule"}
              </h3>
            </div>
            <p className="web-import-editor-hint">
              Paste or edit a rule as JSON. Required fields: <code>id</code>,{" "}
              <code>label</code>, <code>urlPattern</code>, <code>strategy</code>.
            </p>
            <textarea
              className="web-import-editor-textarea"
              value={editorJson}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>): void => {
                setEditorJson(e.target.value);
                setEditorError("");
              }}
              rows={18}
              spellCheck={false}
            />
            {editorError && (
              <p className="web-import-editor-error">{editorError}</p>
            )}
            <div className="web-import-editor-footer">
              <button
                className="web-import-btn"
                type="button"
                onClick={(): void => { setEditorOpen(false); }}
              >
                Cancel
              </button>
              <button
                className="web-import-btn web-import-btn-primary"
                type="button"
                onClick={handleEditorSave}
              >
                Save rule
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
};
