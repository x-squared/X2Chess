import { buildTextEditorPlan } from "./text_editor_plan";
import { reconcileTextEditor } from "./text_editor_reconcile";

const lastPlanByContainer = new WeakMap();

export const text_editor = {
  render(container, pgnModel, options: Record<string, unknown> = {}) {
    if (!container) return;
    const layoutMode = options.layoutMode === "plain" || options.layoutMode === "text" || options.layoutMode === "tree"
      ? options.layoutMode
      : "plain";
    const nextPlan = buildTextEditorPlan(pgnModel, { layoutMode });
    reconcileTextEditor(container, nextPlan, options);
    lastPlanByContainer.set(container, nextPlan);
  },
  getLastPlan(container) {
    return lastPlanByContainer.get(container) ?? [];
  },
};
