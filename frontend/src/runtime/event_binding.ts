type BindEventsDeps = {
  bindShellEvents: () => void;
  bindDomEvents: () => void;
  bindGameTabsEvents: () => void;
  bindResourceViewerEvents: () => void;
  bindIngressEvents: () => void;
  boardEl: Element | null;
  boardEditorPaneEl: Element | null;
  syncBoardEditorPaneMaxHeight: (boardEl: Element | null, boardEditorPaneEl: Element | null) => void;
};

export const bindRuntimeEventWiring = ({
  bindShellEvents,
  bindDomEvents,
  bindGameTabsEvents,
  bindResourceViewerEvents,
  bindIngressEvents,
  boardEl,
  boardEditorPaneEl,
  syncBoardEditorPaneMaxHeight,
}: BindEventsDeps): void => {
  bindShellEvents();
  bindDomEvents();
  bindGameTabsEvents();
  bindResourceViewerEvents();
  bindIngressEvents();

  window.addEventListener("resize", (): void => {
    window.requestAnimationFrame((): void => {
      syncBoardEditorPaneMaxHeight(boardEl, boardEditorPaneEl);
    });
  });
};
