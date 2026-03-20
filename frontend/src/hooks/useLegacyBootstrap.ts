import { useEffect } from "react";
import { bootstrap } from "../bootstrap";

let bootstrapStarted = false;

/**
 * Transitional hook: starts legacy runtime once while React migration is in progress.
 */
export const useLegacyBootstrap = (): void => {
  useEffect((): void => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    bootstrap();
  }, []);
};
