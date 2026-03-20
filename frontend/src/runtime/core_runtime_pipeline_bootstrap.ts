import { initializeCoreRuntimeCapabilities } from "./core_runtime_bootstrap";
import { createRenderPipelineWiring } from "./render_pipeline_wiring";
import { createPlayerAutocompleteWiring } from "./player_autocomplete_wiring";
import { createBoardNavigationBootstrap } from "./board_navigation_bootstrap";

type CoreRuntimeBootstrapDeps = Parameters<typeof initializeCoreRuntimeCapabilities>[0];
type RenderPipelineDeps = Parameters<typeof createRenderPipelineWiring>[0];
type PlayerAutocompleteDeps = Parameters<typeof createPlayerAutocompleteWiring>[0];
type BoardNavigationDeps = Parameters<typeof createBoardNavigationBootstrap>[0];

type CoreRuntimePipelineBootstrapDeps = {
  coreRuntimeDeps: CoreRuntimeBootstrapDeps;
  renderPipelineDeps: Omit<RenderPipelineDeps, "selectionRuntimeCapabilities" | "boardRuntimeCapabilities">;
  playerAutocompleteDeps: Omit<PlayerAutocompleteDeps, "getResourcesCapabilities"> & {
    getResourcesCapabilities: PlayerAutocompleteDeps["getResourcesCapabilities"];
  };
  boardNavigationDeps: Omit<BoardNavigationDeps, "moveLookupCapabilities" | "selectionRuntimeCapabilities">;
};

type CoreRuntimePipelineBootstrapResult = {
  boardRuntimeCapabilities: ReturnType<typeof initializeCoreRuntimeCapabilities>["boardRuntimeCapabilities"];
  runtimeConfigCapabilities: ReturnType<typeof initializeCoreRuntimeCapabilities>["runtimeConfigCapabilities"];
  moveLookupCapabilities: ReturnType<typeof initializeCoreRuntimeCapabilities>["moveLookupCapabilities"];
  selectionRuntimeCapabilities: ReturnType<typeof initializeCoreRuntimeCapabilities>["selectionRuntimeCapabilities"];
  renderPipelineCapabilities: ReturnType<typeof createRenderPipelineWiring>;
  playerAutocompleteCapabilities: ReturnType<typeof createPlayerAutocompleteWiring>;
  boardNavigationCapabilities: ReturnType<typeof createBoardNavigationBootstrap>;
};

export const createCoreRuntimePipelineBootstrap = ({
  coreRuntimeDeps,
  renderPipelineDeps,
  playerAutocompleteDeps,
  boardNavigationDeps,
}: CoreRuntimePipelineBootstrapDeps): CoreRuntimePipelineBootstrapResult => {
  const {
    boardRuntimeCapabilities,
    runtimeConfigCapabilities,
    moveLookupCapabilities,
    selectionRuntimeCapabilities,
  } = initializeCoreRuntimeCapabilities(coreRuntimeDeps);

  const renderPipelineCapabilities = createRenderPipelineWiring({
    ...renderPipelineDeps,
    selectionRuntimeCapabilities,
    boardRuntimeCapabilities: {
      buildGameAtPly: boardRuntimeCapabilities.buildGameAtPly,
      renderBoard: (game: unknown): void => {
        boardRuntimeCapabilities.renderBoard(game as Parameters<typeof boardRuntimeCapabilities.renderBoard>[0]);
      },
    },
  });

  const playerAutocompleteCapabilities = createPlayerAutocompleteWiring({
    ...playerAutocompleteDeps,
    getResourcesCapabilities: playerAutocompleteDeps.getResourcesCapabilities,
  });

  const boardNavigationCapabilities = createBoardNavigationBootstrap({
    ...boardNavigationDeps,
    moveLookupCapabilities,
    selectionRuntimeCapabilities,
  });

  return {
    boardRuntimeCapabilities,
    runtimeConfigCapabilities,
    moveLookupCapabilities,
    selectionRuntimeCapabilities,
    renderPipelineCapabilities,
    playerAutocompleteCapabilities,
    boardNavigationCapabilities,
  };
};
