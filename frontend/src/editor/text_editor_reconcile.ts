/**
 * Text editor DOM reconciliation.
 *
 * Intent:
 * - Reconcile render plan blocks/tokens into stable DOM elements.
 * - Manage move-hover insert overlay and delegated move selection events.
 *
 * Integration API:
 * - `reconcileTextEditor(container, blocks, options)` mutates editor DOM to match plan.
 */

const syncClassName = (el: any, className: any): any => {
  if (el.className !== className) el.className = className;
};

const toSegmentKind = (token: any): any => {
  if (token.kind === "comment") return "comment";
  return "move";
};

const syncDataset = (el: any, dataset: any): any => {
  const next = dataset || {};
  Object.keys(el.dataset).forEach((key: any): any => {
    if (!(key in next)) delete el.dataset[key];
  });
  Object.entries(next).forEach(([key, value]: any): any => {
    const normalized = String(value);
    if (el.dataset[key] !== normalized) el.dataset[key] = normalized;
  });
};

const createInlineEl = (token: any, options: any): any => {
  const span = document.createElement("span");
  syncInlineEl(span, token, options);
  return span;
};

const syncInlineEl = (el: any, token: any, options: any): any => {
  const isSelectedMove = token.tokenType === "move"
    && token.dataset?.nodeId
    && options?.selectedMoveId
    && token.dataset.nodeId === options.selectedMoveId;
  const nextClassName = `${token.className || ""}${isSelectedMove ? " text-editor-move-selected" : ""}`;
  syncClassName(el, nextClassName.trim());
  syncDataset(el, {
    kind: toSegmentKind(token),
    tokenType: token.tokenType,
    tokenKey: token.key,
    ...(token.dataset || {}),
  });
  if (el.textContent !== token.text) el.textContent = token.text;
  el.onclick = null;
  el.onpointerdown = null;
  if (token.tokenType === "move" && token.dataset?.nodeId) {
    const handleSelect = (event: any): any => {
      const moveId = token.dataset?.nodeId || "";
      if (!moveId) return;
      const onMoveSelect = options?.onMoveSelect;
      if (onMoveSelect) onMoveSelect(moveId);
      event.preventDefault();
    };
    el.onpointerdown = handleSelect;
    el.onclick = handleSelect;
  }
};

const createCommentEl = (token: any, options: any): any => {
  const span = document.createElement("span");
  syncCommentEl(span, token, options);
  return span;
};

const syncCommentEl = (el: any, token: any, options: any): any => {
  const isHighlighted = options?.highlightCommentId && options.highlightCommentId === token.commentId;
  const introClass = token.introStyling ? " text-editor-comment-intro" : "";
  syncClassName(
    el,
    `text-editor-comment-block text-editor-comment${introClass}${isHighlighted ? " text-editor-comment-new" : ""}`,
  );
  syncDataset(el, {
    kind: "comment",
    tokenType: "comment",
    tokenKey: token.key,
    commentId: token.commentId,
    hasIndentDirective: token.hasIndentDirective ? "true" : "false",
    indentDirectiveDepth: String(token.indentDirectiveDepth || 0),
    introStyling: token.introStyling ? "true" : "false",
  });
  el.contentEditable = "true";
  el.spellcheck = false;
  el.onclick = null;
  el.onfocus = null;
  if (el.innerHTML !== rawCommentToHtml(token.text)) el.innerHTML = rawCommentToHtml(token.text);
  if (options?.onCommentFocus) {
    el.onfocus = (): any => {
      options.onCommentFocus(token.commentId, {
        focusFirstCommentAtStart: Boolean(token.focusFirstCommentAtStart),
      });
    };
  }
  el.onkeydown = (event: any): any => {
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
    el.onblur = (): any => {
      const nextDisplay = htmlCommentToRaw(el);
      if (token.plainLiteralComment) {
        const nextValue = nextDisplay;
        if (nextValue === (token.rawText ?? token.text)) return;
        options.onCommentEdit(token.commentId, nextValue);
        return;
      }
      const prefixParts: string[] = [];
      if (token.hasIndentDirective) {
        prefixParts.push(...Array(Math.max(1, Number(token.indentDirectiveDepth) || 1)).fill("\\i"));
      }
      const nextValue = nextDisplay.trim() && prefixParts.length > 0
        ? `${prefixParts.join(" ")} ${nextDisplay}`
        : nextDisplay;
      if (nextValue === (token.rawText ?? token.text)) return;
      options.onCommentEdit(token.commentId, nextValue);
    };
  } else {
    el.onblur = null;
  }
};

