/**
 * train_tag_parser — re-exports the canonical `[%train]` parser from
 * `features/resources/services/train_tag_parser` for use within the training domain.
 *
 * Integration API:
 * - `TrainTag`, `parseTrainTag` — same as the canonical resource-service module.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure re-exports; no side effects.
 */

export type { TrainTag } from "../../features/resources/services/train_tag_parser";
export { parseTrainTag } from "../../features/resources/services/train_tag_parser";
