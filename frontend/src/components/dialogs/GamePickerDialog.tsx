/**
 * GamePickerDialog — modal dialog for selecting a game from a resource.
 *
 * Loads the game list for the given resource ref, presents a searchable
 * filtered list, and reports the selected game's record ID and derived label
 * back to the caller via `onSelect`.
 *
 * Integration API:
 * - `<GamePickerDialog resourceRef={...} onSelect={...} onCancel={...} t={...} />`
 *   — mount when game-link picker should be shown; unmount on `onSelect` / `onCancel`.
 *   Requires `getResourceLoaderService()` to be populated (set by `useAppStartup`).
 *
 * Configuration API:
 * - `resourceRef: { kind: string; locator: string }` — resource to load games from.
 * - `onSelect: (row: PickerRow) => void` — called with the chosen game.
 * - `onCancel: () => void` — called when the dialog is dismissed.
 * - `t: (key: string, fallback?: string) => string` — translator function.
 *
 * Communication API:
 * - Outbound: `onSelect({ recordId, label })` on game selection.
 * - Outbound: `onCancel()` on Escape or backdrop click.
 * - Inbound: loads rows via `getResourceLoaderService()` on mount.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactElement,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { getResourceLoaderService } from "../../services/resource_loader";
import type { ResourceRow } from "../../features/resources/services/viewer_utils";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal game identity returned to the caller on selection. */
export type PickerRow = {
  /** Record ID of the selected game within the resource. */
  recordId: string;
  /** Derived label: "White vs Black", or empty string if headers are absent. */
  label: string;
};

