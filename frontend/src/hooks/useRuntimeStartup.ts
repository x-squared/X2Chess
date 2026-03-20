import { useEffect } from "react";
import { startRuntime } from "../start_runtime";

let runtimeStarted = false;

/**
 * Transitional hook: starts runtime once while React migration is in progress.
 */
export const useRuntimeStartup = (): void => {
  useEffect((): void => {
    if (runtimeStarted) return;
    runtimeStarted = true;
    try {
      startRuntime();
    } catch (error: unknown) {
      const message: string = error instanceof Error ? error.message : String(error);
      const appHost: HTMLElement | null = document.querySelector("#app") as HTMLElement | null;
      if (appHost) {
        appHost.innerHTML = `<pre style="color:#b00020;padding:12px;white-space:pre-wrap;">Startup error: ${message}</pre>`;
      }
      // Keep runtime diagnostics visible in browser devtools.
      // eslint-disable-next-line no-console
      console.error("X2Chess runtime startup failed", error);
    }
  }, []);
};
