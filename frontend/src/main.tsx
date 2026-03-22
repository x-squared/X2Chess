import "chessground/assets/chessground.base.css";
import "./board/styles.css";
import "./editor/styles.css";
import "./panels/styles.css";
import "./styles.css";
import "./components/resource_viewer.css";
import "./components/toolbar.css";
import "./components/metadata_schema.css";
import "./components/new_game_dialog.css";
import "./components/move_dialogs.css";
import "./components/ext_db_panels.css";
import "./training/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
