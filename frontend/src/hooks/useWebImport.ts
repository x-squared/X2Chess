/**
 * useWebImport — React hook for importing chess games and positions from URLs.
 *
 * Builds the active web import rule registry on mount and exposes a stable
 * `resolveUrl` callback suitable for injection into `createGameIngressHandlers`.
 *
 * Integration API:
 * - Call `const { resolveUrl } = useWebImport()` once in `AppShell`.
 * - Pass `resolveUrl` to `createGameIngressHandlers` as the `resolveUrl` option.
 *
 * Configuration API:
 * - Remote rules are fetched by `useRulesRefresh` and merged automatically.
 *   User-editable rules are not yet persisted (Phase W3).
 *
 * Communication API:
 * - Inbound: receives URL strings from the ingress handler.
 * - Outbound: calls `services.openPgnText()` on success; dispatches
 *   `set_error_message` on fetch failure or no rule match.
 */

import { useRef, useCallback, useEffect } from "react";
import { useAppContext } from "../state/app_context";
import { useServiceContext } from "../state/ServiceContext";
import { buildRegistry } from "../resources/web_import/rule_registry";
import { matchRule } from "../resources/web_import/rule_matcher";
import { fetchFromRule } from "../resources/web_import/rule_fetcher";
import { isTauriRuntime } from "../resources/tauri_gateways";
import { buildTauriHttpGateway } from "../resources/web_import/tauri_http_gateway";
import { useRulesRefresh } from "./useRulesRefresh";
import { loadUserRules } from "../resources/web_import/user_rules_storage";
import type { WebImportRule } from "../resources/web_import/web_import_types";
import type { NativeHttpGateway } from "../resources/web_import/rule_fetcher";

// ── FEN → minimal PGN ────────────────────────────────────────────────────────

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Wrap a FEN string in a minimal PGN with `SetUp "1"` and `FEN` headers so
 * that `openPgnText` can load it as a position game.
 *
 * @param fen - Valid FEN string.
 * @param title - Optional title used as the Event header value.
 */
const fenToPgn = (fen: string, title?: string): string =>
  [
    `[Event "${title ?? "?"}"]`,
    `[Site "?"]`,
    `[Date "${todayIso()}"]`,
    `[Round "?"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "*"]`,
    `[SetUp "1"]`,
    `[FEN "${fen}"]`,
    "",
    "*",
    "",
  ].join("\n");

// ── Hook ──────────────────────────────────────────────────────────────────────

type UseWebImportResult = {
  /**
   * Attempt to import a chess game or position from a URL.
   *
   * Matches the URL against the rule registry, fetches the resource, then
   * either opens the PGN in the editor or wraps a FEN in a minimal PGN and
   * opens that. Dispatches `set_error_message` if the URL is unrecognised or
   * the fetch fails.
   *
   * @param url - HTTP or HTTPS URL string.
   */
  resolveUrl: (url: string) => Promise<void>;
};

/**
 * Build and expose a stable `resolveUrl` callback for web import.
 *
 * Must be called inside the `AppProvider` and `ServiceContext.Provider` trees.
 */
export const useWebImport = (): UseWebImportResult => {
  const { dispatch } = useAppContext();
  const services = useServiceContext();

  // Remote rules fetched from the GitHub Pages rules server (non-blocking).
  const remoteRules = useRulesRefresh();

  // Registry ref: starts with user + built-ins, refreshed when remote rules or
  // user rules change.
  const registryRef = useRef<WebImportRule[]>(buildRegistry(loadUserRules()));
  useEffect((): void => {
    if (remoteRules !== null) {
      registryRef.current = buildRegistry([...loadUserRules(), ...remoteRules]);
    }
  }, [remoteRules]);

  // Rebuild registry when user rules change (saved via WebImportRulesPanel).
  useEffect((): (() => void) => {
    const handleUserRulesChanged = (): void => {
      const userRules = loadUserRules();
      registryRef.current = buildRegistry(
        remoteRules !== null ? [...userRules, ...remoteRules] : userRules,
      );
    };
    window.addEventListener("x2chess:userRulesChanged", handleUserRulesChanged);
    return (): void => {
      window.removeEventListener("x2chess:userRulesChanged", handleUserRulesChanged);
    };
  }, [remoteRules]);

  // Tier 2 gateway: available only in the Tauri desktop runtime.
  const nativeHttpRef = useRef<NativeHttpGateway | undefined>(
    isTauriRuntime() ? buildTauriHttpGateway() : undefined,
  );

  const resolveUrl = useCallback(
    async (url: string): Promise<void> => {
      const match = matchRule(url, registryRef.current);

      if (!match) {
        dispatch({
          type: "set_error_message",
          message: `No import rule matches this URL. Copy the FEN or PGN from the page and paste it directly.`,
        });
        return;
      }

      const result = await fetchFromRule(match.rule, match.captures, nativeHttpRef.current);

      if (!result) {
        dispatch({
          type: "set_error_message",
          message: `Could not import from ${match.rule.label}. Try copying the FEN or PGN directly.`,
        });
        return;
      }

      if (result.kind === "pgn") {
        services.openPgnText(result.value);
      } else {
        // FEN-only result: wrap in a minimal PGN so the editor can open it.
        services.openPgnText(fenToPgn(result.value, result.title));
      }
    },
    [dispatch, services],
  );

  return { resolveUrl };
};
