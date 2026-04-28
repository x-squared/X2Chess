/**
 * useSchemaManagement — schema selection, schema CRUD, and per-tab schema wiring.
 *
 * Integration API:
 * - `useSchemaManagement(activeTabId, activeTab)` →
 *   `{ schemas, tabSchemaMap, activeSchemaId, activeSchema, schemaEditorOpen,
 *      editingSchema, handleSchemaSelect, handleSchemaManage, handleSchemaSave,
 *      handleSchemaEditorClose }`
 *
 * Communication API:
 * - Persists schemas to localStorage via `schema_storage`.
 * - Persists per-tab schema assignment via `setResourceSchemaId`.
 */

import { useState, useCallback } from "react";
import type { TabState } from "../services/viewer_utils";
import {
  loadSchemas,
  saveSchemas,
  upsertSchema,
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
  schemaEditorOpen: boolean;
  editingSchema: MetadataSchema | null;
  /** `resourceRef` is the active tab's resource ref — pass `activeTab?.resourceRef ?? null`. */
  handleSchemaSelect: (id: string, resourceRef: TabState["resourceRef"] | null) => void;
  handleSchemaManage: () => void;
  handleSchemaSave: (saved: MetadataSchema) => void;
  handleSchemaEditorClose: () => void;
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
  const [schemaEditorOpen, setSchemaEditorOpen] = useState<boolean>(false);
  const [editingSchema, setEditingSchema] = useState<MetadataSchema | null>(null);

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

  const handleSchemaManage = useCallback((): void => {
    setEditingSchema(null);
    setSchemaEditorOpen(true);
  }, []);

  const handleSchemaSave = useCallback((saved: MetadataSchema): void => {
    setSchemas((prev) => {
      const next = upsertSchema(prev, saved);
      saveSchemas(next);
      return next;
    });
    setSchemaEditorOpen(false);
    setEditingSchema(null);
  }, []);

  const handleSchemaEditorClose = useCallback((): void => {
    setSchemaEditorOpen(false);
    setEditingSchema(null);
  }, []);

  return {
    schemas,
    tabSchemaMap,
    activeSchemaId,
    activeSchema,
    schemaEditorOpen,
    editingSchema,
    initTabSchema,
    handleSchemaSelect,
    handleSchemaManage,
    handleSchemaSave,
    handleSchemaEditorClose,
  };
};
