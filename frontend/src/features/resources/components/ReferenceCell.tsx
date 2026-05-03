/**
 * ReferenceCell — renders a reference-field game chip for ResourceTable cells and group headers.
 *
 * When the referenced game is already loaded in the same tab (`syncedRow` / `syncedRendered`),
 * the chip reuses that row's pre-rendered GRP output exactly as the Game column does.
 * For cross-tab or unloaded references the chip fetches metadata asynchronously via
 * `onFetchMetadata` and resolves the GRP display independently.
 *
 * Integration API:
 * - `<ReferenceCell ... />` — rendered inside ResourceTable `<td>` cells and group-header `<td>`.
 *   No context required; all inputs are props.
 *
 * Configuration API:
 * - `recordId: string` — the record id the chip refers to.
 * - `syncedRow: ResourceRow | null` — same-tab row when available (avoids async fetch).
 * - `syncedRendered: RenderedGameDisplay | null` — pre-rendered GRP lines for `syncedRow`.
 * - `onFetchMetadata` — async resolver for cross-tab/unloaded metadata.
 * - `onOpen?: (id: string) => void` — called on chip click to navigate to the referenced game.
 * - `renderingProfile?: GameRenderingProfile` — active schema profile for GRP resolution.
 * - `schemaFieldsForGrp?: readonly MetadataFieldDefinition[]` — schema fields for select matching.
 *
 * Communication API:
 * - Outbound: `onOpen(recordId)` on click.
 * - Inbound: `onFetchMetadata(recordId)` on mount when `syncedRow` is null.
 */

import { useState, useEffect, type ReactElement } from "react";
import type {
  GameRenderingDisplay,
  GameRenderingProfile,
  MetadataFieldDefinition,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import {
  resolveDisplayForReferenceChip,
  renderDisplayText,
  type ReferenceChipDisplaySource,
  type RenderedGameDisplay,
} from "../services/game_rendering";
import type { ResourceRow } from "../services/viewer_utils";
import { log } from "../../../logger";

// ── Props ─────────────────────────────────────────────────────────────────────

type ReferenceCellProps = {
  recordId: string;
  /** Same `ResourceRow` object as in this tab when the reference points at a loaded game — chips match the Game column. */
  syncedRow: ResourceRow | null;
  syncedRendered: RenderedGameDisplay | null;
  onFetchMetadata: (id: string) => Promise<Record<string, string> | null>;
  onOpen?: (id: string) => void;
  renderingProfile?: GameRenderingProfile;
  /** Active schema fields — enables select `when` matching (case-insensitive Type, etc.). */
  schemaFieldsForGrp?: readonly MetadataFieldDefinition[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export const ReferenceCell = ({
  recordId,
  syncedRow,
  syncedRendered,
  onFetchMetadata,
  onOpen,
  renderingProfile,
  schemaFieldsForGrp,
}: ReferenceCellProps): ReactElement => {
  const [meta, setMeta] = useState<Record<string, string> | null>(null);

  const useTableSync: boolean = syncedRow !== null;

  useEffect((): (() => void) | void => {
    if (!recordId || useTableSync) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const result = await onFetchMetadata(recordId);
      if (!cancelled) setMeta(result);
    })();
    return (): void => {
      cancelled = true;
    };
  }, [recordId, useTableSync, onFetchMetadata]);

  const metaForDisplay: Record<string, string> | null =
    syncedRow !== null ? syncedRow.metadata : meta;

  const white: string = String(metaForDisplay?.White ?? "").trim();
  const black: string = String(metaForDisplay?.Black ?? "").trim();
  const result: string = String(metaForDisplay?.Result ?? "").trim();
  const date: string = String(metaForDisplay?.Date ?? "").trim();
  const event: string = String(metaForDisplay?.Event ?? "").trim();

  const chipResolution: {
    display: GameRenderingDisplay | null;
    source: ReferenceChipDisplaySource;
  } =
    metaForDisplay && renderingProfile
      ? resolveDisplayForReferenceChip(metaForDisplay, renderingProfile, schemaFieldsForGrp)
      : { display: null, source: "none" };

  const rendered: { line1: string; line2: string } | null =
    !useTableSync && chipResolution.display
      ? renderDisplayText(chipResolution.display, metaForDisplay!)
      : null;

  const playersLabel: string = white && black ? `${white} — ${black}` : white || black || recordId;
  const metaInline: string = [result, event, date].filter(Boolean).join(" · ");
  const tooltip: string =
    [
      white && `White: ${white}`,
      black && `Black: ${black}`,
      result && `Result: ${result}`,
      event && `Event: ${event}`,
      date && `Date: ${date}`,
    ]
      .filter(Boolean)
      .join("\n") || recordId;

  const primaryFromGrp: string = rendered?.line1 || playersLabel;
  const secondaryFromGrp: string = rendered?.line2 ?? metaInline;

  const primaryText: string =
    useTableSync && syncedRow
      ? (syncedRendered?.line1 ?? syncedRow.game)
      : primaryFromGrp;
  const secondaryText: string =
    useTableSync && syncedRow ? (syncedRendered?.line2 ?? "") : secondaryFromGrp;

  const unresolvedClass: string = metaForDisplay ? "" : "metadata-field-reference-game-chip--unresolved";
  const noOpenClass: string = onOpen ? "" : "metadata-field-reference-game-chip--no-open";

  if (
    metaForDisplay &&
    renderingProfile &&
    !useTableSync &&
    !rendered &&
    primaryFromGrp === recordId
  ) {
    log.warn("ResourceTable", "ReferenceCell falls back to raw record id — check GRP rules / metadata fetch", {
      recordId,
      grpSlot: chipResolution.source,
      hasWhiteBlack: Boolean(white || black),
    });
  }

  return (
    <button
      type="button"
      className={["metadata-field-reference-game-chip", unresolvedClass, noOpenClass].filter(Boolean).join(" ")}
      data-grp-reference-slot={chipResolution.source}
      title={tooltip}
      onClick={onOpen ? (e): void => { e.stopPropagation(); onOpen(recordId); } : undefined}
    >
      <span className="metadata-field-reference-game-primary">{primaryText}</span>
      {secondaryText && (
        <span className="metadata-field-reference-game-secondary"> · {secondaryText}</span>
      )}
    </button>
  );
};
