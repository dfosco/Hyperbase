import { o as isHideMode, e as getAllShadows, g as getAllParams } from "./hideMode-DxxH-PW9.js";
import { s as subscribeToHash } from "./hashSubscribe-Bi9R_rI0.js";
import { s as subscribeToStorage } from "./localStorage-DulkrQ4k.js";
import { syncFlagBodyClasses } from "../core-3.js";
const PREFIX = "sb-";
const FLOW_PREFIX = "sb-scene--";
function sanitize(str) {
  return String(str).toLowerCase().replace(/[.\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function overrideClass(key, value) {
  return `${PREFIX}${sanitize(key)}--${sanitize(value)}`;
}
function getCurrentOverrideClasses() {
  const classes = /* @__PURE__ */ new Set();
  for (const cls of document.body.classList) {
    if (cls.startsWith(PREFIX) && cls.includes("--") && !cls.startsWith(FLOW_PREFIX)) {
      classes.add(cls);
    }
  }
  return classes;
}
function syncOverrideClasses() {
  const overrides = isHideMode() ? getAllShadows() : getAllParams();
  const desired = /* @__PURE__ */ new Set();
  for (const [key, value] of Object.entries(overrides)) {
    if (key && value != null && value !== "") {
      desired.add(overrideClass(key, value));
    }
  }
  const current = getCurrentOverrideClasses();
  for (const cls of current) {
    if (!desired.has(cls)) {
      document.body.classList.remove(cls);
    }
  }
  for (const cls of desired) {
    if (!current.has(cls)) {
      document.body.classList.add(cls);
    }
  }
}
function setFlowClass(name) {
  for (const cls of [...document.body.classList]) {
    if (cls.startsWith(FLOW_PREFIX)) {
      document.body.classList.remove(cls);
    }
  }
  if (name) {
    document.body.classList.add(`${FLOW_PREFIX}${sanitize(name)}`);
  }
}
const setSceneClass = setFlowClass;
function installBodyClassSync() {
  syncOverrideClasses();
  syncFlagBodyClasses();
  const sync = () => {
    syncOverrideClasses();
    syncFlagBodyClasses();
  };
  const unsubHash = subscribeToHash(sync);
  const unsubStorage = subscribeToStorage(sync);
  return () => {
    unsubHash();
    unsubStorage();
  };
}
export {
  setSceneClass as a,
  syncOverrideClasses as b,
  installBodyClassSync as i,
  setFlowClass as s
};
