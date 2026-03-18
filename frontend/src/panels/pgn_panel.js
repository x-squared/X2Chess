export const setPgnSaveStatus = (saveStatusEl, message = "", kind = "") => {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = message;
  saveStatusEl.dataset.kind = kind;
};

export const renderPgnGameSelect = ({
  gameSelect,
  files = [],
  selectedFile = "",
  t,
}) => {
  if (!gameSelect) return;
  gameSelect.innerHTML = "";
  const manualOption = document.createElement("option");
  manualOption.value = "";
  manualOption.textContent = t
    ? t("pgn.source.placeholder", "Manual / unsaved")
    : "Manual / unsaved";
  gameSelect.appendChild(manualOption);
  files.forEach((fileName) => {
    const option = document.createElement("option");
    option.value = fileName;
    option.textContent = fileName;
    gameSelect.appendChild(option);
  });
  gameSelect.value = selectedFile || "";
};
