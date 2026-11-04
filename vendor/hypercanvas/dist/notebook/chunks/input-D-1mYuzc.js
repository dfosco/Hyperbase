import { c as createLucideIcon, a as cn } from "./createLucideIcon-CV-5aOV3.js";
import * as React from "react";
import { v as useButton, w as useRenderElement } from "./composite-WCaVrKIy.js";
import { jsx } from "react/jsx-runtime";
import { F as FieldControl } from "./FieldControl-s34cBhar.js";
const __iconData = {
  name: "chevron-down",
  size: 24,
  node: [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]
};
__iconData.node;
const ChevronDown = createLucideIcon(__iconData);
const Button = /* @__PURE__ */ React.forwardRef(function Button2(componentProps, forwardedRef) {
  const {
    render,
    className,
    disabled = false,
    focusableWhenDisabled = false,
    nativeButton = true,
    style,
    ...elementProps
  } = componentProps;
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled,
    focusableWhenDisabled,
    native: nativeButton
  });
  const state = {
    disabled
  };
  return useRenderElement("button", componentProps, {
    state,
    ref: [forwardedRef, buttonRef],
    props: [elementProps, getButtonProps]
  });
});
if (process.env.NODE_ENV !== "production") Button.displayName = "Button";
const Input$1 = /* @__PURE__ */ React.forwardRef(function Input(props, forwardedRef) {
  return /* @__PURE__ */ jsx(FieldControl, {
    ref: forwardedRef,
    ...props
  });
});
if (process.env.NODE_ENV !== "production") Input$1.displayName = "Input";
function Input2({
  className,
  type,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Input$1,
    {
      type,
      "data-hc-ui": "",
      "data-slot": "input",
      className: cn(
        "hc-h-8 hc-w-full hc-min-w-0 hc-rounded-lg hc-border hc-border-input hc-bg-transparent hc-px-2.5 hc-py-1 hc-text-base hc-transition-colors hc-outline-none hc-file:inline-flex hc-file:h-6 hc-file:border-0 hc-file:bg-transparent hc-file:text-sm hc-file:font-medium hc-file:text-foreground hc-placeholder:text-muted-foreground hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-disabled:pointer-events-none hc-disabled:cursor-not-allowed hc-disabled:bg-input/50 hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-md:text-sm hc-dark:bg-input/30 hc-dark:disabled:bg-input/80 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40",
        className
      ),
      ...props
    }
  );
}
export {
  Button as B,
  ChevronDown as C,
  Input2 as I
};
