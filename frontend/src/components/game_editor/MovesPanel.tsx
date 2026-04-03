/**
 * MovesPanel — React move-list display component.
 *
 * Renders the mainline SAN moves from the active game as numbered move pairs.
 * Rendered inside the app as a dev auxiliary panel.
 *
 * Integration API:
 * - `<MovesPanel />` — no props required; reads from `AppStoreState`.
 *
 * Configuration API:
 * - No props.  Data flows from `AppStoreState.moves` and `AppStoreState.pgnModel`.
 *
 * Communication API:
 * - Inbound: re-renders when `moves` or `pgnModel` change.
 * - Outbound: none; read-only display.
 */

import type { ReactElement } from "react";
import { useMemo } from "react";
import { useAppContext } from "../state/app_context";
import { selectMoves, selectPgnModel } from "../state/selectors";
import { useTranslator } from "../hooks/useTranslator";

// ── Types ─────────────────────────────────────────────────────────────────────

type MovesPgnModel = {
  root?: {
    entries?: Array<{ type?: string; text?: string }>;
  };
};

type MovePair = {
  number: number;
  white: string;
  black: string;
  /** True when the white half should appear as a gap (game starts with Black). */
  skipWhite: boolean;
};

// ── Game-start-side detection ─────────────────────────────────────────────────

/**
 * Return `true` when the game's first move belongs to Black
 * (i.e., the PGN starts with a move-number like "1...").
 */
const detectStartsWithBlack = (pgnModel: unknown): boolean => {
  const model: MovesPgnModel | null = (pgnModel as MovesPgnModel | null) ?? null;
  const entries: Array<{ type?: string; text?: string }> | undefined =
    model?.root?.entries;
  if (!Array.isArray(entries)) return false;
  for (const entry of entries) {
    if (entry?.type === "move_number") {
      return /^\d+\.\.\.?$/.test(String(entry.text ?? ""));
    }
    if (entry?.type === "move") return false;
  }
  return false;
};

// ── Move-pair builder ─────────────────────────────────────────────────────────

const buildMovePairs = (moves: string[], startsWithBlack: boolean): MovePair[] => {
  if (moves.length === 0) return [];
  const pairs: MovePair[] = [];

  if (startsWithBlack) {
    // First visible row: no white move, only black move
    pairs.push({
      number: 1,
      white: "",
      black: moves[0] ?? "",
      skipWhite: true,
    });
    for (let i: number = 1; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor((i + 1) / 2) + 1,
        white: moves[i] ?? "",
        black: moves[i + 1] ?? "",
        skipWhite: false,
      });
    }
  } else {
    for (let i: number = 0; i < moves.length; i += 2) {
      pairs.push({
        number: i / 2 + 1,
        white: moves[i] ?? "",
        black: moves[i + 1] ?? "",
        skipWhite: false,
      });
    }
  }
  return pairs;
};

// ── MovesPanel ────────────────────────────────────────────────────────────────

/** Renders the mainline move list as numbered move pairs. */
export const MovesPanel = (): ReactElement => {
  const { state } = useAppContext();
  const moves: string[] = selectMoves(state);
  const pgnModel = selectPgnModel(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  const startsWithBlack: boolean = useMemo(
    (): boolean => detectStartsWithBlack(pgnModel),
    [pgnModel],
  );

  const pairs: MovePair[] = useMemo(
    (): MovePair[] => buildMovePairs(moves, startsWithBlack),
    [moves, startsWithBlack],
  );

  return (
    <div data-react-slice="moves-panel">
      <span className="moves-label">{t("moves.label", "Moves")}:</span>
      {moves.length === 0 ? (
        <span className="moves-empty"> {t("moves.none", "No moves loaded.")}</span>
      ) : (
        <div className="moves-list">
          {pairs.map((pair: MovePair): ReactElement => (
            <span key={pair.number} className="move">
              <span className="move-number">{pair.number}</span>
              <span
                className={["move-white", pair.skipWhite ? "skip" : ""].filter(Boolean).join(" ")}
              >
                {pair.white}
              </span>
              <span className="move-black">{pair.black}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
