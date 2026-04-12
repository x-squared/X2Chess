# `app`

`app/` is the frontend composition root. It is the first package to read when you want to understand how the React application starts and how the major subsystems are wired together.

Important subdirectories:

- `main.tsx`: loads global CSS, initializes logging, installs global error handlers, and mounts React.
- `App.tsx`: top-level app component.
- `providers/`: React context providers such as `AppProvider` and `ServiceProvider`.
- `startup/`: startup lifecycle logic, mainly `useAppStartup.ts`, which constructs services and hydrates state.
- `shell/`: the top-level application shell and shell-specific UI/helpers.
- `hooks/`: app-wide hooks such as translation and update checks.
- `i18n/`: translation bundle loading and translator construction.

Code belongs here when it wires together features or owns app-wide bootstrap concerns. Feature business logic should stay in `features/`, and runtime transport details should stay in `platform/`.
