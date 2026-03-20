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

/**
 * Render formatted move list into moves panel container.
 *
 * @param {object} params - Rendering parameters.
 * @param {HTMLElement|null} params.movesEl - Moves panel root element.
 * @param {string[]} params.moves - Mainline SAN move list.
 * @param {object} params.pgnModel - Current PGN model for move-number context.
 * @param {Function} params.t - Translation resolver `(key, fallback) => string`.
 */
export const renderMovesPanel = ({ movesEl, moves, pgnModel, t }: any): any => {
  if (!movesEl) return;
  movesEl.replaceChildren();

  const label = document.createElement("span");
  label.className = "moves-label";
  label.textContent = `${t("moves.label", "Moves")}:`;
  movesEl.appendChild(label);

  if (moves.length === 0) {
    const empty = document.createElement("span");
    empty.className = "moves-empty";
    empty.textContent = ` ${t("moves.none", "No moves loaded.")}`;
    movesEl.appendChild(empty);
    return;
  }

  const startsWithBlack = ((): any => {
    const entries = pgnModel?.root?.entries;
    if (!Array.isArray(entries)) return false;
    for (const entry of entries) {
      if (entry?.type === "move_number") {
        return /^\d+\.\.\.?$/.test(String(entry.text ?? ""));
      }
      if (entry?.type === "move") return false;
    }
    return false;
  })();

  const list = document.createElement("div");
  list.className = "moves-list";

  if (startsWithBlack) {
    const first = document.createElement("span");
    first.className = "move";

    const nr = document.createElement("span");
    nr.className = "move-number";
    nr.textContent = "1";

    const white = document.createElement("span");
    white.className = "move-white skip";
    white.textContent = "";

    const black = document.createElement("span");
    black.className = "move-black";
    black.textContent = moves[0] ?? "";

    first.append(nr, white, black);
    list.appendChild(first);

    for (let i = 1; i < moves.length; i += 2) {
      const fullMove = Math.floor((i + 1) / 2) + 1;
      const whiteSan = moves[i] ?? "";
      const blackSan = moves[i + 1] ?? "";

      const move = document.createElement("span");
      move.className = "move";

      const moveNr = document.createElement("span");
      moveNr.className = "move-number";
      moveNr.textContent = String(fullMove);

      const moveWhite = document.createElement("span");
      moveWhite.className = "move-white";
      moveWhite.textContent = whiteSan;

      const moveBlack = document.createElement("span");
      moveBlack.className = "move-black";
      moveBlack.textContent = blackSan;

      move.append(moveNr, moveWhite, moveBlack);
      list.appendChild(move);
    }
  } else {
    for (let i = 0; i < moves.length; i += 2) {
      const fullMove = i / 2 + 1;
      const white = moves[i] ?? "";
      const black = moves[i + 1] ?? "";

      const move = document.createElement("span");
      move.className = "move";

      const moveNr = document.createElement("span");
      moveNr.className = "move-number";
      moveNr.textContent = String(fullMove);

      const moveWhite = document.createElement("span");
      moveWhite.className = "move-white";
      if (!white && black) moveWhite.classList.add("skip");
      moveWhite.textContent = white;

      const moveBlack = document.createElement("span");
      moveBlack.className = "move-black";
      moveBlack.textContent = black;

      move.append(moveNr, moveWhite, moveBlack);
      list.appendChild(move);
    }
  }

  movesEl.appendChild(list);
};
