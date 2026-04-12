/**
 * EditStartPositionDialog — allows editing the starting FEN of an existing game.
 *
 * Integration API:
 * - `<EditStartPositionDialog initialFen={...} onSave={...} onClose={...} t={...} />`
 *   Mount when the user requests editing the starting position.
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onSave(fen)` fires with the new validated FEN.
 * - `onClose()` fires on cancel/dismiss.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
} from "react";
import { STANDARD_STARTING_FEN, validateFenStructure, validateKings } from "../../features/editor/model/fen_utils";
import { PositionSetupBoard } from "./NewGameDialog";

type EditStartPositionDialogProps = {
  /** Current starting FEN of the game. */
  initialFen: string;
  t: (key: string, fallback?: string) => string;
  onSave: (fen: string) => void;
  onClose: () => void;
};

/**
 * Modal dialog for editing the starting position FEN of an existing game.
 * Uses the same interactive `PositionSetupBoard` as `NewGameDialog`.
 */
export const EditStartPositionDialog = ({
  initialFen,
  t,
  onSave,
  onClose,
}: EditStartPositionDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fen, setFen] = useState<string>(initialFen || STANDARD_STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const validateFen = useCallback((value: string): string | null => {
    const structResult = validateFenStructure(value);
    if (!structResult.valid) return structResult.error;
    const kingsError = validateKings(value);
    return kingsError;
  }, []);

  const handleFenChange = useCallback((value: string): void => {
    setFen(value);
    setFenError(validateFen(value));
  }, [validateFen]);

  const handleSave = useCallback((): void => {
    const err = validateFen(fen);
    if (err) { setFenError(err); return; }
    dialogRef.current?.close();
    onSave(fen);
  }, [fen, validateFen, onSave]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const handleReset = useCallback((): void => {
    handleFenChange(STANDARD_STARTING_FEN);
  }, [handleFenChange]);

  return (
    <dialog ref={dialogRef} className="edit-start-pos-dialog" onClose={onClose}>
      <div className="edit-start-pos-content">
        <h2 className="edit-start-pos-title">
          {t("editStartPos.title", "Edit Starting Position")}
        </h2>

        <PositionSetupBoard fen={fen} onFenChange={handleFenChange} t={t} />

        <div className="edit-start-pos-fen-row">
          <input
            type="text"
            className={`edit-start-pos-fen-input${fenError ? " edit-start-pos-fen-input--error" : ""}`}
            value={fen}
            onChange={(e): void => { handleFenChange(e.target.value); }}
            aria-label={t("editStartPos.fenLabel", "FEN string")}
            spellCheck={false}
          />
          <button
            type="button"
            className="edit-start-pos-btn-reset"
            onClick={handleReset}
            title={t("editStartPos.reset", "Reset to starting position")}
          >
            {t("editStartPos.resetShort", "Reset")}
          </button>
        </div>
        {fenError && (
          <p className="edit-start-pos-error" role="alert">{fenError}</p>
        )}

        <div className="edit-start-pos-actions">
          <button type="button" className="edit-start-pos-btn-cancel" onClick={handleCancel}>
            {t("editStartPos.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="edit-start-pos-btn-save"
            disabled={!!fenError}
            onClick={handleSave}
          >
            {t("editStartPos.save", "Apply")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
