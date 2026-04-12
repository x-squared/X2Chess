import type { ReactElement } from "react";
import { AppShell } from "./shell/components/AppShell";
import { AppProvider } from "./providers/AppStateProvider";
import { HoverPreviewProvider } from "../components/board/HoverPreviewContext";
import { HoverPositionPopup } from "../components/board/HoverPositionPopup";

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
