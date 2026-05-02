/**
 * useResourceTabs — manages tab state, row loading, and live-refresh for ResourceViewer.
 *
 * Integration API:
 * - `useResourceTabs(activeTabId, tabSnapshots, schemas, tabSchemaMap, t)` →
 *   `{ tabs, setTabs, loadRowsForTab }`
 *
 * Communication API:
 * - Subscribes to `resourceDomainEvents` for live row refresh.
 * - Calls `getResourceLoaderService()` to load game rows.
 */

import { useState, useEffect, useCallback } from "react";
import type { ResourceTabSnapshot } from "../../../core/state/app_reducer";
import { getResourceLoaderService } from "../../../services/resource_loader";
import {
  clampGameIdColumnWidth,
  clampWidth,
  readPrefsMap,
  reconcileColumns,
  DEFAULT_METADATA_KEYS,
  type TabState,
  type TabPrefs,
  type ResourceRef,
  type ResourceRow,
} from "../services/viewer_utils";
import { buildResourceTabReloadPlan, collectAffectedResourceTabIds } from "../services/resource_tab_refresh";
import { BUILT_IN_SCHEMA, type MetadataSchema } from "../../../../../parts/resource/src/domain/metadata_schema";
import { resolveInheritedMetadata } from "../../../../../parts/resource/src/domain/metadata_inheritance";
import type { PgnGameEntry } from "../../../../../parts/resource/src/domain/game_entry";
import { resourceDomainEvents } from "../../../core/events/resource_domain_events";
import { log } from "../../../logger";

// ── Tab initialisation ────────────────────────────────────────────────────────

const initTab = (snapshot: ResourceTabSnapshot): TabState => {
  const ref: ResourceRef = { kind: snapshot.kind, locator: snapshot.locator };
  const tabId: string = snapshot.tabId;
  const prefs: TabPrefs | undefined = readPrefsMap()[tabId];
  const visibleMetadataKeys: string[] =
    prefs?.visibleMetadataKeys?.length
      ? [...prefs.visibleMetadataKeys]
      : [...DEFAULT_METADATA_KEYS];
  const metadataColumnOrder: string[] = Array.isArray(prefs?.metadataColumnOrder)
    ? [...prefs.metadataColumnOrder]
    : ["game", ...visibleMetadataKeys];
  const columnWidths: Record<string, number> = {};
  if (prefs?.columnWidths) {
    Object.entries(prefs.columnWidths).forEach(([k, v]: [string, number]): void => {
      columnWidths[k] = k === "game" ? clampGameIdColumnWidth(v) : clampWidth(v);
    });
  }
  return reconcileColumns({
    tabId,
    title: snapshot.title,
    resourceRef: ref,
    loadState: { status: "idle" },
    visibleMetadataKeys,
    metadataColumnOrder,
    columnWidths,
  });
};

// ── Row hydration ─────────────────────────────────────────────────────────────

const hydrateRows = (
  entries: unknown[],
  t: (key: string, fallback?: string) => string,
): { rows: ResourceRow[]; discoveredKeys: string[] } => {
  const discovered = new Set<string>();
  const rows = (Array.isArray(entries) ? entries : []).map((entry: unknown) => {
    const record: Record<string, unknown> =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const sourceRefRaw: unknown = record.sourceRef ?? record.gameRef;
    const sourceRef: Record<string, unknown> =
      sourceRefRaw && typeof sourceRefRaw === "object"
        ? (sourceRefRaw as Record<string, unknown>)
        : {};
    const identifier: string = String(sourceRef.recordId ?? record.identifier ?? "");
    const metadata: Record<string, string> = {
      identifier,
      source: String(sourceRef.kind ?? ""),
      revision: String(record.revisionToken ?? ""),
    };
    const metaRaw: unknown = record.metadata;
    if (metaRaw && typeof metaRaw === "object") {
      Object.entries(metaRaw as Record<string, unknown>).forEach(
        ([k, v]: [string, unknown]): void => {
          if (!k || k === "game") return;
          metadata[k] = v == null ? "" : String(v);
          discovered.add(k);
        },
      );
    }
    const availRaw: unknown = record.availableMetadataKeys;
    if (Array.isArray(availRaw)) {
      availRaw.forEach((k: unknown): void => {
        if (k && String(k) !== "game") discovered.add(String(k));
      });
    }
    const metaWhite: string = String((metaRaw as Record<string, unknown> | null)?.White ?? "").trim();
    const metaBlack: string = String((metaRaw as Record<string, unknown> | null)?.Black ?? "").trim();
    const gameLabel: string =
      metaWhite && metaBlack && metaWhite !== "?" && metaBlack !== "?"
        ? `${metaWhite} \u2013 ${metaBlack}`
        : String(record.titleHint ?? identifier ?? t("resources.table.unknown", "Untitled"));

    const rawKind: unknown = record.gameKind;
    const kind: "game" | "position" = rawKind === "position" ? "position" : "game";

    return {
      game: gameLabel,
      kind,
      identifier,
      source: metadata.source,
      revision: metadata.revision,
      metadata,
      sourceRef:
        sourceRefRaw && typeof sourceRefRaw === "object"
          ? (sourceRefRaw as Record<string, unknown>)
          : null,
    };
  });
  return { rows, discoveredKeys: [...discovered] };
};

