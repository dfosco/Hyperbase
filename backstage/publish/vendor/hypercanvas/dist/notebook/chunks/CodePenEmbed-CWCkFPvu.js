import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { forwardRef, useState, useCallback, useRef, useMemo, useEffect, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { r as readProp } from "./widgetProps-BqIDs1ZC.js";
import { s as schemas } from "./tooltip-content-CaxwY_7M.js";
import { u as useIframeDevLogs, o as overlayStyles } from "./embedOverlay.module-BVkT7z5d.js";
import { u as useExpandOverride } from "./useExpandOverride-CWRcTp1O.js";
const CODEPEN_RE = /^https?:\/\/codepen\.io\/([^/]+)\/(pen|full|details|embed)\/([A-Za-z0-9]+)/;
function isCodePenUrl(url) {
  if (!url) return false;
  return CODEPEN_RE.test(url);
}
function toCodePenEmbedUrl(url) {
  const m = url?.match(CODEPEN_RE);
  if (!m) return "";
  const [, user, , penId] = m;
  return `https://codepen.io/${user}/embed/${penId}?default-tab=result&editable=true`;
}
function getCodePenTitle(url) {
  const m = url?.match(CODEPEN_RE);
  if (!m) return "CodePen";
  return `${m[1]}/${m[3]}`;
}
const _oembedCache = /* @__PURE__ */ new Map();
async function fetchCodePenMeta(url) {
  if (!url || !isCodePenUrl(url)) return null;
  if (_oembedCache.has(url)) return _oembedCache.get(url);
  try {
    const endpoint = `https://codepen.io/api/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const meta = {
      title: data.title || "",
      author: data.author_name || ""
    };
    _oembedCache.set(url, meta);
    return meta;
  } catch {
    return null;
  }
}
const embed = "_embed_1y7th_1";
const header = "_header_1y7th_10";
const codepenLogo = "_codepenLogo_1y7th_26";
const headerTitle = "_headerTitle_1y7th_32";
const iframeContainer = "_iframeContainer_1y7th_37";
const iframe = "_iframe_1y7th_37";
const resizeHandle = "_resizeHandle_1y7th_50";
const expandBackdrop = "_expandBackdrop_1y7th_79";
const expandContainer = "_expandContainer_1y7th_95";
const expandIframe = "_expandIframe_1y7th_111";
const expandClose = "_expandClose_1y7th_118";
const emptyState = "_emptyState_1y7th_142";
const emptyIcon = "_emptyIcon_1y7th_152";
const emptyLabel = "_emptyLabel_1y7th_157";
const styles = {
  embed,
  header,
  codepenLogo,
  headerTitle,
  iframeContainer,
  iframe,
  resizeHandle,
  expandBackdrop,
  expandContainer,
  expandIframe,
  expandClose,
  emptyState,
  emptyIcon,
  emptyLabel
};
const codepenEmbedSchema = schemas["codepen-embed"];
function CodePenLogo({ className }) {
  return /* @__PURE__ */ jsxs("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("polygon", { points: "12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" }),
    /* @__PURE__ */ jsx("line", { x1: "12", y1: "22", x2: "12", y2: "15.5" }),
    /* @__PURE__ */ jsx("polyline", { points: "22 8.5 12 15.5 2 8.5" }),
    /* @__PURE__ */ jsx("polyline", { points: "2 15.5 12 8.5 22 15.5" }),
    /* @__PURE__ */ jsx("line", { x1: "12", y1: "2", x2: "12", y2: "8.5" })
  ] });
}
function CodeIcon({ size = 32, className }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("polyline", { points: "16 18 22 12 16 6" }),
        /* @__PURE__ */ jsx("polyline", { points: "8 6 2 12 8 18" })
      ]
    }
  );
}
const CodePenEmbed = forwardRef(function CodePenEmbed2({ id, props, onUpdate, resizable }, ref) {
  const url = readProp(props, "url", codepenEmbedSchema);
  const width = readProp(props, "width", codepenEmbedSchema);
  const height = readProp(props, "height", codepenEmbedSchema);
  const [interactive, setInteractive] = useState(false);
  const [expandedMode, setExpandedMode] = useExpandOverride("codepen", id);
  const expanded = expandedMode === "1";
  const setExpanded = useCallback((open) => setExpandedMode(open ? "1" : null), [setExpandedMode]);
  const iframeRef = useRef(null);
  const embedRef = useRef(null);
  const inlineContainerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const isValid = useMemo(() => isCodePenUrl(url), [url]);
  const embedUrl = useMemo(() => isValid ? toCodePenEmbedUrl(url) : "", [url, isValid]);
  const fallbackTitle = useMemo(() => url ? getCodePenTitle(url) : "CodePen", [url]);
  const [penMeta, setPenMeta] = useState(null);
  useEffect(() => {
    if (!url || !isValid) return;
    let cancelled = false;
    fetchCodePenMeta(url).then((meta) => {
      if (!cancelled && meta) setPenMeta(meta);
    });
    return () => {
      cancelled = true;
    };
  }, [url, isValid]);
  const headerTitle2 = penMeta?.title ? `${penMeta.title} · ${penMeta.author || fallbackTitle}` : fallbackTitle;
  useIframeDevLogs({
    widget: "CodePenEmbed",
    loaded: Boolean(embedUrl),
    src: embedUrl
  });
  const enterInteractive = useCallback(() => {
    setInteractive(true);
  }, []);
  useEffect(() => {
    if (!interactive || expanded) return;
    function handlePointerDown(e) {
      if (embedRef.current && !embedRef.current.contains(e.target)) {
        setInteractive(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [interactive, expanded]);
  useEffect(() => {
    if (!expanded) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setExpanded(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [expanded, setExpanded]);
  useEffect(() => {
    const iframe2 = iframeRef.current;
    if (!iframe2) return;
    if (expanded && modalContainerRef.current) {
      iframe2._savedClassName = iframe2.className;
      iframe2._savedStyle = iframe2.getAttribute("style") || "";
      iframe2.className = styles.expandIframe;
      iframe2.removeAttribute("style");
      const target = modalContainerRef.current;
      if (target.moveBefore) {
        target.moveBefore(iframe2, target.firstChild);
      } else {
        target.prepend(iframe2);
      }
    } else if (!expanded && inlineContainerRef.current) {
      if (iframe2._savedClassName !== void 0) {
        iframe2.className = iframe2._savedClassName;
        iframe2.setAttribute("style", iframe2._savedStyle);
        delete iframe2._savedClassName;
        delete iframe2._savedStyle;
      }
      const target = inlineContainerRef.current;
      if (target.moveBefore) {
        target.moveBefore(iframe2, null);
      } else {
        target.appendChild(iframe2);
      }
    }
  }, [expanded]);
  useImperativeHandle(ref, () => ({
    getIframeWindow() {
      try {
        return iframeRef.current?.contentWindow ?? null;
      } catch {
        return null;
      }
    },
    handleAction(actionId) {
      if (actionId === "open-external") {
        if (url) window.open(url, "_blank", "noopener");
      } else if (actionId === "expand") {
        setExpanded(true);
      }
    }
  }), [url, setExpanded]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
      /* @__PURE__ */ jsxs("div", { ref: embedRef, className: styles.embed, style: { width, height }, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
          /* @__PURE__ */ jsx(CodePenLogo, { className: styles.codepenLogo }),
          /* @__PURE__ */ jsx("span", { className: styles.headerTitle, children: headerTitle2 })
        ] }),
        embedUrl ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              ref: inlineContainerRef,
              className: styles.iframeContainer,
              style: expanded ? { visibility: "hidden" } : void 0,
              children: /* @__PURE__ */ jsx(
                "iframe",
                {
                  ref: iframeRef,
                  src: embedUrl,
                  className: styles.iframe,
                  title: `CodePen: ${headerTitle2}`,
                  allowFullScreen: true,
                  onLoad: (e) => e.target.blur()
                }
              )
            }
          ),
          !interactive && !expanded && /* @__PURE__ */ jsx(
            "div",
            {
              className: overlayStyles.interactOverlay,
              onClick: (e) => {
                if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
                enterInteractive();
              },
              role: "button",
              tabIndex: 0,
              onKeyDown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  enterInteractive();
                }
              },
              "aria-label": "Click to interact with CodePen embed",
              children: /* @__PURE__ */ jsx("span", { className: overlayStyles.interactHint, children: "Click to interact" })
            }
          )
        ] }) : /* @__PURE__ */ jsxs("div", { className: styles.emptyState, children: [
          /* @__PURE__ */ jsx(CodeIcon, { size: 32, className: styles.emptyIcon }),
          /* @__PURE__ */ jsx("span", { className: styles.emptyLabel, children: "No CodePen URL" })
        ] })
      ] }),
      resizable && /* @__PURE__ */ jsx(
        "div",
        {
          className: styles.resizeHandle,
          onMouseDown: (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = width;
            const startH = height;
            function onMove(ev) {
              const newW = Math.max(200, startW + ev.clientX - startX);
              const newH = Math.max(150, startH + ev.clientY - startY);
              onUpdate?.({ width: newW, height: newH });
            }
            function onUp() {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          },
          onPointerDown: (e) => e.stopPropagation()
        }
      )
    ] }),
    createPortal(
      /* @__PURE__ */ jsx(
        "div",
        {
          className: styles.expandBackdrop,
          style: expanded && embedUrl ? void 0 : { display: "none" },
          onClick: () => setExpanded(false),
          onPointerDown: (e) => e.stopPropagation(),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Escape") setExpanded(false);
          },
          onWheel: (e) => e.stopPropagation(),
          tabIndex: -1,
          ref: (el) => {
            if (el && expanded) el.focus();
          },
          children: /* @__PURE__ */ jsx(
            "div",
            {
              ref: modalContainerRef,
              className: styles.expandContainer,
              onClick: (e) => e.stopPropagation(),
              children: /* @__PURE__ */ jsx(
                "button",
                {
                  className: styles.expandClose,
                  onClick: () => setExpanded(false),
                  "aria-label": "Close expanded view",
                  autoFocus: true,
                  children: "✕"
                }
              )
            }
          )
        }
      ),
      document.body
    )
  ] });
});
export {
  CodePenEmbed as default
};
