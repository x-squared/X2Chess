/**
 * UpdateBanner — in-app update notification strip.
 *
 * Displayed inside `MenuPanel` when a newer app version is detected.
 * Handles four visible states: available (prompt), downloading (progress bar),
 * ready (relaunch in progress), and error (retry message).
 *
 * Integration API:
 * - `<UpdateBanner update={update} onInstall={fn} onDismiss={fn} />` — render
 *   inside `MenuPanel` above the controls section.
 * - Returns `null` when no update is available or the banner has been dismissed.
 *
 * Configuration API:
 * - `update` — `UpdateCheckState` from `useUpdateCheck`.
 * - `onInstall` — called when the user confirms the update download.
 * - `onDismiss` — called when the user clicks "Later".
 *
 * Communication API:
 * - Outbound: calls `onInstall` or `onDismiss` on user action.
 * - No direct service context usage; all logic lives in `useUpdateCheck`.
 */

import type { ReactElement } from "react";
import type { UpdateCheckState } from "../../hooks/useUpdateCheck";

type UpdateBannerProps = {
  update: UpdateCheckState;
  onInstall: () => void;
  onDismiss: () => void;
};

/** Renders nothing when there is no actionable update. */
export const UpdateBanner = ({
  update,
  onInstall,
  onDismiss,
}: UpdateBannerProps): ReactElement | null => {
  if (
    update.status === "idle" ||
    update.status === "checking" ||
    update.status === "dismissed"
  ) {
    return null;
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      {update.status === "available" && (
        <>
          <p className="update-banner-text">
            Version <strong>{update.version}</strong> is available.
          </p>
          <div className="update-banner-actions">
            <button
              className="update-banner-btn update-banner-btn-primary"
              type="button"
              onClick={onInstall}
            >
              Update &amp; restart
            </button>
            <button
              className="update-banner-btn update-banner-btn-secondary"
              type="button"
              onClick={onDismiss}
            >
              Later
            </button>
          </div>
        </>
      )}

      {update.status === "downloading" && (
        <>
          <p className="update-banner-text">
            Downloading update…{" "}
            {update.progressPercent > 0 ? `${update.progressPercent}%` : ""}
          </p>
          <div className="update-banner-progress">
            <div
              className="update-banner-progress-fill"
              style={{ width: `${Math.max(4, update.progressPercent)}%` }}
            />
          </div>
        </>
      )}

      {update.status === "ready" && (
        <p className="update-banner-text">Restarting…</p>
      )}

      {update.status === "error" && (
        <p className="update-banner-text update-banner-error">
          Update failed: {update.message}
        </p>
      )}
    </div>
  );
};
