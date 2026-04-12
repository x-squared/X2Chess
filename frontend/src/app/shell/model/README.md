# `app/shell/model`

This package contains small shell-level definitions that are shared between startup, shell UI, and services without pulling in React components.

Important files:

- `app_state.ts`: exports `DEFAULT_LOCALE`, `DEFAULT_APP_MODE`, `DEFAULT_RESOURCE_VIEWER_HEIGHT_PX`, `DEFAULT_BOARD_COLUMN_WIDTH_PX`, and the `PlayerRecord` type.

Use this package for small shell-wide constants and simple shared types. Do not move editor parsing or resource logic here; those belong in their feature or infrastructure packages.
