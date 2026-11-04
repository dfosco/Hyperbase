import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25V2.75Z" })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M6.69 2h10.56c.966 0 1.75.784 1.75 1.75v17.5a.75.75 0 0 1-1.218.585L12 17.21l-5.781 4.626A.75.75 0 0 1 5 21.253L4.94 3.756A1.748 1.748 0 0 1 6.69 2Z" })
  }
};
var BookmarkFillIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-bookmark-fill", svgDataByHeight, heights);
});
BookmarkFillIcon.displayName = "BookmarkFillIcon";
export {
  BookmarkFillIcon,
  BookmarkFillIcon as default
};
