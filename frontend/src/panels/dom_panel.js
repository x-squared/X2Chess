const formatDomNode = (node, depth = 0) => {
  const indent = "  ".repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";
    if (!value) return "";
    if (/^\s+$/.test(value)) return `${indent}#text(${JSON.stringify(value)})`;
    return `${indent}#text(${JSON.stringify(value)})`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  const attrs = Array.from(node.attributes)
    .map((attr) => `${attr.name}=${JSON.stringify(attr.value)}`)
    .join(" ");
  const open = attrs ? `${indent}<${tag} ${attrs}>` : `${indent}<${tag}>`;
  const childLines = Array.from(node.childNodes)
    .map((child) => formatDomNode(child, depth + 1))
    .filter(Boolean);
  const close = `${indent}</${tag}>`;
  if (childLines.length === 0) {
    return `${open}${close.slice(indent.length)}`;
  }
  return [open, ...childLines, close].join("\n");
};

export const renderDomPanel = (domViewEl, sourceEl) => {
  if (!domViewEl || !sourceEl) return;
  domViewEl.textContent = formatDomNode(sourceEl);
};
