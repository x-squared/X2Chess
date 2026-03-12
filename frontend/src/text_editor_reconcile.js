const syncClassName = (el, className) => {
  if (el.className !== className) el.className = className;
};

const toSegmentKind = (token) => {
  if (token.kind === "comment") return "comment";
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
  const isHighlighted = options?.highlightCommentId && options.highlightCommentId === token.commentId;
  syncClassName(el, `text-editor-comment-block text-editor-comment${isHighlighted ? " text-editor-comment-new" : ""}`);
  syncDataset(el, {
    kind: "comment",
    tokenType: "comment",
    tokenKey: token.key,
    commentId: token.commentId,
    hasIndentDirective: token.hasIndentDirective ? "true" : "false",
    indentDirectiveDepth: String(token.indentDirectiveDepth || 0),
  });
  el.contentEditable = "true";
  el.spellcheck = false;
  el.onclick = null;
  if (el.innerHTML !== rawCommentToHtml(token.text)) el.innerHTML = rawCommentToHtml(token.text);
  el.onkeydown = (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        document.execCommand("insertText", false, "\\i ");
        return;
      }
      document.execCommand("insertText", false, "\t");
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
      const nextDisplay = htmlCommentToRaw(el);
      const nextValue = token.hasIndentDirective
        ? (
          nextDisplay.trim()
            ? `${"\\i ".repeat(Math.max(1, Number(token.indentDirectiveDepth) || 1))}${nextDisplay}`
            : ""
        )
        : nextDisplay;
      if (nextValue === (token.rawText ?? token.text)) return;
      options.onCommentEdit(token.commentId, nextValue);
    };
  } else {
    el.onblur = null;
  }
};

const createTokenEl = (token, options) => {
  if (token.kind === "comment") return createCommentEl(token, options);
  return createInlineEl(token);
};

const syncTokenEl = (el, token, options) => {
  if (token.kind === "comment") syncCommentEl(el, token, options);
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
  syncBlockEl(el, block, options);
  reconcileTokenChildren(el, block.tokens, block.key, options);
  return el;
};

const syncBlockEl = (el, block, options) => {
  const depthClass = Number(block.indentDepth) > 0 ? ` text-editor-block-indent-${block.indentDepth}` : "";
  const nextClassName = `text-editor-block${depthClass}`;
  if (el.className !== nextClassName) el.className = nextClassName;
  syncDataset(el, { blockKey: block.key, indentDepth: Number(block.indentDepth) || 0 });
  reconcileTokenChildren(el, block.tokens, block.key, options);
};

