import { a as activateHideMode, d as deactivateHideMode } from "./hideMode-DxxH-PW9.js";
function interceptHideParams() {
  const url = new URL(window.location.href);
  if (url.searchParams.has("hide")) {
    activateHideMode();
    return;
  }
  if (url.searchParams.has("show")) {
    deactivateHideMode();
    return;
  }
}
function installHideParamListener() {
  interceptHideParams();
  window.addEventListener("popstate", () => interceptHideParams());
}
let _router = null;
let _base = "";
function setNavigationRouter(router, basename = "") {
  _router = router;
  _base = String(basename || "").replace(/\/+$/, "");
}
function getNavigationRouter() {
  return _router;
}
function canSpaNavigate(url) {
  const router = _router;
  if (!router || typeof window === "undefined") return null;
  let target;
  try {
    target = new URL(url, window.location.origin);
  } catch {
    return null;
  }
  if (target.origin !== window.location.origin) return null;
  let pathname = target.pathname;
  if (_base) {
    if (pathname === _base || pathname.startsWith(_base + "/")) {
      pathname = pathname.slice(_base.length) || "/";
    } else {
      return null;
    }
  }
  return pathname + target.search + target.hash;
}
function sbNavigate(url, opts = {}) {
  if (typeof url !== "string" || !url) return;
  if (opts.forceReload) {
    window.location.href = url;
    return;
  }
  const router = _router;
  const spaPath = canSpaNavigate(url);
  if (spaPath != null && router) {
    router.navigate(spaPath, { replace: !!opts.replace });
    return;
  }
  window.location.href = url;
}
export {
  interceptHideParams as a,
  sbNavigate as b,
  getNavigationRouter as g,
  installHideParamListener as i,
  setNavigationRouter as s
};
