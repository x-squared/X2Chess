import {
  useRef,
  useEffect,
  type ReactElement,
  type FormEvent,
  type RefObject,
} from "react";
import type { TabState } from "../resources_viewer/viewer_utils";

// ── Metadata catalog builder ──────────────────────────────────────────────────

type CatalogEntry = { key: string; label: string };

const buildMetadataCatalog = (tab: TabState): CatalogEntry[] => {
  const builtins: string[] = ["identifier", "source", "revision"];
  const builtinSet = new Set<string>(builtins);
  const dynamic = new Set<string>();
  tab.availableMetadataKeys.forEach((k: string): void => { dynamic.add(k); });
  tab.rows.forEach((row): void => {
    if (row.metadata) Object.keys(row.metadata).forEach((k: string): void => { dynamic.add(k); });
  });
  const catalog: CatalogEntry[] = builtins.map(
    (k: string): CatalogEntry => ({ key: k, label: k }),
  );
  [...dynamic]
    .filter((k: string): boolean => Boolean(k) && k !== "game" && !builtinSet.has(k))
    .sort((a: string, b: string): number => a.localeCompare(b))
    .forEach((k: string): void => { catalog.push({ key: k, label: k }); });
  return catalog;
};

// ── Props ─────────────────────────────────────────────────────────────────────

type ResourceMetadataDialogProps = {
  isOpen: boolean;
  /** Incremented each open so the form remounts with fresh defaultChecked values. */
  dialogKey: number;
  activeTab: TabState | null;
  dialogFormId: string;
  t: (key: string, fallback?: string) => string;
  onSave: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onReset: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/** Modal dialog for selecting visible metadata columns. */
export const ResourceMetadataDialog = ({
  isOpen,
  dialogKey,
  activeTab,
  dialogFormId,
  t,
  onSave,
  onClose,
  onReset,
}: ResourceMetadataDialogProps): ReactElement => {
  const dialogRef: RefObject<HTMLDialogElement> = useRef<HTMLDialogElement>(null);

  // Drive native <dialog> open/close from the isOpen prop.
  useEffect((): void => {
    const dialog: HTMLDialogElement | null = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="resource-metadata-dialog"
      aria-labelledby={`${dialogFormId}-title`}
    >
      <form
        key={dialogKey}
        method="dialog"
        className="resource-metadata-form"
        onSubmit={onSave}
      >
        <p id={`${dialogFormId}-title`} className="resource-metadata-title">
          {t("resources.metadata.title", "Select metadata columns")}
        </p>
        <div className="resource-metadata-fields">
          {activeTab &&
            buildMetadataCatalog(activeTab).map(
              (field: CatalogEntry): ReactElement => (
                <label key={field.key} className="resource-metadata-option">
                  <input
                    type="checkbox"
                    data-meta-key={field.key}
                    defaultChecked={activeTab.visibleMetadataKeys.includes(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              ),
            )}
        </div>
        <label className="resource-metadata-apply-all">
          <input id="rv-meta-apply-all" type="checkbox" />
          {t("resources.metadata.applyAll", "Apply to all resources")}
        </label>
        <div className="resource-metadata-actions">
          <button
            id="btn-resource-metadata-reset"
            type="button"
            onClick={onReset}
          >
            {t("resources.metadata.resetCurrent", "Reset columns for this resource")}
          </button>
          <button type="button" onClick={onClose}>
            {t("resources.metadata.cancel", "Cancel")}
          </button>
          <button type="submit">
            {t("resources.metadata.save", "Apply")}
          </button>
        </div>
      </form>
    </dialog>
  );
};
