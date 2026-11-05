import { j as storyFrameRoute } from "./Document-DbLUnVhy.js";
function storyFrameUrl(story, storyId, props = {}, { theme, componentSet = false } = {}) {
  const route = storyFrameRoute(story, storyId, props, componentSet);
  if (!route) return "";
  const url = new URL(route, "http://localhost");
  if (theme && !url.searchParams.has("theme")) url.searchParams.set("theme", theme);
  const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
  return `${base}${globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__ ? "/stories.html" : ""}${url.pathname}${url.search}${url.hash}`;
}
export {
  storyFrameUrl as s
};
