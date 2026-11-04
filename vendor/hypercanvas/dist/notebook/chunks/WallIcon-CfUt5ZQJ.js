import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", {
      fillRule: "evenodd",
      d: "M14.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1zM10.5 13.5h3.75a.25.25 0 0 0 .25-.25V9h-4zm-9-.25c0 .138.112.25.25.25H9V9H1.5zM1.75 2.5a.25.25 0 0 0-.25.25V7.5h4v-5zM7 7.5h7.5V2.75a.25.25 0 0 0-.25-.25H7z"
    })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", {
      fillRule: "evenodd",
      d: "M21.75 2.5c.966 0 1.75.784 1.75 1.75v15.5a1.75 1.75 0 0 1-1.75 1.75H2.25A1.75 1.75 0 0 1 .5 19.75V4.25c0-.966.784-1.75 1.75-1.75zM15.5 13v7h6.25a.25.25 0 0 0 .25-.25V13zM2 19.75c0 .138.112.25.25.25H14v-7H2zm8-8.25h12V4.25a.25.25 0 0 0-.25-.25H10zM2.25 4a.25.25 0 0 0-.25.25v7.25h6.5V4z"
    })
  }
};
var WallIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-wall", svgDataByHeight, heights);
});
WallIcon.displayName = "WallIcon";
export {
  WallIcon,
  WallIcon as default
};
