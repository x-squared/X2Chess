import type { ReactElement } from "react";
import { AppShell } from "./components/shell/AppShell";
import { AppProvider } from "./state/app_context";
import { HoverPreviewProvider } from "./components/board/HoverPreviewContext";
import { HoverPositionPopup } from "./components/board/HoverPositionPopup";

/**
 * React root application.
 */
export function App(): ReactElement {
  return (
    <AppProvider>
      <HoverPreviewProvider>
        <AppShell />
        <HoverPositionPopup />
      </HoverPreviewProvider>
    </AppProvider>
  );
}
