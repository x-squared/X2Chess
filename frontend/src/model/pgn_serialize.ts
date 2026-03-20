const INDENT_DIRECTIVE_PREFIX = /^(\s*(?:\\i(?:\s+|$))+)/;

const encodeCommentLayout = (raw: any): any => {
  const source = String(raw ?? "");
  const encodeBody = (text: any): any => text
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n");
  const match = source.match(INDENT_DIRECTIVE_PREFIX);
  if (!match) return encodeBody(source);
  const prefix = match[1];
  const rest = source.slice(prefix.length);
  return `${prefix}${encodeBody(rest)}`;
};

const serializeComment = (comment: any): any => `{${encodeCommentLayout(comment.raw)}}`;

const serializeVariation = (variation: any): any => {
  const parts: string[] = [];
  const hoistedBeforeCommentMoveIds = new Set();
  variation.entries.forEach((entry: any, idx: any): any => {
    if (entry.type === "move_number") {
      const nextEntry = variation.entries[idx + 1];
      if (nextEntry?.type === "move" && Array.isArray(nextEntry.commentsBefore) && nextEntry.commentsBefore.length > 0) {
        nextEntry.commentsBefore.forEach((comment: any): any => parts.push(serializeComment(comment)));
        hoistedBeforeCommentMoveIds.add(nextEntry.id);
      }
    }
    if (entry.type === "move_number" || entry.type === "result" || entry.type === "nag") {
      parts.push(entry.text);
      return;
    }
    if (entry.type === "comment") {
      parts.push(serializeComment(entry));
      return;
    }
    if (entry.type === "variation") {
      parts.push(`(${serializeVariation(entry)})`);
      return;
    }
    if (entry.type !== "move") return;

    if (!hoistedBeforeCommentMoveIds.has(entry.id)) {
      entry.commentsBefore.forEach((comment: any): any => parts.push(serializeComment(comment)));
    }
    parts.push(entry.san);
    entry.nags.forEach((nag: any): any => parts.push(nag));
    if (Array.isArray(entry.postItems) && entry.postItems.length > 0) {
      entry.postItems.forEach((item: any): any => {
        if (item.type === "comment" && item.comment) {
          parts.push(serializeComment(item.comment));
          return;
        }
        if (item.type === "rav" && item.rav) {
          parts.push(`(${serializeVariation(item.rav)})`);
        }
      });
    } else {
      entry.commentsAfter.forEach((comment: any): any => parts.push(serializeComment(comment)));
      entry.ravs.forEach((child: any): any => parts.push(`(${serializeVariation(child)})`));
    }
  });
  variation.trailingComments.forEach((comment: any): any => parts.push(serializeComment(comment)));
  return parts
    .map((part: any): any => String(part ?? ""))
    .filter((part: any): any => part.length > 0)
    .join(" ")
    .trim();
};

export const serializeModelToPgn = (model: any): any => {
  const headerLines = model.headers.map((header: any): any => `[${header.key} "${header.value}"]`);
  const moveText = serializeVariation(model.root);
  if (headerLines.length === 0) return moveText;
  return `${headerLines.join("\n")}\n\n${moveText}`.trim();
};
