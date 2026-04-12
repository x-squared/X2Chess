/**
 * PlayersPanel — browse, add, edit, and delete players in the player store,
 * and launch a text search for any player.
 *
 * Integration API:
 * - `<PlayersPanel t={t} onSearchPlayer={onSearchPlayer} />` — rendered inside
 *   the right-panel tab area by `RightPanelStack`.
 *
 * Configuration API:
 * - `t: (key, fallback?) => string` — translator function.
 * - `onSearchPlayer: (query) => void` — called when the user clicks "Search"
 *   on a player row; the caller switches to the text-search panel and supplies
 *   the query there.
 *
 * Communication API:
 * - Outbound: `services.addPlayer`, `services.deletePlayer`, `services.updatePlayer`
 *   via `useServiceContext()`.  `onSearchPlayer(query)` fires for panel navigation.
 * - Inbound: loads the player list from `services.getPlayers()` on mount and
 *   after each mutation; maintains a local copy in component state.
 */

import { useState, useEffect, useCallback, type ReactElement, type ChangeEvent, type KeyboardEvent } from "react";
import { useServiceContext } from "../../../state/ServiceContext";
import type { PlayerRecord } from "../model/app_state";
import { formatPlayerRecordName } from "../../../features/editor/model/game_info";
import { GUIDE_IDS } from "../../../features/guide/model/guide_ids";

type PlayersPanelProps = {
  t: (key: string, fallback?: string) => string;
  onSearchPlayer: (query: string) => void;
};

type EditState = { lastName: string; firstName: string };

const emptyEdit = (): EditState => ({ lastName: "", firstName: "" });

const playerKey = (r: PlayerRecord): string =>
  `${r.lastName.toLowerCase()}|${r.firstName.toLowerCase()}`;

