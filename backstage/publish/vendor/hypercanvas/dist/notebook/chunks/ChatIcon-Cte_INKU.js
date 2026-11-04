import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "m1.594 10.822-.795 3.481a.75.75 0 0 0 .898.898l3.481-.795a7 7 0 1 0-3.584-3.584m1.52.085a.75.75 0 0 0-.054-.488l-.058-.124a5.5 5.5 0 1 1 2.703 2.703l-.124-.058a.75.75 0 0 0-.488-.054l-2.566.587Z" })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M2.002 16.586.796 22.315a.75.75 0 0 0 .889.889l5.729-1.206a11 11 0 1 0-5.412-5.412m1.519.062a.75.75 0 0 0-.056-.476l-.099-.209a9.5 9.5 0 1 1 4.671 4.671l-.209-.099a.75.75 0 0 0-.476-.056l-4.851 1.02Z" })
  }
};
var ChatIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-chat", svgDataByHeight, heights);
});
ChatIcon.displayName = "ChatIcon";
export {
  ChatIcon,
  ChatIcon as default
};
