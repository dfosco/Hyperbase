import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useMemo, useState, useRef, useEffect, useCallback, createElement, Suspense } from "react";
import { C as Canvas } from "./Canvas-kSVAzYPO.js";
import StickyNote from "./StickyNote-D0qOXpee.js";
import { a as MarkdownView } from "./MarkdownEditor-Co1WgSAW.js";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { b as getConnectorDefaults, D as DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD, c as getConnectorConfig, d as getWidgetKnobs } from "./widgetConfig-DkrqwrI0.js";
import { d as detectKnobRoute, K as KnobsForm } from "./KnobsForm-DJarcYie.js";
import { c as connectedWidgetIds } from "./canvasBridge-BSAFcD76.js";
import { b as buildPrototypeIndex } from "./viewfinder-D-4ZTzXo.js";
import { getPrototypeKnobs, getComponentKnobs } from "../core-1.js";
import { getPrototypeMetadata } from "../core-0.js";
import { r as resolveFrameTheme, a as resolveBasePathAsset } from "./basePathAsset-Bs6UgtNi.js";
import { getConfig } from "../core-2.js";
import { getResolvedFor } from "../core-9.js";
import { c as createDocumentResolvers } from "./resolvers-CjNPHTkb.js";
import * as documents from "virtual:hypercanvas-documents";
import { t as toFigmaEmbedUrl } from "./figmaUrl-Bzyfguzi.js";
import { canvases, notebookWidgets, stories } from "virtual:storyboard-data-index";
const WIDGET_REFS_KEY = "__storyboardCanvasWidgetRefs";
function getWidgetRefsStore() {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (!root[WIDGET_REFS_KEY]) root[WIDGET_REFS_KEY] = /* @__PURE__ */ new Map();
  return root[WIDGET_REFS_KEY];
}
function getWidgetRef(id) {
  if (!id) return null;
  return getWidgetRefsStore().get(id) ?? null;
}
const connectorLayer = "_connectorLayer_1c333_1";
const connectorLayerHidden = "_connectorLayerHidden_1c333_13";
const connectorLayerTransitioning = "_connectorLayerTransitioning_1c333_18";
const endpointLayer = "_endpointLayer_1c333_25";
const connectorPath = "_connectorPath_1c333_59";
const connectorEndpoint = "_connectorEndpoint_1c333_76";
const endpointHitArea = "_endpointHitArea_1c333_91";
const connectorPathHitArea = "_connectorPathHitArea_1c333_103";
const dragPreviewPath = "_dragPreviewPath_1c333_117";
const styles = {
  connectorLayer,
  connectorLayerHidden,
  connectorLayerTransitioning,
  endpointLayer,
  connectorPath,
  connectorEndpoint,
  endpointHitArea,
  connectorPathHitArea,
  dragPreviewPath
};
const connectorConfig$1 = getConnectorDefaults();
const CONTROL_OFFSET = connectorConfig$1.controlOffset;
function getWidgetBounds(widget) {
  const x = widget.position?.x ?? 0;
  const y = widget.position?.y ?? 0;
  let w, h;
  const el = typeof document !== "undefined" ? document.getElementById(widget.id) : null;
  if (el) {
    const firstChild = el.querySelector("[data-widget-id]") || el.firstElementChild;
    if (firstChild) {
      w = firstChild.offsetWidth;
      h = firstChild.offsetHeight;
    }
  }
  if (!w) w = widget.props?.width ?? widget.bounds?.width ?? 270;
  if (!h) h = widget.props?.height ?? widget.bounds?.height ?? 170;
  return { x, y, width: w, height: h };
}
function getWidgetGap(widgetA, widgetB) {
  const a = getWidgetBounds(widgetA);
  const b = getWidgetBounds(widgetB);
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.hypot(dx, dy);
}
function getAnchorPoint(widget, anchor) {
  const { x, y, width: w, height: h } = getWidgetBounds(widget);
  switch (anchor) {
    case "top":
      return { x: x + w / 2, y };
    case "bottom":
      return { x: x + w / 2, y: y + h };
    case "left":
      return { x, y: y + h / 2 };
    case "right":
      return { x: x + w, y: y + h / 2 };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}
function getControlOffset(anchor, scale = 1) {
  const offset = CONTROL_OFFSET * scale;
  switch (anchor) {
    case "top":
      return { dx: 0, dy: -offset };
    case "bottom":
      return { dx: 0, dy: offset };
    case "left":
      return { dx: -offset, dy: 0 };
    case "right":
      return { dx: offset, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}
const CLOSE_THRESHOLD = 24 * 6;
function computeControlScale(dist) {
  if (dist >= CLOSE_THRESHOLD) return 1;
  return 0.15 + dist / CLOSE_THRESHOLD * 0.85;
}
function buildPath(startPt, startAnchor, endPt, endAnchor, freeEnd = false) {
  const dx = Math.abs(startPt.x - endPt.x);
  const dy = Math.abs(startPt.y - endPt.y);
  const minAxisDist = Math.min(dx, dy);
  const scale = computeControlScale(minAxisDist);
  const c1 = getControlOffset(startAnchor, scale);
  let c2;
  if (freeEnd) {
    const fdx = startPt.x - endPt.x;
    const fdy = startPt.y - endPt.y;
    const dist = Math.hypot(fdx, fdy) || 1;
    const freeScale = Math.min(CONTROL_OFFSET * scale, dist * 0.4);
    c2 = { dx: fdx / dist * freeScale, dy: fdy / dist * freeScale };
  } else {
    c2 = getControlOffset(endAnchor, scale);
  }
  return `M ${startPt.x} ${startPt.y} C ${startPt.x + c1.dx} ${startPt.y + c1.dy}, ${endPt.x + c2.dx} ${endPt.y + c2.dy}, ${endPt.x} ${endPt.y}`;
}
const ANCHORS = ["top", "right", "bottom", "left"];
const VECTOR = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
const DEFAULT_STEM_LENGTH = 36;
function getStemLength(options) {
  return Number.isFinite(options?.stemLength) ? Math.max(0, options.stemLength) : DEFAULT_STEM_LENGTH;
}
function obstacleBounds(widget) {
  return {
    x: widget.position?.x ?? 0,
    y: widget.position?.y ?? 0,
    width: widget.props?.width ?? widget.bounds?.width ?? 270,
    height: widget.props?.height ?? widget.bounds?.height ?? 170
  };
}
function segmentHitsRect(a, b, rect, padding = 8) {
  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;
  if (a.x === b.x) return a.x > left && a.x < right && Math.max(Math.min(a.y, b.y), top) < Math.min(Math.max(a.y, b.y), bottom);
  if (a.y === b.y) return a.y > top && a.y < bottom && Math.max(Math.min(a.x, b.x), left) < Math.min(Math.max(a.x, b.x), right);
  return true;
}
function intersects(points, obstacles) {
  for (let i = 1; i < points.length; i++) {
    if (obstacles.some((rect) => segmentHitsRect(points[i - 1], points[i], rect))) return true;
  }
  return false;
}
function simplify(points, preserveIndices = /* @__PURE__ */ new Set()) {
  const result = [];
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const previous = result[result.length - 1];
    const before = result[result.length - 2];
    if (previous && point.x === previous.point.x && point.y === previous.point.y) continue;
    const continuesStraight = before && (before.point.x === previous.point.x && previous.point.x === point.x || before.point.y === previous.point.y && previous.point.y === point.y);
    if (continuesStraight && !preserveIndices.has(index) && !preserveIndices.has(previous.index)) {
      result[result.length - 1] = { point, index };
    } else {
      result.push({ point, index });
    }
  }
  return result.map(({ point }) => point);
}
function routePoints(start, startAnchor, end, endAnchor, obstacles, stemLength = DEFAULT_STEM_LENGTH) {
  const [sx, sy] = VECTOR[startAnchor];
  const [ex, ey] = VECTOR[endAnchor];
  const a = { x: start.x + sx * stemLength, y: start.y + sy * stemLength };
  const b = { x: end.x + ex * stemLength, y: end.y + ey * stemLength };
  const candidates = [
    [start, a, { x: b.x, y: a.y }, b, end],
    [start, a, { x: a.x, y: b.y }, b, end],
    [start, a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b, end],
    [start, a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b, end]
  ].map((points) => simplify(points, /* @__PURE__ */ new Set([1, points.length - 2])));
  return candidates.map((points) => ({
    points,
    blocked: intersects(points, obstacles),
    length: points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y), 0)
  })).sort((a2, b2) => Number(a2.blocked) - Number(b2.blocked) || a2.length - b2.length || a2.points.length - b2.points.length);
}
function sharedLength(points, preferredRoutes = []) {
  let total = 0;
  for (const route of preferredRoutes) {
    const otherPoints = route?.points || route;
    if (!otherPoints?.length) continue;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      for (let j = 1; j < otherPoints.length; j++) {
        const c = otherPoints[j - 1];
        const d = otherPoints[j];
        if (a.y === b.y && c.y === d.y && a.y === c.y) {
          total += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)));
        } else if (a.x === b.x && c.x === d.x && a.x === c.x) {
          total += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)));
        }
      }
    }
  }
  return Math.min(total, 240);
}
function roundedPath(points, radius = 10) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const beforeLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const afterLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const r = Math.min(radius, beforeLength / 2, afterLength / 2);
    const before = { x: current.x + Math.sign(previous.x - current.x) * r, y: current.y + Math.sign(previous.y - current.y) * r };
    const after = { x: current.x + Math.sign(next.x - current.x) * r, y: current.y + Math.sign(next.y - current.y) * r };
    d += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
