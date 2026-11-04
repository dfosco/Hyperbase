import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M1.084 2.656a1.25 1.25 0 0 1 1.572-1.572L14.11 4.766c1.188.381 1.145 2.076-.06 2.397l-5.437 1.45-1.449 5.436c-.321 1.205-2.016 1.248-2.397.06zm4.849 10.185L7.2 8.087l.053-.158a1.25 1.25 0 0 1 .833-.728l4.754-1.268L2.66 2.66z" })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M1.223 3.105c-.368-1.159.723-2.25 1.882-1.882L21.802 7.15c1.425.453 1.383 2.484-.06 2.877l-9.204 2.511-2.51 9.204c-.394 1.443-2.425 1.485-2.878.06zM8.58 21.348l2.51-9.205a1.5 1.5 0 0 1 1.053-1.052l9.205-2.51-18.696-5.93z" })
  }
};
var CursorIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-cursor", svgDataByHeight, heights);
});
CursorIcon.displayName = "CursorIcon";
export {
  CursorIcon,
  CursorIcon as default
};
