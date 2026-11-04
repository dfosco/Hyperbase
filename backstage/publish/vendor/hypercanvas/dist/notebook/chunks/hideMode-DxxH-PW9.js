import { a as getLocal, c as setLocal, r as removeLocal, n as notifyChange } from "./localStorage-DulkrQ4k.js";
function parseHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return new URLSearchParams("");
  if (raw.startsWith("/")) {
    const queryIdx = raw.indexOf("?");
    return new URLSearchParams(queryIdx >= 0 ? raw.slice(queryIdx + 1) : "");
  }
  return new URLSearchParams(raw);
}
function hashPathPrefix() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw.startsWith("/")) return "";
  const queryIdx = raw.indexOf("?");
  return queryIdx >= 0 ? raw.slice(0, queryIdx) : raw;
}
function writeHash(params) {
  const path = hashPathPrefix();
  const query = params.toString();
  if (path && query) window.location.hash = `${path}?${query}`;
  else if (path) window.location.hash = path;
  else window.location.hash = query;
}
function getParam(key) {
  return parseHash().get(key);
}
function setParam(key, value) {
  const params = parseHash();
  params.set(key, String(value));
  writeHash(params);
}
function getAllParams() {
  const params = parseHash();
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}
function removeParam(key) {
  const params = parseHash();
  params.delete(key);
  writeHash(params);
}
const HIDE_FLAG = "__hide__";
const HISTORY_KEY = "historyState";
const CURRENT_KEY = "currentState";
const NEXT_KEY = "nextState";
const MAX_HISTORY = 200;
function isHideMode() {
  return getLocal(HIDE_FLAG) === "1";
}
function activateHideMode() {
  pushSnapshot();
  setLocal(HIDE_FLAG, "1");
  const url = new URL(window.location.href);
  url.searchParams.delete("hide");
  url.hash = "";
  window.history.replaceState(window.history.state, "", url.toString());
}
function deactivateHideMode() {
  const params = getCurrentSnapshot();
  if (params) {
    window.location.hash = "";
    const parsed = new URLSearchParams(params);
    for (const [key, value] of parsed.entries()) {
      setParam(key, value);
    }
  }
  removeLocal(HIDE_FLAG);
  stripSearchParam("show");
}
function currentRoute() {
  return window.location.pathname;
}
function currentParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).toString();
}
function pushSnapshot(paramString, route) {
  const params = paramString !== void 0 ? paramString : currentParams();
  const routePath = route !== void 0 ? route : currentRoute();
  const history = getOverrideHistory();
  const current = getCurrentIndex();
  if (current !== null && history[current]) {
    const [, prevRoute, prevParams] = history[current];
    if (prevRoute === routePath && prevParams === params) return;
  }
  const base = current !== null ? history.slice(0, current + 1) : history;
  const newIndex = base.length;
  const entry = [newIndex, routePath, params];
  const updated = [...base, entry];
  if (updated.length > MAX_HISTORY) {
    const trimmed = updated.slice(updated.length - MAX_HISTORY);
    for (let i = 0; i < trimmed.length; i++) {
      const entry2 = trimmed[i];
      if (entry2) trimmed[i] = [i, entry2[1], entry2[2]];
    }
    setLocal(HISTORY_KEY, JSON.stringify(trimmed));
    setLocal(CURRENT_KEY, String(trimmed.length - 1));
  } else {
    setLocal(HISTORY_KEY, JSON.stringify(updated));
    setLocal(CURRENT_KEY, String(newIndex));
  }
  removeLocal(NEXT_KEY);
}
function undo() {
  const current = getCurrentIndex();
  if (current === null || current <= 0) return null;
  const prevIndex = current - 1;
  const history = getOverrideHistory();
  if (!history[prevIndex]) return null;
  setLocal(NEXT_KEY, String(current));
  setLocal(CURRENT_KEY, String(prevIndex));
  const [, route, params] = history[prevIndex];
  applySnapshot(params);
  return { route, params };
}
function redo() {
  const nextIndex = getNextIndex();
  if (nextIndex === null) return null;
  const history = getOverrideHistory();
  if (!history[nextIndex]) return null;
  const followingIndex = nextIndex + 1;
  if (history[followingIndex]) {
    setLocal(NEXT_KEY, String(followingIndex));
  } else {
    removeLocal(NEXT_KEY);
  }
  setLocal(CURRENT_KEY, String(nextIndex));
  const [, route, params] = history[nextIndex];
  applySnapshot(params);
  return { route, params };
}
function getOverrideHistory() {
  const raw = getLocal(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function getCurrentIndex() {
  const raw = getLocal(CURRENT_KEY);
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}
function getNextIndex() {
  const raw = getLocal(NEXT_KEY);
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}
function getCurrentSnapshot() {
  const current = getCurrentIndex();
  if (current === null) return null;
  const history = getOverrideHistory();
  if (!history[current]) return null;
  return history[current][2];
}
function getCurrentRoute() {
  const current = getCurrentIndex();
  if (current === null) return null;
  const history = getOverrideHistory();
  if (!history[current]) return null;
  return history[current][1];
}
function canUndo() {
  const current = getCurrentIndex();
  return current !== null && current > 0;
}
function canRedo() {
  return getNextIndex() !== null;
}
function getShadow(key) {
  const params = getCurrentSnapshot();
  if (!params) return null;
  return new URLSearchParams(params).get(key);
}
function setShadow(key, value) {
  const params = getCurrentSnapshot() || "";
  const parsed = new URLSearchParams(params);
  parsed.set(key, String(value));
  pushSnapshot(parsed.toString(), getCurrentRoute() || currentRoute());
}
function removeShadow(key) {
  const params = getCurrentSnapshot() || "";
  const parsed = new URLSearchParams(params);
  parsed.delete(key);
  pushSnapshot(parsed.toString(), getCurrentRoute() || currentRoute());
}
function getAllShadows() {
  const params = getCurrentSnapshot();
  if (!params) return {};
  const parsed = new URLSearchParams(params);
  const result = {};
  for (const [key, value] of parsed.entries()) {
    result[key] = value;
  }
  return result;
}
function syncHashToHistory() {
  if (isHideMode()) return;
  const route = currentRoute();
  const params = currentParams();
  const history = getOverrideHistory();
  const current = getCurrentIndex();
  if (!params && !route && history.length === 0) return;
  const matchIndex = history.findIndex(
    ([, r, p]) => r === route && p === params
  );
  if (matchIndex === -1) {
    pushSnapshot(params, route);
    return;
  }
  if (matchIndex === current) return;
  const prevIndex = current !== null ? current - 1 : null;
  const nextIndex = getNextIndex();
  if (prevIndex !== null && matchIndex === prevIndex) {
    setLocal(NEXT_KEY, String(current));
    setLocal(CURRENT_KEY, String(matchIndex));
  } else if (nextIndex !== null && matchIndex === nextIndex) {
    const followingIndex = nextIndex + 1;
    if (history[followingIndex]) {
      setLocal(NEXT_KEY, String(followingIndex));
    } else {
      removeLocal(NEXT_KEY);
    }
    setLocal(CURRENT_KEY, String(matchIndex));
  } else {
    removeLocal(NEXT_KEY);
    setLocal(CURRENT_KEY, String(matchIndex));
    const trimmed = history.slice(0, matchIndex + 1);
    setLocal(HISTORY_KEY, JSON.stringify(trimmed));
  }
  notifyChange();
}
function installHistorySync() {
  if (!isHideMode()) {
    pushSnapshot();
  }
  window.addEventListener("hashchange", () => syncHashToHistory());
  window.addEventListener("popstate", () => syncHashToHistory());
}
function applySnapshot(params) {
  if (isHideMode()) {
    notifyChange();
  } else {
    window.location.hash = params;
  }
}
function stripSearchParam(param) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(param)) return;
  url.searchParams.delete(param);
  window.history.replaceState(window.history.state, "", url.toString());
}
export {
  activateHideMode as a,
  canUndo as b,
  canRedo as c,
  deactivateHideMode as d,
  getAllShadows as e,
  getCurrentIndex as f,
  getAllParams as g,
  getCurrentRoute as h,
  getCurrentSnapshot as i,
  getNextIndex as j,
  getOverrideHistory as k,
  getParam as l,
  getShadow as m,
  installHistorySync as n,
  isHideMode as o,
  pushSnapshot as p,
  removeParam as q,
  redo as r,
  removeShadow as s,
  setParam as t,
  setShadow as u,
  syncHashToHistory as v,
  undo as w
};
