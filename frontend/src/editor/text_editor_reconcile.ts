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

type SegmentKind = "comment" | "move";

type InlineToken = {
  key: string;
  kind: "inline";
  tokenType: string;
  text: string;
  className?: string;
  dataset?: Record<string, string | number | boolean | null | undefined>;
};

type CommentToken = {
  key: string;
  kind: "comment";
  tokenType: "comment";
  commentId: string;
  text: string;
  rawText?: string;
  hasIndentDirective?: boolean;
  indentDirectiveDepth?: number;
  introStyling?: boolean;
  plainLiteralComment?: boolean;
  focusFirstCommentAtStart?: boolean;
};

type TextToken = InlineToken | CommentToken;

type TextBlock = {
  key: string;
  indentDepth?: number;
  tokens: TextToken[];
};

type ReconcileOptions = {
  selectedMoveId?: string;
  highlightCommentId?: string;
  onMoveSelect?: (moveId: string) => void;
  onCommentFocus?: (commentId: string, meta: { focusFirstCommentAtStart: boolean }) => void;
  onCommentEdit?: (commentId: string, nextValue: string) => void;
  onResolveExistingComment?: (moveId: string, side: string) => string | null | undefined;
  onInsertComment?: (moveId: string, side: string) => void;
};

const syncClassName = (el: HTMLElement, className: string): void => {
  if (el.className !== className) el.className = className;
};

const toSegmentKind = (token: TextToken): SegmentKind => {
  if (token.kind === "comment") return "comment";
  return "move";
};

const syncDataset = (el: HTMLElement, dataset: Record<string, unknown> | null | undefined): void => {
  const next: Record<string, unknown> = dataset || {};
  Object.keys(el.dataset).forEach((key: string): void => {
    if (!(key in next)) delete el.dataset[key];
  });
  Object.entries(next).forEach(([key, value]: [string, unknown]): void => {
    const normalized: string = String(value);
    if (el.dataset[key] !== normalized) el.dataset[key] = normalized;
  });
};

const createInlineEl = (token: InlineToken, options: ReconcileOptions): HTMLSpanElement => {
  const span: HTMLSpanElement = document.createElement("span");
  syncInlineEl(span, token, options);
  return span;
};

const syncInlineEl = (el: HTMLElement, token: InlineToken, options: ReconcileOptions): void => {
  const nodeId: string = String(token.dataset?.nodeId ?? "");
  const isSelectedMove: boolean = token.tokenType === "move"
    && Boolean(nodeId)
    && Boolean(options.selectedMoveId)
    && nodeId === options.selectedMoveId;
  const nextClassName: string = `${token.className || ""}${isSelectedMove ? " text-editor-move-selected" : ""}`;
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
  if (token.tokenType === "move" && nodeId) {
    const handleSelect = (event: MouseEvent | PointerEvent): void => {
      const moveId: string = nodeId;
      if (!moveId) return;
      const onMoveSelect: ((moveId: string) => void) | undefined = options.onMoveSelect;
      if (onMoveSelect) onMoveSelect(moveId);
      event.preventDefault();
    };
    el.onpointerdown = handleSelect;
    el.onclick = handleSelect;
  }
};

const createCommentEl = (token: CommentToken, options: ReconcileOptions): HTMLSpanElement => {
  const span: HTMLSpanElement = document.createElement("span");
  syncCommentEl(span, token, options);
  return span;
};

