export const joinPath = (...parts: string[]): string =>
  parts
    .filter((part: string): boolean => Boolean(part))
    .map((part: string, idx: number): string => (idx === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, "")))
    .filter((part: string): boolean => part.length > 0)
    .join("/");
