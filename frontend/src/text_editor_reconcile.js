const syncClassName = (el, className) => {
  if (el.className !== className) el.className = className;
};

const toSegmentKind = (token) => {
  if (token.kind === "comment") return "comment";
  if (token.kind === "control") return "control";
  return "move";
};

const syncDataset = (el, dataset) => {
  const next = dataset || {};
  Object.keys(el.dataset).forEach((key) => {
    if (!(key in next)) delete el.dataset[key];
  });
  Object.entries(next).forEach(([key, value]) => {
    const normalized = String(value);
    if (el.dataset[key] !== normalized) el.dataset[key] = normalized;
  });
};

const createInlineEl = (token) => {
  const span = document.createElement("span");
  syncInlineEl(span, token);
  return span;
};

const syncInlineEl = (el, token) => {
  syncClassName(el, token.className || "");
  syncDataset(el, {
    kind: toSegmentKind(token),
    tokenType: token.tokenType,
    tokenKey: token.key,
    ...(token.dataset || {}),
  });
  if (el.textContent !== token.text) el.textContent = token.text;
};

const createCommentEl = (token, options) => {
  const span = document.createElement("span");
  syncCommentEl(span, token, options);
  return span;
};

const syncCommentEl = (el, token, options) => {
  syncClassName(el, "text-editor-comment-block text-editor-comment");
  syncDataset(el, {
    kind: "comment",
    tokenType: "comment",
    tokenKey: token.key,
    commentId: token.commentId,
  });
  el.contentEditable = "true";
  el.spellcheck = false;
  el.onclick = null;
  if (el.innerHTML !== rawCommentToHtml(token.text)) el.innerHTML = rawCommentToHtml(token.text);
  el.onkeydown = (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertText", false, "  ");
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        document.execCommand("bold");
      } else if (key === "i") {
        event.preventDefault();
        document.execCommand("italic");
      } else if (key === "u") {
        event.preventDefault();
        document.execCommand("underline");
      }
    }
  };
  if (options?.onCommentEdit) {
    el.onblur = () => {
      const nextValue = htmlCommentToRaw(el);
      if (nextValue === token.text) return;
      options.onCommentEdit(token.commentId, nextValue);
    };
  } else {
    el.onblur = null;
  }
};

const createControlEl = (token, options) => {
  const button = document.createElement("button");
  button.type = "button";
  syncControlEl(button, token, options);
  return button;
};

const syncControlEl = (el, token, options) => {
  syncClassName(el, token.className || "text-editor-insert-comment");
  syncDataset(el, {
    kind: "control",
    tokenType: token.tokenType,
    tokenKey: token.key,
    moveId: token.moveId,
    insertPosition: token.insertPosition,
  });
  el.type = "button";
  el.contentEditable = "false";
  if (el.textContent !== token.text) el.textContent = token.text;
  if (options?.onInsertComment) {
    el.onclick = () => options.onInsertComment(token.moveId, token.insertPosition);
  } else {
    el.onclick = null;
  }
};

const createTokenEl = (token, options) => {
  if (token.kind === "comment") return createCommentEl(token, options);
  if (token.kind === "control") return createControlEl(token, options);
  return createInlineEl(token);
};

const syncTokenEl = (el, token, options) => {
  if (token.kind === "comment") syncCommentEl(el, token, options);
  else if (token.kind === "control") syncControlEl(el, token, options);
  else syncInlineEl(el, token);
};

const createAnchorEl = (anchorId) => {
  const anchor = document.createElement("span");
  anchor.className = "text-editor-anchor";
  syncDataset(anchor, {
    kind: "anchor",
    anchorId,
  });
  return anchor;
};

const syncAnchorEl = (el, anchorId) => {
  syncClassName(el, "text-editor-anchor");
  syncDataset(el, {
    kind: "anchor",
    anchorId,
  });
  el.textContent = "";
};

const reconcileTokenChildren = (blockEl, tokens, blockKey, options) => {
  const desired = [];
  for (let idx = 0; idx <= tokens.length; idx += 1) {
    desired.push({ kind: "anchor", anchorId: `${blockKey}:${idx}` });
    if (idx < tokens.length) desired.push({ kind: "token", token: tokens[idx] });
  }
  const children = Array.from(blockEl.children);
  desired.forEach((entry, idx) => {
    let child = children[idx];
    if (!child) {
      child = entry.kind === "anchor" ? createAnchorEl(entry.anchorId) : createTokenEl(entry.token, options);
      blockEl.appendChild(child);
      return;
    }
    if (entry.kind === "anchor") {
      if (child.dataset.kind !== "anchor") {
        const replacement = createAnchorEl(entry.anchorId);
        blockEl.replaceChild(replacement, child);
      } else {
        syncAnchorEl(child, entry.anchorId);
      }
    } else {
      const expectedKind = toSegmentKind(entry.token);
      if (child.dataset.kind !== expectedKind || child.dataset.kind === "anchor") {
        const replacement = createTokenEl(entry.token, options);
        blockEl.replaceChild(replacement, child);
        return;
      }
      syncTokenEl(child, entry.token, options);
    }
  });
  for (let idx = children.length - 1; idx >= desired.length; idx -= 1) {
    children[idx].remove();
  }
};

const createBlockEl = (block, options) => {
  const el = document.createElement("div");
  el.className = "text-editor-block";
  el.dataset.blockKey = block.key;
  reconcileTokenChildren(el, block.tokens, block.key, options);
  return el;
};

const syncBlockEl = (el, block, options) => {
  if (el.className !== "text-editor-block") el.className = "text-editor-block";
  syncDataset(el, { blockKey: block.key });
  reconcileTokenChildren(el, block.tokens, block.key, options);
};

export const reconcileTextEditor = (container, blocks, options = {}) => {
  const currentBlocks = Array.from(container.children);
  blocks.forEach((block, idx) => {
    let blockEl = currentBlocks[idx];
    if (!blockEl) {
      blockEl = createBlockEl(block, options);
      container.appendChild(blockEl);
      return;
    }
    if (blockEl.dataset.blockKey !== block.key) {
      const found = currentBlocks.find((candidate, candidateIdx) => candidateIdx > idx && candidate.dataset.blockKey === block.key);
      if (found) {
        container.insertBefore(found, blockEl);
        blockEl = found;
      } else {
        const created = createBlockEl(block, options);
        container.insertBefore(created, blockEl);
        blockEl = created;
      }
    }
    syncBlockEl(blockEl, block, options);
  });
  const latestBlocks = Array.from(container.children);
  for (let idx = latestBlocks.length - 1; idx >= blocks.length; idx -= 1) {
    latestBlocks[idx].remove();
  }
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const rawCommentToHtml = (raw) => {
  let html = escapeHtml(raw);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<u>$1</u>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br>");
  return html;
};

const htmlCommentToRawFromNode = (node) => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";

  const parts = Array.from(node.childNodes).map((child) => htmlCommentToRawFromNode(child)).join("");
  if (tag === "strong" || tag === "b") return `**${parts}**`;
  if (tag === "em" || tag === "i") return `*${parts}*`;
  if (tag === "u") return `__${parts}__`;
  if (tag === "div" || tag === "p") return `${parts}\n`;
  return parts;
};

const htmlCommentToRaw = (element) => {
  const raw = Array.from(element.childNodes).map((node) => htmlCommentToRawFromNode(node)).join("");
  return raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
};
