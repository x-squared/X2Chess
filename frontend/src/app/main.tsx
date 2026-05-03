import "chessground/assets/chessground.base.css";
import "../board/styles.css";
import "../features/editor/styles.css";
import "../features/editor/components/ast_panel.css";
import "../styles.css";
import "../app/shell/components/AppShell.css";
import "../app/shell/components/MenuPanel.css";
import "../app/shell/components/GameTabs.css";
import "../components/badges/annotation_badges.css";
import "../components/board/HoverPreview.css";
import "../features/resources/components/resource_viewer.css";
import "../app/shell/components/toolbar.css";
import "../features/resources/metadata/metadata_schema.css";
import "../components/dialogs/dialog.css";
import "../components/dialogs/new_game_dialog.css";
import "../components/dialogs/game_picker_dialog.css";
import "../components/board/move_dialogs.css";
import "../features/settings/components/ext_db_panels.css";
import "../features/analysis/components/analysis_panel.css";
import "../features/engines/components/engines.css";
import "../features/resources/components/web_import_rules.css";
import "../training/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initLogger, log } from "../logger";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

await initLogger();
log.info("main", "X2Chess starting — logging active");

globalThis.addEventListener("error", (event: ErrorEvent): void => {
  const err = event.error;
  const detail: string = err instanceof Error
    ? `${err.name}: ${err.message}\n${err.stack ?? ""}`
    : `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
  log.error("main", `Unhandled error event: ${detail}`);
});

globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
  const reason = event.reason;
  const detail: string = reason instanceof Error
    ? `${reason.name}: ${reason.message}\n${reason.stack ?? ""}`
    : String(reason);
  log.error("main", `Unhandled rejection: ${detail}`);
});

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
