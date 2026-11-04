const NOTEBOOK_VIEW_PARAMS = ["hideUI", "removeUI", "showTools"];
const DEFAULT_NOTEBOOK_BROWSER_LINK = Object.freeze({
  mode: "hidden",
  showTools: false
});
function normalizeNotebookBrowserLinkOptions(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    mode: input.mode === "visible" || input.mode === "hidden" || input.mode === "removed" ? input.mode : DEFAULT_NOTEBOOK_BROWSER_LINK.mode,
    showTools: typeof input.showTools === "boolean" ? input.showTools : DEFAULT_NOTEBOOK_BROWSER_LINK.showTools
  };
}
function resolveNotebookView(search = "") {
  const params = new URLSearchParams(search);
  const embed = params.has("_sb_embed");
  const mode = params.has("removeUI") ? "removed" : params.has("hideUI") ? "hidden" : "visible";
  const showTools = params.has("showTools");
  return {
    mode,
    embed,
    showTools,
    notebookVisible: !embed && mode === "visible",
    commandToolbarVisible: !embed && (mode === "visible" || showTools),
    toolPanelsAvailable: !embed && (mode !== "removed" || showTools),
    paletteAvailable: !embed && mode !== "removed",
    recoveryAvailable: !embed && mode !== "removed",
    canvasControlsVisible: !embed
  };
}
function stripNotebookViewParams(params) {
  for (const name of NOTEBOOK_VIEW_PARAMS) params.delete(name);
}
export {
  DEFAULT_NOTEBOOK_BROWSER_LINK as D,
  normalizeNotebookBrowserLinkOptions as n,
  resolveNotebookView as r,
  stripNotebookViewParams as s
};
