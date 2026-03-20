import type { PgnResourceKind } from "../domain/kinds";

export const resolveKind = (kind: string): PgnResourceKind => {
  if (kind === "file" || kind === "directory" || kind === "db") return kind;
  throw new Error(`Unsupported resource kind: ${kind}`);
};
