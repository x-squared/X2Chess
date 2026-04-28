# `components/dialogs`

Reusable dialogs that are shared across shell and features.

Important files:

- `NewGameDialog.tsx`: create a new game with headers/start-position setup.
- `GamePickerDialog.tsx`: choose a game from a resource.
- `EditStartPositionDialog.tsx`, `AnnotateGameDialog.tsx`, `PlayVsEngineDialog.tsx`
- shared dialog CSS such as `dialog.css`, `new_game_dialog.css`, and `game_picker_dialog.css`

These dialogs stay here because they are shared UI shells. Feature-specific state and parsing logic should remain in feature packages and be passed in via props.

Application dialog components.

Holds dialogs reused across multiple features or not yet fully migrated to a feature package. Prefer feature ownership for domain-specific dialogs and `ui/dialogs` for generic primitives.