// ── Hook ──────────────────────────────────────────────────────────────────────

type UseResourceTabsResult = {
  tabs: TabState[];
  setTabs: React.Dispatch<React.SetStateAction<TabState[]>>;
  loadRowsForTab: (tabId: string, resourceRef: ResourceRef, schema: MetadataSchema) => void;
};

import type React from "react";

export const useResourceTabs = (
  activeTabId: string | null,
  tabSnapshots: ResourceTabSnapshot[],
  schemas: MetadataSchema[],
  tabSchemaMap: Record<string, string | null>,
  t: (key: string, fallback?: string) => string,
): UseResourceTabsResult => {
  const [tabs, setTabs] = useState<TabState[]>([]);

  const loadRowsForTab = useCallback(
    (tabId: string, resourceRef: ResourceRef, schema: MetadataSchema): void => {
      const loader = getResourceLoaderService();
      if (!loader) return;
      setTabs((prev: TabState[]): TabState[] =>
        prev.map((tab: TabState): TabState =>
          tab.tabId === tabId ? { ...tab, loadState: { status: "loading" } } : tab,
        ),
      );
      void (async (): Promise<void> => {
        try {
          const raw: unknown[] = await loader(resourceRef);
          const resolved = resolveInheritedMetadata(raw as PgnGameEntry[], schema);
          const { rows, discoveredKeys } = hydrateRows(resolved, t);
          setTabs((prev: TabState[]): TabState[] =>
            prev.map((tab: TabState): TabState => {
              if (tab.tabId !== tabId) return tab;
              return reconcileColumns({
                ...tab,
                loadState: { status: "loaded", rows, availableMetadataKeys: discoveredKeys },
              });
            }),
          );
        } catch (error: unknown) {
          const message: string = error instanceof Error ? error.message : String(error);
          const errorMessage: string = message || t("resources.error", "Unable to load resource.");
          setTabs((prev: TabState[]): TabState[] =>
            prev.map((tab: TabState): TabState =>
              tab.tabId === tabId ? { ...tab, loadState: { status: "error", errorMessage } } : tab,
            ),
          );
        }
      })();
    },
    [t],
  );

  // Sync tab list from state snapshots.
  useEffect((): void => {
    setTabs((prev: TabState[]): TabState[] =>
      tabSnapshots.map((snapshot: ResourceTabSnapshot): TabState => {
        const existing: TabState | undefined = prev.find(
          (t: TabState): boolean => t.tabId === snapshot.tabId,
        );
        return existing ?? initTab(snapshot);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabSnapshots]);

  // Trigger row loading for the active tab when it enters idle state.
  useEffect((): void => {
    if (!activeTabId) return;
    const tab: TabState | undefined = tabs.find((item: TabState): boolean => item.tabId === activeTabId);
    if (!tab || tab.loadState.status !== "idle") return;
    const schemaId: string | null = tabSchemaMap[activeTabId] ?? null;
    const schema: MetadataSchema = schemas.find((s) => s.id === schemaId) ?? BUILT_IN_SCHEMA;
    loadRowsForTab(tab.tabId, tab.resourceRef, schema);
  }, [activeTabId, tabs, loadRowsForTab, tabSchemaMap, schemas]);

  // Live-refresh on resource domain events.
  useEffect((): (() => void) => {
    const unsubscribe: () => void = resourceDomainEvents.subscribe((event): void => {
      if (event.type !== "resource.resourceChanged") return;
      const changedKind: string = event.resourceRef.kind;
      const changedLocator: string = event.resourceRef.locator;
      const matchingTabIds: string[] = collectAffectedResourceTabIds(
        tabs.map((tab: TabState) => ({
          tabId: tab.tabId,
          kind: tab.resourceRef.kind,
          locator: tab.resourceRef.locator,
        })),
        changedKind,
        changedLocator,
      );
      if (matchingTabIds.length === 0) return;
      const matchingTabIdSet: Set<string> = new Set<string>(matchingTabIds);
      const reloadPlan = buildResourceTabReloadPlan(
        tabs.map((tab: TabState) => ({
          tabId: tab.tabId,
          resourceRef: { kind: tab.resourceRef.kind, locator: tab.resourceRef.locator },
        })),
        changedKind,
        changedLocator,
      );
      setTabs((prev: TabState[]): TabState[] =>
        prev.map((tab: TabState): TabState => {
          if (!matchingTabIdSet.has(tab.tabId)) return tab;
          return { ...tab, loadState: { status: "idle" } };
        }),
      );
      for (const planItem of reloadPlan) {
        const schemaId: string | null = tabSchemaMap[planItem.tabId] ?? null;
        const schema: MetadataSchema = schemas.find((s) => s.id === schemaId) ?? BUILT_IN_SCHEMA;
        loadRowsForTab(planItem.tabId, {
          kind: planItem.resourceRef.kind,
          locator: planItem.resourceRef.locator,
        }, schema);
      }
      log.info("useResourceTabs", "Reloading resource tab(s) after resource.resourceChanged", {
        kind: changedKind,
        locator: changedLocator,
        operation: event.operation,
      });
    });
    return (): void => { unsubscribe(); };
  }, [tabs, loadRowsForTab]);

  return { tabs, setTabs, loadRowsForTab };
};
