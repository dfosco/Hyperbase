const FIGMA_HOST_RE = /^(www\.)?figma\.com$/;
const FIGMA_PATH_RE = /^\/(board|design|proto)\/[A-Za-z0-9]+/;
const STRIP_PARAMS = /* @__PURE__ */ new Set(["t"]);
function isFigmaUrl(url) {
  try {
    const parsed = new URL(url);
    return FIGMA_HOST_RE.test(parsed.hostname) && FIGMA_PATH_RE.test(parsed.pathname);
  } catch {
    return false;
  }
}
function getFigmaType(url) {
  try {
    const parsed = new URL(url);
    if (!FIGMA_HOST_RE.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(FIGMA_PATH_RE);
    if (!match) return null;
    return match[1];
  } catch {
    return null;
  }
}
function toFigmaEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    if (!FIGMA_HOST_RE.test(parsed.hostname)) return url;
    parsed.hostname = "embed.figma.com";
    for (const key of STRIP_PARAMS) {
      parsed.searchParams.delete(key);
    }
    parsed.searchParams.set("embed-host", "share");
    return parsed.toString();
  } catch {
    return url;
  }
}
function getFigmaTitle(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 3) {
      return segments[2].replace(/-/g, " ");
    }
    return "Figma";
  } catch {
    return "Figma";
  }
}
export {
  getFigmaType as a,
  getFigmaTitle as g,
  isFigmaUrl as i,
  toFigmaEmbedUrl as t
};
