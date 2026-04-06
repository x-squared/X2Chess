import "chessground/assets/chessground.base.css";
import "./board/styles.css";
import "./editor/styles.css";
import "./components/game_editor/ast_panel.css";
import "./styles.css";
import "./components/shell/AppShell.css";
import "./components/shell/MenuPanel.css";
import "./components/shell/GameTabs.css";
import "./components/badges/annotation_badges.css";
import "./components/board/HoverPreview.css";
import "./components/resource_viewer/resource_viewer.css";
import "./components/shell/toolbar.css";
import "./components/metadata/metadata_schema.css";
import "./components/dialogs/new_game_dialog.css";
import "./components/board/move_dialogs.css";
import "./components/settings/ext_db_panels.css";
import "./components/web_import/web_import_rules.css";
import "./training/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initLogger } from "./logger";

void initLogger();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
