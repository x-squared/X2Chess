/**
 * useSchemaManagement — schema selection and per-tab schema wiring for ResourceViewer.
 *
 * Schema CRUD (create / edit / delete) is handled by MetadataPanel in the dedicated
 * Metadata tab.  This hook is responsible only for:
 *   - Maintaining the in-memory schema list (reloaded from localStorage when
 *     MetadataPanel dispatches `x2chess:schemas-updated`).
 *   - Tracking which schema is assigned to each open tab.
 *   - Persisting schema changes per-resource.
 *
 * Integration API:
 * - `useSchemaManagement(activeTabId, deps)` →
 *   `{ schemas, tabSchemaMap, activeSchemaId, activeSchema,
 *      initTabSchema, handleSchemaSelect }`
 *
 * Communication API:
 * - Reads / writes schemas via `schema_storage`.
 * - Listens for `x2chess:schemas-updated` (dispatched by MetadataPanel) to
 *   refresh the schema list without a page reload.
 * - Persists per-tab schema assignment via `setResourceSchemaId`.
 */

import { useState, useCallback, useEffect } from "react";
import type { TabState } from "../services/viewer_utils";
import {
  loadSchemas,
  setResourceSchemaId,
} from "../services/schema_storage";
import {
  BUILT_IN_SCHEMA,
  type MetadataSchema,
} from "../../../../../parts/resource/src/domain/metadata_schema";

type UseSchemaManagementResult = {
  schemas: MetadataSchema[];
  tabSchemaMap: Record<string, string | null>;
  activeSchemaId: string | null;
  activeSchema: MetadataSchema;
  /** `resourceRef` is the active tab's resource ref — pass `activeTab?.resourceRef ?? null`. */
  handleSchemaSelect: (id: string, resourceRef: TabState["resourceRef"] | null) => void;
  /** Seed `tabSchemaMap` from a resource on tab activation. No-op if already set this session. */
  initTabSchema: (tabId: string, schemaId: string | null) => void;
};

type UseSchemaManagementDeps = {
  /** Called after localStorage write to also persist schema ID inside the resource file/DB. */
  persistSchemaId?: (resourceRef: { kind: string; locator: string }, schemaId: string | null) => Promise<void>;
};

export const useSchemaManagement = (
  activeTabId: string | null,
  deps?: UseSchemaManagementDeps,
): UseSchemaManagementResult => {
  const [schemas, setSchemas] = useState<MetadataSchema[]>(() => loadSchemas());
  const [tabSchemaMap, setTabSchemaMap] = useState<Record<string, string | null>>({});

  useEffect((): (() => void) => {
    const handler = (): void => { setSchemas(loadSchemas()); };
    globalThis.addEventListener("x2chess:schemas-updated", handler);
    return (): void => { globalThis.removeEventListener("x2chess:schemas-updated", handler); };
  }, []);

  const activeSchemaId: string | null = tabSchemaMap[activeTabId ?? ""] ?? null;
  const activeSchema: MetadataSchema =
    schemas.find((s) => s.id === activeSchemaId) ?? BUILT_IN_SCHEMA;

  const handleSchemaSelect = useCallback((id: string, resourceRef: TabState["resourceRef"] | null): void => {
    if (!activeTabId) return;
    const schemaId: string | null = id === "builtin" ? null : id;
    setTabSchemaMap((prev) => ({ ...prev, [activeTabId]: schemaId }));
    if (resourceRef) {
      setResourceSchemaId(resourceRef, schemaId);
      deps?.persistSchemaId?.(resourceRef, schemaId);
    }
  }, [activeTabId, deps]);

  const initTabSchema = useCallback((tabId: string, schemaId: string | null): void => {
    setTabSchemaMap((prev) => {
      if (prev[tabId] !== undefined) return prev;
      return { ...prev, [tabId]: schemaId };
    });
  }, []);

  return {
    schemas,
    tabSchemaMap,
    activeSchemaId,
    activeSchema,
    handleSchemaSelect,
    initTabSchema,
  };
};
