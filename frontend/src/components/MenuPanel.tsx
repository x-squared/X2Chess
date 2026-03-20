import type { ReactElement } from "react";
import { useAppContext } from "../state/app_context";
import { selectLocale } from "../state/selectors";
import { useShellRuntime } from "../hooks/useShellRuntime";

/**
 * React menu panel boundary (Slice 2 in progress).
 */
export const MenuPanel = (): ReactElement => {
  useShellRuntime();
  const { state } = useAppContext();
  const locale: string = selectLocale(state);

  return (
    <section
      data-react-slice="menu-panel"
      data-locale={locale}
      data-developer-tools={state.isDeveloperToolsEnabled ? "true" : "false"}
      hidden
    />
  );
};
