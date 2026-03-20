export const setPgnSaveStatus = (saveStatusEl, message = "", kind = "") => {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = message;
  saveStatusEl.dataset.kind = kind;
};
