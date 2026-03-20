import type { ReactElement } from "react";
import { useEditorRuntime } from "../hooks/useEditorRuntime";

/**
 * React editor panel migration shell.
 */
export const EditorPanel = (): ReactElement => {
  useEditorRuntime();
  return <></>;
};
