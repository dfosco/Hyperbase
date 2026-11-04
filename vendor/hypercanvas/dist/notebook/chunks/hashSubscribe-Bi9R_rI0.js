function subscribeToHash(callback) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getHashSnapshot() {
  return window.location.hash;
}
export {
  getHashSnapshot as g,
  subscribeToHash as s
};
