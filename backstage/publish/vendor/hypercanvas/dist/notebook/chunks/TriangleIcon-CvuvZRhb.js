import { r as renderOcticon } from "./renderOcticon-DuMQdmQC-Bkrvv2QR.js";
import React__default from "react";
var heights = ["16", "24"];
var svgDataByHeight = {
  "16": {
    "width": 16,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M3.6 3.602A1.2 1.2 0 0 1 5.378 2.55l8 4.398a1.2 1.2 0 0 1 0 2.102l-8 4.399-.152.07a1.202 1.202 0 0 1-1.615-.955l-.011-.167zm1.5 8.286 7.075-3.89L5.1 4.108z" })
  },
  "24": {
    "width": 24,
    "path": /* @__PURE__ */ React__default.createElement("path", { d: "M5.4 5.403a1.8 1.8 0 0 1 2.667-1.577l12 6.595c1.244.684 1.244 2.472 0 3.156l-12 6.595A1.8 1.8 0 0 1 5.4 18.595zm1.5 13.192a.3.3 0 0 0 .444.263l12-6.596a.3.3 0 0 0 0-.526l-12-6.596a.3.3 0 0 0-.444.263z" })
  }
};
var TriangleIcon = /* @__PURE__ */ React__default.forwardRef(function(props, ref) {
  return renderOcticon(props, ref, "octicon octicon-triangle", svgDataByHeight, heights);
});
TriangleIcon.displayName = "TriangleIcon";
export {
  TriangleIcon,
  TriangleIcon as default
};