const syncCommentEl = (el: HTMLElement, token: CommentToken, options: ReconcileOptions): void => {
  const isHighlighted: boolean = Boolean(options.highlightCommentId) && options.highlightCommentId === token.commentId;
  const introClass: string = token.introStyling ? " text-editor-comment-intro" : "";
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
  if (options.onCommentFocus) {
    el.onfocus = (): void => {
      options.onCommentFocus?.(token.commentId, {
        focusFirstCommentAtStart: Boolean(token.focusFirstCommentAtStart),
      });
    };
  }
  el.onkeydown = (event: KeyboardEvent): void => {
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
      const key: string = event.key.toLowerCase();
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
  if (options.onCommentEdit) {
    el.onblur = (): void => {
      const nextDisplay: string = htmlCommentToRaw(el);
      if (token.plainLiteralComment) {
        const nextValue: string = nextDisplay;
        if (nextValue === (token.rawText ?? token.text)) return;
        options.onCommentEdit?.(token.commentId, nextValue);
        return;
      }
      const prefixParts: string[] = [];
      if (token.hasIndentDirective) {
        prefixParts.push(...Array(Math.max(1, Number(token.indentDirectiveDepth) || 1)).fill("\\i"));
      }
      const nextValue: string = nextDisplay.trim() && prefixParts.length > 0
        ? `${prefixParts.join(" ")} ${nextDisplay}`
        : nextDisplay;
      if (nextValue === (token.rawText ?? token.text)) return;
      options.onCommentEdit?.(token.commentId, nextValue);
    };
  } else {
    el.onblur = null;
  }
};

const createTokenEl = (token: TextToken, options: ReconcileOptions): HTMLElement => {
  if (token.kind === "comment") return createCommentEl(token, options);
  return createInlineEl(token, options);
};

const syncTokenEl = (el: HTMLElement, token: TextToken, options: ReconcileOptions): void => {
  if (token.kind === "comment") syncCommentEl(el, token, options);
  else syncInlineEl(el, token, options);
};

const createAnchorEl = (anchorId: string): HTMLSpanElement => {
  const anchor: HTMLSpanElement = document.createElement("span");
  anchor.className = "text-editor-anchor";
  syncDataset(anchor, {
    kind: "anchor",
    anchorId,
  });
  return anchor;
};

const syncAnchorEl = (el: HTMLElement, anchorId: string): void => {
  syncClassName(el, "text-editor-anchor");
  syncDataset(el, {
    kind: "anchor",
    anchorId,
  });
  el.textContent = "";
};

type DesiredChild =
  | { kind: "anchor"; anchorId: string }
  | { kind: "token"; token: TextToken };

const reconcileTokenChildren = (
  blockEl: HTMLElement,
  tokens: TextToken[],
  blockKey: string,
  options: ReconcileOptions,
): void => {
  const desired: DesiredChild[] = [];
  for (let idx: number = 0; idx <= tokens.length; idx += 1) {
    desired.push({ kind: "anchor", anchorId: `${blockKey}:${idx}` });
    if (idx < tokens.length) desired.push({ kind: "token", token: tokens[idx] });
  }
  const children: HTMLElement[] = Array.from(blockEl.children) as HTMLElement[];
  desired.forEach((entry: DesiredChild, idx: number): void => {
    const child: HTMLElement | undefined = children[idx];
    if (!child) {
      const created: HTMLElement = entry.kind === "anchor"
        ? createAnchorEl(entry.anchorId)
        : createTokenEl(entry.token, options);
      blockEl.appendChild(created);
      return;
    }
    if (entry.kind === "anchor") {
      if (child.dataset.kind !== "anchor") {
        const replacement: HTMLSpanElement = createAnchorEl(entry.anchorId);
        blockEl.replaceChild(replacement, child);
      } else {
        syncAnchorEl(child, entry.anchorId);
      }
    } else {
      const expectedKind: SegmentKind = toSegmentKind(entry.token);
      const childKind: string = String(child.dataset.kind ?? "");
      if (childKind === "anchor" || childKind !== expectedKind) {
        const replacement: HTMLElement = createTokenEl(entry.token, options);
        blockEl.replaceChild(replacement, child);
        return;
      }
      syncTokenEl(child, entry.token, options);
    }
  });
  for (let idx: number = children.length - 1; idx >= desired.length; idx -= 1) {
    children[idx]?.remove();
  }
};

const createBlockEl = (block: TextBlock, options: ReconcileOptions): HTMLDivElement => {
  const el: HTMLDivElement = document.createElement("div");
  syncBlockEl(el, block, options);
  reconcileTokenChildren(el, block.tokens, block.key, options);
  return el;
};

const syncBlockEl = (el: HTMLElement, block: TextBlock, options: ReconcileOptions): void => {
  const indentDepth: number = Number(block.indentDepth) || 0;
  const depthClass: string = indentDepth > 0 ? ` text-editor-block-indent-${indentDepth}` : "";
  const nextClassName: string = `text-editor-block${depthClass}`;
  if (el.className !== nextClassName) el.className = nextClassName;
  syncDataset(el, { blockKey: block.key, indentDepth });
  reconcileTokenChildren(el, block.tokens, block.key, options);
};

type ContainerWithEditorExtras = HTMLElement & {
  _textEditorOverlay?: HTMLDivElement;
  _textEditorOptions?: ReconcileOptions;
  _hideMoveInsertOverlay?: () => void;
};

export const reconcileTextEditor = (container: HTMLElement, blocks: TextBlock[], options: ReconcileOptions = {}): void => {
  const host: ContainerWithEditorExtras = container as ContainerWithEditorExtras;
  const currentBlocks: HTMLElement[] = Array.from(container.children).filter(
    (child: Element): boolean => Boolean((child as HTMLElement).dataset.blockKey),
  ) as HTMLElement[];
  const appendBlockEl = (blockEl: HTMLElement): void => {
    const overlay: HTMLDivElement | undefined = host._textEditorOverlay;
    if (overlay && overlay.parentElement === host) {
      host.insertBefore(blockEl, overlay);
    } else {
      host.appendChild(blockEl);
    }
  };
  blocks.forEach((block: TextBlock, idx: number): void => {
    let blockEl: HTMLElement | undefined = currentBlocks[idx];
    if (!blockEl) {
      blockEl = createBlockEl(block, options);
      appendBlockEl(blockEl);
      return;
    }
    if (blockEl.dataset.blockKey !== block.key) {
      const found: HTMLElement | undefined = currentBlocks.find(
        (candidate: HTMLElement, candidateIdx: number): boolean => candidateIdx > idx && candidate.dataset.blockKey === block.key,
      );
      if (found) {
        host.insertBefore(found, blockEl);
        blockEl = found;
      } else {
        const created: HTMLDivElement = createBlockEl(block, options);
        host.insertBefore(created, blockEl);
        blockEl = created;
      }
    }
    syncBlockEl(blockEl, block, options);
  });
  const latestBlocks: Element[] = Array.from(container.children).filter(
    (child: Element): boolean => Boolean((child as HTMLElement).dataset.blockKey),
  );
  for (let idx: number = latestBlocks.length - 1; idx >= blocks.length; idx -= 1) {
    latestBlocks[idx].remove();
  }
  setupMoveInsertOverlay(container as ContainerWithEditorExtras, options);
};

const createMoveInsertOverlay = (container: HTMLElement): HTMLDivElement => {
  const overlay: HTMLDivElement = document.createElement("div");
  overlay.className = "text-editor-move-insert-overlay";
  overlay.innerHTML = `
    <button type="button" class="text-editor-insert-icon left" aria-label="Insert comment before move">&#x25C0;</button>
    <button type="button" class="text-editor-insert-icon right" aria-label="Insert comment after move">&#x25B6;</button>
  `;
  container.appendChild(overlay);
  return overlay;
};

const asElementTarget = (rawTarget: EventTarget | null): Element | null => {
  if (rawTarget instanceof Element) return rawTarget;
  if (rawTarget instanceof Node) return rawTarget.parentElement;
  return null;
};

const getMoveTokenFromEvent = (container: HTMLElement, event: Event): HTMLElement | null => {
  if (typeof (event as Event & { composedPath?: () => EventTarget[] }).composedPath === "function") {
    const path: EventTarget[] = (event as Event & { composedPath: () => EventTarget[] }).composedPath();
    for (const item of path) {
      if (!(item instanceof Element)) continue;
      if (item.matches('[data-token-type="move"][data-node-id]')) {
        return item as HTMLElement;
      }
      if (item === container) break;
    }
  }
  const targetEl: Element | null = asElementTarget(event.target);
  if (!targetEl) return null;
  const moveEl: Element | null = targetEl.closest('[data-token-type="move"][data-node-id]');
  if (!moveEl) return null;
  return moveEl as HTMLElement;
};

const getElementTargetFromEvent = (event: Event): Element | null => asElementTarget(event.target);

const trySelectMoveFromEvent = (container: ContainerWithEditorExtras, event: Event): boolean => {
  const moveEl: HTMLElement | null = getMoveTokenFromEvent(container, event);
  if (!moveEl) return false;
  const moveId: string = moveEl.dataset.nodeId || "";
  if (!moveId) return false;
  const onMoveSelect: ((id: string) => void) | undefined = container._textEditorOptions?.onMoveSelect;
  if (onMoveSelect) onMoveSelect(moveId);
  return true;
};

const positionOverlayAtMove = (container: HTMLElement, overlay: HTMLElement, moveEl: HTMLElement): void => {
  const containerRect: DOMRect = container.getBoundingClientRect();
  const moveRect: DOMRect = moveEl.getBoundingClientRect();
  const horizontalPadding: number = 6;
  overlay.style.left = `${moveRect.left - containerRect.left + moveRect.width / 2}px`;
  overlay.style.top = `${moveRect.top - containerRect.top + moveRect.height / 2}px`;
  overlay.style.width = `${moveRect.width + horizontalPadding * 2}px`;
  overlay.style.height = `${Math.max(moveRect.height + 8, 22)}px`;
  overlay.dataset.moveId = moveEl.dataset.nodeId || "";
  overlay.classList.add("visible");
};

const setupMoveInsertOverlay = (container: ContainerWithEditorExtras, options: ReconcileOptions): void => {
  if (!container) return;
  container._textEditorOptions = options;
  const overlayEl: HTMLDivElement = container._textEditorOverlay ?? createMoveInsertOverlay(container);
  container._textEditorOverlay = overlayEl;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let activeMoveEl: HTMLElement | null = null;
  const clearHideTimer = (): void => {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = null;
  };
  const hideNow = (): void => {
    clearHideTimer();
    overlayEl.classList.remove("visible");
    overlayEl.dataset.moveId = "";
    activeMoveEl = null;
  };
  container._hideMoveInsertOverlay = hideNow;
  const showForMove = (moveEl: HTMLElement): void => {
    activeMoveEl = moveEl;
    clearHideTimer();
    positionOverlayAtMove(container, overlayEl, moveEl);
  };
  const scheduleHide = (): void => {
    clearHideTimer();
    hideTimer = window.setTimeout((): void => {
      hideNow();
    }, 110);
  };
  const leftBtn: Element | null = overlayEl.querySelector(".text-editor-insert-icon.left");
  const rightBtn: Element | null = overlayEl.querySelector(".text-editor-insert-icon.right");
  const focusCommentById = (commentId: string | null | undefined): boolean => {
    if (!commentId) return false;
    const commentEl: Element | null = container.querySelector(`[data-kind="comment"][data-comment-id="${commentId}"]`);
    if (!(commentEl instanceof HTMLElement)) return false;
    commentEl.classList.add("text-editor-comment-new");
    commentEl.focus();
    const selection: Selection | null = window.getSelection();
    if (selection) {
      const range: Range = document.createRange();
      range.selectNodeContents(commentEl);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    window.setTimeout((): void => commentEl.classList.remove("text-editor-comment-new"), 1400);
    return true;
  };
  const triggerInsertAtSide = (moveId: string, side: string): void => {
    if (!moveId) return;
    const resolveExisting: ((moveId: string, side: string) => string | null | undefined) | undefined =
      container._textEditorOptions?.onResolveExistingComment;
    const existingCommentId: string | null | undefined = resolveExisting ? resolveExisting(moveId, side) : null;
    if (focusCommentById(existingCommentId)) return;
    const callback: ((moveId: string, side: string) => void) | undefined = container._textEditorOptions?.onInsertComment;
    if (callback) callback(moveId, side);
  };

  if (leftBtn instanceof HTMLElement) {
    leftBtn.onclick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const moveId: string = overlayEl.dataset.moveId || "";
      triggerInsertAtSide(moveId, "before");
      hideNow();
    };
  }
  if (rightBtn instanceof HTMLElement) {
    rightBtn.onclick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const moveId: string = overlayEl.dataset.moveId || "";
      triggerInsertAtSide(moveId, "after");
      hideNow();
    };
  }

  overlayEl.onmouseenter = (): void => {
    clearHideTimer();
    if (activeMoveEl) positionOverlayAtMove(container, overlayEl, activeMoveEl);
    else overlayEl.classList.add("visible");
  };
  overlayEl.onmouseleave = (): void => {
    scheduleHide();
  };
  container.onmousemove = (event: MouseEvent): void => {
    if (event.target instanceof Element && overlayEl.contains(event.target)) {
      clearHideTimer();
      return;
    }
    const moveEl: HTMLElement | null = getMoveTokenFromEvent(container, event);
    if (!moveEl) {
      scheduleHide();
      return;
    }
    showForMove(moveEl);
  };
  container.onmouseleave = (): void => {
    scheduleHide();
  };
  container.onclick = (event: MouseEvent): void => {
    const targetEl: Element | null = getElementTargetFromEvent(event);
    if (targetEl?.closest(".text-editor-insert-icon")) return;
    const selected: boolean = trySelectMoveFromEvent(container, event);
    if (!selected) return;
    window.setTimeout((): void => hideNow(), 0);
  };
  container.onpointerdown = (event: PointerEvent): void => {
    const targetEl: Element | null = getElementTargetFromEvent(event);
    if (targetEl?.closest(".text-editor-insert-icon")) return;
    const selected: boolean = trySelectMoveFromEvent(container, event);
    if (!selected) return;
    hideNow();
    event.preventDefault();
  };
};

const escapeHtml = (value: unknown): string => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const rawCommentToHtml = (raw: unknown): string => {
  let html: string = escapeHtml(raw);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<u>$1</u>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br>");
  return html;
};

const htmlCommentToRawFromNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element: HTMLElement = node as HTMLElement;
  const tag: string = element.tagName.toLowerCase();
  if (tag === "br") return "\n";

  const parts: string = Array.from(node.childNodes)
    .map((child: Node): string => htmlCommentToRawFromNode(child))
    .join("");
  if (tag === "strong" || tag === "b") return `**${parts}**`;
  if (tag === "em" || tag === "i") return `*${parts}*`;
  if (tag === "u") return `__${parts}__`;
  if (tag === "div" || tag === "p") return `${parts}\n`;
  return parts;
};

const htmlCommentToRaw = (element: HTMLElement): string => {
  const raw: string = Array.from(element.childNodes)
    .map((node: Node): string => htmlCommentToRawFromNode(node))
    .join("");
  return raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
};
