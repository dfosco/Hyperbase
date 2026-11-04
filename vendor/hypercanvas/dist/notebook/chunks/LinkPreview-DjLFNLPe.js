import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { forwardRef, useRef, useState, useImperativeHandle, useCallback, useEffect, useMemo } from "react";
import { b as createLucideIcon } from "./createLucideIcon-CV-5aOV3.js";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { r as readProp, l as linkPreviewSchema } from "./widgetProps-_UqatjIo.js";
import { E as ExpandedPane } from "./Document-2gwDP-Y5.js";
import { s as styles, f as findAllConnectedSplitTargets, b as buildPaneForWidget, a as buildSplitLayout } from "./MarkdownBlock-DxsMG03P.js";
import { u as useExpandOverride } from "./useExpandOverride-BmLmUDhU.js";
import { m as markdownToSafeHtml } from "./MarkdownEditor-Co1WgSAW.js";
const __iconNode$4 = [
  ["path", { d: "M15 6a9 9 0 0 0-9 9V3", key: "1cii5b" }],
  ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }]
];
const GitBranch = createLucideIcon("git-branch", __iconNode$4);
const __iconNode$3 = [
  ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
  ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
  ["path", { d: "M6 21V9a9 9 0 0 0 9 9", key: "7kw0sc" }]
];
const GitMerge = createLucideIcon("git-merge", __iconNode$3);
const __iconNode$2 = [
  ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
  ["path", { d: "M6 9v12", key: "1sc30k" }],
  ["path", { d: "m21 3-6 6", key: "16nqsk" }],
  ["path", { d: "m21 9-6-6", key: "9j17rh" }],
  ["path", { d: "M18 11.5V15", key: "65xf6f" }],
  ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
];
const GitPullRequestClosed = createLucideIcon("git-pull-request-closed", __iconNode$2);
const __iconNode$1 = [
  ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
  ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
  ["path", { d: "M18 6V5", key: "1oao2s" }],
  ["path", { d: "M18 11v-1", key: "11c8tz" }],
  ["line", { x1: "6", x2: "6", y1: "9", y2: "21", key: "rroup" }]
];
const GitPullRequestDraft = createLucideIcon("git-pull-request-draft", __iconNode$1);
const __iconNode = [
  ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
  ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
  ["path", { d: "M13 6h3a2 2 0 0 1 2 2v7", key: "1yeb86" }],
  ["line", { x1: "6", x2: "6", y1: "9", y2: "21", key: "rroup" }]
];
const GitPullRequest = createLucideIcon("git-pull-request", __iconNode);
const VIDEO_URL_LINE_RE = /^<p>\s*(https?:\/\/[^\s<]+\.(mp4|mov|webm|ogg)(?:\?[^\s<]*)?)\s*<\/p>$/gim;
function postProcessHtml(html) {
  if (!html) return "";
  let out = html;
  out = out.replace(/<a\s/g, '<a target="_blank" rel="noopener noreferrer" ');
  out = out.replace(/target="_blank"\s*rel="noopener noreferrer"\s*target="_blank"/g, 'target="_blank"');
  out = out.replace(/<details[^>]*>\s*<summary[^>]*>[\s\S]*?<\/summary>\s*(<video[\s\S]*?<\/video>)\s*<\/details>/gi, "$1");
  out = out.replace(/<details(?![^>]*\bopen\b)/gi, "<details open");
  out = out.replace(
    VIDEO_URL_LINE_RE,
    (_, url) => `<video src="${url}" controls preload="none"></video>`
  );
  out = out.replace(
    /<img\s+([^>]*?)src="([^"]+\.(mp4|mov|webm|ogg)(?:\?[^"]*)?)"([^>]*)\/?>/gi,
    (_, _pre, url) => `<video src="${url}" controls preload="none"></video>`
  );
  out = out.replace(/<video\s/g, '<video preload="none" ');
  out = out.replace(/preload="none"\s+preload="[^"]*"/g, 'preload="none"');
  out = out.replace(/<input\s+([^>]*?)disabled([^>]*)>/gi, (match, before, after) => {
    if (!match.includes('type="checkbox"')) return match;
    return `<input ${before}${after}>`;
  });
  out = out.replace(/<a\s([^>]*)>(@[a-zA-Z0-9_-]+)<\/a>/g, (match, attrs, text) => {
    if (match.includes("data-mention")) return match;
    return `<a ${attrs} data-mention>${text}</a>`;
  });
  return out;
}
function renderMarkdown(text) {
  if (!text) return "";
  return postProcessHtml(markdownToSafeHtml(text));
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1e3);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
function splitIssueTitle(title) {
  if (!title) return { number: "", rest: "" };
  const match = title.match(/^(#\d+)\s+(.*)$/);
  if (match) return { number: match[1], rest: match[2] };
  return { number: "", rest: title };
}
const KIND_LABELS = {
  issue: "Issue",
  pull_request: "Pull Request",
  discussion: "Discussion",
  comment: "Comment"
};
function getCommentKindLabel(github) {
  if (github?.kind !== "comment") return KIND_LABELS[github?.kind] || "GitHub";
  if (github?.parentKind === "issue") return "Issue Comment";
  if (github?.parentKind === "pull_request") return "PR Comment";
  if (github?.parentKind === "discussion") return "Discussion Comment";
  return "Comment";
}
const PR_STATE_META = {
  merged: { label: "Merged", Icon: GitMerge, className: "prStateMerged" },
  closed: { label: "Closed", Icon: GitPullRequestClosed, className: "prStateClosed" },
  draft: { label: "Draft", Icon: GitPullRequestDraft, className: "prStateDraft" },
  open: { label: "Open", Icon: GitPullRequest, className: "prStateOpen" }
};
function PullRequestMeta({ github }) {
  if (github?.kind !== "pull_request") return null;
  const stateKey = github?.state || "open";
  const stateMeta = PR_STATE_META[stateKey] || PR_STATE_META.open;
  const { Icon: StateIcon } = stateMeta;
  const baseRef = github?.baseRef || null;
  const headRef = github?.headRef || null;
  const additions = typeof github?.additions === "number" ? github.additions : null;
  const deletions = typeof github?.deletions === "number" ? github.deletions : null;
  const hasDiff = additions !== null || deletions !== null;
  return /* @__PURE__ */ jsxs("div", { className: styles.prMeta, children: [
    /* @__PURE__ */ jsxs("span", { className: `${styles.prStateBadge} ${styles[stateMeta.className]}`, children: [
      /* @__PURE__ */ jsx(StateIcon, { size: 12 }),
      stateMeta.label
    ] }),
    (baseRef || headRef) && /* @__PURE__ */ jsxs("span", { className: styles.prBranchRef, title: `${headRef || "?"} → ${baseRef || "?"}`, children: [
      /* @__PURE__ */ jsx(GitBranch, { size: 12 }),
      /* @__PURE__ */ jsx("span", { className: styles.prBranchName, children: baseRef || "?" }),
      /* @__PURE__ */ jsx("span", { className: styles.prBranchArrow, children: "←" }),
      /* @__PURE__ */ jsx("span", { className: styles.prBranchName, children: headRef || "?" })
    ] }),
    hasDiff && /* @__PURE__ */ jsxs("span", { className: styles.prDiffStat, children: [
      additions !== null && /* @__PURE__ */ jsxs("span", { className: styles.prDiffAdd, children: [
        "+",
        additions
      ] }),
      deletions !== null && /* @__PURE__ */ jsxs("span", { className: styles.prDiffDel, children: [
        "-",
        deletions
      ] })
    ] })
  ] });
}
function GitHubIssueCard({ id, url, title, github, width, collapsed, expanded, expandMode, onCloseExpand }) {
  const authors = Array.isArray(github?.authors) ? github.authors.filter((a) => typeof a === "string" && a.trim()) : [];
  const primaryAuthor = authors[0] || "";
  const createdAgo = timeAgo(github?.createdAt);
  const { number: issueNumber, rest: titleText } = splitIssueTitle(title);
  const kindLabel = getCommentKindLabel(github);
  const bodyHtml = useMemo(() => {
    if (github?.bodyHtml) return postProcessHtml(github.bodyHtml);
    return renderMarkdown(github?.body || "");
  }, [github?.bodyHtml, github?.body]);
  const bodyRef = useRef(null);
  const lastHtmlRef = useRef("");
  useEffect(() => {
    if (bodyRef.current && bodyHtml !== lastHtmlRef.current) {
      bodyRef.current.innerHTML = bodyHtml;
      lastHtmlRef.current = bodyHtml;
    }
  }, [bodyHtml]);
  const setBodyRef = useCallback((el) => {
    bodyRef.current = el;
    if (el && bodyHtml && bodyHtml !== lastHtmlRef.current) {
      el.innerHTML = bodyHtml;
      lastHtmlRef.current = bodyHtml;
    }
  }, [bodyHtml]);
  const sizeStyle = {
    ...width ? { width: `${width}px` } : {}
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsxs("div", { className: `${styles.issueCard} ${collapsed ? styles.issueCardCollapsed : ""}`, style: sizeStyle, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.typeBar, children: [
        /* @__PURE__ */ jsx(GitBranch, { size: 16 }),
        /* @__PURE__ */ jsx("span", { children: kindLabel })
      ] }),
      /* @__PURE__ */ jsx("header", { className: styles.issueHeader, children: /* @__PURE__ */ jsx("h2", { className: styles.issueTitle, children: /* @__PURE__ */ jsxs(
        "a",
        {
          href: url || "#",
          target: "_blank",
          rel: "noopener noreferrer",
          className: styles.issueTitleLink,
          onMouseDown: (e) => e.stopPropagation(),
          onPointerDown: (e) => e.stopPropagation(),
          children: [
            titleText || url,
            issueNumber && /* @__PURE__ */ jsxs("span", { className: styles.issueNumber, children: [
              " ",
              issueNumber
            ] })
          ]
        }
      ) }) }),
      /* @__PURE__ */ jsxs("div", { className: styles.issueByline, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.issueBylineLeft, children: [
          primaryAuthor && /* @__PURE__ */ jsxs(
            "a",
            {
              href: `https://github.com/${primaryAuthor}`,
              target: "_blank",
              rel: "noopener noreferrer",
              className: styles.authorLink,
              onMouseDown: (e) => e.stopPropagation(),
              onPointerDown: (e) => e.stopPropagation(),
              children: [
                /* @__PURE__ */ jsx(
                  "img",
                  {
                    className: styles.avatar,
                    src: `https://github.com/${primaryAuthor}.png?size=40`,
                    alt: "",
                    width: "20",
                    height: "20",
                    loading: "lazy"
                  }
                ),
                primaryAuthor
              ]
            }
          ),
          /* @__PURE__ */ jsx("span", { className: styles.bylineText, children: primaryAuthor && createdAgo ? ` opened ${createdAgo}` : createdAgo ? `Opened ${createdAgo}` : "" })
        ] }),
        /* @__PURE__ */ jsx(PullRequestMeta, { github })
      ] }),
      bodyHtml && /* @__PURE__ */ jsx(
        "div",
        {
          className: `${styles.issueBody} ${collapsed ? styles.issueBodyScrollable : ""}`,
          ref: setBodyRef
        }
      )
    ] }) }),
    expanded && /* @__PURE__ */ jsx(
      LinkPreviewExpandPane,
      {
        widgetId: id,
        label: `${kindLabel}: ${titleText || url || "GitHub"}`,
        splitMode: expandMode === "split",
        onClose: onCloseExpand,
        children: /* @__PURE__ */ jsxs("div", { className: styles.expandedIssue, children: [
          /* @__PURE__ */ jsxs("header", { className: styles.expandedIssueHeader, children: [
            /* @__PURE__ */ jsx("h2", { className: styles.expandedIssueTitle, children: /* @__PURE__ */ jsxs("a", { href: url || "#", target: "_blank", rel: "noopener noreferrer", children: [
              titleText || url,
              issueNumber && /* @__PURE__ */ jsxs("span", { className: styles.expandedIssueNumber, children: [
                " ",
                issueNumber
              ] })
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: styles.expandedByline, children: [
              primaryAuthor && /* @__PURE__ */ jsxs("a", { href: `https://github.com/${primaryAuthor}`, target: "_blank", rel: "noopener noreferrer", className: styles.expandedAuthor, children: [
                /* @__PURE__ */ jsx("img", { src: `https://github.com/${primaryAuthor}.png?size=40`, alt: "", width: "20", height: "20", className: styles.avatar, loading: "lazy" }),
                primaryAuthor
              ] }),
              createdAgo && /* @__PURE__ */ jsx("span", { className: styles.expandedBylineText, children: primaryAuthor ? ` opened ${createdAgo}` : `Opened ${createdAgo}` })
            ] }),
            /* @__PURE__ */ jsx(PullRequestMeta, { github })
          ] }),
          bodyHtml && /* @__PURE__ */ jsx("div", { className: styles.expandedIssueBody, dangerouslySetInnerHTML: { __html: bodyHtml } })
        ] })
      }
    )
  ] });
}
const LinkPreview = forwardRef(function LinkPreview2({ id, props, onUpdate, resizable }, ref) {
  const url = readProp(props, "url", linkPreviewSchema);
  const title = readProp(props, "title", linkPreviewSchema);
  const github = props?.github && typeof props.github === "object" ? props.github : null;
  const width = typeof props?.width === "number" ? props.width : null;
  const height = typeof props?.height === "number" ? props.height : null;
  const ogImage = props?.ogImage || null;
  const description = props?.description || "";
  const canEdit = typeof onUpdate === "function";
  const cardRef = useRef(null);
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [expandMode, setExpandMode] = useExpandOverride("link", id);
  const expanded = expandMode !== null;
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
      if (actionId === "open-external") {
        if (url) window.open(url, "_blank", "noopener");
        return true;
      }
      return false;
    }
  }), [url]);
  const startEditing = useCallback(() => {
    if (!canEdit) return;
    setEditing(true);
  }, [canEdit]);
  const handleTitleChange = useCallback((e) => {
    onUpdate?.({ title: e.target.value });
  }, [onUpdate]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  if (github) {
    return /* @__PURE__ */ jsx(
      GitHubIssueCard,
      {
        id,
        url,
        title,
        github,
        width,
        collapsed: !!props?.collapsed,
        expanded,
        expandMode,
        onCloseExpand: () => setExpandMode(null)
      }
    );
  }
  const sizeStyle = width || height ? { ...width ? { width: `${width}px` } : {}, ...height ? { minHeight: `${height}px` } : {} } : void 0;
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
  }
  const handleResize = (w, h) => onUpdate?.({ width: w, height: h });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: styles.container, children: [
      /* @__PURE__ */ jsxs("div", { ref: cardRef, className: styles.card, style: sizeStyle, children: [
        ogImage && /* @__PURE__ */ jsx(
          "img",
          {
            className: styles.ogImage,
            src: ogImage,
            alt: "",
            loading: "lazy",
            onError: (e) => {
              e.target.style.display = "none";
            }
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: styles.body, children: [
          editing ? /* @__PURE__ */ jsx(
            "input",
            {
              ref: inputRef,
              className: styles.titleInput,
              "data-canvas-allow-text-selection": true,
              type: "text",
              value: title,
              onChange: handleTitleChange,
              onBlur: () => setEditing(false),
              onKeyDown: (e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditing(false);
              },
              onMouseDown: (e) => e.stopPropagation(),
              onPointerDown: (e) => e.stopPropagation()
            }
          ) : /* @__PURE__ */ jsx(
            "p",
            {
              className: styles.title,
              "data-canvas-allow-text-selection": !canEdit ? "" : void 0,
              onDoubleClick: startEditing,
              role: canEdit ? "button" : void 0,
              tabIndex: canEdit ? 0 : void 0,
              onKeyDown: canEdit ? (e) => {
                if (e.key === "Enter") startEditing();
              } : void 0,
              children: title || hostname || url || "Untitled"
            }
          ),
          description && /* @__PURE__ */ jsx("p", { className: styles.description, children: description }),
          /* @__PURE__ */ jsx(
            "a",
            {
              href: url || "#",
              target: "_blank",
              rel: "noopener noreferrer",
              className: styles.url,
              onMouseDown: (e) => e.stopPropagation(),
              onPointerDown: (e) => e.stopPropagation(),
              children: hostname || url
            }
          )
        ] })
      ] }),
      resizable && /* @__PURE__ */ jsx(ResizeHandle, { targetRef: cardRef, width, height, onResize: handleResize })
    ] }),
    expanded && /* @__PURE__ */ jsx(
      LinkPreviewExpandPane,
      {
        widgetId: id,
        label: title || hostname || "Link Preview",
        splitMode: expandMode === "split",
        onClose: () => setExpandMode(null),
        children: /* @__PURE__ */ jsxs("div", { className: styles.expandedLink, children: [
          ogImage && /* @__PURE__ */ jsx("img", { className: styles.expandedOgImage, src: ogImage, alt: "", loading: "lazy" }),
          /* @__PURE__ */ jsx("h2", { className: styles.expandedTitle, children: title || hostname || url || "Untitled" }),
          description && /* @__PURE__ */ jsx("p", { className: styles.expandedDescription, children: description }),
          url && /* @__PURE__ */ jsx("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: styles.expandedUrl, children: url })
        ] })
      }
    )
  ] });
});
function LinkPreviewExpandPane({ widgetId, label, splitMode, onClose, children }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode]
  );
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState;
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: "link-preview", position: { x: 0, y: 0 }, props: {} };
  }, [widgetId]);
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label,
        widgetType: "link-preview",
        kind: "react",
        render: () => children
      };
    }
    return buildPaneForWidget(widget);
  }, [widgetId, label, children]);
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
  LinkPreview as default
};
