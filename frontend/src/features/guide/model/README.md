# `features/guide/model`

Guide feature metadata (future onboarding/help flows).

Stable DOM landmarks for the developer inspector live in `core/model/ui_ids.ts` (`UI_IDS`, single registry). Import `UI_IDS` there rather than duplicating string tables in this package.

Use this package when guide-specific model types or helpers are added that are not shared app-wide.
