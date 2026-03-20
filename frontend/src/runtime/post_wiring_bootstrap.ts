import { createGameTabsBootstrap } from "./game_tabs_bootstrap";
import { createIngressBootstrap } from "./ingress_bootstrap";

type GameTabsDeps = Parameters<typeof createGameTabsBootstrap>[0];
type IngressDeps = Parameters<typeof createIngressBootstrap>[0];

type PostWiringBootstrapDeps = {
  gameTabsDeps: GameTabsDeps;
  ingressDeps: IngressDeps;
};

type PostWiringBootstrapResult = {
  gameTabsUi: ReturnType<typeof createGameTabsBootstrap>;
  ingressHandlers: ReturnType<typeof createIngressBootstrap>;
};

export const createPostWiringBootstrap = ({
  gameTabsDeps,
  ingressDeps,
}: PostWiringBootstrapDeps): PostWiringBootstrapResult => {
  const gameTabsUi = createGameTabsBootstrap(gameTabsDeps);
  const ingressHandlers = createIngressBootstrap(ingressDeps);
  return {
    gameTabsUi,
    ingressHandlers,
  };
};
