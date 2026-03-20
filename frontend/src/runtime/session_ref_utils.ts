type SourceRefLike = {
  kind?: string;
  locator?: string;
  recordId?: string | number;
};

type SessionWithSourceRef = {
  sourceRef?: SourceRefLike | null;
};

export const isSameSourceRef = (
  left: SourceRefLike | null | undefined,
  right: SourceRefLike | null | undefined,
): boolean => (
  left?.kind === right?.kind
  && String(left?.locator || "") === String(right?.locator || "")
  && String(left?.recordId || "") === String(right?.recordId || "")
);

export const findOpenSessionBySourceRef = <TSession extends SessionWithSourceRef>(
  sessions: TSession[],
  sourceRef: SourceRefLike | null,
): TSession | null => (
  sessions.find((session: TSession): boolean => isSameSourceRef(session.sourceRef, sourceRef)) || null
);
