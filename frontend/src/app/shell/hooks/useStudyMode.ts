/**
 * useStudyMode — study-mode state and navigation for AppShell.
 *
 * Integration API:
 * - `const study = useStudyMode(pgnModel, rawServices)`
 * - Read `study.studyItems`, `study.studyActive`, `study.currentStudyItem` for rendering.
 * - Pass `study.handle*` callbacks to toolbar / study overlay buttons.
 *
 * Configuration API:
 * - `pgnModel` — current PGN model (used to collect study annotations).
 * - `rawServices` — needs only `gotoMoveById`.
 *
 * Communication API:
 * - No side effects beyond the state it owns; no context reads.
 */

import { useState, useMemo, useCallback } from "react";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import { collectStudyItems } from "../../../model/study_items";
import type { StudyItem } from "../../../model/study_items";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UseStudyModeReturn = {
  studyItems: StudyItem[];
  studyActive: boolean;
  setStudyActive: (active: boolean) => void;
  studyItemIndex: number;
  studyAnnotIndex: number;
  currentStudyItem: StudyItem | null;
  handleStartStudy: () => void;
  handleStudyNext: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Manages study-mode state: item list, index, annotation step, and navigation. */
export const useStudyMode = (
  pgnModel: PgnModel | null,
  rawServices: { gotoMoveById: (id: string) => void },
): UseStudyModeReturn => {
  const studyItems: StudyItem[] = useMemo(
    () => collectStudyItems(pgnModel),
    // pgnModel reference changes on each PGN edit; use object identity as dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pgnModel],
  );

  const [studyActive, setStudyActive] = useState(false);
  const [studyItemIndex, setStudyItemIndex] = useState(0);
  const [studyAnnotIndex, setStudyAnnotIndex] = useState(0);

  const currentStudyItem: StudyItem | null = studyActive ? (studyItems[studyItemIndex] ?? null) : null;

  const handleStartStudy = useCallback((): void => {
    if (studyItems.length === 0) return;
    setStudyItemIndex(0);
    setStudyAnnotIndex(0);
    setStudyActive(true);
    rawServices.gotoMoveById(studyItems[0].moveId);
  }, [studyItems, rawServices]);

  const handleStudyNext = useCallback((): void => {
    const item: StudyItem | undefined = studyItems[studyItemIndex];
    if (!item) return;
    if (studyAnnotIndex + 1 < item.annotations.length) {
      setStudyAnnotIndex((i) => i + 1);
      return;
    }
    const nextIdx: number = studyItemIndex + 1;
    if (nextIdx < studyItems.length) {
      setStudyItemIndex(nextIdx);
      setStudyAnnotIndex(0);
      rawServices.gotoMoveById(studyItems[nextIdx].moveId);
    } else {
      setStudyActive(false);
    }
  }, [studyItems, studyItemIndex, studyAnnotIndex, rawServices]);

  return {
    studyItems,
    studyActive,
    setStudyActive,
    studyItemIndex,
    studyAnnotIndex,
    currentStudyItem,
    handleStartStudy,
    handleStudyNext,
  };
};
