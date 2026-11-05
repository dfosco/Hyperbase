import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useRef, useEffect, useCallback, forwardRef, useState, useImperativeHandle, useMemo, createElement } from "react";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { r as readProp } from "./widgetProps-BqIDs1ZC.js";
import { s as schemas, i as isSplitScreenCapable, g as getWidgetMeta, c as getFeaturesForSurface } from "./tooltip-content-CaxwY_7M.js";
import { k as copyCanvasImage, i as copyCanvasText, E as ExpandedPane } from "./Document-DbLUnVhy.js";
import { getStoryData } from "../core-0.js";
import { getConfig } from "../core-2.js";
import { getResolvedFor } from "../core-9.js";
import { a as resolveBasePathAsset, r as resolveFrameTheme } from "./basePathAsset-Bs6UgtNi.js";
import { s as storyFrameUrl } from "./storyFrameUrl-BrqNbZ2o.js";
import { u as useExpandOverride } from "./useExpandOverride-CWRcTp1O.js";
import { M as MarkdownTextEditor, a as MarkdownView } from "./MarkdownEditor-CXCDlnnq.js";
import { c as cropAndUpload, t as toggleImagePrivacy } from "./canvasApi-HT5Txujd.js";
const overlay = "_overlay_106c5_3";
const cropRegion = "_cropRegion_106c5_10";
const handle = "_handle_106c5_31";
const handleNW = "_handleNW_106c5_41";
const handleNE = "_handleNE_106c5_42";
const handleSW = "_handleSW_106c5_43";
const handleSE = "_handleSE_106c5_44";
const handleN = "_handleN_106c5_41";
const handleS = "_handleS_106c5_43";
const handleW = "_handleW_106c5_47";
const handleE = "_handleE_106c5_48";
const cropBar = "_cropBar_106c5_52";
const cropBarBtn = "_cropBarBtn_106c5_72";
const cropBarBtnSave = "_cropBarBtnSave_106c5_98";
const cropBarBtnCancel = "_cropBarBtnCancel_106c5_118";
const dimensions = "_dimensions_106c5_134";
const separator = "_separator_106c5_146";
const styles$2 = {
  overlay,
  cropRegion,
  handle,
  handleNW,
  handleNE,
  handleSW,
  handleSE,
  handleN,
  handleS,
  handleW,
  handleE,
  cropBar,
  cropBarBtn,
  cropBarBtnSave,
  cropBarBtnCancel,
  dimensions,
  separator
};
const MIN_CROP = 20;
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
const HANDLES = ["NW", "NE", "SW", "SE", "N", "S", "W", "E"];
function CheckIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" }) });
}
function UndoIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M1.22 6.28a.749.749 0 0 1 0-1.06l3.5-3.5a.749.749 0 1 1 1.06 1.06L3.56 5h7.19a5.25 5.25 0 0 1 0 10.5H9.25a.75.75 0 0 1 0-1.5h1.5a3.75 3.75 0 0 0 0-7.5H3.56l2.22 2.22a.749.749 0 1 1-1.06 1.06Z" }) });
}
function XIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" }) });
}
function CropOverlay({
  containerWidth,
  containerHeight,
  cropRect,
  onCropRectChange,
  onCancel
}) {
  const cw = containerWidth || 400;
  const ch = containerHeight || 300;
  const dragging = useRef(null);
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);
  const startDrag = useCallback((handleId, e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = {
      handle: handleId,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropRect }
    };
    const onMove = (me) => {
      if (!dragging.current) return;
      const { handle: handle2, startX, startY, startCrop } = dragging.current;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      let { x, y, width, height } = startCrop;
      if (handle2 === "move") {
        x = clamp(startCrop.x + dx, 0, cw - width);
        y = clamp(startCrop.y + dy, 0, ch - height);
      } else {
        if (handle2.includes("W") || handle2 === "W") {
          const newX = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.width - MIN_CROP);
          width = startCrop.width - (newX - startCrop.x);
          x = newX;
        }
        if (handle2.includes("E") || handle2 === "E") {
          width = clamp(startCrop.width + dx, MIN_CROP, cw - startCrop.x);
        }
        if (handle2.includes("N") || handle2 === "N") {
          const newY = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.height - MIN_CROP);
          height = startCrop.height - (newY - startCrop.y);
          y = newY;
        }
        if (handle2.includes("S") || handle2 === "S") {
          height = clamp(startCrop.height + dy, MIN_CROP, ch - startCrop.y);
        }
      }
      onCropRectChange({ x, y, width, height });
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [cropRect, cw, ch, onCropRectChange]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: styles$2.overlay,
      onPointerDown: (e) => e.stopPropagation(),
      onMouseDown: (e) => e.stopPropagation(),
      children: /* @__PURE__ */ jsx(
        "div",
        {
          className: styles$2.cropRegion,
          style: {
            left: cropRect.x,
            top: cropRect.y,
            width: cropRect.width,
            height: cropRect.height
          },
          onPointerDown: (e) => startDrag("move", e),
          children: HANDLES.map((h) => /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles$2.handle} ${styles$2[`handle${h}`]}`,
              onPointerDown: (e) => startDrag(h, e)
            },
            h
          ))
        }
      )
    }
  );
}
function CropBar({ cropW, cropH, onSave, onUndo, onCancel, canUndo }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: styles$2.cropBar,
      onPointerDown: (e) => e.stopPropagation(),
      onMouseDown: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxs("span", { className: styles$2.dimensions, children: [
          cropW,
          " × ",
          cropH
        ] }),
        /* @__PURE__ */ jsx("span", { className: styles$2.separator }),
        /* @__PURE__ */ jsxs("button", { className: `${styles$2.cropBarBtn} ${styles$2.cropBarBtnSave}`, onClick: onSave, children: [
          /* @__PURE__ */ jsx(CheckIcon, {}),
          " Save"
        ] }),
        canUndo && /* @__PURE__ */ jsxs("button", { className: styles$2.cropBarBtn, onClick: onUndo, children: [
          /* @__PURE__ */ jsx(UndoIcon, {}),
          " Undo"
        ] }),
        /* @__PURE__ */ jsx("button", { className: `${styles$2.cropBarBtn} ${styles$2.cropBarBtnCancel}`, onClick: onCancel, children: /* @__PURE__ */ jsx(XIcon, {}) })
      ]
    }
  );
}
const imageWrapper = "_imageWrapper_125xh_1";
const container$1 = "_container_125xh_5";
const frame = "_frame_125xh_11";
const image = "_image_125xh_1";
const cropBarSlot = "_cropBarSlot_125xh_37";
const privateBadge = "_privateBadge_125xh_48";
const expandedImageContainer = "_expandedImageContainer_125xh_65";
const expandedImage = "_expandedImage_125xh_65";
const imageStyles = {
  imageWrapper,
  container: container$1,
  frame,
  image,
  cropBarSlot,
  privateBadge,
  expandedImageContainer,
  expandedImage
};
const imageSchema = schemas["image"];
function getImageUrl(src) {
  if (!src) return "";
  const path = globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ === true ? `assets/canvas/images/${src}` : `_hypercanvas/canvas/images/${src}`;
  return resolveBasePathAsset(path, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/");
}
const ImageWidget = forwardRef(function ImageWidget2({ id, props, onUpdate, resizable }, ref) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [naturalRatio, setNaturalRatio] = useState(null);
  const [naturalSize, setNaturalSize] = useState(null);
  const [expandMode, setExpandMode] = useExpandOverride("image", id);
  const expanded = expandMode !== null;
  const [cropping, setCropping] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [previousSrc, setPreviousSrc] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const src = readProp(props, "src", imageSchema);
  const isPrivate = readProp(props, "private", imageSchema);
  const isHiddenInProd = isPrivate && globalThis.__HYPERCANVAS_NOTEBOOK_PRODUCTION__;
  const width = readProp(props, "width", imageSchema);
  const height = readProp(props, "height", imageSchema);
  const handleImageLoad = useCallback((e) => {
    const img = e.target;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalRatio(img.naturalWidth / img.naturalHeight);
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }, []);
  const handleResize = useCallback((newWidth) => {
    const ratio = naturalRatio || (width && height ? width / height : 4 / 3);
    const newHeight = Math.round(newWidth / ratio);
    onUpdate?.({ width: newWidth, height: newHeight });
  }, [naturalRatio, width, height, onUpdate]);
  const cw = containerSize?.width || width || 400;
  const ch = containerSize?.height || height || 300;
  const handleCropSave = useCallback(async () => {
    if (!src || !cropRect) return;
    const scaleX2 = (naturalSize?.width || cw) / cw;
    const scaleY2 = (naturalSize?.height || ch) / ch;
    const naturalCropRect = {
      x: Math.round(cropRect.x * scaleX2),
      y: Math.round(cropRect.y * scaleY2),
      width: Math.round(cropRect.width * scaleX2),
      height: Math.round(cropRect.height * scaleY2)
    };
    const canvasId = window.__storyboardCanvasBridgeState?.canvasId || "";
    try {
      const result = await cropAndUpload(src, naturalCropRect, canvasId);
      if (result.success) {
        setPreviousSrc(src);
        onUpdate?.({ src: result.filename });
      }
    } catch (err) {
      console.error("[canvas] Failed to crop image:", err);
    }
    setCropping(false);
    setCropRect(null);
  }, [src, cropRect, naturalSize, cw, ch, onUpdate]);
  const handleCropCancel = useCallback(() => {
    setCropping(false);
    setCropRect(null);
  }, []);
  const handleCropUndo = useCallback(() => {
    if (previousSrc) {
      onUpdate?.({ src: previousSrc });
      setPreviousSrc(null);
    }
    setCropping(false);
    setCropRect(null);
  }, [previousSrc, onUpdate]);
  useImperativeHandle(ref, () => ({
    handleAction(actionId) {
      if (actionId === "expand" || actionId === "expand-single") {
        setExpandMode("single");
        return true;
      }
      if (actionId === "split-screen") {
        setExpandMode("split");
        return true;
      }
      if (actionId === "crop-image") {
        const el = containerRef.current;
        const w = el?.offsetWidth || width || 400;
        const h = el?.offsetHeight || height || 300;
        if (el) setContainerSize({ width: w, height: h });
        setCropRect({
          x: Math.round(w * 0.05),
          y: Math.round(h * 0.05),
          width: Math.round(w * 0.9),
          height: Math.round(h * 0.9)
        });
        setCropping(true);
        return true;
      }
      if (actionId === "toggle-private") {
        if (!src) return;
        toggleImagePrivacy(src).then((result) => {
          if (result.success) {
            onUpdate?.({ src: result.filename, private: result.private });
          }
        }).catch((err) => {
          console.error("[canvas] Failed to toggle image privacy:", err);
        });
      } else if (actionId === "download-image") {
        if (!src) return;
        const url2 = getImageUrl(src);
        fetch(url2).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        }).then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          const baseName = src.includes("/") ? src.slice(src.lastIndexOf("/") + 1) : src;
          a.download = baseName.replace(/^~/, "");
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }).catch((err) => console.error("[canvas] Failed to download image:", err));
      } else if (actionId === "copy-as-png") {
        if (!src) return;
        const url2 = getImageUrl(src);
        fetch(url2).then((r) => r.blob()).then((blob) => {
          const pngBlob = blob.type === "image/png" ? blob : blob;
          void copyCanvasImage(pngBlob);
        }).catch((err) => console.error("[canvas] Failed to copy image:", err));
      } else if (actionId === "copy-file-path") {
        if (!src) return;
        void copyCanvasText(`assets/canvas/images/${src}`, "image path");
      }
    }
  }), [src, onUpdate]);
  if (!src || isHiddenInProd) return null;
  const sizeStyle = {};
  if (typeof width === "number") sizeStyle.width = `${width}px`;
  const scaleX = cropRect ? (naturalSize?.width || cw) / cw : 1;
  const scaleY = cropRect ? (naturalSize?.height || ch) / ch : 1;
  const cropW = cropRect ? Math.round(cropRect.width * scaleX) : 0;
  const cropH = cropRect ? Math.round(cropRect.height * scaleY) : 0;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(WidgetWrapper, { className: imageStyles.imageWrapper, children: /* @__PURE__ */ jsxs("div", { ref: containerRef, className: imageStyles.container, style: sizeStyle, "data-crop-active": cropping || void 0, children: [
      /* @__PURE__ */ jsxs("div", { className: imageStyles.frame, children: [
        /* @__PURE__ */ jsx(
          "img",
          {
            ref: imgRef,
            src: getImageUrl(src),
            alt: "",
            className: imageStyles.image,
            onLoad: handleImageLoad,
            draggable: false
          }
        ),
        isPrivate && !cropping && /* @__PURE__ */ jsx("span", { className: imageStyles.privateBadge, title: "Private — not committed to git", children: "Private" }),
        cropping && cropRect && /* @__PURE__ */ jsx(
          CropOverlay,
          {
            containerWidth: cw,
            containerHeight: ch,
            cropRect,
            onCropRectChange: setCropRect,
            onCancel: handleCropCancel
          }
        )
      ] }),
      resizable && !cropping && /* @__PURE__ */ jsx(
        ResizeHandle,
        {
          targetRef: containerRef,
          minWidth: 100,
          minHeight: 60,
          onResize: (w) => handleResize(w)
        }
      )
    ] }) }),
    cropping && cropRect && /* @__PURE__ */ jsx("div", { className: imageStyles.cropBarSlot, children: /* @__PURE__ */ jsx(
      CropBar,
      {
        cropW,
        cropH,
        onSave: handleCropSave,
        onCancel: handleCropCancel,
        onUndo: handleCropUndo,
        canUndo: !!previousSrc
      }
    ) }),
    expanded && /* @__PURE__ */ jsx(
      ImageExpandPane,
      {
        widgetId: id,
        src,
        splitMode: expandMode === "split",
        onClose: () => setExpandMode(null)
      }
    )
  ] });
});
function ImageExpandPane({ widgetId, src, splitMode, onClose }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode]
  );
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState;
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: "image", position: { x: 0, y: 0 }, props: {} };
  }, [widgetId]);
  const surface = splitMode ? "splitbar" : "fullbar";
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label: getSplitPaneLabel(primaryWidget) || "Image",
        widgetType: "image",
        kind: "react",
        render: () => /* @__PURE__ */ jsx("div", { className: imageStyles.expandedImageContainer, children: /* @__PURE__ */ jsx(
          "img",
          {
            src: getImageUrl(src),
            alt: "",
            className: imageStyles.expandedImage,
            draggable: false
          }
        ) })
      };
    }
    return buildPaneForWidget(widget, surface);
  }, [widgetId, primaryWidget, src, surface]);
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
const ImageWidget$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: ImageWidget,
  getImageUrl
}, Symbol.toStringTag, { value: "Module" }));
function FileSecondaryPane({ widget, context }) {
  const filePath = typeof widget?.props?.path === "string" ? widget.props.path : "";
  const content = filePath ? context?.renderFileContent?.(filePath) : null;
  if (content) return content;
  return createElement("p", { role: "status" }, "File content is unavailable in this published Notebook.");
}
const container = "_container_1m462_3";
const card = "_card_1m462_7";
const ogImage = "_ogImage_1m462_28";
const body = "_body_1m462_35";
const title = "_title_1m462_42";
const titleInput = "_titleInput_1m462_52";
const description = "_description_1m462_66";
const url = "_url_1m462_77";
const issueCard = "_issueCard_1m462_95";
const issueCardCollapsed = "_issueCardCollapsed_1m462_107";
const typeBar = "_typeBar_1m462_111";
const issueBodyScrollable = "_issueBodyScrollable_1m462_125";
const issueHeader = "_issueHeader_1m462_133";
const issueTitle = "_issueTitle_1m462_137";
const issueTitleLink = "_issueTitleLink_1m462_145";
const issueNumber = "_issueNumber_1m462_155";
const issueContext = "_issueContext_1m462_161";
const issueByline = "_issueByline_1m462_167";
const issueBylineLeft = "_issueBylineLeft_1m462_176";
const avatar = "_avatar_1m462_183";
const authorLink = "_authorLink_1m462_190";
const bylineText = "_bylineText_1m462_206";
const issueBody = "_issueBody_1m462_125";
const error = "_error_1m462_446";
const expandedIssue = "_expandedIssue_1m462_455";
const expandedIssueHeader = "_expandedIssueHeader_1m462_463";
const expandedIssueTitle = "_expandedIssueTitle_1m462_468";
const expandedIssueNumber = "_expandedIssueNumber_1m462_485";
const expandedByline = "_expandedByline_1m462_489";
const expandedAuthor = "_expandedAuthor_1m462_496";
const expandedBylineText = "_expandedBylineText_1m462_509";
const expandedIssueBody = "_expandedIssueBody_1m462_513";
const expandedLink = "_expandedLink_1m462_548";
const expandedOgImage = "_expandedOgImage_1m462_553";
const expandedTitle = "_expandedTitle_1m462_562";
const expandedDescription = "_expandedDescription_1m462_569";
const expandedUrl = "_expandedUrl_1m462_576";
const prMeta = "_prMeta_1m462_588";
const prStateBadge = "_prStateBadge_1m462_598";
const prStateOpen = "_prStateOpen_1m462_611";
const prStateMerged = "_prStateMerged_1m462_612";
const prStateClosed = "_prStateClosed_1m462_613";
const prStateDraft = "_prStateDraft_1m462_614";
const prBranchRef = "_prBranchRef_1m462_618";
const prBranchName = "_prBranchName_1m462_632";
const prBranchArrow = "_prBranchArrow_1m462_639";
const prDiffStat = "_prDiffStat_1m462_645";
const prDiffAdd = "_prDiffAdd_1m462_654";
const prDiffDel = "_prDiffDel_1m462_655";
const styles$1 = {
  container,
  card,
  ogImage,
  body,
  title,
  titleInput,
  description,
  url,
  issueCard,
  issueCardCollapsed,
  typeBar,
  issueBodyScrollable,
  issueHeader,
  issueTitle,
  issueTitleLink,
  issueNumber,
  issueContext,
  issueByline,
  issueBylineLeft,
  avatar,
  authorLink,
  bylineText,
  issueBody,
  error,
  expandedIssue,
  expandedIssueHeader,
  expandedIssueTitle,
  expandedIssueNumber,
  expandedByline,
  expandedAuthor,
  expandedBylineText,
  expandedIssueBody,
  expandedLink,
  expandedOgImage,
  expandedTitle,
  expandedDescription,
  expandedUrl,
  prMeta,
  prStateBadge,
  prStateOpen,
  prStateMerged,
  prStateClosed,
  prStateDraft,
  prBranchRef,
  prBranchName,
  prBranchArrow,
  prDiffStat,
  prDiffAdd,
  prDiffDel
};
function MarkdownSecondaryPane({ widget, editingRef, onUpdate }) {
  const [editing, setEditing] = useState(false);
  editingRef.current = editing;
  editingRef.setter = (v) => {
    setEditing(v);
    document.dispatchEvent(new CustomEvent("storyboard:expanded-pane:refresh"));
  };
  const [content, setContent] = useState(widget.props?.content || "");
  useEffect(() => {
    const handler = () => {
      const liveWidget = window.__storyboardCanvasBridgeState?.widgets?.find((w) => w.id === widget.id);
      const liveContent = liveWidget?.props?.content;
      if (typeof liveContent === "string") {
        setContent((prev) => prev === liveContent ? prev : liveContent);
      }
    };
    document.addEventListener("storyboard:canvas:bridge-updated", handler);
    return () => document.removeEventListener("storyboard:canvas:bridge-updated", handler);
  }, [widget.id]);
  const handleUpdate = useCallback((updates) => {
    if (typeof updates?.content === "string") {
      setContent(updates.content);
    }
    onUpdate(updates);
  }, [onUpdate]);
  return createElement(ExpandedMarkdownEditor, {
    content,
    onUpdate: handleUpdate,
    editing,
    onToggleEdit: () => editingRef.setter(!editing)
  });
}
function buildPaneForWidget(widget, surface = "splitbar", theme, context) {
  if (!widget) return null;
  const label = getSplitPaneLabel(widget);
  if (context?.mode === "static" && ["terminal", "terminal-read", "agent", "agent-chat", "prompt"].includes(widget.type)) {
    const snapshot = typeof widget.props?.snapshot === "string" ? widget.props.snapshot : null;
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "react",
      render: () => snapshot === null ? createElement("p", { role: "status" }, `${label} is read-only in this published Notebook.`) : createElement("pre", {
        "aria-label": `${label} snapshot`,
        style: { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
      }, snapshot)
    };
  }
  if (["site-frame", "story", "component-set", "story-set"].includes(widget.type)) {
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      widgetProps: widget.props,
      kind: "external",
      attach: (container2) => window.__storyboardCanvasWidgetRefs?.get(widget.id)?.attachExpandedPane?.(container2)
    };
  }
  if (widget.type === "terminal" || widget.type === "terminal-read" || widget.type === "agent") {
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      widgetProps: widget.props,
      kind: "external",
      attach: (container2) => reparentTerminalInto(widget.id, container2),
      onResize: (rect) => {
        if (typeof window !== "undefined" && window.__storyboardTerminalRegistry) {
          const entry = window.__storyboardTerminalRegistry.get(widget.id);
          if (entry) {
            const { term, ws } = entry;
            const cw = term.renderer?.charWidth;
            const ch = term.renderer?.charHeight;
            if (cw && ch && rect.width > 50 && rect.height > 50) {
              const cols = Math.max(10, Math.floor(rect.width / cw));
              const rows = Math.max(4, Math.floor(rect.height / ch));
              term.resize?.(cols, rows);
              if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "resize", cols, rows }));
              }
            }
          }
        }
      }
    };
  }
  const iframeUrl = buildSecondaryIframeUrl(widget, { theme });
  if (iframeUrl) {
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "react",
      render: () => createElement("iframe", {
        src: iframeUrl,
        style: { border: "none", width: "100%", height: "100%", display: "block" },
        title: label
      })
    };
  }
  if (widget.type === "markdown") {
    const editingRef = { current: false, setter: null };
    const toggleEdit = () => {
      editingRef.setter?.(!editingRef.current);
    };
    const onUpdate = (updates) => {
      document.dispatchEvent(new CustomEvent("storyboard:canvas:update-widget", {
        detail: { widgetId: widget.id, updates }
      }));
    };
    const surfaceFeatures = getFeaturesForSurface("markdown", surface);
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "react",
      features: surfaceFeatures,
      getState: (key) => {
        if (key === "editing") return editingRef.current;
        return void 0;
      },
      onAction: (actionId) => {
        if (actionId === "toggle-edit") toggleEdit();
      },
      render: () => createElement(MarkdownSecondaryPane, { widget, editingRef, onUpdate })
    };
  }
  if (widget.type === "agent-chat") {
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "external",
      attach: (container2) => window.__storyboardCanvasWidgetRefs?.get(widget.id)?.attachExpandedPane?.(container2),
      beforeDetach: () => window.__storyboardCanvasWidgetRefs?.get(widget.id)?.prepareExpandedPaneMove?.() || Promise.resolve(() => {
      })
    };
  }
  if (widget.type === "link-preview") {
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "react",
      render: () => createElement(LazyLinkPreviewPane, { widget })
    };
  }
  if (widget.type === "image") {
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "react",
      render: () => createElement(LazyImagePane, { widget })
    };
  }
  if (widget.type === "file") {
    const editingRef = { current: false, setter: null };
    const portable = context?.mode === "static";
    const surfaceFeatures = portable ? [] : getFeaturesForSurface("file", surface);
    return {
      id: widget.id,
      label,
      widgetType: widget.type,
      kind: "react",
      features: surfaceFeatures,
      getState: (key) => {
        if (key === "editing") return editingRef.current;
        return void 0;
      },
      onAction: portable ? void 0 : (actionId) => {
        if (actionId === "toggle-edit") editingRef.setter?.(!editingRef.current);
      },
      render: () => createElement(FileSecondaryPane, { widget, editingRef, context })
    };
  }
  return null;
}
function LazyLinkPreviewPane({ widget }) {
  const { url: url2, title: title2, github, ogImage: ogImage2, description: description2 } = widget.props || {};
  let hostname = "";
  try {
    hostname = new URL(url2).hostname;
  } catch {
  }
  if (github) {
    const titleText = title2 || github.title || "";
    const issueNumber2 = github.number ? `#${github.number}` : "";
    const primaryAuthor = github.author || "";
    const createdAgo = github.createdAgo || "";
    const bodyHtml = github.bodyHtml || "";
    return createElement(
      "div",
      { className: styles$1.expandedIssue },
      createElement(
        "header",
        { className: styles$1.expandedIssueHeader },
        createElement(
          "h2",
          { className: styles$1.expandedIssueTitle },
          createElement(
            "a",
            { href: url2 || "#", target: "_blank", rel: "noopener noreferrer" },
            titleText || url2,
            issueNumber2 && createElement("span", { className: styles$1.expandedIssueNumber }, ` ${issueNumber2}`)
          )
        ),
        createElement(
          "div",
          { className: styles$1.expandedByline },
          primaryAuthor && createElement(
            "a",
            {
              href: `https://github.com/${primaryAuthor}`,
              target: "_blank",
              rel: "noopener noreferrer",
              className: styles$1.expandedAuthor
            },
            createElement("img", {
              src: `https://github.com/${primaryAuthor}.png?size=40`,
              alt: "",
              width: "20",
              height: "20",
              className: styles$1.avatar,
              loading: "lazy"
            }),
            primaryAuthor
          ),
          createdAgo && createElement(
            "span",
            { className: styles$1.expandedBylineText },
            primaryAuthor ? ` opened ${createdAgo}` : `Opened ${createdAgo}`
          )
        )
      ),
      bodyHtml && createElement(DangerousHtmlDiv, { html: bodyHtml, className: styles$1.expandedIssueBody })
    );
  }
  return createElement(
    "div",
    { className: styles$1.expandedLink },
    ogImage2 && createElement("img", { className: styles$1.expandedOgImage, src: ogImage2, alt: "", loading: "lazy" }),
    createElement("h2", { className: styles$1.expandedTitle }, title2 || hostname || url2 || "Untitled"),
    description2 && createElement("p", { className: styles$1.expandedDescription }, description2),
    url2 && createElement("a", {
      href: url2,
      target: "_blank",
      rel: "noopener noreferrer",
      className: styles$1.expandedUrl
    }, url2)
  );
}
function DangerousHtmlDiv({ html, className }) {
  const setRef = useCallback((el) => {
    if (el) el.innerHTML = html;
  }, [html]);
  return createElement("div", { ref: setRef, className });
}
function LazyImagePane({ widget }) {
  const src = widget.props?.src;
  if (!src) return null;
  return createElement(
    "div",
    { className: imageStyles.expandedImageContainer },
    createElement("img", {
      src: getImageUrl(src),
      alt: "",
      className: imageStyles.expandedImage,
      draggable: false
    })
  );
}
function findAllConnectedSplitTargets(widgetId, maxCount = 3) {
  const bridge = window.__storyboardCanvasBridgeState;
  if (!bridge?.connectors || !bridge?.widgets) return [];
  const connectedIds = /* @__PURE__ */ new Set();
  for (const c of bridge.connectors) {
    if (c.start?.widgetId === widgetId && c.end?.widgetId) connectedIds.add(c.end.widgetId);
    if (c.end?.widgetId === widgetId && c.start?.widgetId) connectedIds.add(c.start.widgetId);
  }
  if (connectedIds.size === 0) return [];
  const candidates = bridge.widgets.filter(
    (w) => connectedIds.has(w.id) && isSplitScreenCapable(w.type)
  );
  if (candidates.length <= maxCount) return candidates;
  const primary = bridge.widgets.find((w) => w.id === widgetId);
  const px = primary?.position?.x ?? 0;
  const py = primary?.position?.y ?? 0;
  return candidates.map((w) => {
    const dx = (w.position?.x ?? 0) - px;
    const dy = (w.position?.y ?? 0) - py;
    return { widget: w, dist: dx * dx + dy * dy };
  }).sort((a, b) => a.dist - b.dist).slice(0, maxCount).map((e) => e.widget);
}
function buildSplitLayout(primaryWidget, connectedWidgets, buildPaneFn) {
  const allWidgets = [primaryWidget, ...connectedWidgets];
  const entries = allWidgets.map((w) => ({ widget: w, pane: buildPaneFn(w) })).filter((e) => e.pane !== null);
  if (entries.length === 0) return [];
  if (entries.length === 1) return [[entries[0].pane]];
  const assigned = assignToQuadrants(entries.map((e) => ({
    x: e.widget.position?.x ?? 0,
    y: e.widget.position?.y ?? 0,
    data: e.pane
  })));
  const leftCol = [assigned.tl, assigned.bl].filter(Boolean);
  const rightCol = [assigned.tr, assigned.br].filter(Boolean);
  const layout = [];
  if (leftCol.length > 0) layout.push(leftCol);
  if (rightCol.length > 0) layout.push(rightCol);
  return layout;
}
function assignToQuadrants(items) {
  const result = { tl: null, tr: null, bl: null, br: null };
  if (items.length === 0) return result;
  const cx = items.reduce((s, i) => s + i.x, 0) / items.length;
  const cy = items.reduce((s, i) => s + i.y, 0) / items.length;
  const allSameX = items.every((i) => i.x === items[0].x);
  const allSameY = items.every((i) => i.y === items[0].y);
  if (allSameX && allSameY) {
    const slots = ["tl", "tr", "bl", "br"];
    for (let i = 0; i < Math.min(items.length, 4); i++) {
      result[slots[i]] = items[i].data;
    }
    return result;
  }
  const buckets = { tl: [], tr: [], bl: [], br: [] };
  for (const item of items) {
    const col = item.x < cx ? "l" : "r";
    const row = item.y < cy ? "t" : "b";
    buckets[`${row}${col}`].push(item);
  }
  const overflow = [];
  for (const [slot, bucket] of Object.entries(buckets)) {
    if (bucket.length > 0) {
      bucket.sort((a, b) => a.y - b.y || a.x - b.x);
      result[slot] = bucket[0].data;
      for (let i = 1; i < bucket.length; i++) overflow.push(bucket[i]);
    }
  }
  if (overflow.length > 0) {
    const allSlots = ["tl", "tr", "bl", "br"];
    const emptySlots = allSlots.filter((s) => result[s] === null);
    for (let i = 0; i < Math.min(overflow.length, emptySlots.length); i++) {
      result[emptySlots[i]] = overflow[i].data;
    }
  }
  return result;
}
function buildSecondaryIframeUrl(widget, { theme } = {}) {
  if (!widget) return null;
  const base = typeof import.meta !== "undefined" && globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
  const baseClean = base.endsWith("/") ? base.slice(0, -1) : base;
  if (widget.type === "prototype") {
    const src = widget.props?.src;
    if (!src) return null;
    if (/^https?:\/\//.test(src)) return src;
    const baseSegment = baseClean.replace(/^\//, "");
    const cleaned = src.replace(/^\/branch--[^/]+/, "");
    let normalized;
    if (baseSegment && cleaned.startsWith(baseClean)) normalized = cleaned;
    else if (baseSegment && cleaned.startsWith(baseSegment)) normalized = `/${cleaned}`;
    else normalized = `${baseClean}${cleaned.startsWith("/") ? "" : "/"}${cleaned}`;
    const withoutBase = baseSegment && normalized.startsWith(baseClean) ? normalized.slice(baseClean.length) || "/" : normalized;
    const hashIdx = withoutBase.indexOf("#");
    const innerHash = hashIdx >= 0 ? withoutBase.slice(hashIdx + 1) : "";
    const pathAndQuery = hashIdx >= 0 ? withoutBase.slice(0, hashIdx) : withoutBase;
    const queryIdx = pathAndQuery.indexOf("?");
    const route = queryIdx >= 0 ? pathAndQuery.slice(0, queryIdx) : pathAndQuery;
    const params = new URLSearchParams(queryIdx >= 0 ? pathAndQuery.slice(queryIdx + 1) : "");
    if (theme && !params.has("theme")) params.set("theme", theme);
    const routePath = `${route.startsWith("/") ? route : `/${route}`}${params.size ? `?${params}` : ""}`;
    const suffix = innerHash ? `#${innerHash}` : "";
    const sep = routePath.includes("?") ? "&" : "?";
    const isDev = typeof import.meta !== "undefined" && globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__;
    const base2 = isDev ? `${baseClean}/prototypes.html${routePath}` : `${baseClean}${routePath}`;
    return `${base2}${sep}_sb_embed&_sb_hide_branch_bar&_sb_theme_target=content${suffix}`;
  }
  if (widget.type === "figma-embed") {
    const url2 = widget.props?.url;
    if (!url2) return null;
    try {
      const u = new URL(url2);
      if (u.hostname !== "figma.com" && !u.hostname.endsWith(".figma.com")) return null;
      return `https://www.figma.com/embed?embed_host=storyboard&url=${encodeURIComponent(url2)}`;
    } catch {
      return null;
    }
  }
  if (widget.type === "codepen-embed") {
    const url2 = widget.props?.url;
    if (!url2) return null;
    try {
      const u = new URL(url2);
      if (u.hostname !== "codepen.io" && !u.hostname.endsWith(".codepen.io")) return null;
      const path = u.pathname.replace(/\/(pen|full|details)\//, "/embed/");
      return `https://codepen.io${path}?default-tab=result`;
    } catch {
      return null;
    }
  }
  if (widget.type === "story" || widget.type === "component-set") {
    const storyId = widget.props?.storyId;
    if (!storyId) return null;
    return storyFrameUrl(getStoryData(storyId), storyId, widget.props, {
      theme: widget.props?.search && new URLSearchParams(widget.props.search).has("theme") ? void 0 : resolveFrameTheme(widget.props?.frameThemeOverride, theme || getResolvedFor("prototype"), getConfig("theming")?.themes || {}),
      componentSet: widget.type === "component-set"
    }) || null;
  }
  return null;
}
function reparentTerminalInto(widgetId, targetEl) {
  const widgetEl = document.querySelector(`[data-widget-id="${widgetId}"]`);
  if (!widgetEl) return null;
  const xtermEl = widgetEl.querySelector('[class*="xtermContainer"]');
  if (!xtermEl) return null;
  const originalParent = xtermEl.parentElement;
  const originalNextSibling = xtermEl.nextSibling;
  targetEl.appendChild(xtermEl);
  return () => {
    if (originalNextSibling) {
      originalParent.insertBefore(xtermEl, originalNextSibling);
    } else {
      originalParent.appendChild(xtermEl);
    }
  };
}
function getSplitPaneLabel(widget) {
  if (!widget) return "";
  const meta = getWidgetMeta(widget.type);
  const typeName = meta?.label || widget.type;
  if (widget.type === "terminal" || widget.type === "terminal-read") {
    return `Terminal · ${widget.props?.prettyName || "…"}`;
  }
  if (widget.type === "agent") {
    const name = widget.props?.prettyName || "…";
    return `Agent · ${name}`;
  }
  if (widget.type === "prototype") {
    return `Prototype · ${widget.props?.src || "…"}`;
  }
  if (["site-frame", "story", "component-set", "story-set"].includes(widget.type)) {
    return `Site · ${widget.props?.title || widget.props?.siteId || "…"} · ${widget.props?.route || "/"}`;
  }
  if (widget.type === "figma-embed") {
    const url2 = widget.props?.url || "";
    let name = "Figma";
    try {
      name = new URL(url2).pathname.split("/").pop() || "Figma";
    } catch {
    }
    return `Figma · ${name}`;
  }
  if (widget.type === "codepen-embed") {
    return `CodePen · ${widget.props?.url || "…"}`;
  }
  if (widget.type === "story") {
    return `Story · ${widget.props?.storyId || "…"}`;
  }
  if (widget.type === "component-set") {
    return `Component Set · ${widget.props?.storyId || "…"}`;
  }
  if (widget.type === "markdown") {
    const content = widget.props?.content || "";
    const firstLine = content.split("\n").find((l) => l.trim()) || "";
    const preview2 = firstLine.replace(/^#+\s*/, "").slice(0, 40);
    return `Markdown · ${preview2 || "…"}`;
  }
  if (widget.type === "link-preview") {
    return `${widget.props?.github ? "GitHub" : "Link"} · ${widget.props?.title || widget.props?.url || "…"}`;
  }
  if (widget.type === "image") {
    const filename = widget.props?.src || "";
    const name = filename.replace(/^~/, "").replace(/\.[^.]+$/, "") || "…";
    return `Image · ${name}`;
  }
  if (widget.type === "file") {
    const p = widget.props?.path || "";
    if (!p) return "File";
    const basename = p.split("/").pop() || p;
    const dir = p.slice(0, p.length - basename.length).replace(/\/$/, "");
    return dir ? `${dir}/${basename}` : basename;
  }
  if (widget.type === "agent-chat") {
    const agentId = widget.props?.agentId || "";
    return `Agent Chat · ${agentId ? `${agentId.slice(0, 12)}…` : "new chat"}`;
  }
  return typeName;
}
const block = "_block_oc4zw_7";
const blockCollapsed = "_blockCollapsed_oc4zw_12";
const preview = "_preview_oc4zw_17";
const editor = "_editor_oc4zw_28";
const expandedEditorWrap = "_expandedEditorWrap_oc4zw_46";
const expandedEditor = "_expandedEditor_oc4zw_46";
const expandedPreview = "_expandedPreview_oc4zw_78";
const styles = {
  block,
  blockCollapsed,
  preview,
  editor,
  expandedEditorWrap,
  expandedEditor,
  expandedPreview
};
const markdownSchema = schemas["markdown"];
const MarkdownBlock = forwardRef(function MarkdownBlock2({ id, props, onUpdate, resizable, context }, ref) {
  const content = readProp(props, "content", markdownSchema);
  const width = readProp(props, "width", markdownSchema);
  const height = props?.height;
  const collapsed = !!props?.collapsed;
  const canEdit = typeof onUpdate === "function";
  const [editing, setEditing] = useState(false);
  const [expandMode, setExpandMode] = useExpandOverride("markdown", id);
  const expanded = expandMode !== null;
  const editingActive = canEdit && editing;
  const collapsedActive = collapsed && !editingActive;
  const blockRef = useRef(null);
  const [editHeight, setEditHeight] = useState(null);
  useImperativeHandle(ref, () => ({
    handleAction(actionId) {
      if (actionId === "expand" || actionId === "expand-single") {
        setExpandMode("single");
        return true;
      }
      if (actionId === "split-screen") {
        setExpandMode("split");
        return true;
      }
      return false;
    }
  }), []);
  const handleResize = useCallback((w, h) => {
    onUpdate?.({ width: w, height: h });
  }, [onUpdate]);
  const handleContentChange = useCallback((value) => {
    onUpdate?.({ content: value });
  }, [onUpdate]);
  const handleReadOnlyCopy = useCallback((e) => {
    if (canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.clipboardData?.setData) {
      e.clipboardData.setData("text/plain", content || "");
    }
  }, [canEdit, content]);
  const startEditing = useCallback(() => {
    if (blockRef.current) {
      setEditHeight(blockRef.current.offsetHeight);
      blockRef.current.dataset.scrollTop = blockRef.current.scrollTop;
    }
    setEditing(true);
  }, []);
  useEffect(() => {
    if (editingActive) {
      if (blockRef.current) {
        blockRef.current.scrollTop = blockRef.current.dataset.scrollTop || 0;
      }
    } else {
      setEditHeight(null);
    }
  }, [editingActive]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsxs(
      "div",
      {
        ref: blockRef,
        className: `${styles.block}${collapsedActive ? ` ${styles.blockCollapsed}` : ""}`,
        style: {
          width,
          ...height ? {
            height,
            // Collapsed keeps its fade + clipped overflow, but an explicit
            // height (from vertical resize) must beat the default 360px
            // collapse cap so the widget stays vertically resizable.
            overflow: collapsedActive ? "hidden" : "auto",
            ...collapsedActive ? { maxHeight: "none" } : {}
          } : {},
          ...editHeight ? { height: editHeight, display: "flex", flexDirection: "column" } : {}
        },
        children: [
          editingActive ? /* @__PURE__ */ jsx(
            MarkdownTextEditor,
            {
              className: styles.editor,
              style: { flex: 1 },
              content,
              onChange: handleContentChange,
              onExit: () => setEditing(false)
            }
          ) : /* @__PURE__ */ jsx(
            MarkdownView,
            {
              className: styles.preview,
              style: !canEdit ? { cursor: "default" } : void 0,
              content,
              canEdit,
              onStartEditing: startEditing,
              onCopy: !canEdit ? handleReadOnlyCopy : void 0,
              allowTextSelection: !canEdit,
              size: "small",
              inert: true,
              emptyHtml: canEdit ? '<p class="placeholder">Double-click to edit…</p>' : '<p class="placeholder">No content</p>'
            }
          ),
          resizable && /* @__PURE__ */ jsx(
            ResizeHandle,
            {
              targetRef: blockRef,
              minWidth: 200,
              minHeight: 60,
              onResize: handleResize
            }
          )
        ]
      }
    ) }),
    expanded && /* @__PURE__ */ jsx(
      MarkdownExpandPane,
      {
        widgetId: id,
        content,
        splitMode: expandMode === "split",
        onClose: () => setExpandMode(null),
        onUpdate,
        context
      }
    )
  ] });
});
function MarkdownExpandPane({ widgetId, content, splitMode, onClose, onUpdate, context }) {
  const [editing, setEditing] = useState(false);
  const canEdit = typeof onUpdate === "function";
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode]
  );
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState;
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: "markdown", position: { x: 0, y: 0 }, props: {} };
  }, [widgetId]);
  const surface = splitMode ? "splitbar" : "fullbar";
  const surfaceFeatures = useMemo(
    () => canEdit ? getFeaturesForSurface("markdown", surface) : [],
    [canEdit, surface]
  );
  const getState = useCallback((key) => {
    if (key === "editing") return editing;
    return void 0;
  }, [editing]);
  const handleAction = useCallback((actionId) => {
    if (actionId === "toggle-edit") {
      setEditing((v) => !v);
    }
  }, []);
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label: getSplitPaneLabel(primaryWidget) || "Markdown",
        widgetType: "markdown",
        kind: "react",
        features: surfaceFeatures,
        getState,
        onAction: handleAction,
        render: () => /* @__PURE__ */ jsx(
          ExpandedMarkdownEditor,
          {
            content,
            onUpdate,
            editing,
            onToggleEdit: () => setEditing((v) => !v)
          }
        )
      };
    }
    return buildPaneForWidget(widget, surface, void 0, context);
  }, [widgetId, primaryWidget, content, onUpdate, editing, surfaceFeatures, getState, handleAction, surface, context]);
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
function ExpandedMarkdownEditor({ content, onUpdate, editing, onToggleEdit }) {
  const canEdit = typeof onUpdate === "function";
  if (editing && canEdit) {
    return /* @__PURE__ */ jsx("div", { className: styles.expandedEditorWrap, children: /* @__PURE__ */ jsx(
      MarkdownTextEditor,
      {
        className: styles.expandedEditor,
        content,
        onChange: (value) => onUpdate({ content: value }),
        onExit: () => onToggleEdit?.()
      }
    ) });
  }
  return /* @__PURE__ */ jsx(
    MarkdownView,
    {
      className: styles.expandedPreview,
      style: { flex: 1, overflow: "auto" },
      content,
      canEdit,
      onStartEditing: onToggleEdit,
      size: "large",
      emptyHtml: "<p>No content</p>"
    }
  );
}
const MarkdownBlock$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ExpandedMarkdownEditor,
  default: MarkdownBlock
}, Symbol.toStringTag, { value: "Module" }));
export {
  ImageWidget$1 as I,
  MarkdownBlock$1 as M,
  buildSplitLayout as a,
  buildPaneForWidget as b,
  findAllConnectedSplitTargets as f,
  getSplitPaneLabel as g,
  styles$1 as s
};
