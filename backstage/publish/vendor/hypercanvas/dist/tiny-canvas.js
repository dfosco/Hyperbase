import we, { useRef as z, useState as ee, useEffect as te, useCallback as Me, useLayoutEffect as Se, Children as Fe } from "react";
var se = { exports: {} }, ie = {};
var Te;
function qe() {
  if (Te) return ie;
  Te = 1;
  var e = /* @__PURE__ */ Symbol.for("react.fragment");
  return ie.Fragment = e, ie.jsxDEV = void 0, ie;
}
var ce = {};
var De;
function Ue() {
  return De || (De = 1, process.env.NODE_ENV !== "production" && (function() {
    function e(t) {
      if (t == null) return null;
      if (typeof t == "function")
        return t.$$typeof === V ? null : t.displayName || t.name || null;
      if (typeof t == "string") return t;
      switch (t) {
        case T:
          return "Fragment";
        case p:
          return "Profiler";
        case U:
          return "StrictMode";
        case J:
          return "Suspense";
        case I:
          return "SuspenseList";
        case X:
          return "Activity";
      }
      if (typeof t == "object")
        switch (typeof t.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), t.$$typeof) {
          case R:
            return "Portal";
          case k:
            return t.displayName || "Context";
          case j:
            return (t._context.displayName || "Context") + ".Consumer";
          case Q:
            var l = t.render;
            return t = t.displayName, t || (t = l.displayName || l.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
          case A:
            return l = t.displayName || null, l !== null ? l : e(t.type) || "Memo";
          case P:
            l = t._payload, t = t._init;
            try {
              return e(t(l));
            } catch {
            }
        }
      return null;
    }
    function r(t) {
      return "" + t;
    }
    function n(t) {
      try {
        r(t);
        var l = !1;
      } catch {
        l = !0;
      }
      if (l) {
        l = console;
        var s = l.error, v = typeof Symbol == "function" && Symbol.toStringTag && t[Symbol.toStringTag] || t.constructor.name || "Object";
        return s.call(
          l,
          "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
          v
        ), r(t);
      }
    }
    function a(t) {
      if (t === T) return "<>";
      if (typeof t == "object" && t !== null && t.$$typeof === P)
        return "<...>";
      try {
        var l = e(t);
        return l ? "<" + l + ">" : "<...>";
      } catch {
        return "<...>";
      }
    }
    function c() {
      var t = N.A;
      return t === null ? null : t.getOwner();
    }
    function m() {
      return Error("react-stack-top-frame");
    }
    function d(t) {
      if (Y.call(t, "key")) {
        var l = Object.getOwnPropertyDescriptor(t, "key").get;
        if (l && l.isReactWarning) return !1;
      }
      return t.key !== void 0;
    }
    function f(t, l) {
      function s() {
        i || (i = !0, console.error(
          "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
          l
        ));
      }
      s.isReactWarning = !0, Object.defineProperty(t, "key", {
        get: s,
        configurable: !0
      });
    }
    function g() {
      var t = e(this.type);
      return y[t] || (y[t] = !0, console.error(
        "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
      )), t = this.props.ref, t !== void 0 ? t : null;
    }
    function h(t, l, s, v, O, Z) {
      var _ = s.ref;
      return t = {
        $$typeof: E,
        type: t,
        key: l,
        props: s,
        _owner: v
      }, (_ !== void 0 ? _ : null) !== null ? Object.defineProperty(t, "ref", {
        enumerable: !1,
        get: g
      }) : Object.defineProperty(t, "ref", { enumerable: !1, value: null }), t._store = {}, Object.defineProperty(t._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: 0
      }), Object.defineProperty(t, "_debugInfo", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: null
      }), Object.defineProperty(t, "_debugStack", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: O
      }), Object.defineProperty(t, "_debugTask", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: Z
      }), Object.freeze && (Object.freeze(t.props), Object.freeze(t)), t;
    }
    function w(t, l, s, v, O, Z) {
      var _ = l.children;
      if (_ !== void 0)
        if (v)
          if (W(_)) {
            for (v = 0; v < _.length; v++)
              D(_[v]);
            Object.freeze && Object.freeze(_);
          } else
            console.error(
              "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
            );
        else D(_);
      if (Y.call(l, "key")) {
        _ = e(t);
        var G = Object.keys(l).filter(function(ne) {
          return ne !== "key";
        });
        v = 0 < G.length ? "{key: someKey, " + G.join(": ..., ") + ": ...}" : "{key: someKey}", C[_ + v] || (G = 0 < G.length ? "{" + G.join(": ..., ") + ": ...}" : "{}", console.error(
          `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
          v,
          _,
          G,
          _
        ), C[_ + v] = !0);
      }
      if (_ = null, s !== void 0 && (n(s), _ = "" + s), d(l) && (n(l.key), _ = "" + l.key), "key" in l) {
        s = {};
        for (var B in l)
          B !== "key" && (s[B] = l[B]);
      } else s = l;
      return _ && f(
        s,
        typeof t == "function" ? t.displayName || t.name || "Unknown" : t
      ), h(
        t,
        _,
        s,
        c(),
        O,
        Z
      );
    }
    function D(t) {
      b(t) ? t._store && (t._store.validated = 1) : typeof t == "object" && t !== null && t.$$typeof === P && (t._payload.status === "fulfilled" ? b(t._payload.value) && t._payload.value._store && (t._payload.value._store.validated = 1) : t._store && (t._store.validated = 1));
    }
    function b(t) {
      return typeof t == "object" && t !== null && t.$$typeof === E;
    }
    var x = we, E = /* @__PURE__ */ Symbol.for("react.transitional.element"), R = /* @__PURE__ */ Symbol.for("react.portal"), T = /* @__PURE__ */ Symbol.for("react.fragment"), U = /* @__PURE__ */ Symbol.for("react.strict_mode"), p = /* @__PURE__ */ Symbol.for("react.profiler"), j = /* @__PURE__ */ Symbol.for("react.consumer"), k = /* @__PURE__ */ Symbol.for("react.context"), Q = /* @__PURE__ */ Symbol.for("react.forward_ref"), J = /* @__PURE__ */ Symbol.for("react.suspense"), I = /* @__PURE__ */ Symbol.for("react.suspense_list"), A = /* @__PURE__ */ Symbol.for("react.memo"), P = /* @__PURE__ */ Symbol.for("react.lazy"), X = /* @__PURE__ */ Symbol.for("react.activity"), V = /* @__PURE__ */ Symbol.for("react.client.reference"), N = x.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Y = Object.prototype.hasOwnProperty, W = Array.isArray, u = console.createTask ? console.createTask : function() {
      return null;
    };
    x = {
      react_stack_bottom_frame: function(t) {
        return t();
      }
    };
    var i, y = {}, M = x.react_stack_bottom_frame.bind(
      x,
      m
    )(), $ = u(a(m)), C = {};
    ce.Fragment = T, ce.jsxDEV = function(t, l, s, v) {
      var O = 1e4 > N.recentlyCreatedOwnerStacks++;
      return w(
        t,
        l,
        s,
        v,
        O ? Error("react-stack-top-frame") : M,
        O ? u(a(t)) : $
      );
    };
  })()), ce;
}
var Ae;
function Xe() {
  return Ae || (Ae = 1, process.env.NODE_ENV === "production" ? se.exports = qe() : se.exports = Ue()), se.exports;
}
var fe = Xe(), he = {
  dragStart: !0
}, _e = {
  delay: 0,
  distance: 3
  /* DISTANCE */
};
function Ve(e, r = {}) {
  let {
    bounds: n,
    axis: a = "both",
    gpuAcceleration: c = !0,
    legacyTranslate: m = !1,
    transform: d,
    applyUserSelectHack: f = !0,
    disabled: g = !1,
    ignoreMultitouch: h = !1,
    recomputeBounds: w = he,
    grid: D,
    threshold: b = _e,
    position: x,
    cancel: E,
    handle: R,
    defaultClass: T = "neodrag",
    defaultClassDragging: U = "neodrag-dragging",
    defaultClassDragged: p = "neodrag-dragged",
    defaultPosition: j = { x: 0, y: 0 },
    onDragStart: k,
    onDrag: Q,
    onDragEnd: J
  } = r, I = !1, A = !1, P = 0, X = !1, V = !1, N = 0, Y = 0, W = 0, u = 0, i = 0, y = 0, { x: M, y: $ } = x ? { x: x?.x ?? 0, y: x?.y ?? 0 } : j;
  me(M, $);
  let C, t, l = "", s, v, O, Z, _, G = !!x;
  w = { ...he, ...w }, b = { ..._e, ...b ?? {} };
  let B = /* @__PURE__ */ new Set();
  function ne(o) {
    I && !A && V && X && _ && (A = !0, Ie(o), K.add(U), f && (l = de.userSelect, de.userSelect = "none"));
  }
  function Le() {
    A = !1, X = !1, V = !1;
  }
  const de = document.body.style, K = e.classList;
  function me(o = N, S = Y) {
    if (!d) {
      if (m) {
        let q = `${+o}px, ${+S}px`;
        return le(
          e,
          "transform",
          c ? `translate3d(${q}, 0)` : `translate(${q})`
        );
      }
      return le(e, "translate", `${+o}px ${+S}px`);
    }
    const F = d({ offsetX: o, offsetY: S, rootNode: e });
    be(F) && le(e, "transform", F);
  }
  function je(o) {
    return {
      offsetX: N,
      offsetY: Y,
      rootNode: e,
      currentNode: _,
      event: o
    };
  }
  function ge(o, S, F) {
    const q = je(F);
    e.dispatchEvent(new CustomEvent(o, { detail: q })), S?.(q);
  }
  function Ie(o) {
    ge("neodrag:start", k, o);
  }
  function Ye(o) {
    ge("neodrag:end", J, o);
  }
  function $e(o) {
    ge("neodrag", Q, o);
  }
  const ae = addEventListener, pe = new AbortController(), ve = { signal: pe.signal, capture: !1 };
  le(e, "touch-action", "none"), ae(
    "pointerdown",
    (o) => {
      if (g || o.button === 2) return;
      if (B.add(o.pointerId), h && B.size > 1) return o.preventDefault();
      if (w.dragStart && (s = Ee(n, e)), be(R) && be(E) && R === E)
        throw new Error("`handle` selector can't be same as `cancel` selector");
      if (K.add(T), O = He(R, e), Z = ze(E, e), C = /(both|x)/.test(a), t = /(both|y)/.test(a), Ce(Z, O))
        throw new Error(
          "Element being dragged can't be a child of the element on which `cancel` is applied"
        );
      const S = o.composedPath()[0];
      if (O.some((H) => H.contains(S) || H.shadowRoot?.contains(S)) && !Ce(Z, [S]))
        _ = O.length === 1 ? e : O.find((H) => H.contains(S)), I = !0, P = Date.now(), b.delay || (X = !0);
      else return;
      v = e.getBoundingClientRect();
      const { clientX: F, clientY: q } = o, L = Re();
      C && (W = F - M / L), t && (u = q - $ / L), s && (i = F - v.left, y = q - v.top);
    },
    ve
  ), ae(
    "pointermove",
    (o) => {
      if (!I || h && B.size > 1) return;
      if (!A) {
        if (X || Date.now() - P >= b.delay && (X = !0, ne(o)), !V) {
          const L = o.clientX - W, H = o.clientY - u;
          Math.sqrt(L ** 2 + H ** 2) >= b.distance && (V = !0, ne(o));
        }
        if (!A) return;
      }
      w.drag && (s = Ee(n, e)), o.preventDefault(), v = e.getBoundingClientRect();
      let S = o.clientX, F = o.clientY;
      const q = Re();
      if (s) {
        const L = {
          left: s.left + i,
          top: s.top + y,
          right: s.right + i - v.width,
          bottom: s.bottom + y - v.height
        };
        S = Ne(S, L.left, L.right), F = Ne(F, L.top, L.bottom);
      }
      if (Array.isArray(D)) {
        let [L, H] = D;
        if (isNaN(+L) || L < 0)
          throw new Error("1st argument of `grid` must be a valid positive number");
        if (isNaN(+H) || H < 0)
          throw new Error("2nd argument of `grid` must be a valid positive number");
        let oe = S - W, ye = F - u;
        [oe, ye] = We(
          [L / q, H / q],
          oe,
          ye
        ), S = W + oe, F = u + ye;
      }
      C && (N = Math.round((S - W) * q)), t && (Y = Math.round((F - u) * q)), M = N, $ = Y, $e(o), me();
    },
    ve
  ), ae(
    "pointerup",
    (o) => {
      B.delete(o.pointerId), I && (A && (ae("click", (S) => S.stopPropagation(), {
        once: !0,
        signal: pe.signal,
        capture: !0
      }), w.dragEnd && (s = Ee(n, e)), K.remove(U), K.add(p), f && (de.userSelect = l), Ye(o), C && (W = N), t && (u = Y)), I = !1, Le());
    },
    ve
  );
  function Re() {
    let o = e.offsetWidth / v.width;
    return isNaN(o) && (o = 1), o;
  }
  return {
    destroy: () => pe.abort(),
    update: (o) => {
      a = o.axis || "both", g = o.disabled ?? !1, h = o.ignoreMultitouch ?? !1, R = o.handle, n = o.bounds, w = o.recomputeBounds ?? he, E = o.cancel, f = o.applyUserSelectHack ?? !0, D = o.grid, c = o.gpuAcceleration ?? !0, m = o.legacyTranslate ?? !1, d = o.transform, b = { ..._e, ...o.threshold ?? {} };
      const S = K.contains(p);
      K.remove(T, p), T = o.defaultClass ?? "neodrag", U = o.defaultClassDragging ?? "neodrag-dragging", p = o.defaultClassDragged ?? "neodrag-dragged", K.add(T), S && K.add(p), G && (M = N = o.position?.x ?? N, $ = Y = o.position?.y ?? Y, me());
    }
  };
}
var Ne = (e, r, n) => Math.min(Math.max(e, r), n), be = (e) => typeof e == "string", We = ([e, r], n, a) => {
  const c = (f, g) => g === 0 ? 0 : Math.ceil(f / g) * g, m = c(n, e), d = c(a, r);
  return [m, d];
};
function He(e, r) {
  if (!e) return [r];
  if (xe(e)) return [e];
  if (Array.isArray(e)) return e;
  const n = r.querySelectorAll(e);
  if (n === null)
    throw new Error(
      "Selector passed for `handle` option should be child of the element on which the action is applied"
    );
  return Array.from(n.values());
}
function ze(e, r) {
  if (!e) return [];
  if (xe(e)) return [e];
  if (Array.isArray(e)) return e;
  const n = r.querySelectorAll(e);
  if (n === null)
    throw new Error(
      "Selector passed for `cancel` option should be child of the element on which the action is applied"
    );
  return Array.from(n.values());
}
var Ce = (e, r) => e.some((n) => r.some((a) => n.contains(a)));
function Ee(e, r) {
  if (e === void 0) return;
  if (xe(e)) return e.getBoundingClientRect();
  if (typeof e == "object") {
    const { top: a = 0, left: c = 0, right: m = 0, bottom: d = 0 } = e, f = window.innerWidth - m, g = window.innerHeight - d;
    return { top: a, right: f, bottom: g, left: c };
  }
  if (e === "parent") return r.parentNode.getBoundingClientRect();
  const n = document.querySelector(e);
  if (n === null)
    throw new Error("The selector provided for bound doesn't exists in the document.");
  return n.getBoundingClientRect();
}
var le = (e, r, n) => e.style.setProperty(r, n), xe = (e) => e instanceof HTMLElement;
function ue(e) {
  if (e == null || typeof e == "string" || e instanceof HTMLElement) return e;
  if ("current" in e) return e.current;
  if (Array.isArray(e))
    return e.map((r) => r instanceof HTMLElement ? r : r.current);
}
function Je(e, r = {}) {
  const n = z(), [a, c] = ee(!1), [m, d] = ee();
  let { onDragStart: f, onDrag: g, onDragEnd: h, handle: w, cancel: D } = r, b = ue(w), x = ue(D);
  function E(p, j) {
    d(p), j?.(p);
  }
  function R(p) {
    c(!0), E(p, f);
  }
  function T(p) {
    E(p, g);
  }
  function U(p) {
    c(!1), E(p, h);
  }
  return te(() => {
    if (typeof window > "u") return;
    const p = e.current;
    if (!p) return;
    ({ onDragStart: f, onDrag: g, onDragEnd: h } = r);
    const { update: j, destroy: k } = Ve(p, {
      ...r,
      handle: b,
      cancel: x,
      onDragStart: R,
      onDrag: T,
      onDragEnd: U
    });
    return n.current = j, k;
  }, []), te(() => {
    n.current?.({
      ...r,
      handle: ue(w),
      cancel: ue(D),
      onDragStart: R,
      onDrag: T,
      onDragEnd: U
    });
  }, [r]), { isDragging: a, dragState: m };
}
const re = "tiny-canvas-queue";
function Oe() {
  const e = localStorage.getItem(re);
  if (!e) return [];
  try {
    const r = JSON.parse(e);
    return Array.isArray(r) ? r : [];
  } catch {
    return localStorage.setItem(re, JSON.stringify([])), [];
  }
}
const Ge = (e) => {
  if (!e) return null;
  let r = null;
  const n = (a) => {
    if (a.props && a.props.id) {
      r = a.props.id;
      return;
    }
    a.props && a.props.children && we.Children.forEach(a.props.children, n);
  };
  return n(e), r;
};
function Be(e) {
  let r = 5381;
  for (let n = 0; n < e.length; n++)
    r = (r << 5) + r + e.charCodeAt(n) >>> 0;
  return r.toString(16).padStart(8, "0");
}
function Pe(e) {
  if (e == null || typeof e == "boolean") return "";
  if (typeof e == "string" || typeof e == "number") return "#text";
  const r = e.type, n = typeof r == "function" ? r.displayName || r.name || "Anonymous" : typeof r == "string" ? r : "Fragment", a = e.props?.children;
  if (a == null) return n;
  const c = [];
  return we.Children.forEach(a, (m) => {
    const d = Pe(m);
    d && c.push(d);
  }), c.length ? `${n}(${c.join(",")})` : n;
}
const Ke = (e, r) => {
  const n = Pe(e);
  return `tc-${Be(n)}-${r}`;
}, ft = (e) => {
  try {
    return Oe().reduce((a, c) => (a[c.id] = { id: c.id, x: c.x, y: c.y }, a), {})[e] || { x: 0, y: 0 };
  } catch (r) {
    return console.error("Error getting saved coordinates:", r), { x: 0, y: 0 };
  }
}, dt = () => {
  try {
    localStorage.getItem(re) || localStorage.setItem(re, JSON.stringify([]));
  } catch (e) {
    console.error("LocalStorage is not available:", e);
  }
}, Qe = (e, r, n) => {
  try {
    const a = Oe(), c = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-"), m = { id: e, x: r, y: n, time: c }, d = a.findIndex((f) => f.id === e);
    d >= 0 ? a[d] = m : a.push(m), localStorage.setItem(re, JSON.stringify(a));
  } catch (a) {
    console.error("Error saving drag position:", a);
  }
};
function Ze() {
  const e = /* @__PURE__ */ new WeakMap();
  function r(n, a) {
    !n?.style || n.style.getPropertyPriority("pointer-events") !== "important" || (a.inlineFrames.has(n) || a.inlineFrames.set(n, {
      value: n.style.getPropertyValue("pointer-events"),
      priority: n.style.getPropertyPriority("pointer-events")
    }), n.style.getPropertyValue("pointer-events") !== "none" && n.style.setProperty("pointer-events", "none", "important"));
  }
  return function(a = globalThis.document) {
    if (!a?.createElement) return () => {
    };
    let c = e.get(a);
    if (c)
      c.style.isConnected || (a.head || a.documentElement).appendChild(c.style);
    else {
      const f = a.createElement("style");
      f.setAttribute("data-hypercanvas-iframe-pointer-lock", ""), f.textContent = "iframe { pointer-events: none !important; }", (a.head || a.documentElement).appendChild(f), c = { owners: /* @__PURE__ */ new Set(), style: f, inlineFrames: /* @__PURE__ */ new Map(), observer: null }, e.set(a, c);
      const g = a.defaultView?.MutationObserver || globalThis.MutationObserver;
      g && a.documentElement && (c.observer = new g((h) => {
        for (const w of h) {
          w.type === "attributes" && w.target.localName === "iframe" && r(w.target, c);
          for (const D of w.addedNodes || [])
            D.nodeType === 1 && (D.localName === "iframe" && r(D, c), D.querySelectorAll?.("iframe").forEach((b) => r(b, c)));
        }
      }), c.observer.observe(a.documentElement, {
        attributes: !0,
        attributeFilter: ["style"],
        childList: !0,
        subtree: !0
      })), a.querySelectorAll?.("iframe").forEach((h) => r(h, c));
    }
    const m = /* @__PURE__ */ Symbol("iframe-pointer-lock-owner");
    c.owners.add(m);
    let d = !1;
    return () => {
      if (!d && (d = !0, c.owners.delete(m), c.owners.size === 0)) {
        c.observer?.disconnect();
        for (const [f, g] of c.inlineFrames)
          g.value ? f.style.setProperty("pointer-events", g.value, g.priority) : f.style.removeProperty("pointer-events");
        c.inlineFrames.clear(), c.style.remove(), e.delete(a);
      }
    };
  };
}
const et = Ze();
function tt() {
  const e = /* @__PURE__ */ new WeakMap();
  return function(n = globalThis.document) {
    if (!n?.createElement || !n.documentElement) return () => {
    };
    let a = e.get(n);
    if (a)
      a.style.isConnected || (n.head || n.documentElement).appendChild(a.style);
    else {
      const d = n.documentElement, f = n.createElement("style");
      f.setAttribute("data-hypercanvas-widget-drag-cursor-style", ""), f.textContent = "html[data-hypercanvas-widget-drag-cursor], html[data-hypercanvas-widget-drag-cursor] * { cursor: grabbing !important; }", (n.head || d).appendChild(f), a = {
        owners: /* @__PURE__ */ new Set(),
        style: f,
        hadAttribute: d.hasAttribute("data-hypercanvas-widget-drag-cursor"),
        previousAttribute: d.getAttribute("data-hypercanvas-widget-drag-cursor")
      }, e.set(n, a), d.setAttribute("data-hypercanvas-widget-drag-cursor", "active");
    }
    const c = /* @__PURE__ */ Symbol("widget-drag-cursor-owner");
    a.owners.add(c);
    let m = !1;
    return () => {
      if (m || (m = !0, a.owners.delete(c), a.owners.size)) return;
      a.style.remove();
      const d = n.documentElement;
      a.hadAttribute ? d.setAttribute("data-hypercanvas-widget-drag-cursor", a.previousAttribute ?? "") : d.removeAttribute("data-hypercanvas-widget-drag-cursor"), e.delete(n);
    };
  };
}
const rt = tt(), nt = 250, ke = 4, at = 150, ot = 8;
function st({ children: e, dragId: r, initialPosition: n, onDragStart: a, onDrag: c, onDragEnd: m, resolveDropPosition: d, handle: f, locked: g = !1, boundaryPad: h = 0, layout: w = "absolute", wrapperClassName: D }) {
  const b = z(null), x = w === "flow", E = n || { x: 0, y: 0 }, R = z(E), T = z(!1), U = z({
    timer: null,
    startX: 0,
    startY: 0,
    delayMet: !1,
    distanceMet: !1,
    active: !1,
    lastEvent: null
  }), [p, j] = ee(E), [k, Q] = ee(E), [J, I] = ee(!1), A = z(E), P = z({ onDragStartProp: a, onDragProp: c, onDragEnd: m, resolveDropPosition: d }), X = z(null), V = z(null), N = Me(() => {
    X.current?.(), X.current = null, V.current?.(), V.current = null;
  }, []);
  te(() => {
    const u = b.current?.ownerDocument || globalThis.document;
    if (!u) return;
    const i = u.defaultView, y = () => N();
    return u.addEventListener("pointerup", y, !0), u.addEventListener("pointercancel", y, !0), i?.addEventListener("blur", y), () => {
      u.removeEventListener("pointerup", y, !0), u.removeEventListener("pointercancel", y, !0), i?.removeEventListener("blur", y), N();
    };
  }, [N]), Se(() => {
    P.current = { onDragStartProp: a, onDragProp: c, onDragEnd: m, resolveDropPosition: d };
  }, [a, c, m, d]), Se(() => {
    A.current = p;
  }, [p]), n && (n.x !== k.x || n.y !== k.y) && (Q(n), J || j(n)), te(() => {
    const u = b.current;
    if (u && r && (E.x !== 0 || E.y !== 0)) {
      u.classList.add("tc-on-translation");
      const i = setTimeout(() => {
        u.classList.remove("tc-on-translation");
      }, nt * 4);
      return () => {
        clearTimeout(i);
      };
    }
  }, [r, E.x, E.y]), te(() => {
    const u = b.current;
    if (!u || !f || g) return;
    const i = U.current;
    let y = null;
    function M(s) {
      if (!(s.target instanceof Element)) return !1;
      const v = s.target.closest(f);
      return v != null && u.contains(v);
    }
    function $(s) {
      if (s === y) {
        y = null;
        return;
      }
      M(s) && (s.stopImmediatePropagation(), i.active = !0, i.delayMet = !1, i.distanceMet = !1, i.startX = s.clientX, i.startY = s.clientY, i.target = s.target, i.pointerId = s.pointerId, i.button = s.button, i.pointerType = s.pointerType, clearTimeout(i.timer), i.timer = setTimeout(() => {
        i.delayMet = !0, C();
      }, at));
    }
    function C() {
      if (i.delayMet && i.distanceMet && i.active && i.target) {
        const s = new PointerEvent("pointerdown", {
          bubbles: !0,
          cancelable: !0,
          pointerId: i.pointerId,
          clientX: i.startX,
          clientY: i.startY,
          button: i.button,
          pointerType: i.pointerType
        });
        y = s, i.target.dispatchEvent(s), i.target = null;
      }
    }
    function t(s) {
      if (!i.active || i.distanceMet) return;
      const v = s.clientX - i.startX, O = s.clientY - i.startY;
      Math.hypot(v, O) >= ot && (i.distanceMet = !0, C());
    }
    function l() {
      clearTimeout(i.timer), i.active = !1, i.target = null;
    }
    return u.addEventListener("pointerdown", $, !0), document.addEventListener("pointermove", t), document.addEventListener("pointerup", l), document.addEventListener("pointercancel", l), () => {
      u.removeEventListener("pointerdown", $, !0), document.removeEventListener("pointermove", t), document.removeEventListener("pointerup", l), document.removeEventListener("pointercancel", l), clearTimeout(i.timer);
    };
  }, [f, g]);
  const { isDragging: Y } = Je(b, {
    axis: "both",
    defaultClass: "tc-drag",
    defaultClassDragging: "tc-on",
    defaultClassDragged: "tc-off",
    applyUserSelectHack: !0,
    disabled: g,
    ...f ? { handle: f } : {},
    position: { x: p.x, y: p.y },
    // Clamp in the transform callback so neodrag never paints a
    // negative position — avoids the one-frame flicker that happens
    // when clamping only in onDrag (React re-render lag).
    //
    // In flow mode the widget already sits in normal flow at its
    // natural offset; transforms add a delta only (no boundaryPad
    // clamping, no minimum coordinates).
    transform: ({ offsetX: u, offsetY: i }) => {
      if (x)
        return `translate3d(${u}px, ${i}px, 0)`;
      const y = Math.max(h, u), M = Math.max(h, i);
      return `translate3d(${y}px, ${M}px, 0)`;
    },
    onDragStart: () => {
      N();
      const u = b.current?.ownerDocument || globalThis.document;
      u && (X.current = et(u), V.current = rt(u)), I(!0), R.current = A.current, T.current = !1, P.current.onDragStartProp?.(r, A.current);
    },
    onDrag: ({ offsetX: u, offsetY: i }) => {
      const y = u - R.current.x, M = i - R.current.y, $ = Math.hypot(y, M);
      !T.current && $ >= ke && (T.current = !0);
      const C = x ? { x: u, y: i } : { x: Math.max(h, u), y: Math.max(h, i) };
      j(C), A.current = C, P.current.onDragProp?.(r, C);
    },
    onDragEnd: (u) => {
      try {
        const i = x ? u.offsetX : Math.max(h, u.offsetX), y = x ? u.offsetY : Math.max(h, u.offsetY), M = { x: i, y }, $ = i - R.current.x, C = y - R.current.y;
        if (!(T.current || Math.hypot($, C) >= ke)) {
          I(!1);
          return;
        }
        const l = P.current.resolveDropPosition?.(r, M) || M, s = x ? { x: l.x, y: l.y } : { x: Math.max(h, l.x), y: Math.max(h, l.y) };
        j(s), A.current = s, I(!1), r && Qe(r, s.x, s.y), P.current.onDragEnd?.(r, s);
      } finally {
        N();
      }
    }
  }), W = g ? void 0 : f ? Y ? "grabbing" : void 0 : Y ? "grabbing" : "grab";
  return /* @__PURE__ */ fe.jsxDEV(
    "article",
    {
      ref: b,
      className: D || void 0,
      "data-layout": w,
      style: {
        cursor: W,
        transform: `translate3d(${p.x}px, ${p.y}px, 0)`
      },
      children: /* @__PURE__ */ fe.jsxDEV("div", { className: "tc-draggable-inner", children: e }, void 0, !1, {
        fileName: "/Users/danielfosco/workspace/hypercanvas-notebooks/hyperbase/backstage/publish/vendor/hypercanvas/src/canvas/Draggable.jsx",
        lineNumber: 309,
        columnNumber: 7
      }, this)
    },
    void 0,
    !1,
    {
      fileName: "/Users/danielfosco/workspace/hypercanvas-notebooks/hyperbase/backstage/publish/vendor/hypercanvas/src/canvas/Draggable.jsx",
      lineNumber: 300,
      columnNumber: 5
    },
    this
  );
}
function it(e, r = 0) {
  const n = Number(e?.props?.["data-tc-x"]), a = Number(e?.props?.["data-tc-y"]);
  return Number.isFinite(n) && Number.isFinite(a) ? { x: Math.max(r, n), y: Math.max(r, a) } : null;
}
function ct(e) {
  return e?.props?.["data-tc-handle"] || null;
}
function lt(e) {
  const r = e?.props?.["data-tc-class"];
  return typeof r == "string" && r.trim() ? r : null;
}
function mt({
  children: e,
  dotted: r = !1,
  grid: n = !1,
  gridSize: a,
  colorMode: c = "auto",
  locked: m = !1,
  boundaryPad: d,
  layout: f = "absolute",
  className: g,
  onDragStart: h,
  onDrag: w,
  onDragEnd: D,
  resolveDropPosition: b
}) {
  const x = f === "flow", E = !x && (r || n), R = a, T = x ? 0 : d ?? a ?? 0, U = R && R < 16 ? 1 : 2, p = !x && R ? {
    "--tc-grid-size": `${R}px`,
    "--tc-grid-offset": `${R / -2}px`,
    "--tc-dot-radius": `${U}px`
  } : void 0, j = g ? `tc-canvas ${g}` : "tc-canvas";
  return /* @__PURE__ */ fe.jsxDEV(
    "main",
    {
      className: j,
      "data-dotted": E || void 0,
      "data-locked": m || void 0,
      "data-color-mode": c !== "auto" ? c : void 0,
      "data-layout": f,
      style: p,
      children: Fe.map(e, (k, Q) => {
        const J = Ge(k) ?? Ke(k, Q), I = it(k, T), A = ct(k), P = lt(k);
        return /* @__PURE__ */ fe.jsxDEV(
          st,
          {
            dragId: J,
            initialPosition: I,
            onDragStart: h,
            onDrag: w,
            onDragEnd: D,
            resolveDropPosition: b,
            handle: A,
            locked: m,
            boundaryPad: T,
            layout: f,
            wrapperClassName: P,
            children: k
          },
          J,
          !1,
          {
            fileName: "/Users/danielfosco/workspace/hypercanvas-notebooks/hyperbase/backstage/publish/vendor/hypercanvas/src/canvas/Canvas.jsx",
            lineNumber: 72,
            columnNumber: 11
          },
          this
        );
      })
    },
    void 0,
    !1,
    {
      fileName: "/Users/danielfosco/workspace/hypercanvas-notebooks/hyperbase/backstage/publish/vendor/hypercanvas/src/canvas/Canvas.jsx",
      lineNumber: 58,
      columnNumber: 5
    },
    this
  );
}
function gt({ reload: e = !1 } = {}) {
  return Me(() => {
    try {
      localStorage.removeItem("tiny-canvas-queue");
    } catch (r) {
      console.error("Error clearing canvas state:", r);
    }
    e && window.location.reload();
  }, [e]);
}
export {
  mt as Canvas,
  st as Draggable,
  Ge as findDragId,
  Ke as generateDragId,
  ft as getQueue,
  dt as refreshStorage,
  Qe as saveDrag,
  gt as useResetCanvas
};
