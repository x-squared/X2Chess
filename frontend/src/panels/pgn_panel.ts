export const setPgnSaveStatus = (saveStatusEl: any, message: any = "", kind: any = ""): any => {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = message;
  saveStatusEl.dataset.kind = kind;
};
