const __vite_import_meta_env__ = { "BASE_URL": globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ };
const LOCAL_PREFIX = "__notebook/prototypes/";
function normalizeBase(base) {
  if (typeof base !== "string" || !base.startsWith("/") || base.startsWith("//") || /[?#\\]/.test(base)) {
    throw new TypeError("base must be an absolute same-origin path prefix.");
  }
  const segments = base.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) throw new TypeError("base cannot contain traversal segments.");
  return segments.length ? `/${segments.join("/")}/` : "/";
}
function encodeId(id) {
  if (typeof id !== "string" || !id.trim() || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new TypeError("A stable prototype ID is required.");
  }
  return encodeURIComponent(id);
}
function deploymentBase() {
  const environment = __vite_import_meta_env__;
  return normalizeBase(environment?.BASE_URL || "/");
}
function prototypeRouteBasePath(id, { mode = "local", base = "/", baseIsPrototypePrefix = false } = {}) {
  const encodedId = encodeId(id);
  if (mode === "local") return `${deploymentBase()}${LOCAL_PREFIX}${encodedId}`;
  if (mode === "static") {
    const normalized = normalizeBase(base);
    if (baseIsPrototypePrefix) {
      const expectedSuffix = `prototypes/${encodedId}/`;
      if (!normalized.endsWith(expectedSuffix)) throw new TypeError(`base must end with ${expectedSuffix} when baseIsPrototypePrefix is true.`);
      return normalized.replace(/\/$/, "");
    }
    return `${normalized}prototypes/${encodedId}`;
  }
  throw new TypeError('mode must be "local" or "static".');
}
function localPublicBase(basePath) {
  const normalized = basePath.replace(/\/+$/, "");
  const marker = `/${LOCAL_PREFIX}`;
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const deployment = normalized.slice(0, index);
  const id = normalized.slice(index + marker.length);
  if (!id || id.includes("/")) return null;
  return `${deployment}/${id}`;
}
function createPrototypeRouteBinding({ basePath, window: targetWindow = globalThis.window } = {}) {
  if (!targetWindow?.location || !targetWindow?.history) throw new TypeError("A browser Window is required.");
  if (typeof basePath !== "string" || !basePath.startsWith("/") || basePath.startsWith("//")) {
    throw new TypeError("basePath must be an absolute same-origin route prefix.");
  }
  const normalizedBase = basePath.replace(/\/+$/, "") || "/";
  const publicBase = localPublicBase(normalizedBase);
  const listeners = /* @__PURE__ */ new Set();
  let snapshot = readLocation();
  function readLocation() {
    return Object.freeze({
      pathname: targetWindow.location.pathname,
      search: targetWindow.location.search,
      params: Object.freeze({}),
      basePath: normalizedBase
    });
  }
  function publicTarget() {
    if (!publicBase || !targetWindow.location.pathname.startsWith(normalizedBase)) return null;
    const suffix = targetWindow.location.pathname.slice(normalizedBase.length);
    const params = new URLSearchParams(targetWindow.location.search);
    params.delete("_sb_embed");
    const search = params.size ? `?${params}` : "";
    return `${publicBase}${suffix ? suffix.startsWith("/") ? suffix : `/${suffix}` : ""}${search}${targetWindow.location.hash}`;
  }
  function sendParentNavigation(id, replace) {
    if (targetWindow.parent === targetWindow || !publicBase) return;
    const src = publicTarget();
    if (!src) return;
    targetWindow.parent.postMessage({
      type: "storyboard:embed:navigate",
      src: `${targetWindow.location.origin}${src}`,
      ...typeof id === "string" ? { id } : {},
      replace: replace === true
    }, targetWindow.location.origin);
  }
  function publish({ id, replace, notifyParent = true } = {}) {
    snapshot = readLocation();
    for (const listener of listeners) listener();
    if (notifyParent) sendParentNavigation(id, replace);
  }
  function onHostMessage(event) {
    if (event.source !== targetWindow.parent || event.origin !== targetWindow.location.origin) return;
    const data = event.data && typeof event.data === "object" ? event.data : {};
    if (data?.type === "storyboard:embed:hello") {
      targetWindow.parent.postMessage({ type: "storyboard:embed:ready" }, targetWindow.location.origin);
      return;
    }
    if (data?.type !== "storyboard:embed:navigate-request" || typeof data.target !== "string" || !publicBase) return;
    let url;
    try {
      url = new URL(data.target, targetWindow.location.origin);
    } catch {
      return;
    }
    if (url.origin !== targetWindow.location.origin || url.pathname !== publicBase && !url.pathname.startsWith(`${publicBase}/`)) return;
    const suffix = url.pathname.slice(publicBase.length).replace(/^\//, "");
    const localPath = `${normalizedBase}${suffix ? `/${suffix}` : ""}`;
    const next = `${localPath}${url.search}${url.hash}`;
    targetWindow.history[data.replace === true ? "replaceState" : "pushState"]({}, "", next);
    publish({ id: typeof data.id === "string" ? data.id : void 0, replace: data.replace === true, notifyParent: true });
  }
  function subscribe(listener) {
    if (!listeners.size) {
      targetWindow.addEventListener("popstate", onPopState);
      targetWindow.addEventListener("design-notebook:navigate", onDesignNotebookNavigate);
      targetWindow.addEventListener("message", onHostMessage);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) detach();
    };
  }
  function onPopState() {
    publish();
  }
  function onDesignNotebookNavigate() {
    publish();
  }
  function detach() {
    targetWindow.removeEventListener("popstate", onPopState);
    targetWindow.removeEventListener("design-notebook:navigate", onDesignNotebookNavigate);
    targetWindow.removeEventListener("message", onHostMessage);
  }
  function navigate(destination) {
    const url = new URL(destination, targetWindow.location.href);
    if (url.origin !== targetWindow.location.origin) throw new TypeError("Prototype navigation must stay on the current origin.");
    if (normalizedBase !== "/" && url.pathname !== normalizedBase && !url.pathname.startsWith(`${normalizedBase}/`)) {
      throw new TypeError(`Prototype navigation must remain below ${normalizedBase}.`);
    }
    targetWindow.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    publish();
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe,
    navigate,
    dispose() {
      detach();
      listeners.clear();
    }
  });
}
export {
  createPrototypeRouteBinding,
  prototypeRouteBasePath
};
