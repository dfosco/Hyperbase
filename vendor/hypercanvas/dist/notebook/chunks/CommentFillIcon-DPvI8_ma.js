import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", {
      fillRule: "evenodd",
      d: "M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.457 1.457 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25z"
    })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", {
      fillRule: "evenodd",
      d: "M1.5 4.25c0-.966.784-1.75 1.75-1.75h17.5c.966 0 1.75.784 1.75 1.75v12.5a1.75 1.75 0 0 1-1.75 1.75h-9.69l-3.573 3.573A1.457 1.457 0 0 1 5 21.043V18.5H3.25a1.75 1.75 0 0 1-1.75-1.75z"
    })
  }
};
var CommentFillIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-comment-fill", svgDataByHeight, heights);
});
CommentFillIcon.displayName = "CommentFillIcon";
export {
  CommentFillIcon,
  CommentFillIcon as default
};
