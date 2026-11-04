function resolveFrameTheme(override, inheritedTheme, themes = {}) {
  return isSupportedTheme(override, themes) ? override : inheritedTheme;
}
function resolveStoryFrameTheme(search, override, inheritedTheme, themes = {}, systemDark = false) {
  const authored = new URLSearchParams(search || "").get("theme");
  if (authored === "system") return systemDark ? "dark" : "light";
  return resolveFrameTheme(authored, resolveFrameTheme(override, inheritedTheme, themes), themes);
}
function isSupportedTheme(value, themes) {
  return typeof value === "string" && themes !== null && typeof themes === "object" && Object.prototype.hasOwnProperty.call(themes, value);
}
function resolveBasePathAsset(value, basePath = "/") {
  if (typeof value !== "string" || !value) return "";
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value;
  const base = String(basePath || "/");
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${value.replace(/^\/+/, "")}`;
}
export {
  resolveBasePathAsset as a,
  resolveStoryFrameTheme as b,
  resolveFrameTheme as r
};
