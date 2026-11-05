const LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SITE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
function normalizeSiteId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  if (!SITE_ID_RE.test(id)) throw new Error("Site ID must be lowercase alphanumeric with dashes");
  return id;
}
function normalizeSiteUrl(value, { loopbackOnly = false, label = "site URL" } = {}) {
  if (!value) throw new Error(`Missing required ${label}`);
  const url = new URL(String(value));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Site URL must use HTTP or HTTPS");
  if (loopbackOnly && !LOOPBACK_HOSTS.has(url.hostname)) throw new Error("Development Site URL must use localhost, 127.0.0.1, or ::1");
  if (url.username || url.password || url.search || url.hash) throw new Error("Site URL must not contain credentials, query, or hash");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}
function normalizeSiteRoute(value = "") {
  const raw = String(value ?? "").trim().replace(/^\/+/, "");
  if (!raw) return "";
  const base = new URL("https://site.invalid/_route_/");
  const resolved = new URL(raw, base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) throw new Error("Site route must stay inside its configured base URL");
  return `${resolved.pathname.slice(base.pathname.length)}${resolved.search}${resolved.hash}`;
}
function resolveSiteUrl(baseUrl, siteId, route = "") {
  const id = normalizeSiteId(siteId);
  const base = new URL(normalizeSiteUrl(baseUrl));
  const segments = base.pathname.split("/").filter(Boolean);
  if (segments.at(-1)?.toLowerCase() !== id) segments.push(id);
  const siteBase = new URL(`${segments.join("/")}/`, `${base.origin}/`);
  return new URL(normalizeSiteRoute(route) || ".", siteBase).href;
}
function sitePreviewPath(basePath, siteId, route = "") {
  const base = `/${String(basePath || "/").split("/").filter(Boolean).join("/")}`;
  const prefix = base === "/" ? "" : base;
  const id = encodeURIComponent(normalizeSiteId(siteId));
  const normalizedRoute = normalizeSiteRoute(route);
  return `${prefix}/_hypercanvas/site/${id}/preview${normalizedRoute ? `/${normalizedRoute}` : "/"}`;
}
function siteRouteFromPreviewUrl(value, siteId, { basePath = "", origin = null } = {}) {
  try {
    const url = new URL(String(value), origin || "http://hypercanvas.local");
    if (origin && url.origin !== new URL(origin).origin) return null;
    const id = encodeURIComponent(normalizeSiteId(siteId));
    const prefix = `/_hypercanvas/site/${id}/preview`;
    const pathname = withoutBranchPrefix(url.pathname, basePath).pathname;
    if (pathname === prefix) return normalizeSiteRoute(`${url.search}${url.hash}`);
    if (pathname.startsWith(`${prefix}/`)) {
      return normalizeSiteRoute(`${pathname.slice(prefix.length + 1)}${url.search}${url.hash}`);
    }
    return normalizeSiteRoute(`${pathname.replace(/^\/+/, "")}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}
function withoutBranchPrefix(pathname, basePath = "") {
  const normalizedBase = String(basePath || "").replace(/\/+$/, "");
  if (normalizedBase && (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`))) {
    return { pathname: pathname.slice(normalizedBase.length) || "/", prefixPath: normalizedBase };
  }
  const branch = pathname.match(/^\/(branch--[^/]+)(?=\/|$)/);
  if (branch) return { pathname: pathname.slice(branch[0].length) || "/", prefixPath: `/${branch[1]}` };
  return { pathname, prefixPath: "" };
}
export {
  normalizeSiteRoute as a,
  normalizeSiteUrl as b,
  sitePreviewPath as c,
  normalizeSiteId as n,
  resolveSiteUrl as r,
  siteRouteFromPreviewUrl as s
};
