# `components/badges`

Shared badge components for inline annotation display.

Important files:

- `EvalBadge.tsx`, `QaBadge.tsx`, `TodoBadge.tsx`, `TrainBadge.tsx`, `LinkBadge.tsx`, `AnchorBadge.tsx`
- `annotation_badges.css` for shared badge styling

These badges are rendered by editor and resource views to visualize parsed annotations. Keep parsing logic out of this package; it belongs in `features/resources/services`.

Annotation and state badge components.

This package contains badge UI used heavily by the editor and resource workflows. Keep orchestration out of these components and move truly generic primitives into `ui/badges` as they emerge.
