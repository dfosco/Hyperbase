import { useState, useRef, useLayoutEffect, useCallback, useEffect } from "react";
function frameDocumentReady(iframe) {
  try {
    if (!iframe) return false;
    void iframe.contentWindow?.location?.href;
    const doc = iframe.contentDocument;
    if (!doc) return true;
    if (!doc.body || doc.readyState === "loading" || doc.contentType === "text/plain") return false;
    if (doc.querySelector('[data-hc-full-error], [data-sb-render-state="error"], [data-sb-render-state="loading"], vite-error-overlay, [data-hc-recovery-controls]')) return false;
    const readiness = iframe.contentWindow?.__hypercanvasInitialLoad?.routeReadiness?.();
    if (doc.documentElement.hasAttribute("data-hc-route-commit-required") && (!readiness?.committed || readiness.current !== true)) return false;
    const root = doc.getElementById("root");
    if (root && !root.hasChildNodes()) return false;
    if (iframe.contentWindow?.__hypercanvasCaptureReady === false || [...doc.querySelectorAll('[aria-busy="true"]')].some((node) => node.getClientRects().length)) return false;
    return Boolean(doc.body.children.length || doc.body.textContent?.trim());
  } catch {
    return true;
  }
}
const now = () => performance.now();
const MARKERS = '[data-hc-full-error], [data-sb-render-state], vite-error-overlay, [data-hc-recovery-controls], [aria-busy="true"]';
const EMPTY = { phase: "unloaded", started: null, elapsed: null, opaque: false, error: "" };
function useObservedFrameLifecycle({ iframeRef, source, debug = false, interactive = false, starting = false, error = "", onReady }) {
  const [observed, setObserved] = useState(EMPTY);
  const [tick, setTick] = useState(0);
  const current = useRef(EMPTY);
  const latest = useRef({ onReady });
  const cleanup = useRef(() => {
  });
  const navigationCleanup = useRef(() => {
  });
  const documentRef = useRef(null);
  const departingDocument = useRef(null);
  const detached = useRef(null);
  const previousSource = useRef(source);
  useLayoutEffect(() => {
    latest.current = { onReady };
  });
  const publish = useCallback((next) => {
    current.current = next;
    setObserved(next);
  }, []);
  const restart = useCallback(() => {
    cleanup.current();
    try {
      departingDocument.current = iframeRef.current?.contentDocument;
    } catch {
      departingDocument.current = null;
    }
    publish({ phase: "loading", started: now(), elapsed: null, opaque: false, error: "" });
  }, [iframeRef, publish]);
  const fail = useCallback((message = "Document failed to load") => {
    cleanup.current();
    const state = current.current;
    publish({ ...state, phase: "error", elapsed: state.started === null ? null : (now() - state.started) / 1e3, error: message });
  }, [publish]);
  const onLoad = useCallback(({ resume = false } = {}) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc, child, opaque = false;
    try {
      child = iframe.contentWindow;
      void child?.location.href;
      doc = iframe.contentDocument;
    } catch {
      opaque = true;
    }
    if (doc?.URL === "about:blank" && iframe.getAttribute("src") !== "about:blank") return;
    if (!resume && doc && current.current.phase === "loading" && doc === departingDocument.current) return;
    if (!resume && doc && doc === documentRef.current && current.current.phase === "ready") return;
    cleanup.current();
    navigationCleanup.current();
    documentRef.current = doc;
    if (current.current.phase !== "loading" && !resume) restart();
    let timer, stopped = false, observer, waitingSince = now();
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      observer?.disconnect();
    };
    cleanup.current = stop;
    const check = () => {
      if (stopped || iframeRef.current !== iframe) return;
      try {
        if (doc && iframe.contentDocument !== doc) return stop();
      } catch {
        return stop();
      }
      if (doc?.querySelector('[data-hc-full-error], [data-sb-render-state="error"], vite-error-overlay, [data-hc-recovery-controls]') || doc?.contentType === "text/plain") {
        clearTimeout(timer);
        if (current.current.phase !== "error") {
          const state = current.current;
          publish({ ...state, phase: "error", elapsed: state.started === null ? null : (now() - state.started) / 1e3, error: "Page reported an error" });
        }
        return;
      }
      if (current.current.phase === "error") {
        waitingSince = now();
        publish({ ...current.current, phase: "loading", elapsed: null, error: "" });
      }
      if (opaque || frameDocumentReady(iframe)) {
        clearTimeout(timer);
        if (current.current.phase === "ready") return;
        const state = current.current;
        publish({ ...state, phase: "ready", opaque, elapsed: (now() - state.started) / 1e3 });
        latest.current.onReady?.();
        return;
      }
      if (current.current.phase === "ready") {
        waitingSince = now();
        publish({ phase: "loading", started: now(), elapsed: null, opaque: false, error: "" });
      }
      if (now() - waitingSince >= 3e4) {
        clearTimeout(timer);
        const state = current.current;
        publish({ ...state, phase: "error", elapsed: (now() - state.started) / 1e3, error: "Page readiness not confirmed after 30s" });
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(check, 100);
    };
    if (doc) {
      observer = new MutationObserver((records) => {
        if (current.current.phase === "loading" || records.some(
          (record) => record.type === "attributes" || record.target === doc.getElementById("root") || [...record.addedNodes, ...record.removedNodes].some((node) => node.matches?.(MARKERS) || node.querySelector?.(MARKERS))
        )) check();
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-hc-full-error", "data-sb-render-state", "data-hc-recovery-controls", "aria-busy", "data-hc-route-commit-required"] });
      child?.addEventListener("beforeunload", restart);
      navigationCleanup.current = () => child?.removeEventListener("beforeunload", restart);
    }
    check();
  }, [iframeRef, publish, restart]);
  const attach = useCallback((iframe) => {
    if (!iframe && iframeRef.current) {
      try {
        detached.current = { iframe: iframeRef.current, doc: iframeRef.current.contentDocument, state: current.current };
      } catch {
        detached.current = null;
      }
    }
    iframeRef.current = iframe;
    if (iframe) {
      const retained = detached.current;
      detached.current = null;
      let sameDocument = false;
      try {
        sameDocument = retained?.iframe === iframe && retained.doc === iframe.contentDocument;
      } catch {
      }
      if (sameDocument && retained.state.phase === "ready") {
        publish(retained.state);
        onLoad({ resume: true });
      } else restart();
    } else {
      cleanup.current();
      navigationCleanup.current();
      documentRef.current = null;
      publish(EMPTY);
    }
  }, [iframeRef, publish, restart, onLoad]);
  useLayoutEffect(() => {
    const before = previousSource.current;
    previousSource.current = source;
    if (!iframeRef.current || before === source) return;
    if (before && source) {
      const previous = new URL(before, document.baseURI), next = new URL(source, document.baseURI);
      if (previous.origin === next.origin && previous.pathname === next.pathname && previous.search === next.search) return;
    }
    restart();
  }, [iframeRef, restart, source]);
  useEffect(() => {
    if (error) fail(error);
  }, [error, fail]);
  useEffect(() => () => {
    cleanup.current();
    navigationCleanup.current();
  }, []);
  useEffect(() => {
    if (!debug || observed.phase !== "loading") return;
    const timer = setInterval(() => setTick(now()), 100);
    return () => clearInterval(timer);
  }, [debug, observed.phase]);
  const phase = error ? "error" : starting ? "starting" : observed.phase === "ready" ? observed.opaque ? "loaded (opaque)" : interactive ? "interactive" : "idle" : observed.phase;
  const elapsed = observed.elapsed ?? (observed.started === null ? null : (Math.max(tick, now()) - observed.started) / 1e3);
  return { phase, elapsed, loading: !error && (starting || observed.phase === "loading"), ready: observed.phase === "ready", error: error || observed.error, attach, onLoad, onError: () => fail(), restart };
}
const FRAME_HEADER_HEIGHT = 37;
function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
function prototypeContentViewport({ width = 800, height = 600, zoom = 100 } = {}) {
  const scale = positive(zoom, 100) / 100;
  return {
    width: Math.round(positive(width, 800) / scale),
    height: Math.round(Math.max(0, positive(height, 600) - FRAME_HEADER_HEIGHT) / scale)
  };
}
function siteContentViewport({ width = 800, height = 600 } = {}) {
  return {
    width: Math.round(positive(width, 800)),
    height: Math.round(Math.max(0, positive(height, 600) - FRAME_HEADER_HEIGHT))
  };
}
function frameTargetIdentityKey(target = {}) {
  return JSON.stringify({
    kind: target.kind === "site" ? "site" : "prototype",
    src: target.kind === "site" ? void 0 : target.src,
    siteId: target.kind === "site" ? target.siteId : void 0,
    route: target.kind === "site" ? target.route : void 0,
    zoom: target.kind === "site" ? void 0 : target.zoom
  });
}
function storyFramePreviewIdentityKey(target = {}) {
  const src = String(target.src || "");
  const hashAt = src.indexOf("#");
  const hash = hashAt < 0 ? "" : src.slice(hashAt);
  const head = hashAt < 0 ? src : src.slice(0, hashAt);
  const queryAt = head.indexOf("?");
  let source = head;
  if (queryAt >= 0) {
    const query = head.slice(queryAt + 1).split("&").filter((part) => {
      try {
        return !["theme", "_sb_canvas_theme"].includes(decodeURIComponent(part.split("=", 1)[0].replace(/\+/g, " ")));
      } catch {
        return true;
      }
    }).join("&");
    source = head.slice(0, queryAt) + (query ? `?${query}` : "");
  }
  return frameTargetIdentityKey({ ...target, src: source + hash, zoom: void 0 });
}
const CAPTURE_DEBOUNCE_MS = 500;
const pendingInventories = /* @__PURE__ */ new Map();
if (typeof window !== "undefined") window.addEventListener("storyboard:notebook-switch", () => pendingInventories.clear());
async function readInventory(canvasId) {
  const url = `${apiBase()}/_hypercanvas/frame-snapshot/inventory?${new URLSearchParams({ canvasId })}`;
  if (!pendingInventories.has(url)) {
    const pending = fetch(url).then((response) => response.ok ? response.json() : null).finally(() => {
      if (pendingInventories.get(url) === pending) pendingInventories.delete(url);
    });
    pendingInventories.set(url, pending);
  }
  return pendingInventories.get(url);
}
const EVENT_NAME = "storyboard:frame-snapshot:updated";
function apiBase() {
  return (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
}
function serializeTarget(target) {
  const params = {};
  for (const [key, value] of Object.entries(target || {})) {
    if (value !== void 0 && value !== null && value !== "") params[key] = String(value);
  }
  return params;
}
function frameSnapshotRequestKey(target, theme) {
  return target ? JSON.stringify([Object.entries(serializeTarget(target)).sort(([a], [b]) => a.localeCompare(b)), theme || ""]) : null;
}
function hasThemePreview(descriptor, theme) {
  return Boolean(descriptor?.variants?.[theme]?.dataUrl || descriptor?.[theme]?.dataUrl);
}
function hasPreview(descriptor) {
  return Boolean(descriptor?.light?.dataUrl || descriptor?.dark?.dataUrl || Object.values(descriptor?.variants || {}).some((entry) => entry.dataUrl));
}
function previewIdentity(target, themePolicy) {
  return themePolicy === "configured-story" ? storyFramePreviewIdentityKey(target) : frameTargetIdentityKey({ ...target, zoom: void 0 });
}
function inventoryDescriptor(frame, generation, theme, themePolicy = frame?.themePolicy) {
  if (!frame) return null;
  const variants = Object.fromEntries(Object.entries(frame.snapshot?.themes || {}).map(([id, entry]) => [id, {
    ...entry,
    status: themePolicy && entry.themePolicy !== themePolicy ? "mismatch" : entry.status,
    dataUrl: entry.url && entry.matchesCurrentSource !== false && (!themePolicy || entry.themePolicy === themePolicy) ? `${apiBase()}${entry.url}` : null
  }]));
  const selected = variants[theme] || variants.light || Object.values(variants).find((entry) => entry.exists);
  return {
    ...frame,
    generation,
    variants,
    light: variants.light || null,
    dark: variants.dark || null,
    allThemesMatch: Object.keys(variants).length > 0 && Object.values(variants).every((entry) => entry.exists && entry.status === "ready"),
    status: selected?.exists ? selected.status === "ready" ? "ready" : "stale" : frame.error ? "error" : "missing",
    stale: Boolean(selected?.exists && selected.status !== "ready"),
    error: frame.error || frame.snapshot?.error
  };
}
function matchesRequestedFrame(frame, target) {
  if (!frame?.target) return false;
  const viewport = target.kind === "site" ? siteContentViewport(target) : prototypeContentViewport(target);
  if (frame.viewport?.width !== viewport.width || frame.viewport?.height !== viewport.height) return false;
  if (target.kind === "site") return frame.target.siteId === target.siteId && frame.target.route === (target.route || "").replace(/^\/+/, "");
  let src = String(target.src || "");
  if (/^https?:\/\//i.test(src)) {
    const url = new URL(src);
    src = `${url.pathname}${url.search}${url.hash}`;
  } else src = src.replace(/^\/branch--[^/]+/, "");
  return frame.target.src === src && frame.target.zoom === Number(target.zoom || 100);
}
async function readFrameSnapshotApi(target, { theme, canvasId, widgetId, themePolicy } = {}) {
  if (canvasId && widgetId) {
    const payload = await readInventory(canvasId);
    if (!payload) return null;
    const frame = payload.frames?.find((entry) => entry.widgetId === widgetId);
    const descriptor = inventoryDescriptor(frame, payload.generation, theme, themePolicy);
    if (!descriptor) return null;
    descriptor.matchesRequestedFrame = matchesRequestedFrame(frame, target);
    if (!themePolicy && frame.snapshot && Object.values(frame.snapshot.themes).some((entry) => entry.legacy)) {
      const legacy = await readFrameSnapshotApi(target, { theme });
      for (const [id, variant] of Object.entries(descriptor.variants)) {
        if (variant.legacy && legacy?.[id]) descriptor.variants[id] = legacy[id];
      }
      descriptor.light = descriptor.variants.light || null;
      descriptor.dark = descriptor.variants.dark || null;
    }
    return descriptor;
  }
  const params = new URLSearchParams(serializeTarget(target));
  if (theme) params.set("theme", theme);
  const response = await fetch(`${apiBase()}/_hypercanvas/frame-snapshot?${params}`);
  if (!response.ok) return null;
  const { snapshot } = await response.json().catch(() => ({ snapshot: null }));
  return snapshot || null;
}
async function captureFrameSnapshotApi(target, { theme, force = false, widgetId, canvasId, sourceKey, origin, generation, themePolicy } = {}) {
  if (typeof generation !== "string" || !/^[a-f0-9]{32}$/.test(generation)) {
    throw Object.assign(new Error("Frame capture has no original Notebook generation; reload the Frame"), { code: "CAPTURE_OBSOLETE" });
  }
  const scoped = Boolean(canvasId && widgetId);
  if (scoped && !sourceKey) throw Object.assign(new Error("Frame target changed before capture; reload inventory"), { code: "CAPTURE_OBSOLETE" });
  const response = await fetch(`${apiBase()}/_hypercanvas/frame-snapshot${scoped ? "/capture-widget" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scoped ? { canvasId, widgetId, sourceKey, generation, theme, force } : {
      ...serializeTarget(target),
      theme: theme || "light",
      force,
      generation,
      ...widgetId ? { widgetId } : {},
      origin: origin ?? (typeof window !== "undefined" ? window.location.origin : void 0)
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || "Frame capture failed"), { code: payload?.code });
  }
  return scoped ? inventoryDescriptor(payload?.frame, payload?.generation, theme, themePolicy) : payload?.snapshot || null;
}
function useFrameSnapshot({ target, theme, captureTheme = null, autoCapture = true, widgetId = null, canvasId = null, themePolicy = null } = {}) {
  const [entry, setEntry] = useState({ key: null, descriptor: null });
  const requestToken = useRef(0);
  const debounceTimer = useRef(null);
  const lastReadyRef = useRef(null);
  const originalGeneration = useRef(null);
  const [lastReady, setLastReady] = useState(null);
  const rememberReady = useCallback((identityKey, descriptor) => {
    lastReadyRef.current = { identityKey, descriptor };
    setLastReady(lastReadyRef.current);
  }, []);
  const currentKey = frameSnapshotRequestKey(target, theme);
  const activeKey = useRef(currentKey);
  useLayoutEffect(() => {
    activeKey.current = currentKey;
    requestToken.current += 1;
    return () => {
      activeKey.current = null;
      requestToken.current += 1;
    };
  }, [currentKey]);
  const recordCaptureFailure = useCallback((token, key, identityKey, cause) => {
    if (token !== requestToken.current) return;
    const ready = lastReadyRef.current;
    if (ready?.identityKey === identityKey && ready?.descriptor) return;
    setEntry({ key, descriptor: { status: "error", light: null, dark: null, error: { code: cause?.code || "FRAME_CAPTURE_FAILED", message: cause?.message || "Frame capture failed" } } });
  }, []);
  const initializing = Boolean(target) && entry.key !== currentKey;
  const retained = target && lastReady?.identityKey === previewIdentity(target, themePolicy) && hasThemePreview(lastReady.descriptor, theme) ? { ...lastReady.descriptor, status: "stale", stale: true } : null;
  const snapshot = entry.key !== null && entry.key === currentKey ? entry.descriptor : retained;
  const load = useCallback(async ({ capture = false, force = false, onlyIfMismatch = false, onlyIfMissing = false, target: requestedTarget = target, theme: requestedTheme = theme } = {}) => {
    if (!requestedTarget) {
      setEntry({ key: null, descriptor: null });
      return;
    }
    const token = ++requestToken.current;
    const generationAtStart = originalGeneration.current;
    const key = frameSnapshotRequestKey(requestedTarget, requestedTheme);
    const isCurrent = () => token === requestToken.current && key === activeKey.current;
    let next = null;
    try {
      next = await readFrameSnapshotApi(requestedTarget, { theme: requestedTheme, canvasId, widgetId, themePolicy });
    } catch {
    }
    if (!originalGeneration.current && isCurrent() && /^[a-f0-9]{32}$/.test(next?.generation || "")) {
      originalGeneration.current = next.generation;
    }
    const identityKey = previewIdentity(requestedTarget, themePolicy);
    const lastReady2 = lastReadyRef.current;
    const carried = lastReady2?.identityKey === identityKey && hasThemePreview(lastReady2.descriptor, requestedTheme) && (!next || next.status === "missing" || next.status === "error") ? { ...lastReady2.descriptor, status: "stale", stale: true } : null;
    const failure = !next && !carried ? { status: "error", light: null, dark: null, error: { code: "FRAME_SNAPSHOT_UNAVAILABLE", message: "Preview service unavailable — restart Hypercanvas and reload" } } : null;
    const display = carried || next || failure;
    if (isCurrent()) setEntry({ key, descriptor: display });
    if (isCurrent() && display && !carried && hasPreview(display) && display.status !== "stale") {
      rememberReady(identityKey, display);
    }
    if (capture && force) {
      if ((onlyIfMismatch || onlyIfMissing) && next?.matchesRequestedFrame !== false && (next?.allThemesMatch || onlyIfMissing && !canvasId && next?.status === "ready" && (next?.variants ? Object.values(next.variants).every((entry2) => entry2.exists && entry2.status === "ready") : Boolean(next?.[requestedTheme]?.dataUrl)))) return;
      try {
        if (next?.matchesRequestedFrame === false) throw Object.assign(new Error("Materialized Frame has changed; capture discarded"), { code: "CAPTURE_OBSOLETE" });
        const fresh = await captureFrameSnapshotApi(requestedTarget, { theme: canvasId && widgetId ? "both" : captureTheme || requestedTheme || "light", force: !(onlyIfMismatch && canvasId && widgetId), widgetId, canvasId, sourceKey: next?.sourceKey, generation: generationAtStart, themePolicy });
        if (!isCurrent() || !fresh) return;
        setEntry({ key, descriptor: fresh });
        if (hasPreview(fresh)) rememberReady(identityKey, fresh);
      } catch (cause) {
        if (isCurrent()) recordCaptureFailure(token, key, identityKey, cause);
      }
      return;
    }
    if (!autoCapture || !isCurrent()) return;
    if (display.status !== "missing" && display.status !== "stale") return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const captureGeneration = originalGeneration.current;
    debounceTimer.current = setTimeout(() => {
      void (async () => {
        const captureToken = requestToken.current;
        if (key !== activeKey.current) return;
        try {
          if (next?.matchesRequestedFrame === false) return;
          const fresh = await captureFrameSnapshotApi(target, { theme: canvasId && widgetId ? "both" : captureTheme || theme || "light", widgetId, canvasId, sourceKey: next?.sourceKey, generation: captureGeneration, themePolicy });
          if (captureToken !== requestToken.current || key !== activeKey.current || !fresh) return;
          setEntry({ key, descriptor: fresh });
          if (hasPreview(fresh)) rememberReady(identityKey, fresh);
        } catch (cause) {
          recordCaptureFailure(captureToken, key, identityKey, cause);
        }
      })();
    }, CAPTURE_DEBOUNCE_MS);
  }, [autoCapture, canvasId, captureTheme, recordCaptureFailure, rememberReady, target, theme, themePolicy, widgetId]);
  useEffect(() => {
    requestToken.current += 1;
    if (!target) return void 0;
    void load();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [load, target]);
  useEffect(() => {
    function handleUpdate(event) {
      const data = event?.detail;
      if (!data) return;
      const current = lastReadyRef.current?.descriptor;
      const matches = current?.sourceKey && data.sourceKey === current.sourceKey || widgetId && data.widgetId === widgetId;
      if (matches) void load();
    }
    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(EVENT_NAME, handleUpdate);
  }, [load, widgetId]);
  useEffect(() => () => {
    requestToken.current += 1;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);
  const reload = useCallback((options = {}) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    return load(options);
  }, [load]);
  return { snapshot, initializing, reload };
}
const refreshIdentity = (target) => frameTargetIdentityKey({ ...target, zoom: void 0 });
function useFrameSnapshotLifecycle({ target, theme, enabled = true, interactive = false, snapshotReady = true, rootRef, iframeRef, reload, getCurrentTarget, onInteractionEnd }) {
  const latest = useRef(null);
  const dirty = useRef(false);
  const mismatchOnly = useRef(false);
  const timer = useRef(null);
  const running = useRef(null);
  const pending = useRef(null);
  const key = frameSnapshotRequestKey(target, theme);
  const previous = useRef(key);
  const loadTimer = useRef(null);
  const loadedDocument = useRef(null);
  const refreshing = useRef(null);
  useLayoutEffect(() => {
    latest.current = { target, theme, enabled, interactive, snapshotReady, reload, getCurrentTarget, onInteractionEnd };
  });
  const enqueue = useCallback((current, onlyIfMismatch = false, onlyIfMissing = false) => {
    const request = { target: current.getCurrentTarget?.() || current.target, theme: current.theme };
    pending.current = { ...request, reload: current.reload, ...onlyIfMissing ? { onlyIfMissing: true } : {}, ...onlyIfMismatch ? { onlyIfMismatch: true } : {} };
    if (running.current) return running.current;
    const drain = async () => {
      while (pending.current) {
        const next = pending.current;
        pending.current = null;
        await next.reload({ capture: true, force: true, target: next.target, theme: next.theme, ...next.onlyIfMissing ? { onlyIfMissing: true } : {}, ...next.onlyIfMismatch ? { onlyIfMismatch: true } : {} });
      }
    };
    running.current = drain().finally(() => {
      running.current = null;
    });
    return running.current;
  }, []);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const current = latest.current;
    if (!current?.enabled || !current.target || !dirty.current || refreshing.current) return running.current;
    if (iframeRef.current && !frameDocumentReady(iframeRef.current)) return running.current;
    dirty.current = false;
    const onlyIfMismatch = mismatchOnly.current;
    mismatchOnly.current = false;
    return enqueue(current, onlyIfMismatch);
  }, [enqueue, iframeRef]);
  const prepareRefresh = useCallback(({ target: target2 = latest.current?.target } = {}) => {
    if (!latest.current?.enabled || !iframeRef.current) return;
    let doc;
    try {
      doc = iframeRef.current.contentDocument;
    } catch {
    }
    refreshing.current = { iframe: iframeRef.current, doc, identity: refreshIdentity(target2) };
    dirty.current = true;
    mismatchOnly.current = false;
    clearTimeout(timer.current);
    clearTimeout(loadTimer.current);
  }, [iframeRef]);
  const onLoad = useCallback(() => {
    clearTimeout(loadTimer.current);
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc;
    try {
      doc = iframe.contentDocument;
    } catch {
    }
    if (doc && refreshing.current?.iframe === iframe && refreshing.current.doc === doc) return;
    const identity = doc || iframe;
    const requestKey = frameSnapshotRequestKey(latest.current?.target, latest.current?.theme);
    if (!refreshing.current && loadedDocument.current?.identity === identity && loadedDocument.current?.key === requestKey && (doc || running.current)) return;
    let attempts = 0;
    const check = () => {
      const current = latest.current;
      if (iframeRef.current !== iframe || !current?.enabled || requestKey !== frameSnapshotRequestKey(current.target, current.theme)) return;
      try {
        if (doc && iframe.contentDocument !== doc) return;
      } catch {
        return;
      }
      if (current.snapshotReady && frameDocumentReady(iframe)) {
        loadedDocument.current = { identity, key: requestKey };
        if (refreshing.current) {
          refreshing.current = null;
          dirty.current = false;
          mismatchOnly.current = false;
          clearTimeout(timer.current);
          if (current.target) void enqueue(current);
        } else if (current.target) void enqueue(current, true, true);
        return;
      }
      if (++attempts < 100) loadTimer.current = setTimeout(check, 100);
    };
    check();
  }, [enqueue, iframeRef]);
  useEffect(() => () => clearTimeout(loadTimer.current), []);
  const markDirty = useCallback(({ settle = false, onlyIfMismatch = false } = {}) => {
    if (!latest.current?.enabled || !latest.current.target) return;
    mismatchOnly.current = dirty.current ? mismatchOnly.current && onlyIfMismatch : onlyIfMismatch;
    dirty.current = true;
    clearTimeout(timer.current);
    if (settle || !latest.current.interactive) timer.current = setTimeout(flush, 500);
  }, [flush]);
  useLayoutEffect(() => () => {
    void flush();
    refreshing.current = null;
    clearTimeout(timer.current);
  }, [flush]);
  useEffect(() => {
    if (key !== previous.current) {
      const before = previous.current;
      previous.current = key;
      if (refreshing.current && refreshing.current.identity !== refreshIdentity(target)) {
        refreshing.current = null;
        dirty.current = false;
        mismatchOnly.current = false;
        clearTimeout(timer.current);
        clearTimeout(loadTimer.current);
        return;
      }
      if (before && key) {
        const priorTarget = JSON.parse(before)[0];
        const dimensions = (entries) => JSON.stringify(entries.filter(([name]) => ["width", "height", "zoom"].includes(name)));
        const resized = dimensions(priorTarget) !== dimensions(JSON.parse(key)[0]);
        markDirty({ settle: resized, onlyIfMismatch: resized });
      }
    }
  }, [key, markDirty, target]);
  useEffect(() => {
    if (interactive) markDirty();
    else if (dirty.current) void flush();
  }, [flush, interactive, markDirty]);
  useEffect(() => {
    let focusTimer;
    const inside = (node) => Boolean(node && (rootRef.current?.contains(node) || iframeRef.current === node || iframeRef.current?.parentElement?.contains(node)));
    const end = () => {
      if (!latest.current?.enabled) return;
      latest.current.onInteractionEnd?.();
      void flush();
    };
    const outside = (event) => {
      if (!inside(event.target)) end();
    };
    const focusout = (event) => {
      if (!inside(event.target) || inside(event.relatedTarget)) return;
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (document.activeElement === iframeRef.current && document.hasFocus()) return;
        end();
      }, 0);
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") end();
    };
    const blur = () => queueMicrotask(() => {
      if (!document.hasFocus() || document.activeElement !== iframeRef.current) end();
    });
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside, true);
    document.addEventListener("focusout", focusout, true);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", end);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside, true);
      document.removeEventListener("focusout", focusout, true);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", end);
      clearTimeout(focusTimer);
      clearTimeout(timer.current);
    };
  }, [flush, iframeRef, rootRef]);
  return { markDirty, flush, onLoad, prepareRefresh };
}
function readCanvasFrameTheme() {
  if (typeof localStorage === "undefined") return "light";
  try {
    if (!JSON.parse(localStorage.getItem("sb-theme-sync") || "{}").canvas) return "light";
    const attribute = document.documentElement.getAttribute("data-sb-canvas-theme");
    if (attribute) return attribute;
    const stored = localStorage.getItem("sb-color-scheme") || "system";
    return stored === "system" ? window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light" : stored;
  } catch {
    return "light";
  }
}
function useCanvasFrameTheme() {
  const [theme, setTheme] = useState(readCanvasFrameTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches || false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const sync = () => {
      setTheme(readCanvasFrameTheme());
      setSystemDark(media?.matches || false);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sb-canvas-theme"] });
    document.addEventListener("storyboard:theme:changed", sync);
    window.addEventListener("storage", sync);
    media?.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("storyboard:theme:changed", sync);
      window.removeEventListener("storage", sync);
      media?.removeEventListener("change", sync);
    };
  }, []);
  return { theme, systemDark };
}
export {
  FRAME_HEADER_HEIGHT as F,
  useObservedFrameLifecycle as a,
  useFrameSnapshot as b,
  useFrameSnapshotLifecycle as c,
  prototypeContentViewport as p,
  useCanvasFrameTheme as u
};
