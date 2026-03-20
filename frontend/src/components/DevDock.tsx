import type { ReactElement } from "react";
import { useAppContext } from "../state/app_context";
import { selectActiveDevTab, selectDevDockOpen } from "../state/selectors";
import { useShellRuntime } from "../hooks/useShellRuntime";

/**
 * React developer dock boundary (Slice 2 in progress).
 */
export const DevDock = (): ReactElement => {
  useShellRuntime();
  const { state } = useAppContext();
  const isOpen: boolean = selectDevDockOpen(state);
  const activeTab: "ast" | "dom" | "pgn" = selectActiveDevTab(state);

  return (
    <section
      data-react-slice="dev-dock"
      data-open={isOpen ? "true" : "false"}
      data-active-tab={activeTab}
      hidden
    />
  );
};
