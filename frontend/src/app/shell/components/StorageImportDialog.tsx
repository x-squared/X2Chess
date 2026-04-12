/**
 * StorageImportDialog — modal dialog for selectively importing webview storage entries.
 *
 * Displays the key/value pairs from a parsed localStorage snapshot and lets the
 * user choose which entries to write into the current webview's `localStorage`.
 * Existing keys are overwritten when their checkbox is checked.
 *
 * Integration API:
 * - `<StorageImportDialog data={...} onClose={...} />` — rendered inside `<MenuPanel>`
 *   when `storageImportPending` is non-null.
 *   Requires no ancestor wrappers beyond the standard DOM.
 *
 * Configuration API:
 * - `data: Record<string, string>` — parsed storage snapshot to import from.
 * - `onClose: () => void` — called when the dialog is dismissed (cancel or import).
 *
 * Communication API:
 * - Outbound: writes selected entries directly to `localStorage` on confirm.
 *   Calls `onClose` when done.
 * - Inbound: stateless beyond the `data` prop; all selection state is local.
 */

import { useState } from "react";
import type { ReactElement, ChangeEvent } from "react";
import { useTranslator } from "../../hooks/useTranslator";

type Props = {
  readonly data: Record<string, string>;
  readonly onClose: () => void;
};

/** Render a key/value pair truncated for display. */
const truncate = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max)}\u2026` : s;

/** Modal dialog for selective webview-storage import. */
export const StorageImportDialog = ({ data, onClose }: Props): ReactElement => {
  const t: (key: string, fallback?: string) => string = useTranslator();
  const keys: string[] = Object.keys(data).sort();
  const [selected, setSelected] = useState<Set<string>>(new Set(keys));

  const toggleKey = (key: string): void => {
    setSelected((prev: Set<string>): Set<string> => {
      const next: Set<string> = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const toggleAll = (checked: boolean): void => {
    setSelected(checked ? new Set(keys) : new Set());
  };

  const handleImport = (): void => {
    for (const key of selected) {
      const value: string | undefined = data[key];
      if (value !== undefined) localStorage.setItem(key, value);
    }
    onClose();
  };

  const allChecked: boolean = selected.size === keys.length;
  const someChecked: boolean = selected.size > 0 && selected.size < keys.length;

  return (
    <div className="storage-import-overlay" role="dialog" aria-modal="true">
      <div className="storage-import-dialog">

        {/* Header */}
        <div className="storage-import-header">
          <span className="storage-import-title">
            {t("storageImport.title", "Import Storage Entries")}
          </span>
          <button
            className="menu-close"
            type="button"
            aria-label={t("storageImport.cancel", "Cancel")}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Select-all row */}
        <label className="storage-import-select-all inline-control">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el): void => { if (el) el.indeterminate = someChecked; }}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => { toggleAll(e.target.checked); }}
          />
          {t("storageImport.selectAll", "Select all")}
          <span className="storage-import-count">
            ({selected.size} / {keys.length})
          </span>
        </label>

        {/* Key list */}
        <ul className="storage-import-list">
          {keys.map((key: string): ReactElement => (
            <li key={key} className="storage-import-row">
              <label className="inline-control">
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  onChange={(): void => { toggleKey(key); }}
                />
                <span className="storage-import-key" title={key}>
                  {truncate(key, 48)}
                </span>
              </label>
              <span className="storage-import-value" title={data[key]}>
                {truncate(data[key] ?? "", 60)}
              </span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="storage-import-actions">
          <button
            className="source-button"
            type="button"
            disabled={selected.size === 0}
            onClick={handleImport}
          >
            {t("storageImport.importSelected", "Import Selected")}
          </button>
          <button
            className="source-button"
            type="button"
            onClick={onClose}
          >
            {t("storageImport.cancel", "Cancel")}
          </button>
        </div>

      </div>
    </div>
  );
};
