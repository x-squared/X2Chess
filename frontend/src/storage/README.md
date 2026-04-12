# `storage`

Generic frontend storage helpers.

Important files:

- `versioned_store.ts`: versioned localStorage wrapper with migration support.
- `migrate_local_storage.ts`: startup migration from older storage layouts.
- `index.ts`: public export surface.

Use this package for storage primitives and migrations, not for feature-specific preference schemas.

Storage primitives for browser-side persistence.

Contains reusable persistence helpers such as versioned local-storage wrappers. Feature packages may build on these primitives, but schema-specific persistence should stay near the owning feature.
