/**
 * DevDock — renders the developer tools dock section.
 *
 * Shows AST and Raw PGN views of the active game model (Raw PGN is editable with explicit apply).
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
import { useAppContext } from "../../providers/AppStateProvider";
import { selectActiveDevTab, selectDevDockOpen } from "../../../core/state/selectors";
import { useServiceContext } from "../../providers/ServiceProvider";
import { useTranslator } from "../../hooks/useTranslator";
import { AstPanel } from "../../../features/editor/components/AstPanel";
import { RawPgnPanel } from "../../../features/editor/components/RawPgnPanel";
import { GUIDE_IDS } from "../../../features/guide/model/guide_ids";

/** Renders the developer tools dock with AST and Raw PGN tabs. */
export const DevDock = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const isOpen: boolean = selectDevDockOpen(state);
  const activeDevTab: "ast" | "pgn" = selectActiveDevTab(state);
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
          <div className="developer-dock-tabs" role="tablist" aria-label={t("controls.developerTools", "Developer Tools")}>
            <button
              id="dev-tab-btn-ast"
              className="developer-dock-tab"
              type="button"
              role="tab"
              aria-selected={activeDevTab === "ast"}
              aria-controls="dev-tab-ast"
              onClick={(): void => { services.setActiveDevTab("ast"); }}
            >
              {t("pgn.ast.label", "AST")}
            </button>
            <button
              id="dev-tab-btn-raw-pgn"
              className="developer-dock-tab"
              type="button"
              role="tab"
              aria-selected={activeDevTab === "pgn"}
              aria-controls="dev-tab-raw-pgn"
              onClick={(): void => { services.setActiveDevTab("pgn"); }}
            >
              {t("devDock.tab.rawPgn", "Raw PGN")}
            </button>
          </div>
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
          hidden={activeDevTab !== "ast"}
          role="tabpanel"
          aria-labelledby="dev-tab-btn-ast"
        >
          <div id="ast-wrap" className="text-editor-wrap">
            <p className="text-editor-title">{t("pgn.ast.label", "AST")}</p>
            <AstPanel />
          </div>
        </div>
        <div
          id="dev-tab-raw-pgn"
          className="developer-dock-panel"
          hidden={activeDevTab !== "pgn"}
          role="tabpanel"
          aria-labelledby="dev-tab-btn-raw-pgn"
        >
          <div id="raw-pgn-wrap" className="text-editor-wrap">
            <p className="text-editor-title">{t("devDock.tab.rawPgn", "Raw PGN")}</p>
            <RawPgnPanel />
          </div>
        </div>
      </div>
    </section>
  );
};
