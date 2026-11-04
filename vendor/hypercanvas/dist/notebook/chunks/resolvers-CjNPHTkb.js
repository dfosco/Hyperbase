import { s as stripNotebookViewParams } from "./notebookView-DgDXRwmz.js";
function publishedFallbackPath(location, isNotebookPublication) {
  const params = new URLSearchParams(location.search);
  const route = params.get("p");
  const base = params.get("b");
  if (route === null || !base?.startsWith("/") || base.startsWith("//")) return null;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${route.replace(/^\/+/, "")}`;
}
function contentFrameUrl({ pathname, search = "", hash = "" }, base = "/", { componentView = false } = {}) {
  const prefix = base.replace(/\/$/, "");
  const params = new URLSearchParams(search);
  stripNotebookViewParams(params);
  params.set("_sb_embed", "");
  if (componentView) params.set("_sb_component_view", "");
  return `${prefix}${pathname.startsWith("/") ? pathname : `/${pathname}`}?${params}${hash}`;
}
function encodedId(id) {
  if (typeof id !== "string" || !id.trim() || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new TypeError("A stable prototype ID is required.");
  }
  return encodeURIComponent(id);
}
function statefullyPrototypeFrameUrl({ pathname, search = "", hash = "" }, base = "/", id) {
  const basePrefix = base.replace(/\/$/, "");
  const publicRoot = `/${encodedId(id)}`;
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (cleanPath !== publicRoot && !cleanPath.startsWith(`${publicRoot}/`)) {
    throw new TypeError(`Prototype route must remain below ${publicRoot}.`);
  }
  const suffix = cleanPath.slice(publicRoot.length);
  const params = new URLSearchParams(search);
  stripNotebookViewParams(params);
  params.set("_sb_embed", "");
  return `${basePrefix}/__notebook/prototypes/${encodedId(id)}${suffix}?${params}${hash}`;
}
function createDocumentResolvers({ artifacts = [], assets = {}, base = "/", mode = "local", baseUrl = globalThis.location?.href } = {}) {
  const resolvedBase = base === "./" && baseUrl ? new URL(baseUrl).pathname.replace(/\/docs\/[^/]*\/?$/, "/") : base;
  const prefix = resolvedBase.endsWith("/") ? resolvedBase : `${resolvedBase}/`;
  const unavailable = (message) => ({ available: false, diagnostics: [{ code: "UNAVAILABLE_DOCUMENT_REFERENCE", message }] });
  return {
    resolveAsset(reference, { basePath = "" } = {}) {
      if (/^https?:\/\//i.test(reference)) return { available: true, url: reference };
      const url = assets[`${basePath}/${reference}`];
      return url ? { available: true, url } : unavailable(`Asset unavailable: ${reference}`);
    },
    resolveArtifact(id, { kind, viewId } = {}) {
      const matches = artifacts.filter((item) => item.id === id);
      if (matches.length !== 1) return unavailable(`Artifact ${id} is ${matches.length ? "ambiguous" : "missing"}.`);
      const artifact = matches[0];
      if (artifact.available === false || (artifact.kind || artifact.type) !== kind) return unavailable(`Artifact ${id} is unavailable or is not a ${kind}.`);
      const candidates = artifact.views || artifact.descriptor?.views;
      const views = Array.isArray(candidates) ? candidates : [];
      const view = viewId === void 0 ? views[0] : views.find((item) => item.id === viewId);
      if (viewId !== void 0 && !view) return unavailable(`View ${viewId} was not found in ${id}.`);
      if (kind === "site") {
        const descriptor = artifact.descriptor || artifact;
        const localBase = descriptor.local?.developmentUrl || artifact.developmentUrl;
        const publishedBase = descriptor.published?.url || artifact.productionUrl;
        const baseUrl2 = mode === "static" ? publishedBase : localBase || publishedBase;
        const join = (value) => {
          try {
            return value ? new URL((view?.path || "/").replace(/^\/+/, ""), value.replace(/\/?$/, "/")).href : null;
          } catch {
            return null;
          }
        };
        const url = mode === "static" ? view?.publishedUrl || join(publishedBase) : view?.localUrl || join(localBase) || view?.publishedUrl || join(baseUrl2);
        if (!/^https?:\/\//i.test(url || "")) return unavailable(`Site ${id} has no ${mode} destination.`);
        const screenshot = view?.screenshot ? assets[`${artifact.folderPath || ""}/${view.screenshot}`] : null;
        return { available: true, url, screenshot };
      }
      if (!artifact.route?.startsWith("/") || artifact.route.startsWith("//")) return unavailable(`Prototype ${id} has no renderable route.`);
      const canonical = new URL(artifact.route, "http://document.invalid");
      if (view?.path) {
        const selected = new URL(view.path, "http://document.invalid");
        canonical.pathname = canonical.pathname.replace(/\/?$/, "/") + selected.pathname.replace(/^\/+/, "");
        const search = new URLSearchParams(canonical.search);
        for (const [key, value] of selected.searchParams) search.set(key, value);
        canonical.search = search.toString();
        if (selected.hash) canonical.hash = selected.hash;
      }
      if (mode === "local" && artifact.runtime?.id === "@dfosco/statefully" && artifact.runtime.version === "0.2.1") {
        return { available: true, url: statefullyPrototypeFrameUrl(canonical, prefix, artifact.id) };
      }
      return { available: true, url: contentFrameUrl({ pathname: `${mode === "local" ? "/prototypes.html" : ""}${canonical.pathname}`, search: canonical.search, hash: canonical.hash }, prefix) };
    }
  };
}
export {
  createDocumentResolvers as c,
  publishedFallbackPath as p
};
