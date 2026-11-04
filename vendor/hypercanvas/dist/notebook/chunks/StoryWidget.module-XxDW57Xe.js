import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { getStoryData } from "../core-0.js";
import { m as storyFrameRoute } from "./Document-2gwDP-Y5.js";
import { a as resolveBasePathAsset } from "./basePathAsset-Bs6UgtNi.js";
import { useFeatureFlag } from "../useFeatureFlag.js";
import { b as useFrameSnapshot, c as useFrameSnapshotLifecycle, a as useObservedFrameLifecycle } from "./useCanvasFrameTheme-D4Yco8Ax.js";
function useStoryFrame({ widgetId, canvasId, props, componentSet = false, iframeSrc, theme, expanded, interactive, setInteractive, rootRef, iframeRef }) {
  const [admitted, setAdmitted] = useState(false);
  const viewportRef = useRef(null);
  const published = window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ != null;
  const debug = useFeatureFlag("frame-lifecycle-overlay") && !published;
  const route = storyFrameRoute(getStoryData(props?.storyId), props?.storyId, { ...props, ...componentSet ? { selected: props?.selected || "" } : {} }, componentSet);
  const target = useMemo(() => route ? { kind: "prototype", src: route, width: props?.width, height: props?.height, zoom: 100 } : null, [route, props?.width, props?.height]);
  const { snapshot, reload } = useFrameSnapshot({ target: published ? null : target, theme, widgetId, canvasId, themePolicy: "configured-story", autoCapture: false });
  const manual = String(theme).startsWith("dark") ? props?.snapshotDark || props?.snapshot : props?.snapshot || props?.snapshotDark;
  const poster = resolveBasePathAsset(manual || props?.snapshotVariants?.[theme], globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/") || snapshot?.variants?.[theme]?.dataUrl || snapshot?.[theme]?.dataUrl || "";
  const { onLoad: captureAfterReady, prepareRefresh } = useFrameSnapshotLifecycle({ target, theme, enabled: admitted && !published && !manual, snapshotReady: Boolean(snapshot?.generation), interactive: interactive || expanded, rootRef, iframeRef, reload, onInteractionEnd: () => setInteractive(false) });
  const { phase, elapsed, loading, ready, error, attach, onLoad, onError, restart } = useObservedFrameLifecycle({ iframeRef, source: admitted ? iframeSrc : "", debug, interactive: interactive || expanded, onReady: () => {
    document.dispatchEvent(new CustomEvent("storyboard:canvas:iframe-ready", { detail: { widgetId } }));
    captureAfterReady();
  } });
  const activate = useCallback(() => {
    setAdmitted(true);
    setInteractive(true);
  }, [setInteractive]);
  useEffect(() => {
    const activated = (event) => {
      if (event.detail?.widgetId === widgetId) activate();
    };
    document.addEventListener("storyboard:interact-gate-activated", activated);
    return () => document.removeEventListener("storyboard:interact-gate-activated", activated);
  }, [activate, widgetId]);
  const attachExpandedPane = useCallback((container) => {
    const viewport = viewportRef.current;
    if (!container || !viewport || published) return;
    setAdmitted(true);
    const parent = viewport.parentElement;
    const sibling = viewport.nextSibling;
    const style = viewport.getAttribute("style");
    if (container.moveBefore && viewport.isConnected) container.moveBefore(viewport, null);
    else container.appendChild(viewport);
    viewport.style.width = "100%";
    viewport.style.height = "100%";
    viewport.style.display = "block";
    return () => {
      const before = sibling?.parentNode === parent ? sibling : null;
      if (parent?.moveBefore && viewport.isConnected) parent.moveBefore(viewport, before);
      else parent?.insertBefore(viewport, before);
      if (style === null) viewport.removeAttribute("style");
      else viewport.setAttribute("style", style);
    };
  }, [published]);
  const refresh = useCallback(() => {
    if (!iframeRef.current) return;
    prepareRefresh();
    restart();
    iframeRef.current.setAttribute("src", iframeRef.current.src);
  }, [iframeRef, prepareRefresh, restart]);
  return { admitted, activate, attachExpandedPane, viewportRef, poster, debug, phase, elapsed, loading, ready, error, attach, onLoad, onError, refresh, published, snapshotStatus: snapshot?.status };
}
let storyPathPromise = null;
async function getStoryPathByName(name) {
  if (!storyPathPromise) {
    const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
    storyPathPromise = fetch(`${base}/_hypercanvas/canvas/stories`).then((r) => r.json()).then((d) => new Map((d.stories || []).map((s) => [s.name, s.path]))).catch(() => /* @__PURE__ */ new Map());
  }
  const map = await storyPathPromise;
  return map.get(name) || null;
}
const content = "_content_1e71e_40";
const placeholder = "_placeholder_1e71e_49";
const spinner = "_spinner_1e71e_68";
const iframe = "_iframe_1e71e_82";
const snapshotImage = "_snapshotImage_1e71e_92";
const codeBlock = "_codeBlock_1e71e_149";
const lifecycleToast = "_lifecycleToast_1e71e_220";
const loadingIndicator = "_loadingIndicator_1e71e_221";
const frameError = "_frameError_1e71e_223";
const styles = {
  content,
  placeholder,
  spinner,
  iframe,
  snapshotImage,
  codeBlock,
  lifecycleToast,
  loadingIndicator,
  frameError
};
export {
  getStoryPathByName as g,
  styles as s,
  useStoryFrame as u
};
