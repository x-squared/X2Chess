import { buildTextEditorPlan } from "./text_editor_plan";
import { reconcileTextEditor } from "./text_editor_reconcile";

const lastPlanByContainer = new WeakMap();

export const text_editor = {
  render(container, pgnModel, options = {}) {
    if (!container) return;
    const nextPlan = buildTextEditorPlan(pgnModel);
    reconcileTextEditor(container, nextPlan, options);
    lastPlanByContainer.set(container, nextPlan);
  },
  getLastPlan(container) {
    return lastPlanByContainer.get(container) ?? [];
  },
};
