const LEGACY_PREFIX = "storyboard:";
function computePrefix() {
  let branch = "";
  try {
    const base = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
    const m = String(base).match(/\/branch--([a-z0-9._-]+)\/?$/i);
    branch = m?.[1] ?? "";
  } catch {
  }
  let devDomain = "default";
  try {
    const host = typeof window !== "undefined" && window.location?.hostname || "";
    const m = host.match(/^([a-z][a-z0-9-]*)\.localhost$/i);
    const matchedDomain = m?.[1];
    if (matchedDomain) devDomain = matchedDomain.toLowerCase();
  } catch {
  }
  return `storyboard:${devDomain}:${branch}:`;
}
const PREFIX = computePrefix();
let _migrationRan = false;
function runOneShotMigration() {
  if (_migrationRan) return;
  _migrationRan = true;
  try {
    if (typeof localStorage === "undefined") return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const raw = localStorage.key(i);
      if (!raw) continue;
      if (raw.startsWith(LEGACY_PREFIX) && !raw.startsWith(PREFIX)) {
        const tail = raw.slice(LEGACY_PREFIX.length);
        const segments = tail.split(":");
        if (segments.length < 3) {
          toRemove.push(raw);
        }
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
  }
}
runOneShotMigration();
function getLocal(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}
function setLocal(key, value) {
  try {
    localStorage.setItem(PREFIX + key, String(value));
    notifyChange();
  } catch {
  }
}
function removeLocal(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    notifyChange();
  } catch {
  }
}
function getAllLocal() {
  const result = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const raw = localStorage.key(i);
      if (raw && raw.startsWith(PREFIX)) {
        result[raw.slice(PREFIX.length)] = localStorage.getItem(raw);
      }
    }
  } catch {
  }
  return result;
}
function subscribeToStorage(callback) {
  if (typeof window === "undefined") return () => {
  };
  const wrappedCallback = () => {
    invalidateSnapshotCache();
    callback();
  };
  window.addEventListener("storage", wrappedCallback);
  window.addEventListener("storyboard-storage", wrappedCallback);
  return () => {
    window.removeEventListener("storage", wrappedCallback);
    window.removeEventListener("storyboard-storage", wrappedCallback);
  };
}
let _snapshotCache = null;
function invalidateSnapshotCache() {
  _snapshotCache = null;
}
function getStorageSnapshot() {
  if (_snapshotCache !== null) return _snapshotCache;
  try {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const raw = localStorage.key(i);
      if (raw && raw.startsWith(PREFIX)) {
        entries.push(raw + "=" + localStorage.getItem(raw));
      }
    }
    _snapshotCache = entries.sort().join("&");
    return _snapshotCache;
  } catch {
    return "";
  }
}
function notifyChange() {
  invalidateSnapshotCache();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("storyboard-storage"));
}
export {
  getLocal as a,
  getStorageSnapshot as b,
  setLocal as c,
  getAllLocal as g,
  notifyChange as n,
  removeLocal as r,
  subscribeToStorage as s
};
