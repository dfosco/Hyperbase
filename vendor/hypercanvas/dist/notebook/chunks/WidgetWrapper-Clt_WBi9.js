import { jsx } from "react/jsx-runtime";
const wrapper = "_wrapper_vysbd_1";
const content = "_content_vysbd_12";
const styles = {
  wrapper,
  content
};
function WidgetWrapper({ children, className }) {
  return /* @__PURE__ */ jsx("section", { className: `${styles.wrapper} ${className || ""}`, children: /* @__PURE__ */ jsx("div", { className: styles.content, children }) });
}
export {
  WidgetWrapper as W
};
