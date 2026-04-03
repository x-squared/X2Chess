/**
 * WebImportBrowserPanel — control panel for the Tier 3 in-app browser window.
 *
 * Renders a floating overlay in the main app window showing navigation controls
 * and a Capture button.  The actual site is displayed in a separate Tauri
 * WebView window managed via `BrowserPanelGateway`.
 *
 * Integration API:
 * - `<WebImportBrowserPanel gateway={…} url={…} captureScript={…}
 *     onCaptureResult={fn} onClose={fn} />` — render when a webview-strategy
 *   URL has been matched.  Pass `captureScript` from the matched rule; omit
 *   (or pass `undefined`) for URL-only access with no automatic capture.
 *
 * Configuration API:
 * - `gateway` — `BrowserPanelGateway` controlling the Tauri browser window.
 * - `url` — Initial URL shown to the user and used to open the browser window.
 * - `captureScript` — Optional JS expression evaluated in the browser window
 *   on Capture; must return a FEN or PGN string or null.
 *
 * Communication API:
 * - Outbound: calls `onCaptureResult(value)` when the capture script returns a
 *   non-null string; calls `onClose()` when the user closes the panel.
 * - Inbound: `gateway` commands control the Tauri browser window.
 * - Side effects: opens the browser window on mount; closes it on unmount.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { BrowserPanelGateway } from "../../resources/web_import/browser_panel_gateway";

// ── Types ─────────────────────────────────────────────────────────────────────

type WebImportBrowserPanelProps = {
  /** Gateway controlling the Tauri browser window commands. */
  gateway: BrowserPanelGateway;
  /** Initial URL to navigate the browser window to on mount. */
  url: string;
  /**
   * JS expression to evaluate in the browser window when the user clicks Capture.
   * Must return a FEN or PGN string, or null.  When absent, Capture is unavailable.
   */
  captureScript?: string;
  /**
   * Called with the raw string result of a successful capture.
   * The caller decides whether the value is FEN or PGN and imports accordingly.
   */
  onCaptureResult: (value: string) => void;
  /** Called when the user closes the panel (and the browser window). */
  onClose: () => void;
};

type CaptureState =
  | { status: "idle" }
  | { status: "capturing" }
  | { status: "error"; message: string };

// ── Component ─────────────────────────────────────────────────────────────────

/** Floating control panel for the Tier 3 browser window. */
export const WebImportBrowserPanel = ({
  gateway,
  url: initialUrl,
  captureScript,
  onCaptureResult,
  onClose,
}: WebImportBrowserPanelProps): ReactElement => {
  const [navUrl, setNavUrl] = useState<string>(initialUrl);
  const [captureState, setCaptureState] = useState<CaptureState>({ status: "idle" });
  const openedRef = useRef<boolean>(false);

  // Open the browser window when the panel mounts; close it on unmount.
  useEffect((): (() => void) => {
    if (!openedRef.current) {
      openedRef.current = true;
      void gateway.open(initialUrl).catch((): void => {
        setCaptureState({
          status: "error",
          message: "Could not open browser window. Make sure you are running the desktop app.",
        });
      });
    }
    return (): void => {
      void gateway.close().catch(() => undefined);
    };
  // initialUrl and gateway are stable for the lifetime of this panel instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = useCallback((): void => {
    const trimmed = navUrl.trim();
    if (!trimmed) return;
    void gateway.navigate(trimmed).catch((): void => {
      setCaptureState({ status: "error", message: "Navigation failed." });
    });
  }, [gateway, navUrl]);

  const handleAddressKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") handleNavigate();
  }, [handleNavigate]);

  const handleCapture = useCallback(async (): Promise<void> => {
    if (!captureScript) return;
    setCaptureState({ status: "capturing" });
    try {
      const result = await gateway.capture(captureScript);
      if (result !== null && result.trim()) {
        onCaptureResult(result.trim());
        onClose();
      } else {
        setCaptureState({
          status: "error",
          message: "Capture returned no result. Try navigating to the position first.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Capture failed.";
      setCaptureState({ status: "error", message });
    }
  }, [gateway, captureScript, onCaptureResult, onClose]);

  const handleClose = useCallback((): void => {
    void gateway.close().catch(() => undefined);
    onClose();
  }, [gateway, onClose]);

  const isCapturing = captureState.status === "capturing";

  return (
    <div className="web-browser-panel-overlay" role="dialog" aria-label="Browser panel">
      <div className="web-browser-panel">
        {/* ── Header ── */}
        <div className="web-browser-panel-header">
          <span className="web-browser-panel-title">Browser</span>
          <button
            className="web-import-rules-close"
            type="button"
            aria-label="Close browser panel"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        {/* ── Nav bar ── */}
        <div className="web-browser-panel-nav">
          <button
            className="web-import-btn-icon"
            type="button"
            title="Back"
            onClick={(): void => { void gateway.goBack(); }}
          >
            ←
          </button>
          <button
            className="web-import-btn-icon"
            type="button"
            title="Forward"
            onClick={(): void => { void gateway.goForward(); }}
          >
            →
          </button>
          <button
            className="web-import-btn-icon"
            type="button"
            title="Reload"
            onClick={(): void => { void gateway.reload(); }}
          >
            ↺
          </button>
          <input
            className="web-browser-panel-address"
            type="url"
            aria-label="Address"
            value={navUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => { setNavUrl(e.target.value); }}
            onKeyDown={handleAddressKeyDown}
          />
          <button
            className="web-import-btn"
            type="button"
            onClick={handleNavigate}
          >
            Go
          </button>
        </div>

        {/* ── Instruction ── */}
        <p className="web-browser-panel-hint">
          Navigate to the position in the browser window, then click <strong>Capture</strong>.
        </p>

        {/* ── Status / error ── */}
        {captureState.status === "error" && (
          <p className="web-browser-panel-error">{captureState.message}</p>
        )}

        {/* ── Capture footer ── */}
        <div className="web-browser-panel-footer">
          {!captureScript && (
            <p className="web-browser-panel-no-script">
              No capture script — copy the FEN or PGN from the page and paste it directly.
            </p>
          )}
          <button
            className="web-import-btn web-import-btn-primary"
            type="button"
            disabled={!captureScript || isCapturing}
            onClick={(): void => { void handleCapture(); }}
          >
            {isCapturing ? "Capturing…" : "Capture position"}
          </button>
        </div>
      </div>
    </div>
  );
};
