import { jsx, jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useLocation, Outlet, Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import "virtual:storyboard-data-index";
import { catalog, prototypes } from "virtual:hypercanvas-portable-notebook";
import { PROTOTYPE_MODALS, PROTOTYPE_ROUTES, PROTOTYPE_STATEFULLY_ROUTES, PROTOTYPE_EXTERNAL_ROUTES } from "virtual:hypercanvas-notebook-routes";
import { p as publishedFallbackPath, c as createDocumentResolvers } from "./chunks/resolvers-CjNPHTkb.js";
import { generateModalRoutes, generateRegularRoutes, patterns } from "@generouted/react-router/core";
import FlowProvider from "./context.js";
import { s as setNavigationRouter } from "./chunks/sbNavigate-B3XfDwJj.js";
import { installHashPreserver } from "./hash-preserver.js";
const ARTIFACT_ROOT = /(^|\/)([^/]+\.prototype)(?=\/|$)/g;
function artifactRootNames(keys) {
  const names = /* @__PURE__ */ new Set();
  for (const key of keys) {
    for (const match of key.matchAll(ARTIFACT_ROOT)) names.add(match[2]);
  }
  return names;
}
function protectArtifactRoots(value, replacements) {
  return value.replace(ARTIFACT_ROOT, (_match, prefix, root) => `${prefix}${replacements.get(root)}`);
}
function routeRootReplacements(keys) {
  const names = artifactRootNames(keys);
  let prefix = "HypercanvasLiteralPrototypeRoot";
  while ([...keys].some((key) => key.includes(prefix))) prefix += "X";
  return new Map([...names].map((name, index) => [name, `${prefix}${index}Token`]));
}
function restoreArtifactRoots(value, replacements) {
  if (typeof value !== "string") return value;
  for (const [name, token] of replacements) value = value.replaceAll(token, name);
  return value;
}
function restoreRoute(route, replacements) {
  if (typeof route.path === "string") route.path = restoreArtifactRoots(route.path, replacements);
  if (typeof route.id === "string") route.id = restoreArtifactRoots(route.id, replacements);
  if (route.children) route.children.forEach((child) => restoreRoute(child, replacements));
  return route;
}
function compileRegularRoutes(files, buildRoute) {
  const originalKeys = /* @__PURE__ */ new Map();
  const replacements = routeRootReplacements(Object.keys(files));
  const protectedFiles = Object.fromEntries(Object.entries(files).map(([key, module]) => {
    const protectedKey = protectArtifactRoots(key, replacements);
    originalKeys.set(protectedKey, key);
    return [protectedKey, module];
  }));
  const routes = generateRegularRoutes(protectedFiles, (module, key) => buildRoute(module, originalKeys.get(key) ?? restoreArtifactRoots(key, replacements)));
  return routes.map((route) => restoreRoute(route, replacements));
}
function compileModalRoutes(files) {
  const replacements = routeRootReplacements(Object.keys(files));
  const protectedFiles = Object.fromEntries(
    Object.entries(files).map(([key, module]) => [protectArtifactRoots(key, replacements), module])
  );
  return Object.fromEntries(
    Object.entries(generateModalRoutes(protectedFiles)).map(([key, value]) => [restoreArtifactRoots(key, replacements), value])
  );
}
patterns.route = [new RegExp("^.*\\/src\\/(library|prototypes)\\/|^\\/(library|prototypes)\\/|[^/]*\\.folder\\/|(?<=^|\\/)drafts\\/|\\.(jsx|tsx|mdx)$", "g"), ""];
const Wrapper = lazy(() => import("virtual:hypercanvas-prototype-wrapper"));
const modalRoutes = compileModalRoutes(Object.fromEntries(Object.entries(PROTOTYPE_MODALS).map(([key, load]) => [key, { default: lazy(load) }])));
const EmptyModal = () => null;
function PrototypeLayout() {
  const Modal = modalRoutes[useLocation().state?.modal] || EmptyModal;
  return /* @__PURE__ */ jsx(FlowProvider, { children: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("p", { role: "status", children: "Loading prototype…" }), children: /* @__PURE__ */ jsxs(Wrapper, { children: [
    /* @__PURE__ */ jsx(Outlet, {}),
    /* @__PURE__ */ jsx(Modal, {})
  ] }) }) });
}
function legacyPrototypeRoutes() {
  return [{ Component: PrototypeLayout, children: compileRegularRoutes(PROTOTYPE_ROUTES, (load, key) => ({
    .../index\.(jsx|tsx|mdx)$/.test(key) ? { index: true } : {},
    lazy: async () => {
      const module = await load();
      return { Component: module.default, loader: module.Loader, action: module.Action, ...module.Catch ? { ErrorBoundary: module.Catch } : {} };
    }
  })) }];
}
const frame = "_frame_1ckvp_1";
const css = {
  frame
};
const NotebookViewer = lazy(() => import("./chunks/NotebookViewer-DAs8-IvG.js"));
const CanvasViewer = lazy(() => import("./chunks/CanvasViewer-CJVHKzkc.js"));
const DocPage = lazy(() => import("./doc-page.js"));
const SiteViewer = lazy(() => import("./chunks/SiteViewer-uSsH0qS_.js"));
function PrototypeFrame({ prototype }) {
  const location = useLocation();
  const entry = prototypes.find((item) => item.id === prototype.artifactId);
  if (!prototype.available || prototype.routeConflict || !entry?.href) return /* @__PURE__ */ jsx("p", { role: "status", children: prototype.diagnostics?.[0]?.message || "Prototype unavailable." });
  const suffix = location.pathname.slice(prototype.route.length).replace(/^\/+/, "");
  return /* @__PURE__ */ jsx("iframe", { className: css.frame, title: prototype.title || prototype.artifactId, src: `${entry.href}${suffix}${location.search}${location.hash}` });
}
const loadDocuments = () => import("virtual:hypercanvas-documents");
function PortableSite({ artifact }) {
  const [page, setPage] = useState(null);
  useEffect(() => {
    let live = true;
    loadDocuments().then((documents) => {
      const data = documents.getDocumentSnapshot();
      const result = createDocumentResolvers({ ...data, mode: "static", base: globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ }).resolveArtifact(artifact.id, { kind: "site" });
      if (live) setPage({ title: artifact.title, available: result.available, productionUrl: result.url, snapshot: result.screenshot });
    });
    return () => {
      live = false;
    };
  }, [artifact.id, artifact.title]);
  if (!page) return /* @__PURE__ */ jsx("p", { role: "status", children: "Loading Site…" });
  return /* @__PURE__ */ jsx(SiteViewer, { page, absoluteAssets: true });
}
function Missing() {
  return /* @__PURE__ */ jsx("p", { role: "status", children: "This page is unavailable in this Notebook." });
}
function mountNotebook(element, { isolated = false, basePath, preview } = {}) {
  if (basePath !== void 0) globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ = new URL(basePath, document.baseURI).pathname;
  if (preview !== void 0) {
    globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__ = preview;
    globalThis.__HYPERCANVAS_NOTEBOOK_PRODUCTION__ = !preview;
  }
  window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ = catalog;
  const fallback = publishedFallbackPath(window.location);
  if (fallback) window.history.replaceState(null, "", fallback);
  const pages = catalog.pages || [];
  const routes = [
    { path: "docs/:docId", Component: DocPage },
    ...pages.filter((page) => page.type === "canvas" && page.route).map((page) => ({ path: page.route.slice(1), element: /* @__PURE__ */ jsx(CanvasViewer, { id: page.id }) })),
    ...pages.filter((page) => page.type === "site" && !catalog.artifacts?.some((item) => item.id === page.id && item.portable)).map((page) => ({ path: page.route?.slice(1) || `sites/${encodeURIComponent(page.siteId)}`, element: /* @__PURE__ */ jsx(SiteViewer, { page }) })),
    ...(catalog.artifacts || []).filter((item) => item.kind === "site" && item.portable && item.route).map((artifact) => ({ path: artifact.route.slice(1), element: /* @__PURE__ */ jsx(PortableSite, { artifact }) })),
    ...PROTOTYPE_STATEFULLY_ROUTES.map((prototype) => ({ path: `${prototype.route.slice(1)}/*`, element: /* @__PURE__ */ jsx(PrototypeFrame, { prototype }) })),
    ...PROTOTYPE_EXTERNAL_ROUTES.map((prototype) => ({ path: `${prototype.route.slice(1)}/*`, element: /* @__PURE__ */ jsx("iframe", { className: css.frame, src: prototype.url, title: prototype.title }) })),
    ...legacyPrototypeRoutes(),
    { index: true, element: pages.find((page) => page.route && page.available !== false) ? /* @__PURE__ */ jsx(Navigate, { replace: true, to: pages.find((page) => page.route && page.available !== false).route }) : /* @__PURE__ */ jsx(Missing, {}) },
    { path: "*", Component: Missing }
  ];
  const base = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
  const router = createBrowserRouter(isolated ? routes : [{ element: /* @__PURE__ */ jsx(NotebookViewer, { catalog }), children: routes }], { basename: `${base.replace(/\/$/, "")}${isolated ? "/prototypes.html" : ""}` || "/" });
  setNavigationRouter(router, base.replace(/\/$/, ""));
  installHashPreserver(router, base);
  createRoot(element).render(/* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("p", { role: "status", children: "Loading Notebook…" }), children: /* @__PURE__ */ jsx(RouterProvider, { router }) }));
  return router;
}
export {
  mountNotebook
};
