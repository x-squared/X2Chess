import type { ReactElement } from "react";
import { AppShell } from "./components/AppShell";
import { AppProvider } from "./state/app_context";

/**
 * React root application.
 */
export function App(): ReactElement {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
