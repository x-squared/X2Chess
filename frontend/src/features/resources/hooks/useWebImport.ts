/**
 * useWebImport — React hook for importing chess games and positions from URLs.
 *
 * Builds the active web import rule registry on mount and exposes a stable
 * `resolveUrl` callback suitable for injection into `createGameIngressHandlers`.
 * Also manages the Tier 3 browser panel state for webview-strategy rules.
 *
 * Integration API:
 * - Call `const { resolveUrl, browserPanelState, closeBrowserPanel,
 *   handleCaptureResult } = useWebImport()` once in `AppShell`.
 * - Pass `resolveUrl` to `createGameIngressHandlers` as the `resolveUrl` option.
 * - When `browserPanelState !== null`, render `<WebImportBrowserPanel>` with
 *   the provided url/captureScript and wire `onCaptureResult`/`onClose`.
 *
 * Configuration API:
 * - Remote rules are fetched by `useRulesRefresh` and merged automatically.
 * - User-editable rules are loaded from localStorage via `loadUserRules`.
 *
 * Communication API:
 * - Inbound: receives URL strings from the ingress handler via `resolveUrl`.
 * - Outbound: calls `services.openPgnText()` on Tier 1/2 success; opens the
 *   browser panel on Tier 3 match; dispatches `set_error_message` on failure.
 * - `handleCaptureResult(value)` processes a captured FEN/PGN string and
 *   imports it, then clears `browserPanelState`.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import { buildRegistry } from "../../../resources/web_import/rule_registry";
import { matchRule } from "../../../resources/web_import/rule_matcher";
import { fetchFromRule } from "../../../resources/web_import/rule_fetcher";
import { isTauriRuntime } from "../../../platform/desktop/tauri/tauri_gateways";
import { buildTauriHttpGateway } from "../../../resources/web_import/tauri_http_gateway";
import {
  buildTauriBrowserPanelGateway,
  type BrowserPanelGateway,
} from "../../../resources/web_import/browser_panel_gateway";
import { useRulesRefresh } from "./useRulesRefresh";
import { loadUserRules } from "../../../resources/web_import/user_rules_storage";
import type { WebImportRule } from "../../../resources/web_import/web_import_types";
import type { NativeHttpGateway } from "../../../resources/web_import/rule_fetcher";

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

/** State for the Tier 3 browser panel, set when a webview-strategy rule is matched. */
type BrowserPanelState = {
  /** URL to display in the panel address bar and open in the browser window. */
  url: string;
  /** JS capture expression from the matched rule, if present. */
  captureScript?: string;
  /** Resolved gateway for controlling the browser window. */
  gateway: BrowserPanelGateway;
};

type UseWebImportResult = {
  /**
   * Attempt to import a chess game or position from a URL.
   *
   * Tier 1/2: fetches programmatically and imports the result.
   * Tier 3 (webview): opens the browser panel instead of fetching.
   * No match: dispatches `set_error_message`.
   *
   * @param url - HTTP or HTTPS URL string.
   */
  resolveUrl: (url: string) => Promise<void>;

  /**
   * Non-null while the Tier 3 browser panel is open.
   * Render `<WebImportBrowserPanel>` with these values when set.
   */
  browserPanelState: BrowserPanelState | null;

  /** Close the browser panel and clear its state. */
  closeBrowserPanel: () => void;

  /**
   * Process a raw FEN or PGN string captured from the browser panel.
   * Imports the value and clears `browserPanelState`.
   *
   * @param value - FEN string or raw PGN text returned by the capture script.
   */
  handleCaptureResult: (value: string) => void;
};

/**
 * Build and expose a stable `resolveUrl` callback for web import, plus browser
 * panel state for Tier 3 (webview) rules.
 *
 * Must be called inside the `AppProvider` and `ServiceContext.Provider` trees.
 *
 * @returns `UseWebImportResult` with `resolveUrl`, `browserPanelState`, `closeBrowserPanel`, and `handleCaptureResult`.
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

  // Tier 3 gateway: available only in the Tauri desktop runtime.
  const browserPanelGatewayRef = useRef<BrowserPanelGateway | undefined>(
    isTauriRuntime() ? buildTauriBrowserPanelGateway() : undefined,
  );

  // Browser panel state: set when a webview-strategy rule is matched.
  const [browserPanelState, setBrowserPanelState] = useState<BrowserPanelState | null>(null);

  const closeBrowserPanel = useCallback((): void => {
    setBrowserPanelState(null);
  }, []);

  const handleCaptureResult = useCallback((value: string): void => {
    setBrowserPanelState(null);
    const trimmed = value.trim();
    // Heuristic: FEN strings contain slashes between ranks and no PGN tag syntax.
    const looksLikeFen = /^[pnbrqkPNBRQK1-8]{1,8}(?:\/[pnbrqkPNBRQK1-8]{1,8}){7}/.test(trimmed);
    if (looksLikeFen) {
      services.openPgnText(fenToPgn(trimmed));
    } else {
      services.openPgnText(trimmed);
    }
  }, [services]);

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

      // Tier 3: open the in-app browser panel instead of fetching programmatically.
      if (match.rule.strategy === "webview") {
        const gateway = browserPanelGatewayRef.current;
        if (!gateway) {
          dispatch({
            type: "set_error_message",
            message: `"${match.rule.label}" requires the desktop app. Copy the FEN or PGN directly.`,
          });
          return;
        }
        setBrowserPanelState({
          url,
          captureScript: match.rule.captureScript,
          gateway,
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

  return { resolveUrl, browserPanelState, closeBrowserPanel, handleCaptureResult };
};
