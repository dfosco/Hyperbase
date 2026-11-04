const __vite_import_meta_env__ = {};
function isNotebookPublication() {
  const publication = globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__;
  return __vite_import_meta_env__?.VITE_NOTEBOOK_PUBLISHED === "1" || publication === true || publication !== null && typeof publication === "object";
}
function canUseNotebookAuthoringTools() {
  return !isNotebookPublication();
}
export {
  canUseNotebookAuthoringTools as c,
  isNotebookPublication as i
};
