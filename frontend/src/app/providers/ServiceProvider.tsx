import { createContext, useContext } from "react";
import type { ReactNode, ReactElement } from "react";
import type { PlayerRecord } from "../shell/model/app_state";
import type { AppStartupServices } from "../../core/contracts/app_services";

const noop = (): void => {};

const defaultServices: AppStartupServices = {
  gotoFirst: noop,
  gotoPrev: noop,
  gotoNext: noop,
  gotoLast: noop,
  gotoMoveById: noop,
  handleEditorArrowHotkey: (): boolean => false,
  loadPgnText: noop,
  applyDeveloperDockRawPgn: (): boolean => false,
  insertComment: (): null => null,
  focusCommentAroundMove: noop,
  saveCommentText: noop,
  applyDefaultIndent: noop,
  saveBoardShapes: noop,
  updateGameInfoHeader: noop,
  toggleMoveNag: noop,
  applyPgnModelEdit: noop,
  undo: noop,
  redo: noop,
  openGameFromRef: noop,
  openResource: noop,
  openResourceFile: noop,
  openResourceDirectory: noop,
  createResource: noop,
  openPgnText: noop,
  exportWebviewStorage: noop,
  importWebviewStorage: noop,
  openGameFromRecordId: async (): Promise<void> => {},
  fetchGameMetadataByRecordId: async (): Promise<Record<string, string> | null> => null,
  getActiveSessionResourceRef: (): null => null,
  reorderGameInResource: async () => {},
  searchByPosition: async () => [],
  searchByText: async () => [],
  explorePosition: async () => [],
  flipBoard: noop,
  switchSession: noop,
  closeSession: noop,
  openCurriculumPanel: noop,
  setMenuOpen: noop,
  openEditorStyleDialog: noop,
  openDefaultLayoutDialog: noop,
  setDevDockOpen: noop,
  setActiveDevTab: noop,
  setLayoutMode: noop,
  setShowEvalPills: noop,
  setLocale: noop,
  setMoveDelayMs: noop,
  setSoundEnabled: noop,
  setPositionPreviewOnHover: noop,
  setDeveloperToolsEnabled: noop,
  setShapePrefs: noop,
  setEditorStylePrefs: noop,
  setDefaultLayoutPrefs: noop,
  setSaveMode: noop,
  saveActiveGameNow: noop,
  saveSessionById: noop,
  getPlayerNameSuggestions: (): string[] => [],
  getPlayers: (): PlayerRecord[] => [],
  addPlayer: async (): Promise<void> => {},
  deletePlayer: async (): Promise<void> => {},
  updatePlayer: async (): Promise<void> => {},
};

export const ServiceContext = createContext<AppStartupServices>(defaultServices);

export const useServiceContext = (): AppStartupServices => useContext(ServiceContext);

export const ServiceContextProvider = ({
  value,
  children,
}: {
  value: AppStartupServices;
  children: ReactNode;
}): ReactElement => (
  <ServiceContext.Provider value={value}>{children as ReactElement}</ServiceContext.Provider>
);
