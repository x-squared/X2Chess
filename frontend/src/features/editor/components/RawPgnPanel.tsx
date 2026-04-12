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
import { useEffect, useState } from "react";
import { useAppContext } from "../../../state/app_context";
import { selectActiveSessionId, selectPgnText } from "../../../state/selectors";
import { useServiceContext } from "../../../state/ServiceContext";
import { useTranslator } from "../../../app/hooks/useTranslator";

/** Editable raw PGN area with explicit apply (no autosave). */
export const RawPgnPanel = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const t: (key: string, fallback?: string) => string = useTranslator();
  const storePgn: string = selectPgnText(state);
  const activeSessionId: string | null = selectActiveSessionId(state);
  const [draft, setDraft] = useState<string>(storePgn);
  const [touched, setTouched] = useState<boolean>(false);

  useEffect((): void => {
    setTouched(false);
    setDraft(storePgn);
  }, [activeSessionId]);

  useEffect((): void => {
    if (!touched) {
      setDraft(storePgn);
    }
  }, [storePgn, touched]);

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

      <textarea
        className="raw-pgn-view raw-pgn-editor"
        aria-label={t("devDock.rawPgn.editorLabel", "Raw PGN editor")}
        spellCheck={false}
        value={draft}
        onChange={onChange}
      />
    </div>
  );
};
