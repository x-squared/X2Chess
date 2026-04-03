/**
 * DevDock — renders the developer tools dock section.
 *
 * Shows the AST view of the parsed PGN model.
 * Visibility is driven by `isDevDockOpen` from `AppStoreState`.
 * All interactions wired to `useServiceContext()`.
 *
 * Integration API:
 * - `<DevDock />` — rendered at the bottom of `<main class="app">`.
 *   No props required; reads all state from context.
 *
 * Configuration API:
 * - No props.  Dock open/close flows from `AppStoreState`.
 *
 * Communication API:
 * - Outbound: `setDevDockOpen` via `useServiceContext()`.
 * - Inbound: re-renders when `isDevDockOpen` or `pgnModel` change via
 *   `AppStoreState`.
 */

import type { ReactElement } from "react";
import { useAppContext } from "../../state/app_context";
import { selectDevDockOpen } from "../../state/selectors";
import { useServiceContext } from "../../state/ServiceContext";
import { useTranslator } from "../../hooks/useTranslator";
import { AstPanel } from "../game_editor/AstPanel";
import { GUIDE_IDS } from "../../guide/guide_ids";

/** Renders the developer tools dock with the AST panel. */
export const DevDock = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const isOpen: boolean = selectDevDockOpen(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  return (
    <section
      id="developer-dock"
      className="developer-dock"
      data-guide-id={GUIDE_IDS.DEV_DOCK}
      hidden={!isOpen}
    >
      {/* Resize handle */}
      <div
        id="dev-dock-resize-handle"
        className="developer-dock-resize-handle"
        aria-hidden="true"
      />

      <div className="developer-dock-header">
        <p className="developer-dock-title">
          {t("controls.developerTools", "Developer Tools")}
        </p>
        <div className="developer-dock-controls">
          <button
            id="btn-dev-dock-close"
            className="menu-close"
            type="button"
            aria-label={t("controls.closeDeveloperDock", "Close Developer Dock")}
            onClick={(): void => { services.setDevDockOpen(false); }}
          >
            ×
          </button>
        </div>
      </div>

      {/* AST panel — live PGN model tree */}
      <div className="developer-dock-body">
        <div
          id="dev-tab-ast"
          className="developer-dock-panel"
          role="region"
          aria-label={t("pgn.ast.label", "AST")}
        >
          <div id="ast-wrap" className="text-editor-wrap">
            <p className="text-editor-title">{t("pgn.ast.label", "AST")}</p>
            <AstPanel />
          </div>
        </div>
      </div>
    </section>
  );
};