type GamePickerDialogProps = {
  /** Resource to load games from. */
  resourceRef: { kind: string; locator: string };
  /**
   * Called when the user confirms a game selection.
   * @param row - Identity of the selected game.
   */
  onSelect: (row: PickerRow) => void;
  /** Called when the user dismisses without selecting. */
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const deriveRecordId = (row: ResourceRow): string => {
  const ref = row.sourceRef as Record<string, unknown> | null;
  const fromRef: string = String(ref?.recordId ?? "").trim();
  if (fromRef) return fromRef;
  return String(row.identifier ?? "").trim();
};

const deriveLabel = (row: ResourceRow): string => {
  const white: string = String(row.metadata?.White ?? "").trim();
  const black: string = String(row.metadata?.Black ?? "").trim();
  if (white && black) return `${white} vs ${black}`;
  if (white) return white;
  if (black) return black;
  return "";
};

const rowMatchesQuery = (row: ResourceRow, query: string): boolean => {
  if (!query) return true;
  const q: string = query.toLowerCase();
  const fields: string[] = [
    row.metadata?.White ?? "",
    row.metadata?.Black ?? "",
    row.metadata?.Event ?? "",
    row.metadata?.Date ?? "",
  ];
  return fields.some((f: string): boolean => f.toLowerCase().includes(q));
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Modal dialog presenting a searchable game list from a resource.
 * Arrow keys and Enter navigate and confirm; Escape cancels.
 */
export const GamePickerDialog = ({
  resourceRef,
  onSelect,
  onCancel,
  t,
}: GamePickerDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // ── Load game list on mount ──────────────────────────────────────────────
  useEffect((): void => {
    const loader = getResourceLoaderService();
    if (!loader) {
      setLoading(false);
      setErrorMessage(t("gamePicker.unavailable", "Resource not available."));
      return;
    }
    setLoading(true);
    void (async (): Promise<void> => {
      try {
        const result: unknown[] = await loader(resourceRef);
        setRows(result as ResourceRow[]);
      } catch {
        setErrorMessage(t("gamePicker.loadError", "Could not load game list."));
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // resourceRef identity is stable for the lifetime of this dialog

  // ── Open dialog and focus search on mount ───────────────────────────────
  useEffect((): void => {
    dialogRef.current?.showModal();
    searchRef.current?.focus();
  }, []);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered: ResourceRow[] = useMemo(
    (): ResourceRow[] => rows.filter((r: ResourceRow): boolean => rowMatchesQuery(r, query)),
    [rows, query],
  );

  // Reset active index when filter changes.
  useEffect((): void => {
    setActiveIndex(0);
  }, [query]);

  // ── Scroll active row into view ──────────────────────────────────────────
  useEffect((): void => {
    const list: HTMLUListElement | null = listRef.current;
    if (!list) return;
    const item: HTMLLIElement | null = list.querySelector<HTMLLIElement>(
      `[data-index="${activeIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const confirmSelection = useCallback(
    (index: number): void => {
      const row: ResourceRow | undefined = filtered[index];
      if (!row) return;
      const recordId: string = deriveRecordId(row);
      if (!recordId) return;
      dialogRef.current?.close();
      onSelect({ recordId, label: deriveLabel(row) });
    },
    [filtered, onSelect],
  );

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    setQuery(e.currentTarget.value);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i: number): number => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i: number): number => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirmSelection(activeIndex);
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [activeIndex, filtered.length, confirmSelection, handleCancel],
  );

  const handleDialogCancel = useCallback((): void => {
    onCancel();
  }, [onCancel]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <dialog
      ref={dialogRef}
      className="game-picker-dialog"
      onCancel={handleDialogCancel}
    >
      {/* Header */}
      <div className="game-picker-header">
        <span className="game-picker-title">
          {t("gamePicker.title", "Pick a game")}
        </span>
        <button
          type="button"
          className="game-picker-close"
          aria-label={t("gamePicker.close", "Close")}
          onClick={handleCancel}
        >
          ×
        </button>
      </div>

      {/* Search */}
      <div className="game-picker-search-row">
        <input
          ref={searchRef}
          type="search"
          className="game-picker-search"
          placeholder={t("gamePicker.searchPlaceholder", "Search by player or event…")}
          value={query}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          aria-label={t("gamePicker.searchPlaceholder", "Search by player or event…")}
        />
      </div>

      {/* Game list */}
      <div className="game-picker-list-wrap">
        {loading && (
          <p className="game-picker-status">
            {t("gamePicker.loading", "Loading…")}
          </p>
        )}
        {!loading && errorMessage && (
          <p className="game-picker-status game-picker-error">{errorMessage}</p>
        )}
        {!loading && !errorMessage && filtered.length === 0 && (
          <p className="game-picker-status">
            {t("gamePicker.noResults", "No games found.")}
          </p>
        )}
        {!loading && !errorMessage && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="game-picker-list"
            role="listbox"
            aria-label={t("gamePicker.title", "Pick a game")}
          >
            {filtered.map((row: ResourceRow, index: number): ReactElement => {
              const white: string = String(row.metadata?.White ?? "").trim();
              const black: string = String(row.metadata?.Black ?? "").trim();
              const result: string = String(row.metadata?.Result ?? "").trim();
              const date: string = String(row.metadata?.Date ?? "").trim();
              const isActive: boolean = index === activeIndex;

              return (
                <li
                  key={`${deriveRecordId(row)}-${index}`}
                  data-index={index}
                  className={["game-picker-row", isActive ? "game-picker-row-active" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  role="option"
                  aria-selected={isActive}
                  onClick={(): void => { confirmSelection(index); }}
                  onMouseEnter={(): void => { setActiveIndex(index); }}
                >
                  {/* Player names */}
                  <span className="game-picker-players">
                    {white || t("gamePicker.unknown", "?")}
                    {" – "}
                    {black || t("gamePicker.unknown", "?")}
                  </span>
                  {/* Result + date */}
                  <span className="game-picker-meta">
                    {[result, date].filter(Boolean).join(" · ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="game-picker-footer">
        <button
          type="button"
          className="game-picker-btn game-picker-btn-cancel"
          onClick={handleCancel}
        >
          {t("gamePicker.cancel", "Cancel")}
        </button>
      </div>
    </dialog>
  );
};
