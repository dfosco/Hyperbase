import { useSyncExternalStore } from "react";
import { themeState, themeSyncState } from "../core-9.js";
function subscribeTheme(cb) {
  return themeState.subscribe(cb);
}
let _themeSnapshot = null;
themeState.subscribe((s) => {
  _themeSnapshot = s;
});
function getThemeSnapshot() {
  return _themeSnapshot;
}
function useThemeState() {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
}
function subscribeSyncTargets(cb) {
  return themeSyncState.subscribe(cb);
}
let _syncSnapshot = null;
themeSyncState.subscribe((s) => {
  _syncSnapshot = s;
});
function getSyncSnapshot() {
  return _syncSnapshot;
}
function useThemeSyncTargets() {
  return useSyncExternalStore(subscribeSyncTargets, getSyncSnapshot, getSyncSnapshot);
}
export {
  useThemeSyncTargets as a,
  useThemeState as u
};
