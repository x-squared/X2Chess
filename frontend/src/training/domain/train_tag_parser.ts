/**
 * train_tag_parser — re-exports the canonical `[%train]` parser from
 * `resources_viewer/train_tag_parser` for use within the training domain.
 *
 * Integration API:
 * - `TrainTag`, `parseTrainTag` — same as the resources_viewer module.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure re-exports; no side effects.
 */

export type { TrainTag } from "../../resources_viewer/train_tag_parser";
export { parseTrainTag } from "../../resources_viewer/train_tag_parser";
