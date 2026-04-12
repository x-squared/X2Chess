# `assets`

This package contains visual asset helpers and bundled frontend assets.

Important files:

- `visual_assets.ts`: defines remote and bundled fallback assets, cache behavior, and CSS-variable hydration for visuals loaded at runtime.

Use this package for asset-loading logic and asset definitions. Do not mix it with feature UI state or generic runtime adapters.

Static frontend assets.

Use this package for checked-in visual or bundled runtime assets referenced by the frontend. Keep code and architectural documentation in source packages, not here.
