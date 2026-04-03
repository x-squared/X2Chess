/**
 * useUpdateCheck — background app-update check using the Tauri updater plugin.
 *
 * On mount (desktop/Tauri runtime only), checks the configured endpoint
 * for a newer app version.  Exposes the update state so `UpdateBanner` can
 * render a prompt.  All network failures are silently swallowed — a failed
 * check has no visible effect.
 *
 * Integration API:
 * - `const update = useUpdateCheck()` — call once in `MenuPanel` or `AppShell`.
 * - Pass the returned object to `<UpdateBanner update={update} />`.
 *
 * Configuration API:
 * - No props.  The endpoint is configured in `tauri.conf.json` under
 *   `plugins.updater.endpoints`.
 *
 * Communication API:
 * - Inbound: Tauri updater plugin via `@tauri-apps/plugin-updater`.
 * - Outbound: no side effects until `installUpdate()` is called; that
 *   downloads, installs, and relaunches the app.
 */

import { useState, useEffect, useCallback } from "react";
import { isTauriRuntime } from "../resources/tauri_gateways";
import { CURRENT_APP_VERSION, isNewerVersion } from "../runtime/app_version";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The current state of the update check. */
export type UpdateCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string }
  | { status: "downloading"; progressPercent: number }
  | { status: "ready" }
  | { status: "dismissed" }
  | { status: "error"; message: string };

export type UseUpdateCheckResult = {
  /** Current update check status. */
  update: UpdateCheckState;
  /**
   * Download and install the available update, then relaunch.
   * No-op if `update.status !== "available"`.
   */
  installUpdate: () => void;
  /** Dismiss the update banner until the next app launch. */
  dismissUpdate: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Check for app updates on mount.  No-op if not running inside the Tauri
 * desktop runtime (e.g. browser dev mode).
 */
export const useUpdateCheck = (): UseUpdateCheckResult => {
  const [update, setUpdate] = useState<UpdateCheckState>({ status: "idle" });

  useEffect((): void => {
    if (!isTauriRuntime()) return;

    void (async (): Promise<void> => {
      setUpdate({ status: "checking" });
      try {
        // Dynamically import the Tauri plugin so the module is tree-shaken in
        // browser builds where the runtime is absent.
        const { check } = await import("@tauri-apps/plugin-updater");
        const available = await check();
        if (!available) {
          setUpdate({ status: "idle" });
          return;
        }
        const version: string = available.version ?? "unknown";
        if (isNewerVersion(CURRENT_APP_VERSION, version)) {
          setUpdate({ status: "available", version });
        } else {
          setUpdate({ status: "idle" });
        }
      } catch {
        // Silent failure — update check is non-critical.
        setUpdate({ status: "idle" });
      }
    })();
  }, []); // run once on mount

  const installUpdate = useCallback((): void => {
    if (update.status !== "available") return;
    const targetVersion: string = update.version;

    void (async (): Promise<void> => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const { relaunch } = await import("@tauri-apps/plugin-process");

        const available = await check();
        if (!available) return;

        setUpdate({ status: "downloading", progressPercent: 0 });

        await available.downloadAndInstall((progress) => {
          if (progress.event === "Progress" && progress.data.chunkLength != null) {
            // The plugin emits chunk-level events; approximate percentage from
            // contentLength when available.
            const total = (progress.data as { contentLength?: number | null }).contentLength;
            if (total && total > 0) {
              const pct = Math.min(
                99,
                Math.round(((progress.data.chunkLength) / total) * 100),
              );
              setUpdate({ status: "downloading", progressPercent: pct });
            }
          }
        });

        setUpdate({ status: "ready" });
        await relaunch();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setUpdate({ status: "error", message });
        // Revert to available so the user can retry.
        setTimeout((): void => {
          setUpdate({ status: "available", version: targetVersion });
        }, 4000);
      }
    })();
  }, [update]);

  const dismissUpdate = useCallback((): void => {
    setUpdate({ status: "dismissed" });
  }, []);

  return { update, installUpdate, dismissUpdate };
};
