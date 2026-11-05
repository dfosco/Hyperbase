import { jsx, jsxs } from "react/jsx-runtime";
import { useRef, useState, useCallback } from "react";
import { r as readProp, s as stickyNoteSchema } from "./widgetProps-BqIDs1ZC.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { M as MarkdownTextEditor, a as MarkdownView } from "./MarkdownEditor-CXCDlnnq.js";
const container = "_container_7mo8q_1";
const sticky = "_sticky_7mo8q_5";
const text = "_text_7mo8q_30";
const textarea = "_textarea_7mo8q_184";
const styles = {
  container,
  sticky,
  text,
  textarea
};
const COLORS = {
  yellow: { bg: "#fff8c5", border: "#d4a72c", dot: "#e8c846" },
  blue: { bg: "#ddf4ff", border: "#54aeff", dot: "#74b9ff" },
  green: { bg: "#dafbe1", border: "#4ac26b", dot: "#6dd58c" },
  pink: { bg: "#ffebe9", border: "#ff8182", dot: "#ff9a9e" },
  purple: { bg: "#fbefff", border: "#c297ff", dot: "#d4a8ff" },
  orange: { bg: "#fff1e5", border: "#d18616", dot: "#e8a844" }
};
const BASE_AREA = 270 * 170;
const MIN_SCALE = 0.8;
const MAX_SCALE = 2;
function computeTextScale(width, height) {
  if (typeof width !== "number" || typeof height !== "number") return 1;
  if (width <= 0 || height <= 0) return 1;
  const ratio = Math.sqrt(width * height / BASE_AREA);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, ratio));
}
function StickyNote({ props, onUpdate, resizable }) {
  const text2 = readProp(props, "text", stickyNoteSchema);
  const color = readProp(props, "color", stickyNoteSchema);
  const width = readProp(props, "width", stickyNoteSchema);
  const height = readProp(props, "height", stickyNoteSchema);
  const autoScaleText = !!readProp(props, "autoScaleText", stickyNoteSchema);
  const canEdit = typeof onUpdate === "function";
  const palette = COLORS[color] ?? COLORS.yellow;
  const stickyRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const editingActive = canEdit && editing;
  const handleResize = useCallback((w, h) => {
    onUpdate?.({ width: w, height: h });
  }, [onUpdate]);
  const handleTextChange = useCallback((value) => {
    onUpdate?.({ text: value });
  }, [onUpdate]);
  const textStyle = autoScaleText ? { "--sticky-text-scale": computeTextScale(width, height) } : void 0;
  return /* @__PURE__ */ jsx("div", { className: styles.container, children: /* @__PURE__ */ jsxs(
    "article",
    {
      ref: stickyRef,
      className: styles.sticky,
      "data-auto-scale": autoScaleText ? "" : void 0,
      style: {
        "--sticky-bg": palette.bg,
        "--sticky-border": palette.border,
        ...typeof width === "number" ? { width: `${width}px` } : void 0,
        ...typeof height === "number" ? { height: `${height}px` } : void 0
      },
      children: [
        editingActive ? /* @__PURE__ */ jsx(
          MarkdownTextEditor,
          {
            content: text2,
            onChange: handleTextChange,
            onExit: () => setEditing(false),
            className: styles.textarea,
            style: textStyle,
            placeholder: "Type here…"
          }
        ) : /* @__PURE__ */ jsx(
          MarkdownView,
          {
            content: text2,
            canEdit,
            onStartEditing: () => setEditing(true),
            className: styles.text,
            style: textStyle,
            allowTextSelection: !canEdit,
            size: "small",
            inert: true
          }
        ),
        resizable && /* @__PURE__ */ jsx(
          ResizeHandle,
          {
            targetRef: stickyRef,
            minWidth: 180,
            minHeight: 60,
            onResize: handleResize
          }
        )
      ]
    }
  ) });
}
export {
  StickyNote as default
};
