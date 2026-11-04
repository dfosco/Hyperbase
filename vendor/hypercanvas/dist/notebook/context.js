import { jsx } from "react/jsx-runtime";
import { useParams, useLocation } from "react-router-dom";
import { S as StoryboardContext } from "./chunks/StoryboardContext-a5DglSkK.js";
import { useMemo, useEffect, useRef } from "react";
import { resolveFlowName, flowExists, loadFlow, resolveRecordName, findRecord, deepMerge, getPrototypeMetadata } from "./core-0.js";
import { i as installBodyClassSync, s as setFlowClass } from "./chunks/bodyClasses-BfDW4I72.js";
function stripBasePath(pathname) {
  let p = pathname.replace(/\/+$/, "") || "/";
  const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/+$/, "");
  if (base && base !== "/") {
    const withoutBranch = base.replace(/^\/branch--[^/]+/, "");
    const subPath = withoutBranch.replace(/\/+$/, "");
    if (subPath && (p === subPath || p.startsWith(subPath + "/"))) {
      p = p.slice(subPath.length) || "/";
    }
  }
  if (typeof window !== "undefined" && window.__SB_LOCAL_DEV__ && window.__SB_DEV_DOMAIN__) {
    const devDomain = String(window.__SB_DEV_DOMAIN__).replace(/^\/+|\/+$/g, "");
    if (devDomain) {
      const devPrefix = "/" + devDomain;
      if (p === devPrefix || p.startsWith(devPrefix + "/")) {
        p = p.slice(devPrefix.length) || "/";
      }
    }
  }
  return p;
}
function getPrototypeName(pathname) {
  const path = stripBasePath(pathname).replace(/\/+$/, "") || "/";
  if (path === "/") return null;
  const segments = path.split("/").filter(Boolean);
  const firstSegment = segments[0];
  if (!firstSegment) return null;
  let decodedSegment = firstSegment;
  try {
    decodedSegment = decodeURIComponent(firstSegment);
  } catch {
  }
  return decodedSegment.endsWith(".prototype") ? decodedSegment.slice(0, -".prototype".length) : decodedSegment;
}
function getPageFlowName(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "index";
  const last = path.split("/").pop();
  return last || "index";
}
function useFlowContext({ location, params, flowName, sceneName, recordName, recordParam, disabled = false }) {
  const searchParams = new URLSearchParams(location.search);
  const sceneParam = searchParams.get("flow") || searchParams.get("scene");
  const prototypeName = getPrototypeName(location.pathname);
  const pageFlow = getPageFlowName(location.pathname);
  const activeFlowName = useMemo(() => {
    if (disabled) return null;
    const requested = sceneParam || flowName || sceneName;
    if (requested) {
      if (requested.includes("/")) return requested;
      return resolveFlowName(prototypeName, requested);
    }
    const scopedPageFlow = resolveFlowName(prototypeName, pageFlow);
    if (flowExists(scopedPageFlow)) return scopedPageFlow;
    if (prototypeName) {
      const protoFlow = resolveFlowName(prototypeName, prototypeName);
      if (flowExists(protoFlow)) return protoFlow;
    }
    if (prototypeName) {
      const scopedDefault = resolveFlowName(prototypeName, "default");
      if (flowExists(scopedDefault)) return scopedDefault;
    }
    if (flowExists("default")) return "default";
    return null;
  }, [disabled, sceneParam, flowName, sceneName, prototypeName, pageFlow]);
  useEffect(() => installBodyClassSync(), []);
  const { data, error, flowTokens } = useMemo(() => {
    if (disabled) return { data: null, error: null, flowTokens: null };
    if (!activeFlowName) return { data: {}, error: null, flowTokens: null };
    try {
      let flowData = loadFlow(activeFlowName);
      const extractedTokens = flowData?.tokens || null;
      if (flowData?.tokens) {
        flowData = { ...flowData };
        delete flowData.tokens;
      }
      if (recordName && recordParam && params[recordParam]) {
        const resolvedRecord = resolveRecordName(prototypeName, recordName);
        const entry = findRecord(resolvedRecord, params[recordParam]);
        if (entry) {
          flowData = deepMerge(flowData, { record: entry });
        }
      }
      setFlowClass(activeFlowName);
      return { data: flowData, error: null, flowTokens: extractedTokens };
    } catch (err) {
      return { data: null, error: err.message, flowTokens: null };
    }
  }, [disabled, activeFlowName, recordName, recordParam, params, prototypeName]);
  const protoTokens = useMemo(() => {
    if (!prototypeName) return null;
    const meta = getPrototypeMetadata(prototypeName);
    return meta?.tokens || null;
  }, [prototypeName]);
  const mergedTokens = useMemo(() => {
    if (!protoTokens && !flowTokens) return null;
    return { ...protoTokens || {}, ...flowTokens || {} };
  }, [protoTokens, flowTokens]);
  const managedParamsRef = useRef({});
  useEffect(() => {
    const url = new URL(window.location.href);
    const managed = managedParamsRef.current;
    const nextManaged = {};
    let changed = false;
    for (const key of Object.keys(managed)) {
      if (!mergedTokens || !(key in mergedTokens)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (mergedTokens) {
      const reserved = /* @__PURE__ */ new Set(["flow", "scene"]);
      for (const [key, value] of Object.entries(mergedTokens)) {
        if (value == null || typeof value === "object" || reserved.has(key)) continue;
        const strValue = String(value);
        if (!url.searchParams.has(key) || key in managed && managed[key] !== strValue) {
          url.searchParams.set(key, strValue);
          nextManaged[key] = strValue;
          changed = true;
        } else if (key in managed) {
          nextManaged[key] = strValue;
        }
      }
    }
    managedParamsRef.current = nextManaged;
    if (changed) {
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [mergedTokens]);
  return { data, error, loading: false, flowName: activeFlowName, sceneName: activeFlowName, prototypeName };
}
function FlowProvider({ children, ...options }) {
  const value = useFlowContext({ location: useLocation(), params: useParams(), ...options });
  return /* @__PURE__ */ jsx(StoryboardContext.Provider, { value, children: value.error ? /* @__PURE__ */ jsx("p", { role: "alert", children: value.error }) : children });
}
export {
  StoryboardContext,
  FlowProvider as default
};