const createTokenEl = (token: any, options: any): any => {
  if (token.kind === "comment") return createCommentEl(token, options);
  return createInlineEl(token, options);
};

const syncTokenEl = (el: any, token: any, options: any): any => {
  if (token.kind === "comment") syncCommentEl(el, token, options);
  else syncInlineEl(el, token, options);
};

const createAnchorEl = (anchorId: any): any => {
  const anchor = document.createElement("span");
  anchor.className = "text-editor-anchor";
  syncDataset(anchor, {
    kind: "anchor",
    anchorId,
  });
  return anchor;
};

const syncAnchorEl = (el: any, anchorId: any): any => {
  syncClassName(el, "text-editor-anchor");
  syncDataset(el, {
    kind: "anchor",
    anchorId,
  });
  el.textContent = "";
};

type DesiredChild =
  | { kind: "anchor"; anchorId: string }
  | { kind: "token"; token: unknown };

const reconcileTokenChildren = (blockEl: HTMLElement, tokens: any, blockKey: any, options: any): any => {
  const desired: DesiredChild[] = [];
  for (let idx = 0; idx <= tokens.length; idx += 1) {
    desired.push({ kind: "anchor", anchorId: `${blockKey}:${idx}` });
    if (idx < tokens.length) desired.push({ kind: "token", token: tokens[idx] });
  }
  const children = Array.from(blockEl.children) as HTMLElement[];
  desired.forEach((entry: any, idx: any): any => {
    let child: HTMLElement | undefined = children[idx];
    if (!child) {
      const created = entry.kind === "anchor"
        ? createAnchorEl(entry.anchorId)
        : createTokenEl(entry.token, options);
      blockEl.appendChild(created);
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
      const childKind = String(child.dataset.kind ?? "");
      if (childKind === "anchor" || childKind !== expectedKind) {
        const replacement = createTokenEl(entry.token, options);
        blockEl.replaceChild(replacement, child);
        return;
      }
      syncTokenEl(child, entry.token, options);
    }
  });
  for (let idx = children.length - 1; idx >= desired.length; idx -= 1) {
    children[idx]?.remove();
  }
};

const createBlockEl = (block: any, options: any): any => {
  const el = document.createElement("div");
  syncBlockEl(el, block, options);
  reconcileTokenChildren(el, block.tokens, block.key, options);
  return el;
};

const syncBlockEl = (el: any, block: any, options: any): any => {
  const depthClass = Number(block.indentDepth) > 0 ? ` text-editor-block-indent-${block.indentDepth}` : "";
  const nextClassName = `text-editor-block${depthClass}`;
  if (el.className !== nextClassName) el.className = nextClassName;
  syncDataset(el, { blockKey: block.key, indentDepth: Number(block.indentDepth) || 0 });
  reconcileTokenChildren(el, block.tokens, block.key, options);
};

type ContainerWithEditorExtras = HTMLElement & {
  _textEditorOverlay?: HTMLElement;
  _textEditorOptions?: Record<string, unknown>;
  _hideMoveInsertOverlay?: () => void;
};

