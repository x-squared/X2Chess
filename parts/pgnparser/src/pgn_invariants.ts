/**
 * pgn_invariants — structural consistency checks for `PgnModel`.
 *
 * Integration API:
 * - `collectPgnModelInvariantIssues(model)` gathers invariant violations without throwing.
 * - `isPgnModelStructurallyValid(model)` returns a boolean convenience check.
 *
 * Configuration API:
 * - No runtime configuration; checks are deterministic for a given model.
 *
 * Communication API:
 * - Pure validation helpers over `PgnModel`; no I/O and no mutation.
 */
import type { PgnEntryNode, PgnModel, PgnMoveNode, PgnVariationNode } from "./pgn_model";
import { getMoveRavs } from "./pgn_move_attachments";

export type PgnInvariantIssue = {
  code: string;
  message: string;
};

const appendIssue = (issues: PgnInvariantIssue[], code: string, message: string): void => {
  issues.push({ code, message });
};

const collectMoveIds = (
  variation: PgnVariationNode,
  moveIds: Set<string>,
  variationIds: Set<string>,
): void => {
  variationIds.add(variation.id);
  variation.entries.forEach((entry: PgnEntryNode): void => {
    if (entry.type === "move") {
      moveIds.add(entry.id);
      getMoveRavs(entry).forEach((rav: PgnVariationNode): void => {
        collectMoveIds(rav, moveIds, variationIds);
      });
      return;
    }
    if (entry.type === "variation") {
      collectMoveIds(entry, moveIds, variationIds);
    }
  });
};

const validateVariation = (
  variation: PgnVariationNode,
  moveIds: Set<string>,
  issues: PgnInvariantIssue[],
): void => {
  if (variation.depth === 0 && variation.parentMoveId !== null) {
    appendIssue(
      issues,
      "root_parent_move_id",
      `Root variation "${variation.id}" must have parentMoveId=null.`,
    );
  }
  if (variation.depth > 0 && variation.parentMoveId === null) {
    appendIssue(
      issues,
      "nested_parent_move_missing",
      `Nested variation "${variation.id}" must reference a parent move id.`,
    );
  }
  if (variation.parentMoveId !== null && !moveIds.has(variation.parentMoveId)) {
    appendIssue(
      issues,
      "orphan_parent_move_id",
      `Variation "${variation.id}" references missing parent move "${variation.parentMoveId}".`,
    );
  }

  variation.entries.forEach((entry: PgnEntryNode): void => {
    if (entry.type === "variation") {
      validateVariation(entry, moveIds, issues);
      return;
    }
    if (entry.type !== "move") return;
    validateMove(entry, moveIds, issues);
  });
};

const validateMove = (
  move: PgnMoveNode,
  moveIds: Set<string>,
  issues: PgnInvariantIssue[],
): void => {
  move.postItems.forEach((item): void => {
    if (item.type === "rav") {
      validateVariation(item.rav, moveIds, issues);
      return;
    }
  });
};

/**
 * Collect structural invariant violations for a PGN model.
 *
 * @param model - Model to validate.
 * @returns List of invariant issues; empty means no issues were found.
 */
export const collectPgnModelInvariantIssues = (model: PgnModel): PgnInvariantIssue[] => {
  const issues: PgnInvariantIssue[] = [];
  if (!model.root) return issues;

  const moveIds: Set<string> = new Set<string>();
  const variationIds: Set<string> = new Set<string>();
  collectMoveIds(model.root, moveIds, variationIds);

  validateVariation(model.root, moveIds, issues);
  return issues;
};

/**
 * True when no structural invariant violations are detected.
 *
 * @param model - Model to validate.
 * @returns `true` when the model is structurally valid.
 */
export const isPgnModelStructurallyValid = (model: PgnModel): boolean =>
  collectPgnModelInvariantIssues(model).length === 0;

const shouldAssertPgnInvariants = (): boolean => {
  const processEnv: Record<string, string | undefined> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  if (!processEnv) return true;
  if (processEnv.X2CHESS_ASSERT_PGN_INVARIANTS === "0") return false;
  return processEnv.NODE_ENV !== "production";
};

/**
 * Assert structural invariants for a PGN model in development/test environments.
 *
 * @param model - Model to validate.
 * @param context - Mutation/context label included in thrown error messages.
 * @returns The same model reference for fluent use in return expressions.
 * @throws Error when invariant violations are found and assertions are enabled.
 */
export const assertPgnModelInvariants = (model: PgnModel, context: string): PgnModel => {
  if (!shouldAssertPgnInvariants()) return model;
  const issues: PgnInvariantIssue[] = collectPgnModelInvariantIssues(model);
  if (issues.length === 0) return model;
  const details: string = issues
    .map((issue: PgnInvariantIssue): string => `${issue.code}: ${issue.message}`)
    .join(" | ");
  throw new Error(`PGN invariant violation after ${context}: ${details}`);
};
