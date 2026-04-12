# `features`

This package contains the canonical user-facing feature modules of the frontend.

Current feature packages:

- `analysis/`
- `editor/`
- `guide/`
- `resources/`
- `sessions/`
- `settings/`
- `training/`

Each feature should own its own components, hooks, services, and feature-local models where practical. Reach into `components/`, `resources/`, `training/`, or `runtime/` only when you are using shared infrastructure rather than feature-owned behavior.
