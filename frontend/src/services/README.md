# `services`

Small shared service package.

Important files:

- `resource_loader.ts`: singleton-style resource loader service used by dialogs and the resource viewer.

This package is intentionally tiny. Add code here only when it is a truly shared service that does not fit better in `core/services` or a feature package.

Shared service registries and integration helpers.

This package contains frontend-wide service helpers that are not yet feature-scoped, such as resource loading registries. Prefer moving feature-owned services into the corresponding feature package over expanding this directory.