export const PlayersPanel = ({ t, onSearchPlayer }: PlayersPanelProps): ReactElement => {
  const services = useServiceContext();

  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<EditState>(emptyEdit());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState>(emptyEdit());

  const refresh = useCallback((): void => {
    setPlayers(services.getPlayers());
  }, [services]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Add ────────────────────────────────────────────────────────────────────

  const handleAddSave = useCallback((): void => {
    const lastName = addForm.lastName.trim();
    if (!lastName) return;
    const record: PlayerRecord = { lastName, firstName: addForm.firstName.trim() };
    void services.addPlayer(record).then((): void => {
      refresh();
      setIsAdding(false);
      setAddForm(emptyEdit());
    });
  }, [addForm, services, refresh]);

  const handleAddCancel = useCallback((): void => {
    setIsAdding(false);
    setAddForm(emptyEdit());
  }, []);

  const handleAddKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") handleAddSave();
    if (e.key === "Escape") handleAddCancel();
  }, [handleAddSave, handleAddCancel]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const startEdit = useCallback((player: PlayerRecord): void => {
    setEditingKey(playerKey(player));
    setEditForm({ lastName: player.lastName, firstName: player.firstName });
    setIsAdding(false);
  }, []);

  const handleEditSave = useCallback((original: PlayerRecord): void => {
    const lastName = editForm.lastName.trim();
    if (!lastName) return;
    const updated: PlayerRecord = { lastName, firstName: editForm.firstName.trim() };
    void services.updatePlayer(original, updated).then((): void => {
      refresh();
      setEditingKey(null);
      setEditForm(emptyEdit());
    });
  }, [editForm, services, refresh]);

  const handleEditCancel = useCallback((): void => {
    setEditingKey(null);
    setEditForm(emptyEdit());
  }, []);

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, original: PlayerRecord): void => {
    if (e.key === "Enter") handleEditSave(original);
    if (e.key === "Escape") handleEditCancel();
  }, [handleEditSave, handleEditCancel]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback((player: PlayerRecord): void => {
    void services.deletePlayer(player).then((): void => {
      refresh();
      if (editingKey === playerKey(player)) {
        setEditingKey(null);
        setEditForm(emptyEdit());
      }
    });
  }, [services, refresh, editingKey]);

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback((player: PlayerRecord): void => {
    onSearchPlayer(formatPlayerRecordName(player));
  }, [onSearchPlayer]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="players-panel" data-guide-id={GUIDE_IDS.PLAYERS_PANEL}>
      {/* Header */}
      <div className="players-panel-header">
        <span className="players-panel-title">
          {t("players.title", "Players")}
        </span>
        <button
          className="players-panel-add-btn"
          onClick={(): void => { setIsAdding(true); setEditingKey(null); }}
          disabled={isAdding}
          aria-label={t("players.addPlayer", "Add player")}
        >
          {t("players.add", "+")}
        </button>
      </div>

      {/* Column headings */}
      <div className="players-panel-col-row players-panel-col-heading">
        <span className="players-panel-col-last">{t("players.lastName", "Last name")}</span>
        <span className="players-panel-col-first">{t("players.firstName", "First name")}</span>
        <span className="players-panel-col-actions" />
      </div>

      {/* Player list */}
      <ul className="players-panel-list" data-guide-id={GUIDE_IDS.PLAYERS_PANEL_LIST}>
        {players.length === 0 && !isAdding && (
          <li className="players-panel-empty">
            {t("players.empty", "No players yet.")}
          </li>
        )}

        {players.map((player) => {
          const key = playerKey(player);
          const isEditing = editingKey === key;

          return (
            <li key={key} className={`players-panel-row${isEditing ? " editing" : ""}`}>
              {isEditing ? (
                /* Inline edit form */
                <div className="players-panel-col-row">
                  <input
                    className="players-panel-input players-panel-col-last"
                    type="text"
                    value={editForm.lastName}
                    placeholder={t("players.lastNamePlaceholder", "Last name")}
                    aria-label={t("players.lastName", "Last name")}
                    autoFocus
                    onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                      setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>): void => handleEditKeyDown(e, player)}
                  />
                  <input
                    className="players-panel-input players-panel-col-first"
                    type="text"
                    value={editForm.firstName}
                    placeholder={t("players.firstNamePlaceholder", "First name")}
                    aria-label={t("players.firstName", "First name")}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                      setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>): void => handleEditKeyDown(e, player)}
                  />
                  <span className="players-panel-col-actions">
                    <button
                      className="players-panel-action-btn players-panel-save-btn"
                      onClick={(): void => handleEditSave(player)}
                      aria-label={t("players.save", "Save")}
                    >
                      {t("players.save", "Save")}
                    </button>
                    <button
                      className="players-panel-action-btn players-panel-cancel-btn"
                      onClick={handleEditCancel}
                      aria-label={t("players.cancel", "Cancel")}
                    >
                      {t("players.cancel", "×")}
                    </button>
                  </span>
                </div>
              ) : (
                /* Read-only row */
                <div className="players-panel-col-row">
                  <span className="players-panel-col-last players-panel-name" title={player.lastName}>
                    {player.lastName}
                  </span>
                  <span className="players-panel-col-first players-panel-name" title={player.firstName}>
                    {player.firstName}
                  </span>
                  <span className="players-panel-col-actions">
                    <button
                      className="players-panel-action-btn players-panel-search-btn"
                      onClick={(): void => handleSearch(player)}
                      aria-label={t("players.searchAriaLabel", `Search games for ${formatPlayerRecordName(player)}`)}
                      title={t("players.searchTitle", "Search games")}
                    >
                      {t("players.search", "⌕")}
                    </button>
                    <button
                      className="players-panel-action-btn players-panel-edit-btn"
                      onClick={(): void => startEdit(player)}
                      aria-label={t("players.editAriaLabel", `Edit ${formatPlayerRecordName(player)}`)}
                      title={t("players.editTitle", "Edit")}
                    >
                      {t("players.edit", "✎")}
                    </button>
                    <button
                      className="players-panel-action-btn players-panel-delete-btn"
                      onClick={(): void => handleDelete(player)}
                      aria-label={t("players.deleteAriaLabel", `Delete ${formatPlayerRecordName(player)}`)}
                      title={t("players.deleteTitle", "Delete")}
                    >
                      {t("players.delete", "✕")}
                    </button>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Add form */}
      {isAdding && (
        <div className="players-panel-add-form">
          <div className="players-panel-col-row">
            <input
              className="players-panel-input players-panel-col-last"
              type="text"
              value={addForm.lastName}
              placeholder={t("players.lastNamePlaceholder", "Last name")}
              aria-label={t("players.lastName", "Last name")}
              autoFocus
              onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                setAddForm((f) => ({ ...f, lastName: e.target.value }))}
              onKeyDown={handleAddKeyDown}
            />
            <input
              className="players-panel-input players-panel-col-first"
              type="text"
              value={addForm.firstName}
              placeholder={t("players.firstNamePlaceholder", "First name")}
              aria-label={t("players.firstName", "First name")}
              onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                setAddForm((f) => ({ ...f, firstName: e.target.value }))}
              onKeyDown={handleAddKeyDown}
            />
            <span className="players-panel-col-actions">
              <button
                className="players-panel-action-btn players-panel-save-btn"
                onClick={handleAddSave}
                disabled={addForm.lastName.trim() === ""}
                aria-label={t("players.save", "Save")}
              >
                {t("players.save", "Save")}
              </button>
              <button
                className="players-panel-action-btn players-panel-cancel-btn"
                onClick={handleAddCancel}
                aria-label={t("players.cancel", "Cancel")}
              >
                {t("players.cancel", "×")}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
