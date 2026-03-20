import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import type { ReactElement } from "react";
import type { AppAction } from "./actions";
import { appReducer, initialAppStoreState, type AppStoreState } from "./app_reducer";

type AppContextValue = {
  state: AppStoreState;
  dispatch: Dispatch<AppAction>;
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [state, dispatch] = useReducer(appReducer, initialAppStoreState);
  const value = useMemo<AppContextValue>((): AppContextValue => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
