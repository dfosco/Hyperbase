import { jsxs, jsx } from "react/jsx-runtime";
import { useMemo, useRef, useEffect, isValidElement, forwardRef, useState } from "react";
import { c as createLucideIcon, a as cn, B as Button, t as tv } from "./createLucideIcon-CV-5aOV3.js";
import { i as isNotebookPublication } from "./notebookCapabilities-C3HcelTI.js";
const __iconData = {
  name: "circle-question-mark",
  size: 24,
  node: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ],
  aliases: ["help-circle", "circle-help"]
};
__iconData.node;
const CircleQuestionMark = createLucideIcon(__iconData);
const sources = /* @__PURE__ */ new Set(["shared-alert", "shell-notice", "runtime-notice", "document-reload", "section-error", "import-failure", "notebook-error", "prototype-error", "app-error", "widget-error", "agent-error", "terminal-error", "file-error", "site-error", "publishing-error"]);
const reasons = /* @__PURE__ */ new Set(["dynamic-import-failed", "syntax-error", "type-error", "reference-error", "render-error", "file-not-found", "file-import-failed", "file-render-failed", "agent-setup-failed", "agent-connection-failed", "terminal-connection-failed", "site-load-failed", "deployment-conflict"]);
let warned = false;
let pendingReports = 0;
let reportTail = Promise.resolve();
const noticeSlots = /* @__PURE__ */ new Map();
function metadata(diagnostic) {
  const result = { source: diagnostic.source && sources.has(diagnostic.source) ? diagnostic.source : "shared-alert" };
  if (typeof diagnostic.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(diagnostic.code)) result.code = diagnostic.code;
  if (typeof diagnostic.incidentId === "string" && /^[a-z0-9_-]{16,128}$/i.test(diagnostic.incidentId)) result.incidentId = diagnostic.incidentId;
  if (typeof diagnostic.operationId === "string" && /^[a-z0-9_-]{16,128}$/i.test(diagnostic.operationId)) result.operationId = diagnostic.operationId;
  if (diagnostic.reason && reasons.has(diagnostic.reason)) result.reason = diagnostic.reason;
  if (diagnostic.connection && ["connected", "disconnected", "connecting"].includes(diagnostic.connection)) result.connection = diagnostic.connection;
  return result;
}
function isNativeJournalBridge(value) {
  return typeof value === "object" && value !== null && "call" in value && typeof value.call === "function";
}
function report(event) {
  const bridge = globalThis.window && "mygo" in globalThis.window ? globalThis.window.mygo : void 0;
  if (!isNativeJournalBridge(bridge)) {
    if (!warned) {
      warned = true;
      console.warn("[alert-display] Local desktop journal unavailable in this document.");
    }
    return;
  }
  if (pendingReports >= 128) {
    if (!warned) {
      warned = true;
      console.warn("[alert-display] Local journal observation buffer is full.");
    }
    return;
  }
  pendingReports++;
  reportTail = reportTail.then(() => bridge.call("Bootstrap.ReportAlertDisplay", event)).then((result) => {
    if (!result || typeof result !== "object" || !("accepted" in result) || result.accepted !== true) throw new Error("Local journal rejected the alert display observation.");
  }).catch(() => {
    if (!warned) {
      warned = true;
      console.warn("[alert-display] Could not persist alert display observations to the local journal.");
    }
  }).finally(() => {
    pendingReports--;
  });
}
function alertContentKey(children) {
  if (Array.isArray(children)) return children.map(alertContentKey).join("|");
  if (children === null || children === void 0 || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  return isValidElement(children) ? alertContentKey(children.props.children) : "";
}
function useAlertDisplay(identity, diagnostic = {}, enabled = true) {
  const safe = metadata(diagnostic);
  const display = useMemo(() => ({
    identity,
    source: safe.source,
    code: safe.code,
    incidentId: safe.incidentId,
    operationId: safe.operationId,
    id: enabled ? `display_${globalThis.crypto.randomUUID()}` : ""
  }), [identity, safe.source, safe.code, safe.incidentId, safe.operationId, enabled]);
  const displayId = display.id;
  const lifecycle = useRef({ current: null, generation: 0 });
  const committedMetadata = useRef(safe);
  const slot = diagnostic.slot === "sidebar-recovery-notice" ? diagnostic.slot : null;
  useEffect(() => {
    committedMetadata.current = safe;
  });
  useEffect(() => {
    if (!enabled) return void 0;
    const state = slot ? noticeSlots.get(slot) ?? lifecycle.current : lifecycle.current;
    lifecycle.current = state;
    if (slot) noticeSlots.set(slot, state);
    const generation = ++state.generation;
    if (state.current?.displayId !== displayId) {
      const previous = state.current;
      const at = (/* @__PURE__ */ new Date()).toISOString();
      if (previous && !previous.ended) {
        report({ ...previous.event, status: "replaced", at, replacedBy: displayId });
      }
      const event = {
        ...committedMetadata.current,
        displayId,
        displayedAt: at,
        at,
        status: "displayed",
        ...previous && !previous.ended ? { replaces: previous.displayId } : {}
      };
      state.current = { displayId, event, ended: false };
      report(event);
    }
    return () => {
      const at = (/* @__PURE__ */ new Date()).toISOString();
      queueMicrotask(() => {
        const current = state.current;
        if (state.generation !== generation || !current || current.ended) return;
        report({ ...current.event, status: "removed", at });
        current.ended = true;
        if (slot && noticeSlots.get(slot) === state) noticeSlots.delete(slot);
      });
    };
  }, [displayId, slot, enabled]);
  const onClickCapture = (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-alert-dismiss]")) return;
    const current = lifecycle.current.current;
    if (current && !current.ended) {
      report({ ...current.event, status: "dismissed", at: (/* @__PURE__ */ new Date()).toISOString() });
      current.ended = true;
    }
  };
  return { displayId, onClickCapture };
}
const notice = "_notice_12dvg_1";
const control = "_control_12dvg_9";
const success = "_success_12dvg_40";
const failure = "_failure_12dvg_44";
const alertStyles = {
  notice,
  control,
  success,
  failure
};
const alertVariants = tv({
  base: "hc-grid hc-gap-0.5 hc-rounded-lg hc-border hc-px-2.5 hc-py-2 hc-text-left hc-text-sm hc-has-data-[slot=alert-action]:relative hc-has-data-[slot=alert-action]:pr-18 hc-has-[>svg]:grid-cols-[auto_1fr] hc-has-[>svg]:gap-x-2 hc-*:[svg]:row-span-2 hc-*:[svg]:translate-y-0.5 hc-*:[svg]:text-current hc-*:[svg:not([class*='size-'])]:size-4 hc-group/alert hc-relative hc-w-full",
  variants: {
    variant: {
      default: "hc-bg-card hc-text-card-foreground",
      destructive: "hc-text-destructive hc-bg-card hc-*:data-[slot=alert-description]:text-destructive/90 hc-*:[svg]:text-current"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});
function AlertDisplayControl({ displayId }) {
  const [copyFeedback, setFeedback] = useState(null);
  const feedback = copyFeedback?.displayId === displayId ? copyFeedback.status : "";
  const timer = useRef(null);
  const request = useRef({ generation: 0 });
  useEffect(() => {
    const state = request.current;
    state.generation++;
    clearTimeout(timer.current);
    return () => {
      state.generation++;
      clearTimeout(timer.current);
    };
  }, [displayId]);
  const copy = async () => {
    const current = ++request.current.generation;
    clearTimeout(timer.current);
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(displayId);
      if (request.current.generation !== current) return;
      setFeedback({ displayId, status: "copied" });
      timer.current = setTimeout(() => setFeedback(null), 2e3);
    } catch {
      if (request.current.generation === current) setFeedback({ displayId, status: "failed" });
    }
  };
  return /* @__PURE__ */ jsxs("span", { className: alertStyles.control, "data-alert-display-id": displayId, children: [
    /* @__PURE__ */ jsx(
      Button,
      {
        variant: "ghost",
        size: "icon-xs",
        "aria-label": "Copy diagnostic ID",
        onPointerDown: (event) => event.stopPropagation(),
        onKeyDown: (event) => event.stopPropagation(),
        onClick: (event) => {
          event.stopPropagation();
          void copy();
        },
        children: /* @__PURE__ */ jsx(CircleQuestionMark, { "aria-hidden": "true" })
      }
    ),
    /* @__PURE__ */ jsx("span", { role: feedback ? "status" : void 0, className: feedback === "copied" ? alertStyles.success : alertStyles.failure, children: feedback === "copied" ? "ID copied" : feedback === "failed" ? "Could not copy ID" : "" })
  ] });
}
const Alert = forwardRef(function Alert2({ className, variant = "default", unstyled = false, children, diagnostic = {}, onClickCapture, ...props }, ref) {
  const enabled = !isNotebookPublication();
  const display = useAlertDisplay(diagnostic.identity ?? alertContentKey(children), diagnostic, enabled);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      "data-hc-ui": "",
      "data-slot": "alert",
      role: "alert",
      className: cn(!unstyled && alertVariants({ variant }), enabled && alertStyles.notice, className),
      ...props,
      onClickCapture: (event) => {
        display.onClickCapture(event);
        onClickCapture?.(event);
      },
      children: [
        children,
        enabled && /* @__PURE__ */ jsx(AlertDisplayControl, { displayId: display.displayId })
      ]
    }
  );
});
export {
  Alert as A,
  alertContentKey as a,
  AlertDisplayControl as b,
  alertStyles as c,
  useAlertDisplay as u
};
