import type { ReactElement } from "react";
import { BoardPanel } from "./BoardPanel";
import { DevDock } from "./DevDock";
import { EditorPanel } from "./EditorPanel";
import { MenuPanel } from "./MenuPanel";
import { GameSessionsPanel } from "./GameSessionsPanel";
import { ResourceViewer } from "./ResourceViewer";
import { useLegacyBootstrap } from "../hooks/useLegacyBootstrap";

/**
 * Root React app-shell component.
 *
 * During migration, legacy runtime remains mounted via `#app` while this tree
 * becomes the long-term composition boundary.
 */
export const AppShell = (): ReactElement => {
  useLegacyBootstrap();

  return (
    <>
      <MenuPanel />
      <DevDock />
      <GameSessionsPanel />
      <BoardPanel />
      <EditorPanel />
      <ResourceViewer />
    </>
  );
};
