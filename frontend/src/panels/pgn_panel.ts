export const setPgnSaveStatus = (saveStatusEl: Element | null, message: string = "", kind: string = ""): void => {
  if (!(saveStatusEl instanceof HTMLElement)) return;
  saveStatusEl.textContent = message;
  saveStatusEl.dataset.kind = kind;
};
