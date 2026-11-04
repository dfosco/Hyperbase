import { useState, useEffect } from "react";
function readCanvasBridge() {
  if (typeof window === "undefined") return { widgets: [], connectors: [] };
  const bridge = window.__storyboardCanvasBridgeState;
  return {
    widgets: Array.isArray(bridge?.widgets) ? bridge.widgets : [],
    connectors: Array.isArray(bridge?.connectors) ? bridge.connectors : []
  };
}
function useCanvasBridge() {
  const [bridge, setBridge] = useState(() => readCanvasBridge());
  useEffect(() => {
    if (typeof document === "undefined") return void 0;
    const sync = () => setBridge(readCanvasBridge());
    sync();
    document.addEventListener("storyboard:canvas:bridge-updated", sync);
    return () => document.removeEventListener("storyboard:canvas:bridge-updated", sync);
  }, []);
  return bridge;
}
function connectorEndpoint(connector, side) {
  if (!connector) return null;
  if (side === "start") {
    return connector.start?.widgetId ?? connector.from ?? connector.source?.widgetId ?? connector.source ?? null;
  }
  return connector.end?.widgetId ?? connector.to ?? connector.target?.widgetId ?? connector.target ?? null;
}
function connectedWidgetIds(widgetId, connectors) {
  const result = /* @__PURE__ */ new Set();
  for (const connector of connectors || []) {
    const startId = connectorEndpoint(connector, "start");
    const endId = connectorEndpoint(connector, "end");
    if (startId === widgetId && endId) result.add(endId);
    else if (endId === widgetId && startId) result.add(startId);
  }
  return result;
}
function hasConnectedKnobsWidget(widgetId, widgets, connectors) {
  const widgetMap = new Map((widgets || []).map((w) => [w.id, w]));
  for (const id of connectedWidgetIds(widgetId, connectors)) {
    if (widgetMap.get(id)?.type === "knobs") return true;
  }
  return false;
}
export {
  connectedWidgetIds as c,
  hasConnectedKnobsWidget as h,
  useCanvasBridge as u
};
