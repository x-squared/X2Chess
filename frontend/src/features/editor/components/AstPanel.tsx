/**
 * AstPanel — React AST tree viewer for the developer dock.
 *
 * Renders the parsed PGN model as a recursive tree of labelled nodes.
 * Mounted inside the `#ast-wrap` section of `DevDock`.
 *
 * Integration API:
 * - `<AstPanel />` — rendered inside `<DevDock>` with no props required.
 *
 * Configuration API:
 * - No props.  Data flows from `AppStoreState.pgnModel`.
 *
 * Communication API:
 * - Inbound: re-renders when `pgnModel` changes.
 * - Outbound: none; read-only display.
 */

import type { ReactElement } from "react";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import { selectPgnModel } from "../../../core/state/selectors";
import { getMoveCommentsAfter, getMoveRavs } from "../../../../../parts/pgnparser/src/pgn_move_attachments";
import type { PgnMoveNode } from "../../../../../parts/pgnparser/src/pgn_model";

// ── AST shape types (private — mirrors ast_panel.ts internal types) ────────────

type AstComment = {
  type: "comment";
  id: string;
  raw: string;
};

type AstVariation = {
  type: "variation";
  id: string;
  depth: number;
  parentMoveId?: string | null;
  entries: AstEntry[];
  trailingComments: AstComment[];
};

type AstMove = {
  type: "move";
  id: string;
  san: string;
  nags: string[];
  commentsBefore: AstComment[];
  postItems: Array<{ type: "comment"; comment?: AstComment } | { type: "rav"; rav?: AstVariation }>;
};

type AstEntry =
  | AstMove
  | AstVariation
  | AstComment
  | { type: "move_number"; text: string }
  | { type: "result"; text: string }
  | { type: "nag"; text: string };

type AstModel = {
  id: string;
  headers: Array<{ key: string; value: string }>;
  root: AstVariation;
};

// ── Recursive sub-components ──────────────────────────────────────────────────

const AstLeaf = ({ label, className }: { label: string; className: string }): ReactElement => (
  <div className={`ast-node ${className}`}>{label}</div>
);

const AstCommentNode = ({ comment }: { comment: AstComment }): ReactElement => (
  <AstLeaf
    label={`comment #${comment.id}: ${comment.raw}`}
    className="ast-comment"
  />
);

const AstVariationNode = ({ variation }: { variation: AstVariation }): ReactElement => (
  <div className="ast-item">
    <AstLeaf
      label={`variation #${variation.id}: depth=${variation.depth} parentMoveId=${variation.parentMoveId ?? "null"}`}
      className="ast-variation"
    />
    <div className="ast-children">
      {variation.entries.map((entry: AstEntry, i: number): ReactElement => (
        <AstEntryNode key={i} entry={entry} />
      ))}
      {variation.trailingComments.map((c: AstComment, i: number): ReactElement => (
        <AstCommentNode key={`tc-${i}`} comment={c} />
      ))}
    </div>
  </div>
);

const AstMoveNode = ({ move }: { move: AstMove }): ReactElement => (
  <div className="ast-item">
    <AstLeaf
      label={`move #${move.id}: san=${move.san}${move.nags.length ? ` nags=${move.nags.join(",")}` : ""}`}
      className="ast-move"
    />
    <div className="ast-children">
      {move.commentsBefore.map((c: AstComment, i: number): ReactElement => (
        <AstCommentNode key={`cb-${i}`} comment={c} />
      ))}
      {getMoveCommentsAfter(move as unknown as PgnMoveNode).map((c: AstComment, i: number): ReactElement => (
        <AstCommentNode key={`ca-${i}`} comment={c} />
      ))}
      {getMoveRavs(move as unknown as PgnMoveNode).map((v: AstVariation, i: number): ReactElement => (
        <AstVariationNode key={`rv-${i}`} variation={v} />
      ))}
    </div>
  </div>
);

const AstEntryNode = ({ entry }: { entry: AstEntry }): ReactElement => {
  if (entry.type === "move") return <AstMoveNode move={entry} />;
  if (entry.type === "variation") return <AstVariationNode variation={entry} />;
  if (entry.type === "comment") return <AstCommentNode comment={entry} />;
  if (entry.type === "move_number") {
    return <AstLeaf label={`move_number: ${entry.text}`} className="ast-meta" />;
  }
  if (entry.type === "result") {
    return <AstLeaf label={`result: ${entry.text}`} className="ast-meta" />;
  }
  if (entry.type === "nag") {
    return <AstLeaf label={`nag: ${entry.text}`} className="ast-meta" />;
  }
  return <AstLeaf label={`unknown: ${(entry as { type: string }).type}`} className="ast-meta" />;
};

// ── AstPanel ──────────────────────────────────────────────────────────────────

/** Renders the PGN model AST as a recursive tree. */
export const AstPanel = (): ReactElement => {
  const { state } = useAppContext();
  const pgnModel = selectPgnModel(state);

  if (!pgnModel) {
    return <div className="ast-view" />;
  }

  const model: AstModel = pgnModel as unknown as AstModel;

  return (
    <div className="ast-view ast-root">
      <div className="ast-item">
        <div className="ast-node ast-game">{`game #${model.id}`}</div>
        <div className="ast-children">
          {/* Headers node */}
          <div className="ast-item">
            <div className="ast-node ast-headers">
              {`headers (${model.headers?.length ?? 0})`}
            </div>
            <div className="ast-children">
              {(model.headers ?? []).map(
                (header: { key: string; value: string }, i: number): ReactElement => (
                  <div key={i} className="ast-node ast-header-item">
                    {`[${header.key} "${header.value}"]`}
                  </div>
                ),
              )}
            </div>
          </div>
          {/* Root variation */}
          {model.root && <AstVariationNode variation={model.root} />}
        </div>
      </div>
    </div>
  );
};