export const reconcileTextEditor = (container, blocks, options = {}) => {
  const currentBlocks = Array.from(container.children).filter((child) => child.dataset.blockKey);
  const appendBlockEl = (blockEl) => {
    const overlay = container._textEditorOverlay;
    if (overlay && overlay.parentElement === container) {
      container.insertBefore(blockEl, overlay);
    } else {
      container.appendChild(blockEl);
    }
  };
  blocks.forEach((block, idx) => {
    let blockEl = currentBlocks[idx];
    if (!blockEl) {
      blockEl = createBlockEl(block, options);
      appendBlockEl(blockEl);
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
  const latestBlocks = Array.from(container.children).filter((child) => child.dataset.blockKey);
  for (let idx = latestBlocks.length - 1; idx >= blocks.length; idx -= 1) {
    latestBlocks[idx].remove();
  }
  setupMoveInsertOverlay(container, options);
};

const createMoveInsertOverlay = (container) => {
  const overlay = document.createElement("div");
  overlay.className = "text-editor-move-insert-overlay";
  overlay.innerHTML = `
    <button type="button" class="text-editor-insert-icon left" aria-label="Insert comment before move">&#x25C0;</button>
    <button type="button" class="text-editor-insert-icon right" aria-label="Insert comment after move">&#x25B6;</button>
  `;
  container.appendChild(overlay);
  return overlay;
};

const getMoveTokenFromEvent = (container, event) => {
  if (!(event.target instanceof Element)) return null;
  const moveEl = event.target.closest('[data-token-type="move"][data-node-id]');
  if (!moveEl || !container.contains(moveEl)) return null;
  return moveEl;
};

const positionOverlayAtMove = (container, overlay, moveEl) => {
  const containerRect = container.getBoundingClientRect();
  const moveRect = moveEl.getBoundingClientRect();
  const horizontalPadding = 12;
  overlay.style.left = `${moveRect.left - containerRect.left + moveRect.width / 2}px`;
  overlay.style.top = `${moveRect.top - containerRect.top + moveRect.height / 2}px`;
  overlay.style.width = `${moveRect.width + horizontalPadding * 2}px`;
  overlay.style.height = `${Math.max(moveRect.height + 8, 22)}px`;
  overlay.dataset.moveId = moveEl.dataset.nodeId || "";
  overlay.classList.add("visible");
};

const setupMoveInsertOverlay = (container, options) => {
  if (!container) return;
  container._textEditorOptions = options;
  let overlay = container._textEditorOverlay;
  if (!overlay) {
    overlay = createMoveInsertOverlay(container);
    container._textEditorOverlay = overlay;
    let hideTimer = null;
    let activeMoveEl = null;
    const clearHideTimer = () => {
      if (!hideTimer) return;
      window.clearTimeout(hideTimer);
      hideTimer = null;
    };
    const showForMove = (moveEl) => {
      activeMoveEl = moveEl;
      clearHideTimer();
      positionOverlayAtMove(container, overlay, moveEl);
    };
    const scheduleHide = () => {
      clearHideTimer();
      hideTimer = window.setTimeout(() => {
        overlay.classList.remove("visible");
        overlay.dataset.moveId = "";
        activeMoveEl = null;
      }, 220);
    };
    const leftBtn = overlay.querySelector(".text-editor-insert-icon.left");
    const rightBtn = overlay.querySelector(".text-editor-insert-icon.right");
    const triggerInsertAtSide = (moveId, side) => {
      if (!moveId) return;
      const resolveExisting = container._textEditorOptions?.onResolveExistingComment;
      const existingCommentId = resolveExisting ? resolveExisting(moveId, side) : null;
      if (focusCommentById(existingCommentId)) return;
      const callback = container._textEditorOptions?.onInsertComment;
      if (callback) callback(moveId, side);
    };
    const focusCommentById = (commentId) => {
      if (!commentId) return false;
      const commentEl = container.querySelector(`[data-kind="comment"][data-comment-id="${commentId}"]`);
      if (!commentEl) return false;
      commentEl.classList.add("text-editor-comment-new");
      commentEl.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(commentEl);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      window.setTimeout(() => commentEl.classList.remove("text-editor-comment-new"), 1400);
      return true;
    };
    leftBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const moveId = overlay.dataset.moveId || "";
      triggerInsertAtSide(moveId, "before");
    });
    rightBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const moveId = overlay.dataset.moveId || "";
      triggerInsertAtSide(moveId, "after");
    });
    overlay.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".text-editor-insert-icon")) return;
      const moveId = overlay.dataset.moveId || "";
      if (!moveId) return;
      const rect = overlay.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const side = clickX < rect.width / 2 ? "before" : "after";
      triggerInsertAtSide(moveId, side);
    });
    overlay.addEventListener("mouseenter", () => {
      clearHideTimer();
      if (activeMoveEl) positionOverlayAtMove(container, overlay, activeMoveEl);
      else overlay.classList.add("visible");
    });
    overlay.addEventListener("mouseleave", () => {
      scheduleHide();
    });
    container.addEventListener("mousemove", (event) => {
      if (event.target instanceof Element && overlay.contains(event.target)) {
        clearHideTimer();
        return;
      }
      const moveEl = getMoveTokenFromEvent(container, event);
      if (!moveEl) {
        scheduleHide();
        return;
      }
      showForMove(moveEl);
    });
    container.addEventListener("mouseleave", () => {
      scheduleHide();
    });
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
  return raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
};
