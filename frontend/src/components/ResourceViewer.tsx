import type { ReactElement } from "react";
import { useResourceViewer } from "../hooks/useResourceViewer";
import { useAppContext } from "../state/app_context";
import {
  selectActiveResourceErrorMessage,
  selectActiveResourceRowCount,
  selectActiveResourceTabId,
  selectActiveResourceTabKind,
  selectActiveResourceTabLocator,
  selectActiveResourceTabTitle,
  selectResourceTabCount,
} from "../state/selectors";

/**
 * React resource viewer boundary (Slice 6 in progress).
 */
export const ResourceViewer = (): ReactElement => {
  useResourceViewer();
  const { state } = useAppContext();
  const tabCount: number = selectResourceTabCount(state);
  const activeTabId: string | null = selectActiveResourceTabId(state);
  const activeTabTitle: string = selectActiveResourceTabTitle(state);
  const activeTabKind: string = selectActiveResourceTabKind(state);
  const activeTabLocator: string = selectActiveResourceTabLocator(state);
  const activeRowCount: number = selectActiveResourceRowCount(state);
  const activeErrorMessage: string = selectActiveResourceErrorMessage(state);

  return (
    <section
      data-react-slice="resource-viewer"
      data-resource-tab-count={String(tabCount)}
      data-active-resource-tab-id={activeTabId || ""}
      data-active-resource-tab-title={activeTabTitle}
      data-active-resource-tab-kind={activeTabKind}
      data-active-resource-tab-locator={activeTabLocator}
      data-active-resource-row-count={String(activeRowCount)}
      data-active-resource-error={activeErrorMessage}
      hidden
    />
  );
};
