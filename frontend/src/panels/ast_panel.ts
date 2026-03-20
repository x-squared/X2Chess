const appendNode = (parent: any, label: any, className: any = ""): any => {
  const line = document.createElement("div");
  line.className = `ast-node${className ? ` ${className}` : ""}`;
  line.textContent = label;
  parent.appendChild(line);
  return line;
};

const appendChildrenContainer = (parent: any): any => {
  const box = document.createElement("div");
  box.className = "ast-children";
  parent.appendChild(box);
  return box;
};

const renderComment = (parent: any, comment: any): any => {
  appendNode(parent, `comment #${comment.id}: ${comment.raw}`, "ast-comment");
};

const renderMove = (parent: any, move: any): any => {
  const moveBox = document.createElement("div");
  moveBox.className = "ast-item";
  parent.appendChild(moveBox);

  appendNode(
    moveBox,
    `move #${move.id}: san=${move.san}${move.nags.length ? ` nags=${move.nags.join(",")}` : ""}`,
    "ast-move",
  );
  const children = appendChildrenContainer(moveBox);

  move.commentsBefore.forEach((comment: any): any => renderComment(children, comment));
  move.commentsAfter.forEach((comment: any): any => renderComment(children, comment));
  move.ravs.forEach((variation: any): any => renderVariation(children, variation));
};

const renderEntry = (parent: any, entry: any): any => {
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

function renderVariation(parent: any, variation: any): any {
  const box = document.createElement("div");
  box.className = "ast-item";
  parent.appendChild(box);

  appendNode(
    box,
    `variation #${variation.id}: depth=${variation.depth} parentMoveId=${variation.parentMoveId ?? "null"}`,
    "ast-variation",
  );
  const children = appendChildrenContainer(box);

  variation.entries.forEach((entry: any): any => renderEntry(children, entry));
  variation.trailingComments.forEach((comment: any): any => renderComment(children, comment));
}

export const ast_panel = {
  render(container: any, pgnModel: any) {
    if (!container) return;
    container.innerHTML = "";
    if (!pgnModel) return;

    const root = document.createElement("div");
    root.className = "ast-root";
    container.appendChild(root);

    appendNode(root, `game #${pgnModel.id}`, "ast-game");
    const topChildren = appendChildrenContainer(root);

    const headersNode = appendNode(topChildren, `headers (${pgnModel.headers.length})`, "ast-headers");
    const headersChildren = appendChildrenContainer(headersNode);
    pgnModel.headers.forEach((header: any): any => {
      appendNode(headersChildren, `[${header.key} "${header.value}"]`, "ast-header-item");
    });

    renderVariation(topChildren, pgnModel.root);
  },
};
