import { buildTextEditorPlan } from "./text_editor_plan";
import { reconcileTextEditor } from "./text_editor_reconcile";

type LayoutMode = "plain" | "text" | "tree";

type TextEditorOptions = {
  layoutMode?: LayoutMode;
} & Record<string, unknown>;

const lastPlanByContainer: WeakMap<Element, unknown[]> = new WeakMap<Element, unknown[]>();

export const text_editor = {
  render(container: Element | null, pgnModel: unknown, options: TextEditorOptions = {}): void {
    if (!(container instanceof HTMLElement)) return;
    const layoutMode: LayoutMode = options.layoutMode === "plain" || options.layoutMode === "text" || options.layoutMode === "tree"
      ? options.layoutMode
      : "plain";
    const nextPlan: unknown[] = buildTextEditorPlan(pgnModel, { layoutMode }) as unknown[];
    reconcileTextEditor(container, nextPlan as never, options as never);
    lastPlanByContainer.set(container, nextPlan);
  },
  getLastPlan(container: Element | null): unknown[] {
    if (!container) return [];
    return lastPlanByContainer.get(container) ?? [];
  },
};
