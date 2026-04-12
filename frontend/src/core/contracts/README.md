# `core/contracts`

This package defines stable contracts that the rest of the frontend uses to talk across package boundaries.

Important files:

- `app_services.ts`: the main app startup/service interface exposed through `ServiceContext`.
- storage and gateway contracts that let `core` depend on capabilities instead of concrete platform APIs.

Add types here when they describe a stable dependency boundary between app/core/features/platform. Do not turn this into a dumping ground for arbitrary shared types.

Application capability contracts.

Defines stable TypeScript interfaces and shared service surface types consumed across `core`, `platform`, and features. Runtime-specific implementation details should stay out of this package.
