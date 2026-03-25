import type { ReactElement } from "react";
import { AppShell } from "./components/AppShell";
import { AppProvider } from "./state/app_context";
import { HoverPreviewProvider } from "./components/HoverPreviewContext";
import { HoverPositionPopup } from "./components/HoverPositionPopup";

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
