const formatDomNode = (node: Node, depth: number = 0): string => {
  const indent: string = "  ".repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const value: string = node.textContent ?? "";
    if (!value) return "";
    return `${indent}#text(${JSON.stringify(value)})`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el: Element = node as Element;
  const tag: string = el.tagName.toLowerCase();
  const attrs: string = Array.from(el.attributes)
    .map((attr: Attr): string => `${attr.name}=${JSON.stringify(attr.value)}`)
    .join(" ");
  const open: string = attrs ? `${indent}<${tag} ${attrs}>` : `${indent}<${tag}>`;
  const childLines: string[] = Array.from(node.childNodes)
    .map((child: Node): string => formatDomNode(child, depth + 1))
    .filter(Boolean);
  const close: string = `${indent}</${tag}>`;
  if (childLines.length === 0) {
    return `${open}${close.slice(indent.length)}`;
  }
  return [open, ...childLines, close].join("\n");
};

export const renderDomPanel = (domViewEl: Element | null, sourceEl: Element | null): void => {
  if (!(domViewEl instanceof HTMLElement) || !(sourceEl instanceof Element)) return;
  domViewEl.textContent = formatDomNode(sourceEl);
};
