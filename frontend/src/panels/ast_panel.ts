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
  commentsAfter: AstComment[];
  ravs: AstVariation[];
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

const appendNode = (parent: HTMLElement, label: string, className: string = ""): HTMLDivElement => {
  const line: HTMLDivElement = document.createElement("div");
  line.className = `ast-node${className ? ` ${className}` : ""}`;
  line.textContent = label;
  parent.appendChild(line);
  return line;
};

const appendChildrenContainer = (parent: HTMLElement): HTMLDivElement => {
  const box: HTMLDivElement = document.createElement("div");
  box.className = "ast-children";
  parent.appendChild(box);
  return box;
};

const renderComment = (parent: HTMLElement, comment: AstComment): void => {
  appendNode(parent, `comment #${comment.id}: ${comment.raw}`, "ast-comment");
};

const renderMove = (parent: HTMLElement, move: AstMove): void => {
  const moveBox: HTMLDivElement = document.createElement("div");
  moveBox.className = "ast-item";
  parent.appendChild(moveBox);

  appendNode(
    moveBox,
    `move #${move.id}: san=${move.san}${move.nags.length ? ` nags=${move.nags.join(",")}` : ""}`,
    "ast-move",
  );
  const children: HTMLDivElement = appendChildrenContainer(moveBox);

  move.commentsBefore.forEach((comment: AstComment): void => renderComment(children, comment));
  move.commentsAfter.forEach((comment: AstComment): void => renderComment(children, comment));
  move.ravs.forEach((variation: AstVariation): void => renderVariation(children, variation));
};

const renderEntry = (parent: HTMLElement, entry: AstEntry): void => {
  if (entry.type === "move") {
    renderMove(parent, entry);
    return;
  }
  if (entry.type === "variation") {
    renderVariation(parent, entry);
    return;
  }
  if (entry.type === "move_number") {
    appendNode(parent, `move_number: ${entry.text}`, "ast-meta");
    return;
  }
  if (entry.type === "comment") {
    renderComment(parent, entry);
    return;
  }
  if (entry.type === "result") {
    appendNode(parent, `result: ${entry.text}`, "ast-meta");
    return;
  }
  if (entry.type === "nag") {
    appendNode(parent, `nag: ${entry.text}`, "ast-meta");
  }
};

function renderVariation(parent: HTMLElement, variation: AstVariation): void {
  const box: HTMLDivElement = document.createElement("div");
  box.className = "ast-item";
  parent.appendChild(box);

  appendNode(
    box,
    `variation #${variation.id}: depth=${variation.depth} parentMoveId=${variation.parentMoveId ?? "null"}`,
    "ast-variation",
  );
  const children: HTMLDivElement = appendChildrenContainer(box);

  variation.entries.forEach((entry: AstEntry): void => renderEntry(children, entry));
  variation.trailingComments.forEach((comment: AstComment): void => renderComment(children, comment));
}

export const ast_panel = {
  render(container: Element | null, pgnModel: unknown): void {
    if (!(container instanceof HTMLElement)) return;
    container.innerHTML = "";
    if (!pgnModel) return;

    const model: AstModel = pgnModel as AstModel;
    const root: HTMLDivElement = document.createElement("div");
    root.className = "ast-root";
    container.appendChild(root);

    appendNode(root, `game #${model.id}`, "ast-game");
    const topChildren: HTMLDivElement = appendChildrenContainer(root);

    const headersNode: HTMLDivElement = appendNode(topChildren, `headers (${model.headers.length})`, "ast-headers");
    const headersChildren: HTMLDivElement = appendChildrenContainer(headersNode);
    model.headers.forEach((header: { key: string; value: string }): void => {
      appendNode(headersChildren, `[${header.key} "${header.value}"]`, "ast-header-item");
    });

    renderVariation(topChildren, model.root);
  },
};
