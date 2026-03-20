import type { ReactElement } from "react";
import { BoardPanel } from "./BoardPanel";
import { DevDock } from "./DevDock";
import { EditorPanel } from "./EditorPanel";
import { GameSessionsPanel } from "./GameSessionsPanel";
import { RuntimeHost } from "./RuntimeHost";
import { MenuPanel } from "./MenuPanel";
import { ResourceViewer } from "./ResourceViewer";

/**
 * Root React app-shell component.
 *
 * Migration step:
 * - React owns high-level shell composition and the runtime mount host.
 * - Runtime startup still drives live UI while each boundary migrates to React.
 */
export const AppShell = (): ReactElement => (
  <>
    <MenuPanel />
    <DevDock />
    <GameSessionsPanel />
    <BoardPanel />
    <EditorPanel />
    <ResourceViewer />
    <RuntimeHost />
  </>
);
