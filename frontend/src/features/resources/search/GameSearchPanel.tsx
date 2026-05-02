/**
 * GameSearchPanel — search external game databases and import results (E6, E7).
 *
 * Provides a search form for Lichess and Chess.com games (by username, result,
 * date range, ECO opening, and opening name), displays results in a scrollable
 * table, and lets the user import selected games.
 *
 * Integration API:
 * - `<GameSearchPanel onImport={...} t={...} />`
 *
 * Configuration API:
 * - No global configuration; all state is local.
 *
 * Communication API:
 * - `onImport(pgn)` fires with the PGN text of the game to import.
 */

import {
  useState,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";
import { LICHESS_GAMES_ADAPTER } from "../../../resources/ext_databases/lichess_games";
import { CHESSDOTCOM_GAMES_ADAPTER } from "../../../resources/ext_databases/chessdotcom_games";
import type {
  GameDatabaseAdapter,
  ExtGameEntry,
  GameSearchQuery,
} from "../../../resources/ext_databases/game_db_types";
import { UI_IDS } from "../../../core/model/ui_ids";
import { ECO_OPENING_CODES, resolveEcoOpeningName } from "../../../model";
import { log } from "../../../logger";

// ── Registered adapters ────────────────────────────────────────────────────────

const ADAPTERS: GameDatabaseAdapter[] = [
  LICHESS_GAMES_ADAPTER,
  CHESSDOTCOM_GAMES_ADAPTER,
];

// ── Props ──────────────────────────────────────────────────────────────────────

type GameSearchPanelProps = {
  onImport: (pgn: string) => void;
  t: (key: string, fallback?: string) => string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Renders a formatted ELO string, or an em-dash if missing. */
const elo = (v?: number): string => (v === undefined ? "—" : String(v));

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Game database search panel.
 * Searches Lichess or Chess.com by username and optional filters; shows a table
 * with an import button per row.
 */
export const GameSearchPanel = ({ onImport, t }: GameSearchPanelProps): ReactElement => {

  const [adapterId, setAdapterId] = useState<string>(ADAPTERS[0].id);
  const [username, setUsername] = useState<string>("");
  const [color, setColor] = useState<"any" | "white" | "black">("any");
  const [result, setResult] = useState<"any" | "1-0" | "0-1" | "1/2-1/2">("any");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [eco, setEco] = useState<string>("");
  const [openingName, setOpeningName] = useState<string>("");
  const [results, setResults] = useState<ExtGameEntry[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const activeAdapter = ADAPTERS.find((a) => a.id === adapterId) ?? ADAPTERS[0];

  const handleSearch = useCallback(
    async (e: { preventDefault(): void }): Promise<void> => {
      e.preventDefault();
      const name = username.trim();
      setHasSearched(true);
      if (!name) {
        log.warn("GameSearchPanel", `search blocked: missing username for adapter=${activeAdapter.id}`);
        setError(t("gameSearch.usernameRequired", "Player's name is required by this source."));
        setResults([]);
        setHasMore(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      setResults([]);
      setHasMore(false);
      const query: GameSearchQuery = {
        player: { name, color: color === "any" ? "any" : color },
        result: result === "any" ? undefined : result,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        eco: eco || undefined,
        openingName: openingName.trim() || undefined,
        maxResults: 25,
      };
      try {
        const searchResult = await activeAdapter.search(query);
        setResults(searchResult.entries);
        setHasMore(searchResult.hasMore);
      } catch (error: unknown) {
        log.error("GameSearchPanel", "search failed", {
          adapterId: activeAdapter.id,
          message: error instanceof Error ? error.message : String(error),
        });
        setError(t("gameSearch.error", "Search failed. Please try again."));
      } finally {
        setIsLoading(false);
      }
    },
    [username, color, result, dateFrom, dateTo, eco, openingName, activeAdapter, t],
  );

  const handleImport = useCallback(
    async (entry: ExtGameEntry): Promise<void> => {
      setImportingId(entry.ref.id);
      try {
        const pgn = await activeAdapter.loadGame(entry.ref);
        if (pgn) onImport(pgn);
      } finally {
        setImportingId(null);
      }
    },
    [onImport, activeAdapter],
  );

  return (
    <div className="game-search-panel" data-ui-id={UI_IDS.GAME_SEARCH_PANEL}>
      <form className="game-search-form" onSubmit={handleSearch}>

        {/* Source */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.source", "Source:")}
          </span>
          <select
            className="game-search-select"
            value={adapterId}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
              setAdapterId(e.target.value);
              setResults([]);
            }}
          >
            {ADAPTERS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>

        {/* Username */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.username", "Player:")}
          </span>
          <input
            type="text"
            className="game-search-input"
            value={username}
            placeholder={t("gameSearch.placeholder", "e.g. DrNykterstein")}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              setUsername(e.target.value);
            }}
          />
        </label>

        {/* Color */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.color", "Color:")}
          </span>
          <select
            className="game-search-select"
            value={color}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
              setColor(e.target.value as "any" | "white" | "black");
            }}
          >
            <option value="any">{t("gameSearch.colorAny", "Any")}</option>
            <option value="white">{t("gameSearch.colorWhite", "White")}</option>
            <option value="black">{t("gameSearch.colorBlack", "Black")}</option>
          </select>
        </label>

        {/* Result */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.result", "Result:")}
          </span>
          <select
            className="game-search-select"
            value={result}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
              setResult(e.target.value as "any" | "1-0" | "0-1" | "1/2-1/2");
            }}
          >
            <option value="any">{t("gameSearch.resultAny", "Any")}</option>
            <option value="1-0">1-0</option>
            <option value="0-1">0-1</option>
            <option value="1/2-1/2">½-½</option>
          </select>
        </label>

        {/* Date from */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.dateFrom", "From:")}
          </span>
          <input
            type="date"
            className="game-search-input game-search-input--date"
            value={dateFrom}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              setDateFrom(e.target.value);
            }}
          />
        </label>

        {/* Date to */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.dateTo", "To:")}
          </span>
          <input
            type="date"
            className="game-search-input game-search-input--date"
            value={dateTo}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              setDateTo(e.target.value);
            }}
          />
        </label>

        {/* ECO opening dropdown */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.eco", "ECO:")}
          </span>
          <select
            className="game-search-select game-search-select--eco"
            value={eco}
            onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
              setEco(e.target.value);
            }}
          >
            <option value="">{t("gameSearch.ecoAny", "Any opening")}</option>
            {ECO_OPENING_CODES.map((code: string) => (
              <option key={code} value={code}>
                {code} – {resolveEcoOpeningName(code)}
              </option>
            ))}
          </select>
        </label>

        {/* Opening name substring filter */}
        <label className="game-search-label">
          <span className="game-search-label-text">
            {t("gameSearch.openingName", "Opening name:")}
          </span>
          <input
            type="text"
            className="game-search-input"
            value={openingName}
            placeholder={t("gameSearch.openingNamePlaceholder", "e.g. Sicilian")}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              setOpeningName(e.target.value);
            }}
          />
        </label>

        <button
          type="submit"
          className="game-search-btn-search"
          disabled={isLoading}
        >
          {isLoading
            ? t("gameSearch.searching", "Searching…")
            : t("gameSearch.search", "Search")}
        </button>
      </form>

      {error && (
        <p className="game-search-error" role="alert">{error}</p>
      )}

      {results.length > 0 && (
        <div className="game-search-results">
          <table className="game-search-table">
            <thead>
              <tr>
                <th>{t("gameSearch.col.white", "White")}</th>
                <th>{t("gameSearch.col.black", "Black")}</th>
                <th>{t("gameSearch.col.result", "Result")}</th>
                <th>{t("gameSearch.col.date", "Date")}</th>
                <th>{t("gameSearch.col.elo", "Elo")}</th>
                <th>{t("gameSearch.col.opening", "Opening")}</th>
                <th aria-label={t("gameSearch.col.import", "Import")} />
              </tr>
            </thead>
            <tbody>
              {results.map((entry) => (
                <tr key={entry.ref.id} className="game-search-row">
                  <td className="game-search-cell">{entry.white}</td>
                  <td className="game-search-cell">{entry.black}</td>
                  <td className="game-search-cell game-search-cell--result">{entry.result}</td>
                  <td className="game-search-cell game-search-cell--date">{entry.date}</td>
                  <td className="game-search-cell game-search-cell--elo">
                    {elo(entry.whiteElo)} / {elo(entry.blackElo)}
                  </td>
                  <td className="game-search-cell game-search-cell--opening">
                    {entry.eco && <span className="game-search-eco">{entry.eco}</span>}
                    {entry.opening && (
                      <span className="game-search-opening-name">{entry.opening}</span>
                    )}
                  </td>
                  <td className="game-search-cell game-search-cell--action">
                    <button
                      type="button"
                      className="game-search-btn-import"
                      disabled={importingId === entry.ref.id}
                      onClick={(): void => { void handleImport(entry); }}
                    >
                      {importingId === entry.ref.id
                        ? t("gameSearch.importing", "…")
                        : t("gameSearch.import", "Import")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <p className="game-search-more">
              {t("gameSearch.hasMore", "Showing first 25 results. Refine your search to narrow down.")}
            </p>
          )}
        </div>
      )}

      {!isLoading && results.length === 0 && !error && hasSearched && (
        <p className="game-search-empty">
          {t("gameSearch.noResults", "No games found.")}
        </p>
      )}
    </div>
  );
};
