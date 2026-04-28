/**
 * GamePickerDialog — modal dialog for selecting a game from a resource.
 *
 * Loads the game list for the given resource ref, presents a searchable
 * table, and reports the selected game's record ID and derived label back
 * to the caller via `onSelect`.
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
 * - Outbound: `onSelect({ recordId, label })` after explicit confirmation (Enter, Select button, or double-click row).
 * - Outbound: `onCancel()` on Escape, backdrop cancel, close button, or Cancel.
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
import { UI_IDS } from "../../core/model/ui_ids";
import type { ResourceRow } from "../../features/resources/services/viewer_utils";
import { log } from "../../logger";

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
  /** Called when the user confirms a game selection. */
  onSelect: (row: PickerRow) => void;
  /** Called when the user dismisses without selecting. */
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
};

const deriveRecordId = (row: ResourceRow): string => {
  const sourceRef: unknown = row.sourceRef;
  const ref: Record<string, unknown> | null =
    sourceRef !== null && typeof sourceRef === "object" ? sourceRef as Record<string, unknown> : null;
  const fromRefRaw: unknown = ref?.recordId;
  const fromRef: string = typeof fromRefRaw === "string" ? fromRefRaw.trim() : "";
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
  return fields.some((fieldValue: string): boolean => fieldValue.toLowerCase().includes(q));
};

/** Modal dialog presenting a searchable game list from a resource. */
export const GamePickerDialog = ({
  resourceRef,
  onSelect,
  onCancel,
  t,
}: GamePickerDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect((): void => {
    const loader = getResourceLoaderService();
    if (!loader) {
      setLoading(false);
      setErrorMessage(t("gamePicker.unavailable", "Resource not available."));
      log.warn("GamePickerDialog", "resource loader unavailable");
      return;
    }
    setLoading(true);
    void (async (): Promise<void> => {
      try {
        const result: unknown[] = await loader(resourceRef);
        setRows(result as ResourceRow[]);
        log.info("GamePickerDialog", "rows loaded", {
          kind: resourceRef.kind,
          locator: resourceRef.locator,
          rowCount: result.length,
        });
      } catch (error: unknown) {
        setErrorMessage(t("gamePicker.loadError", "Could not load game list."));
        log.error("GamePickerDialog", "load failed", {
          kind: resourceRef.kind,
          locator: resourceRef.locator,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect((): void => {
    dialogRef.current?.showModal();
    searchRef.current?.focus();
  }, []);

  const filtered: ResourceRow[] = useMemo(
    (): ResourceRow[] => rows.filter((row: ResourceRow): boolean => rowMatchesQuery(row, query)),
    [rows, query],
  );

  useEffect((): void => {
    setActiveIndex(0);
  }, [query]);

  useEffect((): void => {
    const list: HTMLDivElement | null = tableScrollRef.current;
    if (!list) return;
    const row: HTMLTableRowElement | null = list.querySelector<HTMLTableRowElement>(
      `[data-index="${activeIndex}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const confirmSelection = useCallback(
    (index: number): void => {
      const row: ResourceRow | undefined = filtered[index];
      if (!row) return;
      const recordId: string = deriveRecordId(row);
      if (!recordId) return;
      dialogRef.current?.close();
      onSelect({ recordId, label: deriveLabel(row) });
      log.info("GamePickerDialog", "selected", { recordId });
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
        setActiveIndex((index: number): number => Math.min(index + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((index: number): number => Math.max(index - 1, 0));
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

  return (
    <dialog
      ref={dialogRef}
      className="x2-dialog game-picker-dialog"
      data-ui-id={UI_IDS.GAME_PICKER_DIALOG}
      onCancel={handleDialogCancel}
    >
      <div className="x2-dialog-body game-picker-body">
        <div className="game-picker-header">
          <h2 className="x2-dialog-title game-picker-title">
            {t("gamePicker.title", "Pick a game")}
          </h2>
          <button
            type="button"
            className="game-picker-close"
            aria-label={t("gamePicker.close", "Close")}
            onClick={handleCancel}
          >
            ×
          </button>
        </div>

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
            <div ref={tableScrollRef} className="game-picker-list-scroll">
              <table className="game-picker-table" aria-label={t("gamePicker.title", "Pick a game")}>
                <thead>
                  <tr>
                    <th>{t("gamePicker.col.players", "Players")}</th>
                    <th>{t("gamePicker.col.result", "Result")}</th>
                    <th>{t("gamePicker.col.date", "Date")}</th>
                    <th>{t("gamePicker.col.event", "Event")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row: ResourceRow, index: number): ReactElement => {
                    const white: string = String(row.metadata?.White ?? "").trim();
                    const black: string = String(row.metadata?.Black ?? "").trim();
                    const result: string = String(row.metadata?.Result ?? "").trim();
                    const date: string = String(row.metadata?.Date ?? "").trim();
                    const event: string = String(row.metadata?.Event ?? "").trim();
                    const isActive: boolean = index === activeIndex;

                    return (
                      <tr
                        key={`${deriveRecordId(row)}-${index}`}
                        data-index={index}
                        className={["game-picker-row", isActive ? "game-picker-row-active" : ""]
                          .filter(Boolean)
                          .join(" ")}
                        aria-selected={isActive}
                        onClick={(): void => { setActiveIndex(index); }}
                        onDoubleClick={(): void => { confirmSelection(index); }}
                        onMouseEnter={(): void => { setActiveIndex(index); }}
                      >
                        <td className="game-picker-players">
                          {white || t("gamePicker.unknown", "?")}
                          {" – "}
                          {black || t("gamePicker.unknown", "?")}
                        </td>
                        <td>{result || "—"}</td>
                        <td>{date || "—"}</td>
                        <td>{event || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="x2-dialog-footer game-picker-footer">
          <button
            type="button"
            className="x2-dialog-btn"
            onClick={handleCancel}
          >
            {t("gamePicker.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="x2-dialog-btn x2-dialog-btn--primary"
            disabled={filtered.length === 0}
            onClick={(): void => { confirmSelection(activeIndex); }}
          >
            {t("gamePicker.select", "Select")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
