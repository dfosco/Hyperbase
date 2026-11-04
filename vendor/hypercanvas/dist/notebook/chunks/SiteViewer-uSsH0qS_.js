import { jsxs, jsx } from "react/jsx-runtime";
import { useParams } from "react-router-dom";
import { u as useThemeState } from "./useThemeState-6KPJA_hY.js";
const sitePublished = "_sitePublished_1s1yq_17";
const sitePoster = "_sitePoster_1s1yq_21";
const productionLink = "_productionLink_1s1yq_22";
const css = {
  sitePublished,
  sitePoster,
  productionLink
};
function SiteViewer({ page: suppliedPage, absoluteAssets = false } = {}) {
  const { siteId = "" } = useParams();
  const pages = window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__?.pages;
  const page = suppliedPage || (Array.isArray(pages) ? pages.find((item) => item.type === "site" && item.siteId === siteId) : null);
  const base = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
  const assetUrl = (asset) => absoluteAssets ? asset : (base.endsWith("/") ? base : base + "/") + String(asset || "").replace(/^\/+/, "");
  const { resolved: theme = "light" } = useThemeState() || {};
  if (!page?.available || !page.productionUrl) {
    const diagnostic = page?.diagnostics?.[0];
    return /* @__PURE__ */ jsxs("main", { className: css.sitePublished, children: [
      /* @__PURE__ */ jsx("h1", { children: page?.title || siteId || "Site" }),
      /* @__PURE__ */ jsx("p", { role: "status", children: "This Site is unavailable in the publication." }),
      diagnostic ? /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("code", { children: diagnostic.code }),
        " ",
        diagnostic.message
      ] }) : null
    ] });
  }
  const poster = page.snapshotVariants?.[theme] || page.snapshot || page.snapshotDark;
  const previewDiagnostics = Array.isArray(page.previewDiagnostics) ? page.previewDiagnostics : [];
  return /* @__PURE__ */ jsxs("main", { className: css.sitePublished, children: [
    /* @__PURE__ */ jsx("h1", { children: page.title || siteId }),
    poster ? /* @__PURE__ */ jsx("a", { className: css.sitePoster, href: page.productionUrl, target: "_blank", rel: "noopener noreferrer", children: /* @__PURE__ */ jsxs("picture", { children: [
      !page.snapshotVariants?.[theme] && page.snapshot && page.snapshotDark ? /* @__PURE__ */ jsx("source", { media: "(prefers-color-scheme: dark)", srcSet: assetUrl(page.snapshotDark) }) : null,
      /* @__PURE__ */ jsx("img", { src: assetUrl(poster), alt: `${page.title || siteId} home page` })
    ] }) }) : null,
    !poster && previewDiagnostics.length ? /* @__PURE__ */ jsx("p", { role: "status", children: previewDiagnostics.map((item) => item?.message).filter(Boolean).join(" ") }) : null,
    /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("a", { className: css.productionLink, href: page.productionUrl, target: "_blank", rel: "noopener noreferrer", children: "Open production site" }) })
  ] });
}
export {
  SiteViewer as default
};
