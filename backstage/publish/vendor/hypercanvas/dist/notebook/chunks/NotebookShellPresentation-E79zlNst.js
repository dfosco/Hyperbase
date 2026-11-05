import * as React from "react";
import { forwardRef } from "react";
import { V as useTimeout, a1 as getWindow, ai as mergeCleanups, ay as mac, aP as webkit, aj as addEventListener, Z as isElement, bc as createAttribute, aw as activeElement, ah as ownerDocument, ao as contains, am as isTargetInsideEnabledTrigger, k as createChangeEventDetails, bj as triggerFocus, ak as getTarget, bf as isTypeableElement, by as matchesFocusVisible, U as isHTMLElement, a as triggerPress, e as escapeKey } from "./composite-z4dIV_BK.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { c as createLucideIcon, b as clsx, a as cn, d as buttonVariants$1, B as Button$2 } from "./button-Bi0ciDEN.js";
import { B as Button$1, I as Input } from "./CanvasToolsPresentation-CgLIau-Y.js";
import { u as useAlertDisplay, a as alertContentKey, A as AlertDisplayControl, b as alertStyles } from "./alert-BjgVTE5o.js";
import { i as isNotebookPublication } from "./notebookCapabilities-C3HcelTI.js";
const __iconData = {
  name: "search",
  size: 24,
  node: [
    ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
  ]
};
__iconData.node;
const Search = createLucideIcon(__iconData);
const isMacSafari = mac && webkit;
function useFocus(context, props = {}) {
  const {
    enabled = true,
    delay
  } = props;
  const store = "rootStore" in context ? context.rootStore : context;
  const {
    events,
    dataRef
  } = store.context;
  const blockFocusRef = React.useRef(false);
  const blockedReferenceRef = React.useRef(null);
  const keyboardModalityRef = React.useRef(true);
  const timeout = useTimeout();
  React.useEffect(() => {
    const domReference = store.select("domReferenceElement");
    if (!enabled) {
      return void 0;
    }
    const win = getWindow(domReference);
    function onBlur() {
      const currentDomReference = store.select("domReferenceElement");
      if (!store.select("open") && isHTMLElement(currentDomReference) && currentDomReference === activeElement(ownerDocument(currentDomReference))) {
        blockFocusRef.current = true;
        blockedReferenceRef.current = currentDomReference;
      }
    }
    function onKeyDown() {
      keyboardModalityRef.current = true;
    }
    function onPointerDown() {
      keyboardModalityRef.current = false;
    }
    return mergeCleanups(addEventListener(win, "blur", onBlur), isMacSafari && addEventListener(win, "keydown", onKeyDown, true), isMacSafari && addEventListener(win, "pointerdown", onPointerDown, true));
  }, [store, enabled]);
  React.useEffect(() => {
    if (!enabled) {
      return void 0;
    }
    function onOpenChangeLocal(details) {
      if (details.reason === triggerPress || details.reason === escapeKey) {
        const referenceElement = store.select("domReferenceElement");
        if (isElement(referenceElement)) {
          blockedReferenceRef.current = referenceElement;
          blockFocusRef.current = true;
        }
      }
    }
    events.on("openchange", onOpenChangeLocal);
    return () => {
      events.off("openchange", onOpenChangeLocal);
    };
  }, [events, enabled, store]);
  const reference = React.useMemo(() => {
    function resetBlockedFocus() {
      blockFocusRef.current = false;
      blockedReferenceRef.current = null;
    }
    return {
      onMouseLeave() {
        resetBlockedFocus();
      },
      onFocus(event) {
        const focusTarget = event.currentTarget;
        if (blockFocusRef.current) {
          if (blockedReferenceRef.current === focusTarget) {
            return;
          }
          resetBlockedFocus();
        }
        const target = getTarget(event.nativeEvent);
        if (isElement(target)) {
          if (isMacSafari && !event.relatedTarget) {
            if (!keyboardModalityRef.current && !isTypeableElement(target)) {
              return;
            }
          } else if (!matchesFocusVisible(target)) {
            return;
          }
        }
        const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements);
        const {
          nativeEvent,
          currentTarget
        } = event;
        const delayValue = typeof delay === "function" ? delay() : delay;
        if (store.select("open") && movedFromOtherEnabledTrigger || delayValue === 0 || delayValue === void 0) {
          store.setOpen(true, createChangeEventDetails(triggerFocus, nativeEvent, currentTarget));
          return;
        }
        timeout.start(delayValue, () => {
          if (blockFocusRef.current) {
            return;
          }
          store.setOpen(true, createChangeEventDetails(triggerFocus, nativeEvent, currentTarget));
        });
      },
      onBlur(event) {
        resetBlockedFocus();
        const relatedTarget = event.relatedTarget;
        const nativeEvent = event.nativeEvent;
        const movedToFocusGuard = isElement(relatedTarget) && relatedTarget.hasAttribute(createAttribute("focus-guard")) && relatedTarget.getAttribute("data-type") === "outside";
        timeout.start(0, () => {
          const domReference = store.select("domReferenceElement");
          const activeEl = activeElement(ownerDocument(domReference));
          if (!relatedTarget && activeEl === domReference) {
            return;
          }
          if (contains(dataRef.current.floatingContext?.refs.floating.current, activeEl) || contains(domReference, activeEl) || movedToFocusGuard) {
            return;
          }
          const nextFocusedElement = relatedTarget ?? activeEl;
          if (isTargetInsideEnabledTrigger(nextFocusedElement, store.context.triggerElements)) {
            return;
          }
          store.setOpen(false, createChangeEventDetails(triggerFocus, nativeEvent));
        });
      }
    };
  }, [dataRef, delay, store, timeout]);
  return React.useMemo(() => enabled ? {
    reference,
    trigger: reference
  } : {}, [enabled, reference]);
}
const falsyToString = (value) => typeof value === "boolean" ? `${value}` : value === 0 ? "0" : value;
const cx = clsx;
const cva = (base, config) => (props) => {
  var _config_compoundVariants;
  if ((config === null || config === void 0 ? void 0 : config.variants) == null) return cx(base, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
  const { variants, defaultVariants } = config;
  const getVariantClassNames = Object.keys(variants).map((variant) => {
    const variantProp = props === null || props === void 0 ? void 0 : props[variant];
    const defaultVariantProp = defaultVariants === null || defaultVariants === void 0 ? void 0 : defaultVariants[variant];
    if (variantProp === null) return null;
    const variantKey = falsyToString(variantProp) || falsyToString(defaultVariantProp);
    return variants[variant][variantKey];
  });
  const propsWithoutUndefined = props && Object.entries(props).reduce((acc, param) => {
    let [key, value] = param;
    if (value === void 0) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
  const getCompoundVariantClassNames = config === null || config === void 0 ? void 0 : (_config_compoundVariants = config.compoundVariants) === null || _config_compoundVariants === void 0 ? void 0 : _config_compoundVariants.reduce((acc, param) => {
    let { class: cvClass, className: cvClassName, ...compoundVariantOptions } = param;
    return Object.entries(compoundVariantOptions).every((param2) => {
      let [key, value] = param2;
      return Array.isArray(value) ? value.includes({
        ...defaultVariants,
        ...propsWithoutUndefined
      }[key]) : {
        ...defaultVariants,
        ...propsWithoutUndefined
      }[key] === value;
    }) ? [
      ...acc,
      cvClass,
      cvClassName
    ] : acc;
  }, []);
  return cx(base, getVariantClassNames, getCompoundVariantClassNames, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
};
const buttonVariants = cva(
  "hc-group/button hc-inline-flex hc-shrink-0 hc-items-center hc-justify-center hc-rounded-lg hc-border hc-border-transparent hc-bg-clip-padding hc-text-sm hc-font-medium hc-whitespace-nowrap hc-transition-all hc-outline-none hc-select-none hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-active:not-aria-[haspopup]:translate-y-px hc-disabled:pointer-events-none hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "hc-bg-primary hc-text-primary-foreground hc-hover:bg-primary/80",
        outline: "hc-border-border hc-bg-background hc-hover:bg-muted hc-hover:text-foreground hc-aria-expanded:bg-muted hc-aria-expanded:text-foreground hc-dark:border-input hc-dark:bg-input/30 hc-dark:hover:bg-input/50",
        secondary: "hc-bg-secondary hc-text-secondary-foreground hc-hover:bg-[color-mix(in_oklch,var(--hc-color-secondary),var(--hc-color-foreground)_5%)] hc-aria-expanded:bg-secondary hc-aria-expanded:text-secondary-foreground",
        ghost: "hc-hover:bg-muted hc-hover:text-foreground hc-aria-expanded:bg-muted hc-aria-expanded:text-foreground hc-dark:hover:bg-muted/50",
        destructive: "hc-bg-destructive/10 hc-text-destructive hc-hover:bg-destructive/20 hc-focus-visible:border-destructive/40 hc-focus-visible:ring-destructive/20 hc-dark:bg-destructive/20 hc-dark:hover:bg-destructive/30 hc-dark:focus-visible:ring-destructive/40",
        link: "hc-text-primary hc-underline-offset-4 hc-hover:underline"
      },
      size: {
        default: "hc-h-8 hc-gap-1.5 hc-px-2.5 hc-has-data-[icon=inline-end]:pr-2 hc-has-data-[icon=inline-start]:pl-2",
        xs: "hc-h-6 hc-gap-1 hc-rounded-[min(var(--hc-radius-md),10px)] hc-px-2 hc-text-xs hc-in-data-[slot=button-group]:rounded-lg hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&_svg:not([class*='size-'])]:size-3",
        sm: "hc-h-7 hc-gap-1 hc-rounded-[min(var(--hc-radius-md),12px)] hc-px-2.5 hc-text-[0.8rem] hc-in-data-[slot=button-group]:rounded-lg hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&_svg:not([class*='size-'])]:size-3.5",
        lg: "hc-h-9 hc-gap-1.5 hc-px-2.5 hc-has-data-[icon=inline-end]:pr-2 hc-has-data-[icon=inline-start]:pl-2",
        icon: "hc-size-8",
        "icon-xs": "hc-size-6 hc-rounded-[min(var(--hc-radius-md),10px)] hc-in-data-[slot=button-group]:rounded-lg hc-[&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "hc-size-7 hc-rounded-[min(var(--hc-radius-md),12px)] hc-in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "hc-size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Button$1,
    {
      "data-hc-ui": "",
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}
const headerGeometry = "_headerGeometry_yiixv_5";
const buttonGroup = "_buttonGroup_yiixv_13";
const resizeHandle = "_resizeHandle_yiixv_57";
const styles = {
  headerGeometry,
  buttonGroup,
  resizeHandle
};
const icon = "hc-size-4 hc-shrink-0 hc-stroke-[2]";
const notebookShellHeaderGeometry = `${styles.headerGeometry} hc-box-border hc-h-[var(--hc-notebook-shell-header-height)] hc-min-h-[var(--hc-notebook-shell-header-height)] hc-grow-0 hc-shrink-0 hc-items-center`;
const notebookShellTitle = "hc-min-w-0 hc-truncate hc-font-sans hc-text-sm hc-font-semibold hc-leading-5 hc-text-foreground";
const notebookShellButtonGroup = `hc-inline-flex hc-items-stretch hc-gap-0 ${styles.buttonGroup}`;
const notebookShellControl = "hc-h-7 hc-rounded-[3px] hc-text-xs hc-leading-4 hc-font-normal hc-gap-1.5 hc-px-2 hc-text-muted-foreground hc-hover:bg-[var(--hc-color-hover)] hc-hover:text-foreground hc-[&_svg]:size-3.5";
function NotebookShellFrame({ className, children, ...props }) {
  return /* @__PURE__ */ jsx("div", { ...props, "data-notebook-shell-presentation": "", className: cn("hc-relative hc-flex hc-h-full hc-w-full hc-min-w-0 hc-overflow-hidden hc-bg-background hc-text-foreground hc-font-sans hc-text-xs hc-leading-4 hc-antialiased", className), children });
}
const NotebookShellSidebar = forwardRef(function NotebookShellSidebar2({ className, children, ...props }, ref) {
  return /* @__PURE__ */ jsx("aside", { ref, ...props, "data-notebook-shell-sidebar": "", className: cn("hc-box-border hc-[&_*]:box-border hc-[&_*::before]:box-border hc-[&_*::after]:box-border hc-flex hc-h-full hc-w-[var(--sb--notebook-sidebar-width,248px)] hc-min-w-0 hc-shrink-0 hc-flex-col hc-border-r hc-border-border hc-bg-[var(--hc-color-sidebar)] hc-text-sm hc-leading-5 hc-transition-[width] hc-duration-150", className), children });
});
function NotebookShellSidebarResizeHandle({ dragging = false, className, ...props }) {
  return /* @__PURE__ */ jsx("div", { role: "separator", tabIndex: 0, "aria-orientation": "vertical", "aria-label": "Resize notebook sidebar", "data-notebook-sidebar-resize": "", "data-dragging": dragging || void 0, ...props, className: cn(styles.resizeHandle, className) });
}
function NotebookShellHeader({ className, children, ...props }) {
  return /* @__PURE__ */ jsx("header", { ...props, "data-notebook-shell-header": "", className: cn("hc-flex " + notebookShellHeaderGeometry + " hc-gap-2 hc-[&>ul]:flex-1 hc-[&>ul]:min-w-0 hc-[&>ul]:m-0 hc-[&>ul]:p-0 hc-[&>ul]:list-none hc-[&>button]:shrink-0 hc-border-b hc-border-border hc-bg-[var(--hc-color-shell-header)] hc-pl-3 hc-pr-2 hc-text-sm hc-leading-5 hc-text-foreground", className), children });
}
function NotebookShellSearch({ className, ...props }) {
  return /* @__PURE__ */ jsxs("label", { className: cn("hc-mx-2 hc-mt-2 hc-mb-2 hc-flex hc-h-7 hc-shrink-0 hc-items-center hc-gap-1.5 hc-rounded-[3px] hc-border hc-border-border hc-bg-[var(--hc-color-field)] hc-px-2 hc-text-sm hc-text-muted-foreground", className), children: [
    /* @__PURE__ */ jsx(Search, { "aria-hidden": "true", className: icon }),
    /* @__PURE__ */ jsx(Input, { ...props, type: "search", className: "hc-h-full hc-min-w-0 hc-flex-1 hc-rounded-none hc-border-0 hc-bg-transparent hc-p-0 hc-text-sm hc-leading-5 hc-shadow-none hc-focus-visible:ring-0" })
  ] });
}
const NotebookShellNavigation = forwardRef(function NotebookShellNavigation2({ className, children, ...props }, ref) {
  return /* @__PURE__ */ jsx("nav", { ref, ...props, className: cn("hc-flex hc-flex-col hc-gap-0.5 hc-min-h-0 hc-flex-1 hc-overflow-auto hc-px-0 hc-pt-2", className), children });
});
function NotebookShellFooter({ className, children, ...props }) {
  return /* @__PURE__ */ jsx("footer", { ...props, "data-notebook-shell-footer": "", className: cn("hc-flex hc-min-h-11 hc-shrink-0 hc-items-center hc-justify-between hc-gap-1 hc-border-t hc-border-border hc-px-2 hc-py-1.5 hc-text-sm hc-leading-5", className), children });
}
const NotebookShellNotice = forwardRef(function NotebookShellNotice2({ tone = "default", className, children, diagnostic = {}, onClickCapture, ...props }, ref) {
  const enabled = !isNotebookPublication();
  const display = useAlertDisplay(diagnostic.identity ?? alertContentKey(children), { source: "shell-notice", ...diagnostic }, enabled);
  return /* @__PURE__ */ jsxs("aside", { ref, "data-notebook-shell-notice": "", "data-tone": tone, className: cn(
    "hc-mx-2.5 hc-my-2 hc-flex hc-min-w-0 hc-flex-col hc-items-start hc-gap-2 hc-[overflow-wrap:anywhere] hc-rounded-[4px] hc-border hc-border-border hc-p-3 hc-text-xs hc-leading-[1.5]",
    tone === "default" && "hc-bg-background",
    tone === "warning" && "hc-border-current/30 hc-bg-background-attention-muted hc-text-foreground-attention",
    tone === "error" && "hc-border-current/30 hc-bg-background-danger-muted hc-text-foreground-danger",
    enabled && alertStyles.notice,
    className
  ), ...props, onClickCapture: (event) => {
    display.onClickCapture(event);
    onClickCapture?.(event);
  }, children: [
    children,
    enabled && /* @__PURE__ */ jsx(AlertDisplayControl, { displayId: display.displayId })
  ] });
});
function NotebookShellNoticeActions({ className, ...props }) {
  return /* @__PURE__ */ jsx("span", { className: cn("hc-flex hc-flex-wrap hc-items-center hc-gap-1", className), ...props });
}
function NotebookShellTopbar({ className, children, ...props }) {
  return /* @__PURE__ */ jsx("header", { ...props, "data-notebook-shell-topbar": "", className: cn("hc-flex " + notebookShellHeaderGeometry + " hc-gap-1.5 hc-border-b hc-border-border hc-bg-[var(--hc-color-shell-header)] hc-px-2 hc-text-xs hc-leading-4 hc-text-foreground", className), children });
}
const NotebookShellRow = forwardRef(function NotebookShellRow2({ depth = 0, selected, icon: Icon, leading, iconOnly, children, className, style, ...props }, ref) {
  return /* @__PURE__ */ jsxs(Button, { ref, variant: "ghost", ...props, "data-notebook-shell-row": "", "data-selected": selected || void 0, style: { "--depth": depth, ...style }, className: cn(buttonVariants$1({ variant: "ghost", size: "sm" }), "hc-flex hc-h-8 hc-w-full hc-min-w-0 hc-justify-start hc-gap-1.5 hc-border-0 hc-bg-transparent hc-py-0 hc-pl-[calc(8px+var(--depth)*14px)] hc-pr-2 hc-text-left hc-text-sm hc-leading-5 hc-font-normal hc-text-foreground hc-no-underline hc-aria-expanded:not-hover:bg-transparent hc-data-selected:bg-accent", iconOnly && "hc-size-7 hc-p-0 hc-justify-center", className), children: [
    !iconOnly && (leading ?? /* @__PURE__ */ jsx("span", { className: "hc-size-2.5 hc-shrink-0", "aria-hidden": "true" })),
    Icon && /* @__PURE__ */ jsx(Icon, { "aria-hidden": "true", className: cn(icon, selected && "hc-text-foreground", !selected && "hc-text-muted-foreground") }),
    /* @__PURE__ */ jsx("span", { className: cn(iconOnly ? "hc-sr-only" : "hc-flex hc-min-w-0 hc-flex-1 hc-items-center hc-gap-1.5 hc-truncate hc-text-sm hc-leading-5 hc-font-normal hc-subpixel-antialiased"), children })
  ] });
});
function NotebookShellPanelHeader({ className, children, ...props }) {
  return /* @__PURE__ */ jsx("header", { ...props, className: cn("hc-flex hc-min-h-10 hc-shrink-0 hc-items-center hc-justify-between hc-gap-2 hc-px-3 hc-py-1.5 hc-text-xs hc-leading-4", className), children });
}
const NotebookShellTab = forwardRef(function NotebookShellTab2({ className, minimumWidth, style, ...props }, ref) {
  return /* @__PURE__ */ jsx(Button$2, { ref, style: { ...style, ...Number.isFinite(minimumWidth) && minimumWidth > 0 ? { minWidth: minimumWidth } : {} }, variant: "ghost", size: "sm", wrapperClass: "hc-min-w-0 hc-max-w-full", ...props, className: cn(notebookShellControl, "hc-rounded-lg hc-min-w-0 hc-truncate hc-py-0 hc-leading-4 hc-aria-selected:font-semibold hc-aria-selected:text-foreground", className) });
});
function NotebookShellAction({ className, ...props }) {
  return /* @__PURE__ */ jsx(Button$2, { variant: "ghost", size: "sm", ...props, className });
}
function NotebookShellIconButton({ className, ...props }) {
  return /* @__PURE__ */ jsx(Button$2, { variant: "ghost", size: "icon", ...props, className });
}
export {
  Button as B,
  NotebookShellAction as N,
  NotebookShellFooter as a,
  NotebookShellFrame as b,
  NotebookShellHeader as c,
  NotebookShellIconButton as d,
  NotebookShellNavigation as e,
  NotebookShellNotice as f,
  NotebookShellNoticeActions as g,
  NotebookShellPanelHeader as h,
  NotebookShellRow as i,
  NotebookShellSearch as j,
  NotebookShellSidebar as k,
  NotebookShellSidebarResizeHandle as l,
  NotebookShellTab as m,
  NotebookShellTopbar as n,
  notebookShellButtonGroup as o,
  notebookShellControl as p,
  notebookShellHeaderGeometry as q,
  notebookShellTitle as r,
  cva as s,
  useFocus as u
};