export const reconcileTextEditor = (container: HTMLElement, blocks: any, options: Record<string, unknown> = {}): any => {
  const host = container as ContainerWithEditorExtras;
  const currentBlocks = Array.from(container.children).filter(
    (child: any): any => (child as HTMLElement).dataset.blockKey,
  ) as HTMLElement[];
  const appendBlockEl = (blockEl: any): any => {
    const overlay = host._textEditorOverlay;
    if (overlay && overlay.parentElement === host) {
      host.insertBefore(blockEl, overlay);
    } else {
      host.appendChild(blockEl);
    }
  };
  blocks.forEach((block: any, idx: any): any => {
    let blockEl = currentBlocks[idx];
    if (!blockEl) {
      blockEl = createBlockEl(block, options);
      appendBlockEl(blockEl);
      return;
    }
    if (blockEl.dataset.blockKey !== block.key) {
      const found = currentBlocks.find((candidate: any, candidateIdx: any): any => candidateIdx > idx && (candidate as HTMLElement).dataset.blockKey === block.key);
      if (found) {
        host.insertBefore(found, blockEl);
        blockEl = found;
      } else {
        const created = createBlockEl(block, options);
        host.insertBefore(created, blockEl);
        blockEl = created;
      }
    }
    syncBlockEl(blockEl, block, options);
  });
  const latestBlocks = Array.from(container.children).filter((child: any): any => (child as HTMLElement).dataset.blockKey);
  for (let idx = latestBlocks.length - 1; idx >= blocks.length; idx -= 1) {
    latestBlocks[idx].remove();
  }
  setupMoveInsertOverlay(container as ContainerWithEditorExtras, options);
};

const createMoveInsertOverlay = (container: HTMLElement): any => {
  const overlay = document.createElement("div");
  overlay.className = "text-editor-move-insert-overlay";
  overlay.innerHTML = `
    <button type="button" class="text-editor-insert-icon left" aria-label="Insert comment before move">&#x25C0;</button>
    <button type="button" class="text-editor-insert-icon right" aria-label="Insert comment after move">&#x25B6;</button>
  `;
  container.appendChild(overlay);
  return overlay;
};

const getMoveTokenFromEvent = (container: any, event: any): any => {
  if (typeof event.composedPath === "function") {
    const path = event.composedPath();
    for (const item of path) {
      if (!(item instanceof Element)) continue;
      if (item.matches?.('[data-token-type="move"][data-node-id]')) {
        return item as HTMLElement;
      }
      if (item === container) break;
    }
  }
  const rawTarget = event.target;
  const targetEl = rawTarget instanceof Element
    ? rawTarget
    : rawTarget instanceof Node
      ? rawTarget.parentElement
      : null;
  if (!targetEl) return null;
  const moveEl = targetEl.closest('[data-token-type="move"][data-node-id]');
  if (!moveEl) return null;
  return moveEl as HTMLElement;
};

const getElementTargetFromEvent = (event: any): any => {
  const rawTarget = event.target;
  if (rawTarget instanceof Element) return rawTarget;
  if (rawTarget instanceof Node) return rawTarget.parentElement;
  return null;
};

const trySelectMoveFromEvent = (container: ContainerWithEditorExtras, event: any): any => {
  const moveEl = getMoveTokenFromEvent(container, event);
  if (!moveEl) return false;
  const moveId = moveEl.dataset.nodeId || "";
  if (!moveId) return false;
  const onMoveSelect = container._textEditorOptions?.onMoveSelect as ((id: string) => void) | undefined;
  if (onMoveSelect) onMoveSelect(moveId);
  return true;
};

const positionOverlayAtMove = (container: HTMLElement, overlay: HTMLElement, moveEl: HTMLElement): any => {
  const containerRect = container.getBoundingClientRect();
  const moveRect = moveEl.getBoundingClientRect();
  const horizontalPadding = 6;
  overlay.style.left = `${moveRect.left - containerRect.left + moveRect.width / 2}px`;
  overlay.style.top = `${moveRect.top - containerRect.top + moveRect.height / 2}px`;
  overlay.style.width = `${moveRect.width + horizontalPadding * 2}px`;
  overlay.style.height = `${Math.max(moveRect.height + 8, 22)}px`;
  overlay.dataset.moveId = moveEl.dataset.nodeId || "";
  overlay.classList.add("visible");
};

