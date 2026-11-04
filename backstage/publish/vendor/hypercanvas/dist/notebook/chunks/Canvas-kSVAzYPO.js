import { jsx } from "react/jsx-runtime";
import React__default, { useRef, useState, useEffect, useCallback, useLayoutEffect, Children } from "react";
import { a as acquireIframePointerLock } from "./iframePointerLock-CuQbsxGb.js";
var r = { dragStart: true }, o = { delay: 0, distance: 3 };
function a(t, e = {}) {
  let n, a2, { bounds: g2, axis: h2 = "both", gpuAcceleration: p = true, legacyTranslate: m = false, transform: y, applyUserSelectHack: w = true, disabled: b = false, ignoreMultitouch: D = false, recomputeBounds: v = r, grid: E, threshold: S = o, position: x, cancel: A, handle: C, defaultClass: M = "neodrag", defaultClassDragging: N = "neodrag-dragging", defaultClassDragged: B = "neodrag-dragged", defaultPosition: H = { x: 0, y: 0 }, onDragStart: R, onDrag: T, onDragEnd: $ } = e, L = false, X = false, Y = 0, q = false, P = false, k = 0, z = 0, I = 0, U = 0, W = 0, j = 0, { x: F, y: G } = x ? { x: x?.x ?? 0, y: x?.y ?? 0 } : H;
  ot(F, G);
  let J, K, O, Q, V, Z = "", _ = !!x;
  v = { ...r, ...v }, S = { ...o, ...S ?? {} };
  let tt = /* @__PURE__ */ new Set();
  function et(t2) {
    L && !X && P && q && V && (X = true, (function(t3) {
      at("neodrag:start", R, t3);
    })(t2), rt.add(N), w && (Z = nt.userSelect, nt.userSelect = "none"));
  }
  const nt = document.body.style, rt = t.classList;
  function ot(e2 = k, n2 = z) {
    if (!y) {
      if (m) {
        let r3 = `${+e2}px, ${+n2}px`;
        return u(t, "transform", p ? `translate3d(${r3}, 0)` : `translate(${r3})`);
      }
      return u(t, "translate", `${+e2}px ${+n2}px`);
    }
    const r2 = y({ offsetX: e2, offsetY: n2, rootNode: t });
    d(r2) && u(t, "transform", r2);
  }
  function at(e2, n2, r2) {
    const o2 = /* @__PURE__ */ (function(e3) {
      return { offsetX: k, offsetY: z, rootNode: t, currentNode: V, event: e3 };
    })(r2);
    t.dispatchEvent(new CustomEvent(e2, { detail: o2 })), n2?.(o2);
  }
  const it = addEventListener, dt = new AbortController(), lt = { signal: dt.signal, capture: false };
  function st() {
    let e2 = t.offsetWidth / K.width;
    return isNaN(e2) && (e2 = 1), e2;
  }
  return u(t, "touch-action", "none"), it("pointerdown", ((e2) => {
    if (b) return;
    if (2 === e2.button) return;
    if (tt.add(e2.pointerId), D && tt.size > 1) return e2.preventDefault();
    if (v.dragStart && (J = c(g2, t)), d(C) && d(A) && C === A) throw new Error("`handle` selector can't be same as `cancel` selector");
    if (rt.add(M), O = (function(t2, e3) {
      if (!t2) return [e3];
      if (f(t2)) return [t2];
      if (Array.isArray(t2)) return t2;
      const n2 = e3.querySelectorAll(t2);
      if (null === n2) throw new Error("Selector passed for `handle` option should be child of the element on which the action is applied");
      return Array.from(n2.values());
    })(C, t), Q = (function(t2, e3) {
      if (!t2) return [];
      if (f(t2)) return [t2];
      if (Array.isArray(t2)) return t2;
      const n2 = e3.querySelectorAll(t2);
      if (null === n2) throw new Error("Selector passed for `cancel` option should be child of the element on which the action is applied");
      return Array.from(n2.values());
    })(A, t), n = /(both|x)/.test(h2), a2 = /(both|y)/.test(h2), s(Q, O)) throw new Error("Element being dragged can't be a child of the element on which `cancel` is applied");
    const r2 = e2.composedPath()[0];
    if (!O.some(((t2) => t2.contains(r2) || t2.shadowRoot?.contains(r2))) || s(Q, [r2])) return;
    V = 1 === O.length ? t : O.find(((t2) => t2.contains(r2))), L = true, Y = Date.now(), S.delay || (q = true), K = t.getBoundingClientRect();
    const { clientX: o2, clientY: i2 } = e2, l2 = st();
    n && (I = o2 - F / l2), a2 && (U = i2 - G / l2), J && (W = o2 - K.left, j = i2 - K.top);
  }), lt), it("pointermove", ((e2) => {
    if (!L || D && tt.size > 1) return;
    if (!X) {
      if (!q) {
        Date.now() - Y >= S.delay && (q = true, et(e2));
      }
      if (!P) {
        const t2 = e2.clientX - I, n2 = e2.clientY - U;
        Math.sqrt(t2 ** 2 + n2 ** 2) >= S.distance && (P = true, et(e2));
      }
      if (!X) return;
    }
    v.drag && (J = c(g2, t)), e2.preventDefault(), K = t.getBoundingClientRect();
    let r2 = e2.clientX, o2 = e2.clientY;
    const d2 = st();
    if (J) {
      const t2 = { left: J.left + W, top: J.top + j, right: J.right + W - K.width, bottom: J.bottom + j - K.height };
      r2 = i(r2, t2.left, t2.right), o2 = i(o2, t2.top, t2.bottom);
    }
    if (Array.isArray(E)) {
      let [t2, e3] = E;
      if (isNaN(+t2) || t2 < 0) throw new Error("1st argument of `grid` must be a valid positive number");
      if (isNaN(+e3) || e3 < 0) throw new Error("2nd argument of `grid` must be a valid positive number");
      let n2 = r2 - I, a3 = o2 - U;
      [n2, a3] = l([t2 / d2, e3 / d2], n2, a3), r2 = I + n2, o2 = U + a3;
    }
    n && (k = Math.round((r2 - I) * d2)), a2 && (z = Math.round((o2 - U) * d2)), F = k, G = z, at("neodrag", T, e2), ot();
  }), lt), it("pointerup", ((e2) => {
    (tt.delete(e2.pointerId), L) && (X && (it("click", ((t2) => t2.stopPropagation()), { once: true, signal: dt.signal, capture: true }), v.dragEnd && (J = c(g2, t)), rt.remove(N), rt.add(B), w && (nt.userSelect = Z), at("neodrag:end", $, e2), n && (I = k), a2 && (U = z)), L = false, X = false, q = false, P = false);
  }), lt), { destroy: () => dt.abort(), update: (t2) => {
    h2 = t2.axis || "both", b = t2.disabled ?? false, D = t2.ignoreMultitouch ?? false, C = t2.handle, g2 = t2.bounds, v = t2.recomputeBounds ?? r, A = t2.cancel, w = t2.applyUserSelectHack ?? true, E = t2.grid, p = t2.gpuAcceleration ?? true, m = t2.legacyTranslate ?? false, y = t2.transform, S = { ...o, ...t2.threshold ?? {} };
    const e2 = rt.contains(B);
    rt.remove(M, B), M = t2.defaultClass ?? "neodrag", N = t2.defaultClassDragging ?? "neodrag-dragging", B = t2.defaultClassDragged ?? "neodrag-dragged", rt.add(M), e2 && rt.add(B), _ && (F = k = t2.position?.x ?? k, G = z = t2.position?.y ?? z, ot());
  } };
}
var i = (t, e, n) => Math.min(Math.max(t, e), n), d = (t) => "string" == typeof t, l = ([t, e], n, r2) => {
  const o2 = (t2, e2) => 0 === e2 ? 0 : Math.ceil(t2 / e2) * e2;
  return [o2(n, t), o2(r2, e)];
};
var s = (t, e) => t.some(((t2) => e.some(((e2) => t2.contains(e2)))));
function c(t, e) {
  if (void 0 === t) return;
  if (f(t)) return t.getBoundingClientRect();
  if ("object" == typeof t) {
    const { top: e2 = 0, left: n2 = 0, right: r2 = 0, bottom: o2 = 0 } = t;
    return { top: e2, right: window.innerWidth - r2, bottom: window.innerHeight - o2, left: n2 };
  }
  if ("parent" === t) return e.parentNode.getBoundingClientRect();
  const n = document.querySelector(t);
  if (null === n) throw new Error("The selector provided for bound doesn't exists in the document.");
  return n.getBoundingClientRect();
}
var u = (t, e, n) => t.style.setProperty(e, n), f = (t) => t instanceof HTMLElement;
function g(t) {
  return null == t || "string" == typeof t || t instanceof HTMLElement ? t : "current" in t ? t.current : Array.isArray(t) ? t.map(((t2) => t2 instanceof HTMLElement ? t2 : t2.current)) : void 0;
}
function h(r2, o2 = {}) {
  const i2 = useRef(), [d2, l2] = useState(false), [s2, c2] = useState();
  let { onDragStart: u2, onDrag: f2, onDragEnd: h2, handle: p, cancel: m } = o2, y = g(p), w = g(m);
  function b(t, e) {
    c2(t), e?.(t);
  }
  function D(t) {
    l2(true), b(t, u2);
  }
  function v(t) {
    b(t, f2);
  }
  function E(t) {
    l2(false), b(t, h2);
  }
  return useEffect((() => {
    if ("undefined" == typeof window) return;
    const t = r2.current;
    if (!t) return;
    ({ onDragStart: u2, onDrag: f2, onDragEnd: h2 } = o2);
    const { update: e, destroy: n } = a(t, { ...o2, handle: y, cancel: w, onDragStart: D, onDrag: v, onDragEnd: E });
    return i2.current = e, n;
  }), []), useEffect((() => {
    i2.current?.({ ...o2, handle: g(p), cancel: g(m), onDragStart: D, onDrag: v, onDragEnd: E });
  }), [o2]), { isDragging: d2, dragState: s2 };
}
const QUEUE_KEY = "tiny-canvas-queue";
function readQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    return [];
  }
}
const findDragId = (children) => {
  if (!children) return null;
  let dragId = null;
  const checkProps = (element) => {
    if (element.props && element.props.id) {
      dragId = element.props.id;
      return;
    }
    if (element.props && element.props.children) {
      React__default.Children.forEach(element.props.children, checkProps);
    }
  };
  checkProps(children);
  return dragId;
};
function hash(str) {
  let h2 = 5381;
  for (let i2 = 0; i2 < str.length; i2++) {
    h2 = (h2 << 5) + h2 + str.charCodeAt(i2) >>> 0;
  }
  return h2.toString(16).padStart(8, "0");
}
function signature(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return "#text";
  const type = node.type;
  const name = typeof type === "function" ? type.displayName || type.name || "Anonymous" : typeof type === "string" ? type : "Fragment";
  const kids = node.props?.children;
  if (kids == null) return name;
  const childSigs = [];
  React__default.Children.forEach(kids, (child) => {
    const s2 = signature(child);
    if (s2) childSigs.push(s2);
  });
  return childSigs.length ? `${name}(${childSigs.join(",")})` : name;
}
const generateDragId = (element, index) => {
  const sig = signature(element);
  return `tc-${hash(sig)}-${index}`;
};
const getQueue = (dragId) => {
  try {
    const queue = readQueue();
    const coordsMap = queue.reduce((map, item) => {
      map[item.id] = { id: item.id, x: item.x, y: item.y };
      return map;
    }, {});
    return coordsMap[dragId] || { x: 0, y: 0 };
  } catch (error) {
    console.error("Error getting saved coordinates:", error);
    return { x: 0, y: 0 };
  }
};
const refreshStorage = () => {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    if (!queue) {
      localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    }
  } catch (error) {
    console.error("LocalStorage is not available:", error);
  }
};
const saveDrag = (dragId, x, y) => {
  try {
    const queue = readQueue();
    const now = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const dragData = { id: dragId, x, y, time: now };
    const existingIndex = queue.findIndex((item) => item.id === dragId);
    if (existingIndex >= 0) {
      queue[existingIndex] = dragData;
    } else {
      queue.push(dragData);
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Error saving drag position:", error);
  }
};
function createDragCursorManager() {
  const documents = /* @__PURE__ */ new WeakMap();
  return function acquireDragCursor2(doc = globalThis.document) {
    if (!doc?.createElement || !doc.documentElement) return () => {
    };
    let state = documents.get(doc);
    if (!state) {
      const root = doc.documentElement;
      const style = doc.createElement("style");
      style.setAttribute("data-hypercanvas-widget-drag-cursor-style", "");
      style.textContent = "html:root[data-hypercanvas-widget-drag-cursor], html:root[data-hypercanvas-widget-drag-cursor] * { cursor: grabbing !important; }";
      (doc.head || root).appendChild(style);
      state = {
        owners: /* @__PURE__ */ new Set(),
        style,
        hadAttribute: root.hasAttribute("data-hypercanvas-widget-drag-cursor"),
        previousAttribute: root.getAttribute("data-hypercanvas-widget-drag-cursor")
      };
      documents.set(doc, state);
      root.setAttribute("data-hypercanvas-widget-drag-cursor", "active");
    } else if (!state.style.isConnected) {
      (doc.head || doc.documentElement).appendChild(state.style);
    }
    const owner = /* @__PURE__ */ Symbol("widget-drag-cursor-owner");
    state.owners.add(owner);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      state.owners.delete(owner);
      if (state.owners.size) return;
      state.style.remove();
      const root = doc.documentElement;
      if (state.hadAttribute) root.setAttribute("data-hypercanvas-widget-drag-cursor", state.previousAttribute ?? "");
      else root.removeAttribute("data-hypercanvas-widget-drag-cursor");
      documents.delete(doc);
    };
  };
}
const acquireDragCursor = createDragCursorManager();
const TRANSLATION_MS = 250;
const PERSIST_DEADZONE_PX = 4;
const DRAG_DELAY_MS = 150;
const DRAG_DISTANCE_PX = 8;
function Draggable({ children, dragId, initialPosition, onDragStart: onDragStartProp, onDrag: onDragProp, onDragEnd, resolveDropPosition, handle, locked = false, boundaryPad = 0, layout = "absolute", wrapperClassName }) {
  const draggableRef = useRef(null);
  const isFlow = layout === "flow";
  const initialSavedPosition = initialPosition || { x: 0, y: 0 };
  const dragStartRef = useRef(initialSavedPosition);
  const hasMovedRef = useRef(false);
  const gateRef = useRef({
    timer: null,
    startX: 0,
    startY: 0,
    delayMet: false,
    distanceMet: false,
    active: false,
    lastEvent: null
  });
  const [position, setPosition] = useState(initialSavedPosition);
  const [prevInitial, setPrevInitial] = useState(initialSavedPosition);
  const [dragActive, setDragActive] = useState(false);
  const positionRef = useRef(initialSavedPosition);
  const latestCallbacksRef = useRef({ onDragStartProp, onDragProp, onDragEnd, resolveDropPosition });
  const iframeLockReleaseRef = useRef(null);
  const dragCursorReleaseRef = useRef(null);
  const releaseDragInteraction = useCallback(() => {
    iframeLockReleaseRef.current?.();
    iframeLockReleaseRef.current = null;
    dragCursorReleaseRef.current?.();
    dragCursorReleaseRef.current = null;
  }, []);
  useEffect(() => {
    const doc = draggableRef.current?.ownerDocument || globalThis.document;
    if (!doc) return void 0;
    const win = doc.defaultView;
    const releaseOnInterruption = () => releaseDragInteraction();
    doc.addEventListener("pointerup", releaseOnInterruption, true);
    doc.addEventListener("pointercancel", releaseOnInterruption, true);
    win?.addEventListener("blur", releaseOnInterruption);
    return () => {
      doc.removeEventListener("pointerup", releaseOnInterruption, true);
      doc.removeEventListener("pointercancel", releaseOnInterruption, true);
      win?.removeEventListener("blur", releaseOnInterruption);
      releaseDragInteraction();
    };
  }, [releaseDragInteraction]);
  useLayoutEffect(() => {
    latestCallbacksRef.current = { onDragStartProp, onDragProp, onDragEnd, resolveDropPosition };
  }, [onDragStartProp, onDragProp, onDragEnd, resolveDropPosition]);
  useLayoutEffect(() => {
    positionRef.current = position;
  }, [position]);
  if (initialPosition && (initialPosition.x !== prevInitial.x || initialPosition.y !== prevInitial.y)) {
    setPrevInitial(initialPosition);
    if (!dragActive) setPosition(initialPosition);
  }
  useEffect(() => {
    const el = draggableRef.current;
    if (el && dragId && (initialSavedPosition.x !== 0 || initialSavedPosition.y !== 0)) {
      el.classList.add("tc-on-translation");
      const timer = setTimeout(() => {
        el.classList.remove("tc-on-translation");
      }, TRANSLATION_MS * 4);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [dragId, initialSavedPosition.x, initialSavedPosition.y]);
  useEffect(() => {
    const el = draggableRef.current;
    if (!el || !handle || locked) return;
    const g2 = gateRef.current;
    let synthEvent = null;
    function isHandleEvent(e) {
      if (!(e.target instanceof Element)) return false;
      const match = e.target.closest(handle);
      return match != null && el.contains(match);
    }
    function onArticlePointerDownCapture(e) {
      if (e === synthEvent) {
        synthEvent = null;
        return;
      }
      if (!isHandleEvent(e)) return;
      e.stopImmediatePropagation();
      g2.active = true;
      g2.delayMet = false;
      g2.distanceMet = false;
      g2.startX = e.clientX;
      g2.startY = e.clientY;
      g2.target = e.target;
      g2.pointerId = e.pointerId;
      g2.button = e.button;
      g2.pointerType = e.pointerType;
      clearTimeout(g2.timer);
      g2.timer = setTimeout(() => {
        g2.delayMet = true;
        tryEnable();
      }, DRAG_DELAY_MS);
    }
    function tryEnable() {
      if (g2.delayMet && g2.distanceMet && g2.active && g2.target) {
        const synth = new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: g2.pointerId,
          clientX: g2.startX,
          clientY: g2.startY,
          button: g2.button,
          pointerType: g2.pointerType
        });
        synthEvent = synth;
        g2.target.dispatchEvent(synth);
        g2.target = null;
      }
    }
    function onDocPointerMove(e) {
      if (!g2.active || g2.distanceMet) return;
      const dx = e.clientX - g2.startX;
      const dy = e.clientY - g2.startY;
      if (Math.hypot(dx, dy) >= DRAG_DISTANCE_PX) {
        g2.distanceMet = true;
        tryEnable();
      }
    }
    function resetGate() {
      clearTimeout(g2.timer);
      g2.active = false;
      g2.target = null;
    }
    el.addEventListener("pointerdown", onArticlePointerDownCapture, true);
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", resetGate);
    document.addEventListener("pointercancel", resetGate);
    return () => {
      el.removeEventListener("pointerdown", onArticlePointerDownCapture, true);
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", resetGate);
      document.removeEventListener("pointercancel", resetGate);
      clearTimeout(g2.timer);
    };
  }, [handle, locked]);
  const { isDragging } = h(draggableRef, {
    axis: "both",
    defaultClass: "tc-drag",
    defaultClassDragging: "tc-on",
    defaultClassDragged: "tc-off",
    applyUserSelectHack: true,
    disabled: locked,
    ...handle ? { handle } : {},
    position: { x: position.x, y: position.y },
    // Clamp in the transform callback so neodrag never paints a
    // negative position — avoids the one-frame flicker that happens
    // when clamping only in onDrag (React re-render lag).
    //
    // In flow mode the widget already sits in normal flow at its
    // natural offset; transforms add a delta only (no boundaryPad
    // clamping, no minimum coordinates).
    transform: ({ offsetX, offsetY }) => {
      if (isFlow) {
        return `translate3d(${offsetX}px, ${offsetY}px, 0)`;
      }
      const x = Math.max(boundaryPad, offsetX);
      const y = Math.max(boundaryPad, offsetY);
      return `translate3d(${x}px, ${y}px, 0)`;
    },
    onDragStart: () => {
      releaseDragInteraction();
      const doc = draggableRef.current?.ownerDocument || globalThis.document;
      if (doc) {
        iframeLockReleaseRef.current = acquireIframePointerLock(doc);
        dragCursorReleaseRef.current = acquireDragCursor(doc);
      }
      setDragActive(true);
      dragStartRef.current = positionRef.current;
      hasMovedRef.current = false;
      latestCallbacksRef.current.onDragStartProp?.(dragId, positionRef.current);
    },
    onDrag: ({ offsetX, offsetY }) => {
      const dx = offsetX - dragStartRef.current.x;
      const dy = offsetY - dragStartRef.current.y;
      const distance = Math.hypot(dx, dy);
      if (!hasMovedRef.current && distance >= PERSIST_DEADZONE_PX) {
        hasMovedRef.current = true;
      }
      const clamped = isFlow ? { x: offsetX, y: offsetY } : { x: Math.max(boundaryPad, offsetX), y: Math.max(boundaryPad, offsetY) };
      setPosition(clamped);
      positionRef.current = clamped;
      latestCallbacksRef.current.onDragProp?.(dragId, clamped);
    },
    onDragEnd: (data) => {
      try {
        const clampedX = isFlow ? data.offsetX : Math.max(boundaryPad, data.offsetX);
        const clampedY = isFlow ? data.offsetY : Math.max(boundaryPad, data.offsetY);
        const rawPosition = { x: clampedX, y: clampedY };
        const dx = clampedX - dragStartRef.current.x;
        const dy = clampedY - dragStartRef.current.y;
        const movedEnough = hasMovedRef.current || Math.hypot(dx, dy) >= PERSIST_DEADZONE_PX;
        if (!movedEnough) {
          setDragActive(false);
          return;
        }
        const resolved = latestCallbacksRef.current.resolveDropPosition?.(dragId, rawPosition) || rawPosition;
        const finalPosition = isFlow ? { x: resolved.x, y: resolved.y } : { x: Math.max(boundaryPad, resolved.x), y: Math.max(boundaryPad, resolved.y) };
        setPosition(finalPosition);
        positionRef.current = finalPosition;
        setDragActive(false);
        if (dragId) {
          saveDrag(dragId, finalPosition.x, finalPosition.y);
        }
        latestCallbacksRef.current.onDragEnd?.(dragId, finalPosition);
      } finally {
        releaseDragInteraction();
      }
    }
  });
  const articleCursor = locked ? void 0 : handle ? isDragging ? "grabbing" : void 0 : isDragging ? "grabbing" : "grab";
  return /* @__PURE__ */ jsx(
    "article",
    {
      ref: draggableRef,
      className: wrapperClassName || void 0,
      "data-layout": layout,
      style: {
        cursor: articleCursor,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`
      },
      children: /* @__PURE__ */ jsx("div", { className: "tc-draggable-inner", children })
    }
  );
}
function readInitialPosition(child, pad = 0) {
  const x = Number(child?.props?.["data-tc-x"]);
  const y = Number(child?.props?.["data-tc-y"]);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x: Math.max(pad, x), y: Math.max(pad, y) };
  }
  return null;
}
function readHandle(child) {
  return child?.props?.["data-tc-handle"] || null;
}
function readWrapperClassName(child) {
  const v = child?.props?.["data-tc-class"];
  return typeof v === "string" && v.trim() ? v : null;
}
function Canvas({
  children,
  dotted = false,
  grid = false,
  gridSize,
  colorMode = "auto",
  locked = false,
  boundaryPad,
  layout = "absolute",
  className,
  onDragStart,
  onDrag,
  onDragEnd,
  resolveDropPosition
}) {
  const isFlow = layout === "flow";
  const showDots = !isFlow && (dotted || grid);
  const visualGridSize = gridSize;
  const pad = isFlow ? 0 : boundaryPad ?? gridSize ?? 0;
  const dotRadius = visualGridSize && visualGridSize < 16 ? 1 : 2;
  const canvasStyle = !isFlow && visualGridSize ? {
    "--tc-grid-size": `${visualGridSize}px`,
    "--tc-grid-offset": `${visualGridSize / -2}px`,
    "--tc-dot-radius": `${dotRadius}px`
  } : void 0;
  const mainClassName = className ? `tc-canvas ${className}` : "tc-canvas";
  return /* @__PURE__ */ jsx(
    "main",
    {
      className: mainClassName,
      "data-dotted": showDots || void 0,
      "data-locked": locked || void 0,
      "data-color-mode": colorMode !== "auto" ? colorMode : void 0,
      "data-layout": layout,
      style: canvasStyle,
      children: Children.map(children, (child, index) => {
        const dragId = findDragId(child) ?? generateDragId(child, index);
        const initialPosition = readInitialPosition(child, pad);
        const handle = readHandle(child);
        const wrapperClassName = readWrapperClassName(child);
        return /* @__PURE__ */ jsx(
          Draggable,
          {
            dragId,
            initialPosition,
            onDragStart,
            onDrag,
            onDragEnd,
            resolveDropPosition,
            handle,
            locked,
            boundaryPad: pad,
            layout,
            wrapperClassName,
            children: child
          },
          dragId
        );
      })
    }
  );
}
export {
  Canvas as C,
  Draggable as D,
  getQueue as a,
  findDragId as f,
  generateDragId as g,
  refreshStorage as r,
  saveDrag as s
};
