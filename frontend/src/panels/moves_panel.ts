/**
 * Moves Panel module.
 *
 * Integration API:
 * - Primary exports from this module: `renderMovesPanel`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type MovesPanelPgnModel = {
  root?: {
    entries?: Array<{ type?: string; text?: string }>;
  };
};

type MovesPanelParams = {
  movesEl: Element | null;
  moves: string[];
  pgnModel: unknown;
  t: (key: string, fallback?: string) => string;
};

export const renderMovesPanel = ({ movesEl, moves, pgnModel, t }: MovesPanelParams): void => {
  if (!(movesEl instanceof HTMLElement)) return;
  movesEl.replaceChildren();

  const label: HTMLSpanElement = document.createElement("span");
  label.className = "moves-label";
  label.textContent = `${t("moves.label", "Moves")}:`;
  movesEl.appendChild(label);

  if (moves.length === 0) {
    const empty: HTMLSpanElement = document.createElement("span");
    empty.className = "moves-empty";
    empty.textContent = ` ${t("moves.none", "No moves loaded.")}`;
    movesEl.appendChild(empty);
    return;
  }

  const startsWithBlack: boolean = (() => {
    const typedModel: MovesPanelPgnModel | null = (pgnModel as MovesPanelPgnModel | null) ?? null;
    const entries: Array<{ type?: string; text?: string }> | undefined = typedModel?.root?.entries;
    if (!Array.isArray(entries)) return false;
    for (const entry of entries) {
      if (entry?.type === "move_number") {
        return /^\d+\.\.\.?$/.test(String(entry.text ?? ""));
      }
      if (entry?.type === "move") return false;
    }
    return false;
  })();

  const list: HTMLDivElement = document.createElement("div");
  list.className = "moves-list";

  if (startsWithBlack) {
    const first: HTMLSpanElement = document.createElement("span");
    first.className = "move";

    const nr: HTMLSpanElement = document.createElement("span");
    nr.className = "move-number";
    nr.textContent = "1";

    const white: HTMLSpanElement = document.createElement("span");
    white.className = "move-white skip";
    white.textContent = "";

    const black: HTMLSpanElement = document.createElement("span");
    black.className = "move-black";
    black.textContent = moves[0] ?? "";

    first.append(nr, white, black);
    list.appendChild(first);

    for (let i: number = 1; i < moves.length; i += 2) {
      const fullMove: number = Math.floor((i + 1) / 2) + 1;
      const whiteSan: string = moves[i] ?? "";
      const blackSan: string = moves[i + 1] ?? "";

      const move: HTMLSpanElement = document.createElement("span");
      move.className = "move";

      const moveNr: HTMLSpanElement = document.createElement("span");
      moveNr.className = "move-number";
      moveNr.textContent = String(fullMove);

      const moveWhite: HTMLSpanElement = document.createElement("span");
      moveWhite.className = "move-white";
      moveWhite.textContent = whiteSan;

      const moveBlack: HTMLSpanElement = document.createElement("span");
      moveBlack.className = "move-black";
      moveBlack.textContent = blackSan;

      move.append(moveNr, moveWhite, moveBlack);
      list.appendChild(move);
    }
  } else {
    for (let i: number = 0; i < moves.length; i += 2) {
      const fullMove: number = i / 2 + 1;
      const white: string = moves[i] ?? "";
      const black: string = moves[i + 1] ?? "";

      const move: HTMLSpanElement = document.createElement("span");
      move.className = "move";

      const moveNr: HTMLSpanElement = document.createElement("span");
      moveNr.className = "move-number";
      moveNr.textContent = String(fullMove);

      const moveWhite: HTMLSpanElement = document.createElement("span");
      moveWhite.className = "move-white";
      if (!white && black) moveWhite.classList.add("skip");
      moveWhite.textContent = white;

      const moveBlack: HTMLSpanElement = document.createElement("span");
      moveBlack.className = "move-black";
      moveBlack.textContent = black;

      move.append(moveNr, moveWhite, moveBlack);
      list.appendChild(move);
    }
  }

  movesEl.appendChild(list);
};
