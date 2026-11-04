import { default as default2 } from "./context.js";
import { S as StoryboardContext } from "./chunks/StoryboardContext-a5DglSkK.js";
import { useContext, useSyncExternalStore, useMemo, useCallback, createContext } from "react";
import { d as deepClone, s as setByPath, g as getByPath } from "./chunks/dotPath-CXf9dtnn.js";
import { o as isHideMode, e as getAllShadows, g as getAllParams, m as getShadow, l as getParam, a as activateHideMode, d as deactivateHideMode, w as undo, r as redo, c as canRedo, b as canUndo } from "./chunks/hideMode-DxxH-PW9.js";
import { s as subscribeToHash, g as getHashSnapshot } from "./chunks/hashSubscribe-Bi9R_rI0.js";
import { s as subscribeToStorage, b as getStorageSnapshot, a as getLocal, c as setLocal, r as removeLocal } from "./chunks/localStorage-DulkrQ4k.js";
import { u, u as u2 } from "./chunks/useOverride-CmpCccmF.js";
import { b as sbNavigate } from "./chunks/sbNavigate-B3XfDwJj.js";
import { getFlowsForPrototype, resolveRecordName, loadRecord, resolveObjectName, loadObject } from "./core-0.js";
import { g as getFlowMeta, r as resolveFlowRoute } from "./chunks/viewfinder-D-4ZTzXo.js";
import { useParams } from "react-router-dom";
import { useFeatureFlag } from "./useFeatureFlag.js";
import { subscribeToMode, getModeSnapshot, getCurrentMode, getRegisteredModes, activateMode } from "./core-8.js";
import { u as u3, a } from "./chunks/useThemeState-6KPJA_hY.js";
import { subscribeToConfig, getConfigSnapshot, getConfig } from "./core-2.js";
import { K, u as u4 } from "./chunks/KnobsForm-BaG6jvFj.js";
import { installHashPreserver } from "./hash-preserver.js";
import { I } from "./chunks/Icon-CY9OeunJ.js";
import { N, a as a2, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r } from "./chunks/NotebookShellPresentation-E79zlNst.js";
import { e as e2, h as h2, i as i2, j as j2, d as d2, f as f2, C } from "./chunks/CanvasToolsPresentation-CgLIau-Y.js";
function useFlowData(path, opts) {
  const context = useContext(StoryboardContext);
  if (context === null) {
    throw new Error("useFlowData must be used within a <StoryboardProvider>");
  }
  const { data, loading, error } = context;
  const hashString = useSyncExternalStore(subscribeToHash, getHashSnapshot);
  const storageString = useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  const result = useMemo(() => {
    if (loading || error || data == null) return void 0;
    const hidden = isHideMode();
    const readParam = hidden ? getShadow : getParam;
    const readAllParams = hidden ? getAllShadows : getAllParams;
    if (!path) {
      const allParams2 = readAllParams();
      const keys = Object.keys(allParams2);
      if (keys.length === 0) return data;
      const merged = deepClone(data);
      for (const key of keys) setByPath(merged, key, allParams2[key]);
      return merged;
    }
    const exact = readParam(path);
    if (exact !== null) return exact;
    const prefix = path + ".";
    const allParams = readAllParams();
    const childKeys = Object.keys(allParams).filter((k2) => k2.startsWith(prefix));
    const sceneValue = getByPath(data, path);
    if (childKeys.length > 0 && sceneValue !== void 0) {
      const merged = deepClone(sceneValue);
      for (const key of childKeys) {
        const relativePath = key.slice(prefix.length);
        setByPath(merged, relativePath, allParams[key]);
      }
      return merged;
    }
    if (sceneValue === void 0) {
      if (!opts?.optional && data != null && Object.keys(data).length > 0) {
        console.warn(`[useFlowData] Path "${path}" not found in flow data.`);
      }
      return {};
    }
    return sceneValue;
  }, [data, loading, error, path, hashString, storageString]);
  return result;
}
const useSceneData = useFlowData;
function useFlowLoading() {
  const context = useContext(StoryboardContext);
  if (context === null) {
    throw new Error("useFlowLoading must be used within a <StoryboardProvider>");
  }
  return context.loading;
}
const useSceneLoading = useFlowLoading;
function useFlow() {
  const context = useContext(StoryboardContext);
  if (context === null) {
    throw new Error("useFlow must be used within a <StoryboardProvider>");
  }
  const switchFlow = useCallback((name) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("scene");
    url.searchParams.set("flow", name);
    sbNavigate(url.toString());
  }, []);
  return {
    flowName: context.flowName,
    switchFlow
  };
}
function useScene() {
  const { flowName, switchFlow } = useFlow();
  return {
    sceneName: flowName,
    switchScene: switchFlow
  };
}
function useFlows() {
  const context = useContext(StoryboardContext);
  if (context === null) {
    throw new Error("useFlows must be used within a <StoryboardProvider>");
  }
  const { flowName: activeFlow, prototypeName } = context;
  const flows = useMemo(() => {
    if (!prototypeName) return [];
    return getFlowsForPrototype(prototypeName).map((f3) => {
      const meta = getFlowMeta(f3.key);
      return {
        key: f3.key,
        name: f3.name,
        title: meta?.title || f3.name,
        route: resolveFlowRoute(f3.key)
      };
    });
  }, [prototypeName]);
  const switchFlow = useCallback((flowKey) => {
    const flow = flows.find((f3) => f3.key === flowKey);
    if (flow) {
      sbNavigate(flow.route);
    }
  }, [flows]);
  return {
    flows,
    activeFlow,
    switchFlow,
    prototypeName
  };
}
function applyRecordOverrides(baseRecords, resolvedName, plainName) {
  const allParams = isHideMode() ? getAllShadows() : getAllParams();
  const resolvedPrefix = `record.${resolvedName}.`;
  const plainPrefix = plainName && plainName !== resolvedName ? `record.${plainName}.` : null;
  const overrideKeys = Object.keys(allParams).filter(
    (k2) => k2.startsWith(resolvedPrefix) || plainPrefix && k2.startsWith(plainPrefix)
  );
  if (overrideKeys.length === 0) return baseRecords;
  const records = deepClone(baseRecords);
  const byEntryId = {};
  for (const key of overrideKeys) {
    const prefix = key.startsWith(resolvedPrefix) ? resolvedPrefix : plainPrefix;
    const rest = key.slice(prefix.length);
    const dotIdx = rest.indexOf(".");
    if (dotIdx === -1) continue;
    const entryId = rest.slice(0, dotIdx);
    const fieldPath = rest.slice(dotIdx + 1);
    if (!byEntryId[entryId]) byEntryId[entryId] = {};
    byEntryId[entryId][fieldPath] = allParams[key];
  }
  for (const [entryId, fields] of Object.entries(byEntryId)) {
    const existing = records.find((e3) => e3.id === entryId);
    if (existing) {
      for (const [fieldPath, value] of Object.entries(fields)) {
        setByPath(existing, fieldPath, value);
      }
    } else {
      const newEntry = { id: entryId };
      for (const [fieldPath, value] of Object.entries(fields)) {
        setByPath(newEntry, fieldPath, value);
      }
      records.push(newEntry);
    }
  }
  return records;
}
function useRecord(recordName, paramName = "id") {
  const params = useParams();
  const paramValue = params[paramName];
  const context = useContext(StoryboardContext);
  const prototypeName = context?.prototypeName ?? null;
  const hashString = useSyncExternalStore(subscribeToHash, getHashSnapshot);
  const storageString = useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  return useMemo(() => {
    if (!paramValue) return null;
    try {
      const resolvedName = resolveRecordName(prototypeName, recordName);
      const base = loadRecord(resolvedName);
      const merged = applyRecordOverrides(base, resolvedName, recordName);
      return merged.find((e3) => e3[paramName] === paramValue) ?? null;
    } catch (err) {
      console.error(`[useRecord] ${err.message}`);
      return null;
    }
  }, [recordName, paramName, paramValue, prototypeName, hashString, storageString]);
}
function useRecords(recordName) {
  const context = useContext(StoryboardContext);
  const prototypeName = context?.prototypeName ?? null;
  const hashString = useSyncExternalStore(subscribeToHash, getHashSnapshot);
  const storageString = useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  return useMemo(() => {
    try {
      const resolvedName = resolveRecordName(prototypeName, recordName);
      const base = loadRecord(resolvedName);
      return applyRecordOverrides(base, resolvedName, recordName);
    } catch (err) {
      console.error(`[useRecords] ${err.message}`);
      return [];
    }
  }, [recordName, prototypeName, hashString, storageString]);
}
function useObject(objectName, path) {
  const context = useContext(StoryboardContext);
  const prototypeName = context?.prototypeName ?? null;
  const hashString = useSyncExternalStore(subscribeToHash, getHashSnapshot);
  const storageString = useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  return useMemo(() => {
    const resolvedName = resolveObjectName(prototypeName, objectName);
    let data;
    try {
      data = loadObject(resolvedName);
    } catch (err) {
      console.error(`[useObject] ${err.message}`);
      return void 0;
    }
    const hidden = isHideMode();
    const readParam = hidden ? getShadow : getParam;
    const readAllParams = hidden ? getAllShadows : getAllParams;
    const resolvedPrefix = `object.${resolvedName}.`;
    const plainPrefix = objectName !== resolvedName ? `object.${objectName}.` : null;
    const allParams = readAllParams();
    const overrideKeys = Object.keys(allParams).filter(
      (k2) => k2.startsWith(resolvedPrefix) || plainPrefix && k2.startsWith(plainPrefix)
    );
    if (overrideKeys.length > 0) {
      data = deepClone(data);
      for (const key of overrideKeys) {
        const fieldPath = key.startsWith(resolvedPrefix) ? key.slice(resolvedPrefix.length) : key.slice(plainPrefix.length);
        setByPath(data, fieldPath, allParams[key]);
      }
    }
    if (!path) return data;
    const exactResolved = `${resolvedPrefix}${path}`;
    const exactPlain = plainPrefix ? `${plainPrefix}${path}` : null;
    const exact = readParam(exactResolved) ?? (exactPlain ? readParam(exactPlain) : null);
    if (exact !== null) return exact;
    const subResolved = exactResolved + ".";
    const subPlain = exactPlain ? exactPlain + "." : null;
    const childKeys = overrideKeys.filter(
      (k2) => k2.startsWith(subResolved) || subPlain && k2.startsWith(subPlain)
    );
    const baseValue = getByPath(data, path);
    if (childKeys.length > 0 && baseValue !== void 0) {
      const merged = deepClone(baseValue);
      for (const key of childKeys) {
        const relativePath = key.startsWith(subResolved) ? key.slice(subResolved.length) : key.slice(subPlain.length);
        setByPath(merged, relativePath, allParams[key]);
      }
      return merged;
    }
    if (baseValue === void 0) {
      console.warn(`[useObject] Path "${path}" not found in object "${objectName}".`);
      return void 0;
    }
    return baseValue;
  }, [objectName, prototypeName, path, hashString, storageString]);
}
function useLocalStorage(path) {
  const context = useContext(StoryboardContext);
  if (context === null) {
    throw new Error("useLocalStorage must be used within a <StoryboardProvider>");
  }
  const { data } = context;
  const sceneDefault = data != null ? getByPath(data, path) : void 0;
  useSyncExternalStore(subscribeToHash, getHashSnapshot);
  useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  const hashValue = getParam(path);
  const localValue = getLocal(path);
  const value = hashValue !== null ? hashValue : localValue !== null ? localValue : sceneDefault;
  const setValue = useCallback(
    (newValue) => {
      setLocal(path, newValue);
    },
    [path]
  );
  const clearValue = useCallback(() => {
    removeLocal(path);
  }, [path]);
  return [value, setValue, clearValue];
}
function useHideMode() {
  useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  const isHidden = isHideMode();
  const hide = useCallback(() => {
    activateHideMode();
  }, []);
  const show = useCallback(() => {
    deactivateHideMode();
  }, []);
  return { isHidden, hide, show };
}
function useUndoRedo() {
  useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  useSyncExternalStore(subscribeToHash, getHashSnapshot);
  const handleUndo = useCallback(() => undo(), []);
  const handleRedo = useCallback(() => redo(), []);
  return {
    undo: handleUndo,
    redo: handleRedo,
    canUndo: canUndo(),
    canRedo: canRedo()
  };
}
function useMode() {
  useSyncExternalStore(subscribeToMode, getModeSnapshot);
  const mode = getCurrentMode();
  const modes = getRegisteredModes();
  const currentModeConfig = modes.find((m2) => m2.name === mode);
  const switchMode = useCallback((name, options) => {
    activateMode(name, options);
  }, []);
  return {
    mode,
    modes,
    switchMode,
    currentModeConfig
  };
}
function useConfig(domain) {
  const snapshot = useSyncExternalStore(subscribeToConfig, getConfigSnapshot);
  return useCallback(() => getConfig(domain), [snapshot, domain])();
}
const FormContext = createContext(null);
export {
  e2 as CanvasToolButton,
  h2 as CanvasToolMenuItem,
  i2 as CanvasToolMenuLabel,
  j2 as CanvasToolValue,
  d2 as CanvasToolsGroup,
  f2 as CanvasToolsPopup,
  C as CanvasToolsSurface,
  FormContext,
  I as Icon,
  K as KnobsForm,
  N as NotebookShellAction,
  a2 as NotebookShellFooter,
  b as NotebookShellFrame,
  c as NotebookShellHeader,
  d as NotebookShellIconButton,
  e as NotebookShellNavigation,
  f as NotebookShellNotice,
  g as NotebookShellNoticeActions,
  h as NotebookShellPanelHeader,
  i as NotebookShellRow,
  j as NotebookShellSearch,
  k as NotebookShellSidebar,
  l as NotebookShellSidebarResizeHandle,
  m as NotebookShellTab,
  n as NotebookShellTopbar,
  StoryboardContext,
  default2 as StoryboardProvider,
  installHashPreserver,
  o as notebookShellButtonGroup,
  p as notebookShellControl,
  q as notebookShellHeaderGeometry,
  r as notebookShellTitle,
  useConfig,
  useFeatureFlag,
  useFlow,
  useFlowData,
  useFlowLoading,
  useFlows,
  useHideMode,
  u4 as useKnob,
  useLocalStorage,
  useMode,
  useObject,
  u as useOverride,
  useRecord,
  useRecords,
  useScene,
  useSceneData,
  useSceneLoading,
  u2 as useSession,
  u3 as useThemeState,
  a as useThemeSyncTargets,
  useUndoRedo
};
