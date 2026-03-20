type SourceRefLike = {
  kind?: string;
  locator?: string;
  recordId?: string | number;
};

type ResourceRefState = {
  gameDirectoryPath: string;
  gameDirectoryHandle: unknown;
};

export const toResourceTabTitle = (
  resourceRef: SourceRefLike | null,
  t: (key: string, fallback?: string) => string,
): string => {
  if (!resourceRef) return t("resources.title", "Resources");
  const locator = String(resourceRef.locator || "").replaceAll("\\", "/");
  const shortLocator = locator.split("/").filter(Boolean).pop() || locator;
  if (resourceRef.kind === "directory" && shortLocator && shortLocator !== "local-files") return shortLocator;
  return t(
    `resources.tab.${String(resourceRef.kind || "").toLowerCase()}`,
    String(resourceRef.kind || "Resource").toUpperCase(),
  );
};

export const normalizeResourceRefForInsert = (
  resourceRef: SourceRefLike | null,
  state: ResourceRefState,
): SourceRefLike | null => {
  if (!resourceRef) return null;
  if (resourceRef.kind !== "directory") return resourceRef;
  const rawLocator = String(resourceRef.locator || "").trim();
  if (rawLocator && rawLocator !== "local-files") return resourceRef;
  if (state.gameDirectoryPath) return { kind: "directory", locator: state.gameDirectoryPath };
  if (state.gameDirectoryHandle) return { kind: "directory", locator: "browser-handle" };
  return null;
};