function buildOrthogonalPreview(startPt, startAnchor, endPt, endAnchor, options) {
  if (!endAnchor) {
    const dx = startPt.x - endPt.x;
    const dy = startPt.y - endPt.y;
    endAnchor = Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "top" : "bottom";
  }
  return roundedPath(routePoints(startPt, startAnchor, endPt, endAnchor, [], getStemLength(options))[0].points);
}
function getOrthogonalConnector(connector, widgetMap, preferredAnchors, fixedAnchors = false, preferredRoutes = [], options) {
  const startWidget = widgetMap.get(connector.start?.widgetId);
  const endWidget = widgetMap.get(connector.end?.widgetId);
  if (!startWidget || !endWidget || startWidget.id === endWidget.id || connector.waypoints?.length) return null;
  const configuredThreshold = options?.proximityThreshold;
  const proximityThreshold = Number.isFinite(configuredThreshold) && configuredThreshold >= 0 ? configuredThreshold : DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD;
  if (getWidgetGap(startWidget, endWidget) < proximityThreshold) return null;
  const obstacles = [...widgetMap.values()].filter((widget) => widget.id !== startWidget.id && widget.id !== endWidget.id).map(obstacleBounds);
  const cached = preferredAnchors;
  const candidates = [];
  for (const startAnchor of ANCHORS) {
    for (const endAnchor of ANCHORS) {
      if (fixedAnchors && (startAnchor !== connector.start.anchor || endAnchor !== connector.end.anchor)) continue;
      const startPt = getAnchorPoint(startWidget, startAnchor);
      const endPt = getAnchorPoint(endWidget, endAnchor);
      const routes = routePoints(startPt, startAnchor, endPt, endAnchor, obstacles, getStemLength(options));
      const cachedPenalty = cached && (cached.startAnchor !== startAnchor || cached.endAnchor !== endAnchor) ? 8 : 0;
      const facingPenalty = VECTOR[startAnchor][0] * (endPt.x - startPt.x) + VECTOR[startAnchor][1] * (endPt.y - startPt.y) < 0 ? 40 : 0;
      const endFacingPenalty = VECTOR[endAnchor][0] * (startPt.x - endPt.x) + VECTOR[endAnchor][1] * (startPt.y - endPt.y) < 0 ? 40 : 0;
      for (const route of routes) {
        const trunkReward = sharedLength(route.points, preferredRoutes) * 0.4;
        candidates.push({ startAnchor, endAnchor, startPt, endPt, ...route, score: (route.blocked ? 1e5 : 0) + route.length + (route.points.length - 2) * 22 + facingPenalty + endFacingPenalty + cachedPenalty - trunkReward });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];
  return {
    startAnchor: best.startAnchor,
    endAnchor: best.endAnchor,
    startPt: best.startPt,
    endPt: best.endPt,
    points: best.points,
    d: roundedPath(best.points)
  };
}
const connectorConfig = getConnectorDefaults();
const VALID_ENDPOINT_STYLES = /* @__PURE__ */ new Set(["circle", "arrow-start", "arrow-end", "none"]);
function getEndpointStyle(conn, widgetType, side) {
  const override = side === "start" ? conn.startEndpoint : conn.endEndpoint;
  if (VALID_ENDPOINT_STYLES.has(override)) return override;
  const key = side === "start" ? "startEndpoint" : "endEndpoint";
  const widgetConnectors = getConnectorConfig(widgetType);
  if (widgetConnectors.defaults?.[key]) return widgetConnectors.defaults[key];
  return connectorConfig[key];
}
function toDataAttrs(data) {
  if (!data || typeof data !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    const key = k.startsWith("data-") ? k : `data-${k}`;
    out[key] = typeof v === "string" ? v : String(v);
  }
  return out;
}
const ENDPOINT_HIT_PADDING = 8;
function EndpointShape({ x, y, startPt, endPt, style, angle, onPointerDown }) {
  const passThrough = !onPointerDown ? { pointerEvents: "none" } : {};
  const hitRadius = connectorConfig.endpointRadius + ENDPOINT_HIT_PADDING;
  const hitTarget = onPointerDown ? /* @__PURE__ */ jsx(
    "circle",
    {
      cx: x,
      cy: y,
      r: hitRadius,
      className: styles.endpointHitArea,
      onPointerDown
    }
  ) : null;
  if (style === "none") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      hitTarget,
      /* @__PURE__ */ jsx(
        "circle",
        {
          cx: x,
          cy: y,
          r: connectorConfig.endpointRadius,
          style: { fill: "transparent", stroke: "none", ...onPointerDown ? { pointerEvents: "none" } : { pointerEvents: "none" } }
        }
      )
    ] });
  }
  if (style === "arrow-start" || style === "arrow-end") {
    const size = connectorConfig.endpointRadius * 2.2;
    const target = style === "arrow-start" ? startPt : endPt;
    const dx = target.x - x;
    const dy = target.y - y;
    const rotation = angle ?? Math.atan2(dy, dx) * 180 / Math.PI + 90;
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      hitTarget,
      /* @__PURE__ */ jsx(
        "polygon",
        {
          points: `0,${-size} ${size * 0.6},${size * 0.5} ${-size * 0.6},${size * 0.5}`,
          transform: `translate(${x},${y}) rotate(${rotation})`,
          className: styles.connectorEndpoint,
          style: passThrough
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    hitTarget,
    /* @__PURE__ */ jsx(
      "circle",
      {
        cx: x,
        cy: y,
        r: connectorConfig.endpointRadius,
        className: styles.connectorEndpoint,
        style: passThrough
      }
    )
  ] });
}
const svgLayerStyle = {
  width: "100000px",
  height: "100000px",
  "--connector-stroke": connectorConfig.stroke,
  "--connector-stroke-width": `${connectorConfig.strokeWidth}px`,
  "--connector-hover-stroke": connectorConfig.hoverStroke,
  "--connector-hover-stroke-width": `${connectorConfig.hoverStrokeWidth}px`,
  "--connector-endpoint-fill": connectorConfig.endpointFill,
  "--connector-endpoint-stroke": connectorConfig.endpointStroke,
  "--connector-endpoint-stroke-width": `${connectorConfig.endpointStrokeWidth}px`,
  "--connector-hit-area-width": `${connectorConfig.hitAreaStrokeWidth}px`,
  "--connector-drag-stroke": connectorConfig.dragStroke,
  "--connector-drag-stroke-width": `${connectorConfig.dragStrokeWidth}px`,
  "--connector-drag-dasharray": connectorConfig.dragDasharray,
  "--connector-drag-opacity": connectorConfig.dragOpacity
};
function ConnectorLayer({
  connectors = [],
  widgets = [],
  selectedWidgetIds,
  onRemove,
  onEndpointDrag,
  dragPreview,
  hidden = false,
  autoPlace = false
}) {
  const widgetMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const w of widgets) {
      map.set(w.id, w);
    }
    return map;
  }, [widgets]);
  const [displayConnectors, setDisplayConnectors] = useState(connectors);
  const [routingTransition, setRoutingTransition] = useState(false);
  const latestConnectors = useRef(connectors);
  const previousMode = useRef(autoPlace);
  const transitioningRef = useRef(false);
  const transitionTimer = useRef(null);
  useEffect(() => {
    if (previousMode.current === autoPlace) return;
    previousMode.current = autoPlace;
    clearTimeout(transitionTimer.current);
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      transitioningRef.current = false;
      setRoutingTransition(false);
      setDisplayConnectors(latestConnectors.current);
      return;
    }
    transitioningRef.current = true;
    setRoutingTransition(true);
    transitionTimer.current = setTimeout(() => {
      setDisplayConnectors(latestConnectors.current);
      transitionTimer.current = setTimeout(() => {
        transitioningRef.current = false;
        setRoutingTransition(false);
      }, 200);
    }, 200);
    return () => clearTimeout(transitionTimer.current);
  }, [autoPlace]);
  useEffect(() => {
    latestConnectors.current = connectors;
    if (!transitioningRef.current) setDisplayConnectors(connectors);
  }, [connectors]);
  useEffect(() => () => clearTimeout(transitionTimer.current), []);
  const [geometryVersion, setGeometryVersion] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const scheduleBump = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setGeometryVersion((v) => v + 1);
      });
    };
    const observer = new ResizeObserver(scheduleBump);
    for (const w of widgets) {
      const wrapper = document.getElementById(w.id);
      if (!wrapper) continue;
      const inner = wrapper.querySelector("[data-widget-id]") || wrapper.firstElementChild;
      const target = inner || wrapper;
      observer.observe(target);
    }
    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [widgets]);
  const handleClick = useCallback((e, connectorId) => {
    e.stopPropagation();
    onRemove?.(connectorId);
  }, [onRemove]);
  const dragPreviewIsOrthogonal = autoPlace && (!dragPreview?.snapTarget || (() => {
    const startWidget = widgetMap.get(dragPreview.startWidgetId);
    const endWidget = widgetMap.get(dragPreview.snapTarget.widgetId);
    return !!startWidget && !!endWidget && getWidgetGap(startWidget, endWidget) >= connectorConfig.orthogonalProximityThreshold;
  })());
  const resolved = useMemo(() => displayConnectors.map((conn) => {
    const startWidget = widgetMap.get(conn.start?.widgetId);
    const endWidget = widgetMap.get(conn.end?.widgetId);
    if (!startWidget || !endWidget) return null;
    const refreshedRoute = conn._visualRoute ? getOrthogonalConnector(conn, widgetMap, { startAnchor: conn.start.anchor, endAnchor: conn.end.anchor }, true, [], {
      stemLength: connectorConfig.orthogonalStemLength,
      proximityThreshold: connectorConfig.orthogonalProximityThreshold
    }) : null;
    const startPt = refreshedRoute?.startPt || getAnchorPoint(startWidget, conn.start.anchor);
    const endPt = refreshedRoute?.endPt || getAnchorPoint(endWidget, conn.end.anchor);
    const d = refreshedRoute?.d || buildPath(startPt, conn.start.anchor, endPt, conn.end.anchor);
    const routePoints2 = refreshedRoute?.points;
    const startArrowAngle = routePoints2?.length > 1 ? Math.atan2(routePoints2[0].y - routePoints2[1].y, routePoints2[0].x - routePoints2[1].x) * 180 / Math.PI + 90 : void 0;
    const endArrowAngle = routePoints2?.length > 1 ? Math.atan2(routePoints2.at(-1).y - routePoints2.at(-2).y, routePoints2.at(-1).x - routePoints2.at(-2).x) * 180 / Math.PI + 90 : void 0;
    const startStyle = getEndpointStyle(conn, startWidget.type, "start");
    const endStyle = getEndpointStyle(conn, endWidget.type, "end");
    const customClassName = typeof conn.className === "string" ? conn.className : "";
    const customStyle = conn.style && typeof conn.style === "object" ? conn.style : null;
    const customDataAttrs = toDataAttrs(conn.data);
    return {
      conn,
      startPt,
      endPt,
      d,
      startStyle,
      endStyle,
      startArrowAngle,
      endArrowAngle,
      customClassName,
      customStyle,
      customDataAttrs
    };
  }).filter(Boolean), [displayConnectors, widgetMap, selectedWidgetIds, geometryVersion]);
  const hiddenClass = (hidden ? styles.connectorLayerHidden : "") + (routingTransition ? " " + styles.connectorLayerTransitioning : "");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      "svg",
      {
        className: `${styles.connectorLayer} ${hiddenClass}`,
        style: svgLayerStyle,
        children: [
          resolved.map(({ conn, d, customClassName, customStyle, customDataAttrs }) => /* @__PURE__ */ jsxs(
            "g",
            {
              "data-connector-id": conn.id,
              "data-connector-type": conn.connectorType || "default",
              className: customClassName || void 0,
              style: customStyle || void 0,
              ...customDataAttrs || {},
              children: [
                /* @__PURE__ */ jsx(
                  "path",
                  {
                    d,
                    className: styles.connectorPathHitArea,
                    onClick: (e) => handleClick(e, conn.id)
                  }
                ),
                /* @__PURE__ */ jsx(
                  "path",
                  {
                    d,
                    className: styles.connectorPath,
                    onClick: (e) => handleClick(e, conn.id)
                  }
                )
              ]
            },
            conn.id
          )),
          dragPreview && /* @__PURE__ */ jsx(
            "path",
            {
              d: dragPreviewIsOrthogonal ? buildOrthogonalPreview(dragPreview.startPt, dragPreview.startAnchor, dragPreview.endPt, dragPreview.endAnchor, { stemLength: connectorConfig.orthogonalStemLength }) : buildPath(dragPreview.startPt, dragPreview.startAnchor, dragPreview.endPt, dragPreview.endAnchor || dragPreview.startAnchor, !dragPreview.snapTarget),
              className: styles.dragPreviewPath
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      "svg",
      {
        className: `${styles.endpointLayer} ${hiddenClass}`,
        style: svgLayerStyle,
        children: [
          resolved.map(({ conn, startPt, endPt, startStyle, endStyle, startArrowAngle, endArrowAngle, customClassName, customStyle, customDataAttrs }) => /* @__PURE__ */ jsxs(
            "g",
            {
              "data-connector-id": conn.id,
              "data-connector-type": conn.connectorType || "default",
              className: customClassName || void 0,
              style: customStyle || void 0,
              ...customDataAttrs || {},
              children: [
                /* @__PURE__ */ jsx(
                  EndpointShape,
                  {
                    x: startPt.x,
                    y: startPt.y,
                    startPt,
                    endPt,
                    style: startStyle,
                    angle: startArrowAngle,
                    onPointerDown: onEndpointDrag ? (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onEndpointDrag(conn, "start", e);
                    } : void 0
                  }
                ),
                /* @__PURE__ */ jsx(
                  EndpointShape,
                  {
                    x: endPt.x,
                    y: endPt.y,
                    startPt,
                    endPt,
                    style: endStyle,
                    angle: endArrowAngle,
                    onPointerDown: onEndpointDrag ? (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onEndpointDrag(conn, "end", e);
                    } : void 0
                  }
                )
              ]
            },
            conn.id
          )),
          dragPreview?.snapTarget && /* @__PURE__ */ jsx(
            EndpointShape,
            {
              x: dragPreview.endPt.x,
              y: dragPreview.endPt.y,
              startPt: dragPreview.startPt,
              endPt: dragPreview.endPt,
              style: connectorConfig.endEndpoint
            }
          )
        ]
      }
    )
  ] });
}
const EXTERNAL_IFRAME_TYPES = /* @__PURE__ */ new Set(["prototype", "figma-embed", "codepen-embed"]);
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
function labelFromWidget(id, widget) {
  const props = widget?.props ?? {};
  return widget?.alias || props.alias || widget?.prettyName || props.prettyName || widget?.label || props.label || id;
}
function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}
function isExternalWidgetTarget(widget) {
  if (!widget || !EXTERNAL_IFRAME_TYPES.has(widget.type)) return false;
  const props = widget.props ?? {};
  const value = props.src || props.url;
  if (!isHttpUrl(value)) return false;
  try {
    return typeof window === "undefined" || new URL(value).origin !== window.location.origin;
  } catch {
    return true;
  }
}
function readBaseUrl(deps) {
  if (deps?.baseUrl !== void 0) return deps.baseUrl;
  return globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
}
function normalizeBasePath(baseUrl) {
  const base = String(baseUrl || "/").replace(/\/+$/, "");
  if (!base || base === "/") return "";
  return base.startsWith("/") ? base : `/${base}`;
}
function routeKey(value, deps, { keepSearch = false } = {}) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  let pathname = raw;
  let search = "";
  try {
    const url = new URL(raw, "http://storyboard.local");
    pathname = url.pathname || "/";
    search = url.search || "";
  } catch {
    const hashless = raw.split("#")[0];
    const queryIndex = hashless.indexOf("?");
    if (queryIndex >= 0) {
      pathname = hashless.slice(0, queryIndex);
      search = hashless.slice(queryIndex);
    } else {
      pathname = hashless;
    }
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  const base = normalizeBasePath(readBaseUrl(deps));
  if (base && pathname === base) pathname = "/";
  else if (base && pathname.startsWith(`${base}/`)) pathname = pathname.slice(base.length) || "/";
  pathname = pathname.replace(/^\/branch--[^/]+(?=\/|$)/, "") || "/";
  pathname = pathname.replace(/^\/prototypes\.html(?=\/|$)/, "") || "/";
  pathname = pathname.replace(/^\/stories\.html(?=\/|$)/, "") || "/";
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  pathname = pathname.replace(/\/+$/, "") || "/";
  return `${pathname}${keepSearch ? search : ""}`;
}
function flattenPrototypeEntries(index) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const proto of safeArray(index?.prototypes)) {
    const key = proto?.dirName || proto?.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(proto);
  }
  for (const folder of safeArray(index?.folders)) {
    for (const proto of safeArray(folder?.prototypes)) {
      const key = proto?.dirName || proto?.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(proto);
    }
  }
  return result;
}
function resolvePrototypeNameFromSrc(src, deps = {}) {
  const srcExact = routeKey(src, deps, { keepSearch: true });
  const srcPath = routeKey(src, deps);
  if (!srcPath) return null;
  let index;
  try {
    index = (deps.buildPrototypeIndex || buildPrototypeIndex)();
  } catch {
    return null;
  }
  const prototypes = flattenPrototypeEntries(index);
  const candidateRows = prototypes.map((proto) => {
    const protoName = proto?.dirName || proto?.name;
    const routes = [
      proto?.route,
      protoName ? `/${protoName}` : null,
      ...safeArray(proto?.flows).map((flow) => flow?.route)
    ].filter(Boolean);
    return {
      protoName,
      exact: routes.map((route) => routeKey(route, deps, { keepSearch: true })),
      paths: routes.map((route) => routeKey(route, deps))
    };
  }).filter((row) => row.protoName);
  for (const row of candidateRows) {
    if (row.exact.includes(srcExact)) return row.protoName;
  }
  const owners = candidateRows.flatMap((row) => row.paths.filter((path) => path === "/" || srcPath === path || srcPath.startsWith(`${path}/`)).map((path) => ({ protoName: row.protoName, path }))).sort((left, right) => right.path.length - left.path.length);
  return owners[0]?.protoName || null;
}
function iframeWindowGetter(targetId, getWidgetRef2) {
  return () => {
    try {
      const handle = getWidgetRef2(targetId);
      if (typeof handle?.getIframeWindow !== "function") return null;
      return handle.getIframeWindow() ?? null;
    } catch {
      return null;
    }
  };
}
function resolveKnobsTarget(target, deps = {}) {
  const id = target?.id;
  const widget = target?.widget;
  if (!id || !widget) return null;
  if (isExternalWidgetTarget(widget)) return null;
  const getWidgetRef$1 = deps.getWidgetRef || getWidgetRef;
  const getPrototypeKnobs$1 = deps.getPrototypeKnobs || getPrototypeKnobs;
  const getComponentKnobs$1 = deps.getComponentKnobs || getComponentKnobs;
  const getWidgetKnobs$1 = deps.getWidgetKnobs || getWidgetKnobs;
  const getPrototypeMetadata$1 = deps.getPrototypeMetadata || getPrototypeMetadata;
  const fallbackLabel = labelFromWidget(id, widget);
  if (widget.type === "prototype") {
    const protoName = resolvePrototypeNameFromSrc(widget.props?.src, deps);
    if (!protoName) return null;
    const protoMeta = getPrototypeMetadata$1(protoName);
    const protoTitle = protoMeta?.meta?.title || protoMeta?.title || protoName;
    return {
      id,
      label: protoTitle,
      knobs: getPrototypeKnobs$1(protoName),
      requiresTargetWindow: true,
      getTargetWindow: iframeWindowGetter(id, getWidgetRef$1)
    };
  }
  if (widget.type === "component-set" || widget.type === "story") {
    const componentName = widget.props?.storyId;
    if (!componentName) return null;
    return {
      id,
      label: fallbackLabel,
      knobs: getComponentKnobs$1(componentName),
      requiresTargetWindow: true,
      getTargetWindow: iframeWindowGetter(id, getWidgetRef$1)
    };
  }
  const knobs = getWidgetKnobs$1(widget.type);
  if (!Array.isArray(knobs) || knobs.length === 0) return null;
  return {
    id,
    label: fallbackLabel,
    knobs,
    getTargetWindow: null
  };
}
function resolveKnobsTargets(targets, deps = {}) {
  return safeArray(targets).map((target) => resolveKnobsTarget(target, deps)).filter(Boolean);
}
const record = (value) => value && typeof value === "object" ? value : {};
const matches = (rule, name) => Array.isArray(rule) ? rule.includes(name) : rule instanceof RegExp ? rule.test(name) : false;
function resolveStoryExports(module, { componentSet = false, exportNames = [] } = {}) {
  const meta = record(module.default);
  const names = [.../* @__PURE__ */ new Set([...Array.isArray(module.__namedExportsOrder) ? module.__namedExportsOrder : [], ...exportNames, ...Object.keys(module)])];
  const stories2 = {};
  for (const name of names) {
    if (!/^[A-Z]/.test(name) || name === "default" || matches(meta.excludeStories, name) || meta.includeStories && !matches(meta.includeStories, name)) continue;
    const story = module[name];
    if (!story || typeof story !== "function" && typeof story !== "object") continue;
    if (componentSet && story.componentSet === false) continue;
    const render = typeof story === "function" ? story : story.render || meta.render;
    const component = meta.component;
    if (typeof render !== "function" && !component) continue;
    const args = { ...record(meta.args), ...record(story.args) };
    const context = {
      id: name,
      name: story.name || story.storyName || name,
      story: name,
      args,
      initialArgs: args,
      argTypes: { ...record(meta.argTypes), ...record(story.argTypes) },
      parameters: { ...record(meta.parameters), ...record(story.parameters) },
      globals: {},
      viewMode: "story",
      component
    };
    const plainReactStory = typeof story === "function" && !meta.component && !meta.render && !story.args;
    let Preview = (overrides = {}) => {
      const effectiveArgs = { ...args, ...record(overrides.args) };
      const effectiveContext = { ...context, ...overrides, args: effectiveArgs };
      return plainReactStory || render?.prototype?.isReactComponent ? createElement(render, effectiveArgs) : typeof render === "function" ? render(effectiveArgs, effectiveContext) : createElement(component, effectiveArgs);
    };
    for (const decorator of [...meta.decorators || [], ...story.decorators || []].reverse()) {
      const Inner = Preview;
      Preview = (overrides = {}) => {
        const decoratedContext = { ...context, ...overrides, args: { ...args, ...record(overrides.args) } };
        const current = useRef(null);
        current.current = { overrides, decoratedContext };
        const Story = useMemo(() => function DecoratedStory(extra = {}) {
          return createElement(Inner, {
            ...current.current.overrides,
            ...extra,
            args: { ...current.current.decoratedContext.args, ...record(extra.args) }
          });
        }, []);
        return decorator(Story, decoratedContext);
      };
    }
    Preview.displayName = `Story(${name})`;
    Preview.storyName = context.name;
    Preview.minHeight = story.minHeight;
    stories2[name] = Preview;
  }
  return stories2;
}
const page = "_page_9pjb8_1";
const header = "_header_9pjb8_2";
const scroll = "_scroll_9pjb8_4";
const frame = "_frame_9pjb8_7";
const image = "_image_9pjb8_8";
const poster = "_poster_9pjb8_9";
const snapshot = "_snapshot_9pjb8_10";
const css = {
  page,
  header,
  scroll,
  frame,
  image,
  poster,
  snapshot
};
const asset = (value) => resolveBasePathAsset(value, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__);
function Unsupported({ type, fallback }) {
  return /* @__PURE__ */ jsx("aside", { role: "status", "data-notebook-diagnostic": "UNSUPPORTED_WIDGET_CAPABILITY", children: fallback?.type === "text" ? fallback.text : `Widget ${type} requires an authoring capability unavailable in this viewer.` });
}
function StoryPreview({ name }) {
  const [module, setModule] = useState(null);
  useEffect(() => {
    let active = true;
    const load = stories[name]?._storyImport;
    if (load) void load().then((value) => {
      if (active) setModule(value);
    }).catch(() => {
    });
    return () => {
      active = false;
    };
  }, [name]);
  if (!module) return /* @__PURE__ */ jsxs("p", { role: "status", children: [
    "Story preview unavailable: ",
    name
  ] });
  const exports = resolveStoryExports(module);
  return Object.entries(exports).map(([key, Preview]) => /* @__PURE__ */ jsxs("section", { children: [
    /* @__PURE__ */ jsx("h3", { children: key }),
    /* @__PURE__ */ jsx(Preview, {})
  ] }, key));
}
function KnobControls({ widget, widgets, connectors, frames }) {
  const linked = connectedWidgetIds(widget.id, connectors);
  const targets = resolveKnobsTargets(widgets.filter((item) => linked.has(item.id)).map((item) => ({ id: item.id, widget: item })), { getWidgetRef: (id) => ({ getIframeWindow: () => frames.get(id)?.contentWindow ?? null }) });
  const target = targets.find((item) => item.id === widget.props?.activeTarget) || targets[0];
  const targetWindow = target?.getTargetWindow?.() ?? null;
  if (target?.requiresTargetWindow && !targetWindow) return /* @__PURE__ */ jsxs("p", { role: "status", children: [
    "Waiting for ",
    target.label,
    " to finish loading before writing knobs."
  ] });
  if (!target) return /* @__PURE__ */ jsx("p", { role: "status", children: "Connect a supported prototype with declared knobs to expose its controls." });
  let route;
  try {
    route = targetWindow ? detectKnobRoute(targetWindow.location.pathname).route : void 0;
  } catch {
    return /* @__PURE__ */ jsx("p", { role: "status", children: "External frame knobs are unavailable." });
  }
  return /* @__PURE__ */ jsx(KnobsForm, { knobs: target.knobs, target: targetWindow, route });
}
function WidgetView({ widget, widgets, connectors, frames, setFrame }) {
  const { type, props = {}, id } = widget;
  const custom = notebookWidgets?.[type]?.component;
  if (custom) {
    const Component = custom;
    return /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("p", { role: "status", children: "Loading widget…" }), children: /* @__PURE__ */ jsx(Component, { id, props }) });
  }
  if (type === "sticky-note") return /* @__PURE__ */ jsx(StickyNote, { props });
  if (type === "markdown" || type === "file" && typeof props.content === "string") return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(MarkdownView, { content: props.content || "", allowTextSelection: true }) });
  if (type === "image") return /* @__PURE__ */ jsx("figure", { className: css.image, children: /* @__PURE__ */ jsx("img", { src: asset(props.src || props.url), alt: props.alt || props.title || "", style: { width: props.width, height: props.height, objectFit: props.fit || "contain" } }) });
  if (type === "knobs") return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(KnobControls, { ...{ widget, widgets, connectors, frames } }) });
  if (type === "story" || type === "component-set") return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(StoryPreview, { name: props.story || props.name || props.component }) });
  if (type === "site" || type === "site-frame") {
    const resolved = props.artifactId ? createDocumentResolvers({ ...documents.getDocumentSnapshot(), mode: "static", base: globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ }).resolveArtifact(props.artifactId, { kind: "site", viewId: props.viewId }) : null;
    const published = props.published || props;
    const url = resolved?.url || published.productionUrl || published.url;
    const snapshot2 = resolved?.screenshot || published.snapshot || published.snapshotDark;
    return /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
      snapshot2 ? /* @__PURE__ */ jsx("a", { href: url, children: /* @__PURE__ */ jsx("img", { className: css.poster, src: resolved?.screenshot ? snapshot2 : asset(snapshot2), alt: props.title || props.siteId || "Site" }) }) : /* @__PURE__ */ jsx("p", { role: "status", children: "Site snapshot unavailable." }),
      url && /* @__PURE__ */ jsxs("a", { href: url, target: "_blank", rel: "noreferrer", children: [
        "Open ",
        props.title || props.siteId || "Site"
      ] })
    ] });
  }
  if (type === "prototype" || type === "figma-embed" || type === "codepen-embed") {
    const source = props.artifactId ? createDocumentResolvers({ ...documents.getDocumentSnapshot(), mode: globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__ ? "local" : "static", base: globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ }).resolveArtifact(props.artifactId, { kind: "prototype", viewId: props.viewId }).url : props.src || props.url || (props.prototype ? `/${props.prototype}` : "");
    const url = type === "figma-embed" ? toFigmaEmbedUrl(source) : /^https?:\/\//i.test(source) ? source : asset(source);
    if (!url) return /* @__PURE__ */ jsx(Unsupported, { type, fallback: props.fallback });
    const theme = resolveFrameTheme(props.theme, getResolvedFor("canvas"), getConfig()?.theming?.themes);
    const frameUrl = new URL(url, window.location.href);
    frameUrl.searchParams.set("_sb_embed", "");
    if (theme) frameUrl.searchParams.set("theme", theme);
    if ([...connectedWidgetIds(id, connectors)].some((key) => widgets.find((item) => item.id === key)?.type === "knobs")) frameUrl.searchParams.set("sb_knobs", "1");
    return /* @__PURE__ */ jsx("iframe", { onLoad: (event) => setFrame(id, event.currentTarget), className: css.frame, title: props.title || type, src: frameUrl.href, style: { width: props.width || 700, height: props.height || 500 } });
  }
  if (type === "link-preview") return /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
    /* @__PURE__ */ jsx("a", { href: props.url || props.src, target: "_blank", rel: "noreferrer", children: props.title || props.url || props.src }),
    props.description && /* @__PURE__ */ jsx("p", { children: props.description })
  ] });
  if (["terminal", "terminal-read", "agent"].includes(type) && typeof props.snapshot === "string") return /* @__PURE__ */ jsx("pre", { className: css.snapshot, children: props.snapshot });
  return /* @__PURE__ */ jsx(Unsupported, { type, fallback: props.fallback });
}
function CanvasViewer({ id }) {
  const canvas = canvases[id];
  const [frames, updateFrames] = useState(() => /* @__PURE__ */ new Map());
  const setFrame = (id2, element) => updateFrames((previous) => previous.get(id2) === element ? previous : new Map(previous).set(id2, element));
  const [zoom, setZoom] = useState(100);
  if (!canvas) return /* @__PURE__ */ jsxs("p", { role: "alert", children: [
    "Canvas unavailable: ",
    id
  ] });
  const widgets = canvas.widgets || [];
  const connectors = canvas.connectors || [];
  const layout = canvas.settings?.layout || "absolute";
  return /* @__PURE__ */ jsxs("section", { className: css.page, "data-sb-surface": "content", "data-notebook-canvas": id, children: [
    /* @__PURE__ */ jsxs("header", { className: css.header, children: [
      /* @__PURE__ */ jsx("h1", { children: canvas.title || id }),
      layout !== "flow" && /* @__PURE__ */ jsxs("label", { children: [
        "Zoom ",
        /* @__PURE__ */ jsx("input", { "aria-label": "Canvas zoom", type: "range", min: "25", max: "200", value: zoom, onChange: (event) => setZoom(Number(event.target.value)) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: css.scroll, children: /* @__PURE__ */ jsxs("div", { style: { zoom: zoom / 100 }, children: [
      /* @__PURE__ */ jsx(Canvas, { locked: true, layout, gridSize: canvas.settings?.gridSize, dotted: canvas.settings?.dotted, children: widgets.filter((widget) => !widget.hidden).map((widget) => /* @__PURE__ */ jsx("section", { "data-widget-id": widget.id, "data-tc-id": widget.id, "data-tc-x": widget.position?.x || 0, "data-tc-y": widget.position?.y || 0, style: { width: widget.props?.width, minHeight: widget.props?.height }, children: /* @__PURE__ */ jsx(WidgetView, { ...{ widget, widgets, connectors, frames, setFrame } }) }, widget.id)) }),
      layout !== "flow" && /* @__PURE__ */ jsx(ConnectorLayer, { widgets, connectors, selectedWidgetIds: /* @__PURE__ */ new Set() })
    ] }) })
  ] });
}
export {
  CanvasViewer as default
};
