import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M13.378 6.948a1.2 1.2 0 0 1 0 2.103l-8 4.397A1.2 1.2 0 0 1 3.6 12.397V3.602A1.2 1.2 0 0 1 5.378 2.55z" })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M20.067 10.421c1.243.684 1.243 2.471 0 3.155l-12 6.596A1.8 1.8 0 0 1 5.4 18.595V5.402a1.8 1.8 0 0 1 2.667-1.577z" })
  }
};
var TriangleFillIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-triangle-fill", svgDataByHeight, heights);
});
TriangleFillIcon.displayName = "TriangleFillIcon";
export {
  TriangleFillIcon,
  TriangleFillIcon as default
};
