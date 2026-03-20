/**
 * DevDock — renders the developer tools dock section.
 *
 * Shows the AST view, DOM view, and raw-PGN input panels in a tabbed layout.
 * Visibility and active tab are driven by `isDevDockOpen` and `activeDevTab`
 * from `AppStoreState`.  All interactions wired to `useServiceContext()`.
 *
 * Integration API:
 * - `<DevDock />` — rendered at the bottom of `<main class="app">`.
 *   No props required; reads all state from context.
 *
 * Configuration API:
 * - No props.  Dock open/close and tab selection flow from `AppStoreState`.
 *
 * Communication API:
 * - Outbound: `setDevDockOpen`, `setActiveDevTab` via `useServiceContext()`.
 * - Inbound: `hidden` and `aria-selected` attributes re-render when
 *   `isDevDockOpen` or `activeDevTab` change via `AppStoreState`.
 */

import type { ReactElement } from "react";
import { useAppContext } from "../state/app_context";
import { selectActiveDevTab, selectDevDockOpen } from "../state/selectors";
import { useServiceContext } from "../state/ServiceContext";
import { useTranslator } from "../hooks/useTranslator";
import { AstPanel } from "./AstPanel";

/** Renders the developer tools dock with tabbed AST / DOM / PGN panels. */
export const DevDock = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const isOpen: boolean = selectDevDockOpen(state);
  const activeTab: "ast" | "dom" | "pgn" = selectActiveDevTab(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  return (
    <section
      id="developer-dock"
      className="developer-dock"
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
          <div
            className="developer-dock-tabs"
            role="tablist"
            aria-label={t("controls.developerTools", "Developer Tools")}
          >
            <button
              id="dev-tab-btn-ast"
              className="developer-dock-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "ast" ? "true" : "false"}
              aria-controls="dev-tab-ast"
              onClick={(): void => { services.setActiveDevTab("ast"); }}
            >
              {t("pgn.ast.label", "ast_view")}
            </button>
            <button
              id="dev-tab-btn-dom"
              className="developer-dock-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "dom" ? "true" : "false"}
              aria-controls="dev-tab-dom"
              onClick={(): void => { services.setActiveDevTab("dom"); }}
            >
              {t("pgn.dom.label", "dom_view")}
            </button>
            <button
              id="dev-tab-btn-pgn"
              className="developer-dock-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "pgn" ? "true" : "false"}
              aria-controls="dev-tab-pgn"
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

      <div className="developer-dock-body">
        {/* AST panel */}
        <div
          id="dev-tab-ast"
          className="developer-dock-panel"
          role="tabpanel"
          aria-labelledby="dev-tab-btn-ast"
          hidden={activeTab !== "ast"}
        >
          <div id="ast-wrap" className="text-editor-wrap">
            <p className="text-editor-title">{t("pgn.ast.label", "ast_view")}</p>
            <AstPanel />
          </div>
        </div>

        {/* DOM panel */}
        <div
          id="dev-tab-dom"
          className="developer-dock-panel"
          role="tabpanel"
          aria-labelledby="dev-tab-btn-dom"
          hidden={activeTab !== "dom"}
        >
          <div id="dom-wrap" className="text-editor-wrap">
            <p className="text-editor-title">{t("pgn.dom.label", "dom_view")}</p>
            {/* dom_panel.ts renders content into this element */}
            <pre id="dom-view" className="dom-view" />
          </div>
        </div>

        {/* Raw PGN panel */}
        <div
          id="dev-tab-pgn"
          className="developer-dock-panel"
          role="tabpanel"
          aria-labelledby="dev-tab-btn-pgn"
          hidden={activeTab !== "pgn"}
        >
          <div className="pgn-area">
            <label htmlFor="pgn-input">{t("pgn.label", "PGN input")}</label>
            <textarea
              id="pgn-input"
              placeholder={t("pgn.placeholder", "Paste PGN text.")}
            />
            <div className="pgn-actions">
              <button
                id="btn-load"
                type="button"
                onClick={(): void => {
                  const el = document.getElementById("pgn-input") as HTMLTextAreaElement | null;
                  if (el) services.loadPgnText(el.value);
                }}
              >
                {t("pgn.load", "Load PGN")}
              </button>
              <p id="error" className="error" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