const setupMoveInsertOverlay = (container: ContainerWithEditorExtras, options: any): any => {
  if (!container) return;
  container._textEditorOptions = options;
  const overlayEl = container._textEditorOverlay ?? createMoveInsertOverlay(container);
  container._textEditorOverlay = overlayEl;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let activeMoveEl: HTMLElement | null = null;
  const hideNow = (): any => {
    clearHideTimer();
    overlayEl.classList.remove("visible");
    overlayEl.dataset.moveId = "";
    activeMoveEl = null;
  };
  container._hideMoveInsertOverlay = hideNow;
  const clearHideTimer = (): any => {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = null;
  };
  const showForMove = (moveEl: HTMLElement): any => {
    activeMoveEl = moveEl;
    clearHideTimer();
    positionOverlayAtMove(container, overlayEl, moveEl);
  };
  const scheduleHide = (): any => {
    clearHideTimer();
    hideTimer = window.setTimeout((): any => {
      hideNow();
    }, 110);
  };
  const leftBtn = overlayEl.querySelector(".text-editor-insert-icon.left");
  const rightBtn = overlayEl.querySelector(".text-editor-insert-icon.right");
  const triggerInsertAtSide = (moveId: any, side: any): any => {
    if (!moveId) return;
    const resolveExisting = container._textEditorOptions?.onResolveExistingComment as
      | ((moveId: string, side: string) => string | null | undefined)
      | undefined;
    const existingCommentId = resolveExisting ? resolveExisting(moveId, side) : null;
    if (focusCommentById(existingCommentId)) return;
    const callback = container._textEditorOptions?.onInsertComment as
      | ((moveId: string, side: string) => void)
      | undefined;
    if (callback) callback(moveId, side);
  };
  const focusCommentById = (commentId: any): any => {
    if (!commentId) return false;
    const commentEl = container.querySelector(`[data-kind="comment"][data-comment-id="${commentId}"]`);
    if (!commentEl) return false;
    const commentHtml = commentEl as HTMLElement;
    commentHtml.classList.add("text-editor-comment-new");
    commentHtml.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(commentHtml);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    window.setTimeout((): any => commentHtml.classList.remove("text-editor-comment-new"), 1400);
    return true;
  };
  leftBtn?.addEventListener("click", (event: any): any => {
    event.preventDefault();
    event.stopPropagation();
    const moveId = overlayEl.dataset.moveId || "";
    triggerInsertAtSide(moveId, "before");
    hideNow();
  });
  rightBtn?.addEventListener("click", (event: any): any => {
    event.preventDefault();
    event.stopPropagation();
    const moveId = overlayEl.dataset.moveId || "";
    triggerInsertAtSide(moveId, "after");
    hideNow();
  });
  overlayEl.addEventListener("mouseenter", (): any => {
    clearHideTimer();
    if (activeMoveEl) positionOverlayAtMove(container, overlayEl, activeMoveEl);
    else overlayEl.classList.add("visible");
  });
  overlayEl.addEventListener("mouseleave", (): any => {
    scheduleHide();
  });
  container.addEventListener("mousemove", (event: any): any => {
    if (event.target instanceof Element && overlayEl.contains(event.target)) {
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
  container.addEventListener("mouseleave", (): any => {
    scheduleHide();
  });
  container.addEventListener("click", (event: any): any => {
    const targetEl = getElementTargetFromEvent(event);
    if (targetEl?.closest(".text-editor-insert-icon")) return;
    const selected = trySelectMoveFromEvent(container, event);
    if (!selected) return;
    window.setTimeout((): any => hideNow(), 0);
  });
  container.addEventListener("pointerdown", (event: any): any => {
    const targetEl = getElementTargetFromEvent(event);
    if (targetEl?.closest(".text-editor-insert-icon")) return;
    const selected = trySelectMoveFromEvent(container, event);
    if (!selected) return;
    hideNow();
    event.preventDefault();
  }, true);
};

const escapeHtml = (value: any): any => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const rawCommentToHtml = (raw: any): any => {
  let html = escapeHtml(raw);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<u>$1</u>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br>");
  return html;
};

const htmlCommentToRawFromNode = (node: any): any => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";

  const parts = Array.from(node.childNodes).map((child: any): any => htmlCommentToRawFromNode(child)).join("");
  if (tag === "strong" || tag === "b") return `**${parts}**`;
  if (tag === "em" || tag === "i") return `*${parts}*`;
  if (tag === "u") return `__${parts}__`;
  if (tag === "div" || tag === "p") return `${parts}\n`;
  return parts;
};

const htmlCommentToRaw = (element: any): any => {
  const raw = Array.from(element.childNodes).map((node: any): any => htmlCommentToRawFromNode(node)).join("");
  return raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
};
