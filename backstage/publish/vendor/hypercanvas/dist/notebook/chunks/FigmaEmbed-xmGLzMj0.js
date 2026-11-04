import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { forwardRef, useState, useRef, useMemo, useCallback, useEffect, useImperativeHandle } from "react";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { r as readProp } from "./widgetProps-_UqatjIo.js";
import { s as schemas } from "./widgetConfig-DkrqwrI0.js";
import { i as isFigmaUrl, t as toFigmaEmbedUrl, g as getFigmaTitle, a as getFigmaType } from "./figmaUrl-Bzyfguzi.js";
import { u as useIframeDevLogs, o as overlayStyles } from "./embedOverlay.module-BVkT7z5d.js";
import { f as findAllConnectedSplitTargets, g as getSplitPaneLabel, b as buildPaneForWidget, a as buildSplitLayout } from "./MarkdownBlock-DxsMG03P.js";
import { u as useExpandOverride } from "./useExpandOverride-BmLmUDhU.js";
import { E as ExpandedPane } from "./Document-2gwDP-Y5.js";
const embed = "_embed_csojh_1";
const header = "_header_csojh_10";
const figmaLogo = "_figmaLogo_csojh_26";
const headerTitle = "_headerTitle_csojh_32";
const iframeContainer = "_iframeContainer_csojh_37";
const iframe = "_iframe_csojh_37";
const resizeHandle = "_resizeHandle_csojh_50";
const expandIframe = "_expandIframe_csojh_111";
const emptyState = "_emptyState_csojh_203";
const emptyIcon = "_emptyIcon_csojh_213";
const emptyLabel = "_emptyLabel_csojh_218";
const styles = {
  embed,
  header,
  figmaLogo,
  headerTitle,
  iframeContainer,
  iframe,
  resizeHandle,
  expandIframe,
  emptyState,
  emptyIcon,
  emptyLabel
};
const figmaEmbedSchema = schemas["figma-embed"];
function FigmaIcon({ size = 32, className }) {
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
        /* @__PURE__ */ jsx("path", { d: "M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" }),
        /* @__PURE__ */ jsx("path", { d: "M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" }),
        /* @__PURE__ */ jsx("path", { d: "M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" }),
        /* @__PURE__ */ jsx("path", { d: "M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" }),
        /* @__PURE__ */ jsx("path", { d: "M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" })
      ]
    }
  );
}
function FigmaLogo() {
  return /* @__PURE__ */ jsxs("svg", { className: styles.figmaLogo, viewBox: "0 0 38 57", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z", fill: "#1ABCFE" }),
    /* @__PURE__ */ jsx("path", { d: "M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z", fill: "#0ACF83" }),
    /* @__PURE__ */ jsx("path", { d: "M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z", fill: "#FF7262" }),
    /* @__PURE__ */ jsx("path", { d: "M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z", fill: "#F24E1E" }),
    /* @__PURE__ */ jsx("path", { d: "M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z", fill: "#A259FF" })
  ] });
}
const TYPE_LABELS = { board: "Board", design: "Design", proto: "Prototype" };
const FigmaEmbed = forwardRef(function FigmaEmbed2({ id: widgetId, props, onUpdate, resizable }, ref) {
  const url = readProp(props, "url", figmaEmbedSchema);
  const width = readProp(props, "width", figmaEmbedSchema);
  const height = readProp(props, "height", figmaEmbedSchema);
  const [interactive, setInteractive] = useState(false);
  const [expandMode, setExpandMode] = useExpandOverride("figma", widgetId);
  const expanded = expandMode !== null;
  const iframeRef = useRef(null);
  const embedRef = useRef(null);
  const inlineContainerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const isValid = useMemo(() => isFigmaUrl(url), [url]);
  const embedUrl = useMemo(() => isValid ? toFigmaEmbedUrl(url) : "", [url, isValid]);
  const title = useMemo(() => url ? getFigmaTitle(url) : "Figma", [url]);
  const figmaType = useMemo(() => getFigmaType(url), [url]);
  const typeLabel = figmaType ? TYPE_LABELS[figmaType] : "Figma";
  useIframeDevLogs({
    widget: "FigmaEmbed",
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
      } else if (actionId === "expand" || actionId === "expand-single") {
        setExpandMode("single");
      } else if (actionId === "split-screen") {
        setExpandMode("split");
      }
    }
  }), [url, setExpandMode]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
      /* @__PURE__ */ jsxs("div", { ref: embedRef, className: styles.embed, style: { width, height }, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
          /* @__PURE__ */ jsx(FigmaLogo, {}),
          /* @__PURE__ */ jsx("span", { className: styles.headerTitle, children: title })
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
                  title: `Figma ${typeLabel}: ${title}`,
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
              "aria-label": "Click to interact with Figma embed",
              children: /* @__PURE__ */ jsx("span", { className: overlayStyles.interactHint, children: "Click to interact" })
            }
          )
        ] }) : /* @__PURE__ */ jsxs("div", { className: styles.emptyState, children: [
          /* @__PURE__ */ jsx(FigmaIcon, { size: 32, className: styles.emptyIcon }),
          /* @__PURE__ */ jsx("span", { className: styles.emptyLabel, children: "No Figma URL" })
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
    expanded && !!embedUrl && /* @__PURE__ */ jsx(
      FigmaExpandPane,
      {
        widgetId,
        modalContainerRef,
        splitMode: expandMode === "split",
        onClose: () => setExpandMode(null)
      }
    )
  ] });
});
function FigmaExpandPane({ widgetId, modalContainerRef, splitMode, onClose }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode]
  );
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState;
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: "figma-embed", position: { x: 0, y: 0 }, props: {} };
  }, [widgetId]);
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label: getSplitPaneLabel(primaryWidget),
        widgetType: "figma-embed",
        kind: "external",
        attach: (container) => {
          modalContainerRef.current = container;
          return () => {
            modalContainerRef.current = null;
          };
        }
      };
    }
    return buildPaneForWidget(widget);
  }, [widgetId, primaryWidget, modalContainerRef]);
  const layout = useMemo(
    () => buildSplitLayout(primaryWidget, connectedWidgets, buildPaneFn),
    [primaryWidget, connectedWidgets, buildPaneFn]
  );
  return /* @__PURE__ */ jsx(
    ExpandedPane,
    {
      ownerId: widgetId,
      initialLayout: layout,
      variant: layout.flat().length <= 1 ? "modal" : "full",
      onClose
    }
  );
}
export {
  FigmaEmbed as default
};
