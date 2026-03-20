import { useEffect } from "react";
import { bootstrap } from "./bootstrap";

let bootstrapStarted = false;

/**
 * React shell: mounts nothing visible; legacy DOM lives under `#app` (see `createAppLayout`).
 * Module-level guard avoids double init under React StrictMode (dev).
 */
export function App(): null {
  useEffect((): any => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    bootstrap();
  }, []);
  return null;
}
