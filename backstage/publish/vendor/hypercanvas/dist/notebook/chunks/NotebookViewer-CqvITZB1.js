import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as React from "react";
import { useEffect, useState, forwardRef, useRef, useMemo } from "react";
import { useLocation, useNavigate, useNavigationType, Outlet } from "react-router-dom";
import { c as createLucideIcon, d as clsx, a as cn, e as buttonVariants$1, B as Button$2, b as createLucideIcon$1 } from "./createLucideIcon-CV-5aOV3.js";
import { B as Button$1, I as Input, C as ChevronDown } from "./input-D-1mYuzc.js";
import { D as DialogRoot } from "./DialogRoot-D7cqO-Ad.js";
import { u as useDialogRootContext, b as DialogPopup, D as DialogPortal$1, a as DialogBackdrop } from "./DialogPortal-C55KPLOF.js";
import { G as useIsoLayoutEffect, k as createChangeEventDetails, aD as none, T as Timeout, K as useStableCallback, a$ as isMouseLikePointerType, aE as getWindow, aI as addEventListener, ag as getTarget, ac as contains, w as useRenderElement, v as useButton, c as closePress, r as useBaseUiId, f as formatErrorMessage, R as ReactStore, bz as applyPopupOpenChange, a as triggerPress, h as fastComponent, n as usePopupRootStore, i as useImplicitActiveTrigger, j as useOpenStateTransitions, bA as disabled, l as imperativeAction, m as PopupHandleAttachment, az as mergeProps, o as usePopupInteractionProps, av as EMPTY_OBJECT, p as fastComponentRef, q as usePopupHandleStore, s as useTriggerDataForwarding, a3 as useValueAsRef, V as useTimeout, z as triggerOpenStateMapping, bB as triggerDisabled, t as triggerHover, _ as isElement, bC as useFloatingPortalNode, B as POPUP_COLLISION_AVOIDANCE, L as useOpenChangeComplete, N as FOCUSABLE_POPUP_PROPS, O as popupTransitionStateMapping, aJ as popupStateMapping } from "./composite-WCaVrKIy.js";
import { getConfig } from "../core-2.js";
import { D as DEFAULT_MAX_FOLDER_LAYERS } from "./configSchema-Chfvpba8.js";
import { u as useAlertDisplay, a as alertContentKey, b as AlertDisplayControl, c as alertStyles } from "./alert-CePdA8qB.js";
import { i as isNotebookPublication } from "./notebookCapabilities-C3HcelTI.js";
import { p as popupStoreSelectors, c as createInitialPopupStoreState, P as PopupTriggerMap, u as useDismiss } from "./useScrollLock-6_AWQWRh.js";
import * as ReactDOM from "react-dom";
import { n as getDelay, o as useHoverInteractionSharedState, u as useHoverReferenceInteraction, s as safePolygon, a as useAnchorPositioning, b as usePositioner, c as useHoverFloatingInteraction, g as getDisabledMountTransitionStyles } from "./FieldControl-s34cBhar.js";
import { u as useFocus } from "./useFocus-Djz2VYnf.js";
import { getFlag } from "../core-3.js";
import { r as resolveNotebookView } from "./notebookView-DgDXRwmz.js";
const __iconData$6 = {
  name: "component",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z",
        key: "1uwlt4"
      }
    ],
    [
      "path",
      {
        d: "M2.297 11.293a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0z",
        key: "10291m"
      }
    ],
    [
      "path",
      {
        d: "M8.916 17.912a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0z",
        key: "1tqoq1"
      }
    ],
    [
      "path",
      {
        d: "M8.916 4.674a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z",
        key: "1x6lto"
      }
    ]
  ]
};
__iconData$6.node;
const Component = createLucideIcon(__iconData$6);
const __iconData$5 = {
  name: "corner-up-left",
  size: 24,
  node: [
    ["path", { d: "M20 20v-7a4 4 0 0 0-4-4H4", key: "1nkjon" }],
    ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }]
  ]
};
__iconData$5.node;
const CornerUpLeft = createLucideIcon(__iconData$5);
const __iconData$4 = {
  name: "file",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
        key: "1oefj6"
      }
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }]
  ]
};
__iconData$4.node;
const File = createLucideIcon(__iconData$4);
const __iconData$3 = {
  name: "folder",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ]
  ]
};
__iconData$3.node;
const Folder = createLucideIcon(__iconData$3);
const __iconData$2 = {
  name: "globe",
  size: 24,
  node: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", key: "13o1zl" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }]
  ]
};
__iconData$2.node;
const Globe = createLucideIcon(__iconData$2);
const __iconData$1 = {
  name: "layout-dashboard",
  size: 24,
  node: [
    ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1", key: "10lvy0" }],
    ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1", key: "16une8" }],
    ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1", key: "1hutg5" }],
    ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1", key: "ldoo1y" }]
  ]
};
__iconData$1.node;
const LayoutDashboard = createLucideIcon(__iconData$1);
const __iconData = {
  name: "x",
  size: 24,
  node: [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]
};
__iconData.node;
const X = createLucideIcon(__iconData);
const FloatingDelayGroupContext = /* @__PURE__ */ React.createContext({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: {
    current: 0
  },
  initialDelayRef: {
    current: 0
  },
  timeout: new Timeout(),
  currentIdRef: {
    current: null
  },
  currentContextRef: {
    current: null
  }
});
if (process.env.NODE_ENV !== "production") FloatingDelayGroupContext.displayName = "FloatingDelayGroupContext";
function resetDelayRef(delayRef, initialDelayRef) {
  delayRef.current = initialDelayRef.current;
}
function useDelayGroup(context, options = {
  open: false
}) {
  const {
    open
  } = options;
  const store = "rootStore" in context ? context.rootStore : context;
  const floatingId = store.useState("floatingId");
  const groupContext = React.useContext(FloatingDelayGroupContext);
  const {
    currentIdRef,
    delayRef,
    timeoutMs,
    initialDelayRef,
    currentContextRef,
    hasProvider,
    timeout
  } = groupContext;
  const [isInstantPhase, setIsInstantPhase] = React.useState(false);
  const openRef = React.useRef(open);
  useIsoLayoutEffect(() => {
    openRef.current = open;
  }, [open]);
  useIsoLayoutEffect(() => {
    function unset() {
      currentContextRef.current?.setIsInstantPhase(false);
      currentIdRef.current = null;
      currentContextRef.current = null;
      delayRef.current = initialDelayRef.current;
      timeout.clear();
    }
    if (!currentIdRef.current) {
      return void 0;
    }
    if (!open && currentIdRef.current === floatingId) {
      setIsInstantPhase(false);
      if (timeoutMs) {
        const closingId = floatingId;
        timeout.start(timeoutMs, () => {
          if (store.select("open") || currentIdRef.current && currentIdRef.current !== closingId) {
            return;
          }
          unset();
        });
        return () => {
          if (openRef.current || currentIdRef.current !== closingId) {
            timeout.clear();
          }
        };
      }
      unset();
    }
    return void 0;
  }, [open, floatingId, currentIdRef, delayRef, timeoutMs, initialDelayRef, currentContextRef, timeout, store]);
  useIsoLayoutEffect(() => {
    if (!open) {
      return;
    }
    const prevContext = currentContextRef.current;
    const prevId = currentIdRef.current;
    timeout.clear();
    currentContextRef.current = {
      onOpenChange: store.setOpen,
      setIsInstantPhase
    };
    currentIdRef.current = floatingId;
    delayRef.current = {
      open: 0,
      close: getDelay(initialDelayRef.current, "close")
    };
    if (prevId !== null && prevId !== floatingId) {
      setIsInstantPhase(true);
      prevContext?.setIsInstantPhase(true);
      prevContext?.onOpenChange(false, createChangeEventDetails(none));
    } else {
      setIsInstantPhase(false);
      prevContext?.setIsInstantPhase(false);
    }
  }, [open, floatingId, store, currentIdRef, delayRef, initialDelayRef, currentContextRef, timeout]);
  useIsoLayoutEffect(() => {
    return () => {
      if (currentIdRef.current === floatingId) {
        currentContextRef.current = null;
        if (!openRef.current) {
          return;
        }
        currentIdRef.current = null;
        resetDelayRef(delayRef, initialDelayRef);
        timeout.clear();
      }
    };
  }, [currentContextRef, currentIdRef, delayRef, floatingId, initialDelayRef, timeout]);
  return React.useMemo(() => ({
    activeIdRef: currentIdRef,
    hasProvider,
    delayRef,
    isInstantPhase
  }), [currentIdRef, hasProvider, delayRef, isInstantPhase]);
}
function createVirtualElement(domElement, data) {
  let offsetX = null;
  let offsetY = null;
  let isAutoUpdateEvent = false;
  return {
    contextElement: domElement || void 0,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() || {
        width: 0,
        height: 0,
        x: 0,
        y: 0
      };
      const isXAxis = data.axis === "x" || data.axis === "both";
      const isYAxis = data.axis === "y" || data.axis === "both";
      const canTrackCursorOnAutoUpdate = ["mouseenter", "mousemove"].includes(data.dataRef.current.openEvent?.type || "") && data.pointerType !== "touch";
      let width = domRect.width;
      let height = domRect.height;
      let x = domRect.x;
      let y = domRect.y;
      if (offsetX == null && data.x && isXAxis) {
        offsetX = domRect.x - data.x;
      }
      if (offsetY == null && data.y && isYAxis) {
        offsetY = domRect.y - data.y;
      }
      x -= offsetX || 0;
      y -= offsetY || 0;
      width = 0;
      height = 0;
      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        width = data.axis === "y" ? domRect.width : 0;
        height = data.axis === "x" ? domRect.height : 0;
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      } else if (isAutoUpdateEvent && !canTrackCursorOnAutoUpdate) {
        height = data.axis === "x" ? domRect.height : height;
        width = data.axis === "y" ? domRect.width : width;
      }
      isAutoUpdateEvent = true;
      return {
        width,
        height,
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x
      };
    }
  };
}
function isMouseBasedEvent(event) {
  return event != null && event.clientX != null;
}
function useClientPoint(context, props = {}) {
  const {
    enabled = true,
    axis = "both"
  } = props;
  const store = "rootStore" in context ? context.rootStore : context;
  const open = store.useState("open");
  const floating = store.useState("floatingElement");
  const domReference = store.useState("domReferenceElement");
  const dataRef = store.context.dataRef;
  const initialRef = React.useRef(false);
  const cleanupListenerRef = React.useRef(null);
  const [pointerType, setPointerType] = React.useState();
  const [reactive, setReactive] = React.useState([]);
  const resetReference = useStableCallback((reference2) => {
    store.set("positionReference", reference2);
  });
  const setReference = useStableCallback((newX, newY, referenceElement) => {
    if (initialRef.current) {
      return;
    }
    if (dataRef.current.openEvent && !isMouseBasedEvent(dataRef.current.openEvent)) {
      return;
    }
    store.set("positionReference", createVirtualElement(referenceElement ?? domReference, {
      x: newX,
      y: newY,
      axis,
      dataRef,
      pointerType
    }));
  });
  const handleReferenceEnterOrMove = useStableCallback((event) => {
    if (!open) {
      setReference(event.clientX, event.clientY, event.currentTarget);
    } else if (!cleanupListenerRef.current) {
      setReference(event.clientX, event.clientY, event.currentTarget);
      setReactive([]);
    }
  });
  const openCheck = isMouseLikePointerType(pointerType) ? floating : open;
  React.useEffect(() => {
    if (!enabled) {
      resetReference(domReference);
      return void 0;
    }
    if (!openCheck) {
      return void 0;
    }
    function cleanupListener() {
      cleanupListenerRef.current?.();
      cleanupListenerRef.current = null;
    }
    const win = getWindow(floating);
    function handleMouseMove(event) {
      const target = getTarget(event);
      if (!contains(floating, target)) {
        setReference(event.clientX, event.clientY);
      } else {
        cleanupListener();
      }
    }
    if (!dataRef.current.openEvent || isMouseBasedEvent(dataRef.current.openEvent)) {
      cleanupListenerRef.current = addEventListener(win, "mousemove", handleMouseMove);
    } else {
      resetReference(domReference);
    }
    return cleanupListener;
  }, [openCheck, enabled, floating, dataRef, domReference, store, setReference, resetReference, reactive]);
  React.useEffect(() => () => {
    store.set("positionReference", null);
  }, [store]);
  React.useEffect(() => {
    if (enabled && !floating) {
      initialRef.current = false;
    }
  }, [enabled, floating]);
  React.useEffect(() => {
    if (!enabled && open) {
      initialRef.current = true;
    }
  }, [enabled, open]);
  const reference = React.useMemo(() => {
    function setPointerTypeRef(event) {
      setPointerType(event.pointerType);
    }
    return {
      onPointerDown: setPointerTypeRef,
      onPointerEnter: setPointerTypeRef,
      onMouseMove: handleReferenceEnterOrMove,
      onMouseEnter: handleReferenceEnterOrMove
    };
  }, [handleReferenceEnterOrMove]);
  return React.useMemo(() => enabled ? {
    reference,
    trigger: reference
  } : {}, [enabled, reference]);
}
const Separator$1 = /* @__PURE__ */ React.forwardRef(function SeparatorComponent(componentProps, forwardedRef) {
  const {
    className,
    render,
    orientation = "horizontal",
    style,
    ...elementProps
  } = componentProps;
  const state = {
    orientation
  };
  const element = useRenderElement("div", componentProps, {
    state,
    ref: forwardedRef,
    props: [{
      role: "separator",
      "aria-orientation": orientation
    }, elementProps]
  });
  return element;
});
if (process.env.NODE_ENV !== "production") Separator$1.displayName = "Separator";
const DialogClose = /* @__PURE__ */ React.forwardRef(function DialogClose2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    disabled: disabled2 = false,
    nativeButton = true,
    ...elementProps
  } = componentProps;
  const store = useDialogRootContext();
  const open = store.useState("open");
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled: disabled2,
    native: nativeButton
  });
  const state = {
    disabled: disabled2
  };
  function handleClick(event) {
    if (open) {
      store.setOpen(false, createChangeEventDetails(closePress, event.nativeEvent));
    }
  }
  return useRenderElement("button", componentProps, {
    state,
    ref: [forwardedRef, buttonRef],
    props: [{
      onClick: handleClick
    }, elementProps, getButtonProps]
  });
});
if (process.env.NODE_ENV !== "production") DialogClose.displayName = "DialogClose";
const DialogDescription$1 = /* @__PURE__ */ React.forwardRef(function DialogDescription(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    id: idProp,
    ...elementProps
  } = componentProps;
  const store = useDialogRootContext();
  const id = useBaseUiId(idProp);
  store.useSyncedValueWithCleanup("descriptionElementId", id);
  return useRenderElement("p", componentProps, {
    ref: forwardedRef,
    props: [{
      id
    }, elementProps]
  });
});
if (process.env.NODE_ENV !== "production") DialogDescription$1.displayName = "DialogDescription";
const DialogTitle$1 = /* @__PURE__ */ React.forwardRef(function DialogTitle(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    id: idProp,
    ...elementProps
  } = componentProps;
  const store = useDialogRootContext();
  const id = useBaseUiId(idProp);
  store.useSyncedValueWithCleanup("titleElementId", id);
  return useRenderElement("h2", componentProps, {
    ref: forwardedRef,
    props: [{
      id
    }, elementProps]
  });
});
if (process.env.NODE_ENV !== "production") DialogTitle$1.displayName = "DialogTitle";
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
function useAnnounceModal(open) {
  useEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent("hypercanvas:modal-opened"));
  }, [open]);
}
const DIALOG_OVERLAY_CLASS = "hc-fixed hc-inset-0 hc-isolate hc-z-[10000] hc-bg-black/10 hc-duration-100 hc-supports-backdrop-filter:backdrop-blur-xs hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-closed:animate-out hc-data-closed:fade-out-0";
const DIALOG_CONTENT_CLASS = "hc-fixed hc-top-1/2 hc-left-1/2 hc-z-[10001] hc-grid hc-w-full hc-max-w-[calc(100%-2rem)] hc--translate-x-1/2 hc--translate-y-1/2 hc-gap-4 hc-rounded-xl hc-bg-popover hc-p-4 hc-font-sans hc-text-sm hc-text-popover-foreground hc-ring-1 hc-ring-foreground/10 hc-duration-100 hc-outline-none hc-sm:max-w-sm hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95";
function Dialog({ open, defaultOpen = false, onOpenChange, ...props }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  useAnnounceModal(open ?? internalOpen);
  return /* @__PURE__ */ jsx(DialogRoot, { "data-hc-ui": "", "data-slot": "dialog", open: open ?? internalOpen, onOpenChange: (value, details) => {
    setInternalOpen(value);
    onOpenChange?.(value, details);
  }, ...props });
}
function DialogPortal({
  ...props
}) {
  return /* @__PURE__ */ jsx(DialogPortal$1, { "data-hc-ui": "", "data-slot": "dialog-portal", ...props });
}
function DialogOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    DialogBackdrop,
    {
      "data-hc-ui": "",
      "data-slot": "dialog-overlay",
      className: cn(
        DIALOG_OVERLAY_CLASS,
        className
      ),
      ...props
    }
  );
}
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}) {
  return /* @__PURE__ */ jsxs(DialogPortal, { children: [
    /* @__PURE__ */ jsx(DialogOverlay, {}),
    /* @__PURE__ */ jsxs(
      DialogPopup,
      {
        "data-hc-ui": "",
        "data-slot": "dialog-content",
        className: cn(
          DIALOG_CONTENT_CLASS,
          className
        ),
        ...props,
        children: [
          children,
          showCloseButton && /* @__PURE__ */ jsxs(
            DialogClose,
            {
              "data-hc-ui": "",
              "data-slot": "dialog-close",
              render: /* @__PURE__ */ jsx(
                Button,
                {
                  variant: "ghost",
                  className: "hc-absolute hc-top-2 hc-right-2",
                  size: "icon-sm"
                }
              ),
              children: [
                /* @__PURE__ */ jsx(
                  X,
                  {}
                ),
                /* @__PURE__ */ jsx("span", { className: "hc-sr-only", children: "Close" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function DialogHeader({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-hc-ui": "",
      "data-slot": "dialog-header",
      className: cn("hc-flex hc-flex-col hc-gap-2", className),
      ...props
    }
  );
}
function DialogTitle2({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    DialogTitle$1,
    {
      "data-hc-ui": "",
      "data-slot": "dialog-title",
      className: cn(
        "hc-text-base hc-leading-none hc-font-medium",
        className
      ),
      ...props
    }
  );
}
function DialogDescription2({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    DialogDescription$1,
    {
      "data-hc-ui": "",
      "data-slot": "dialog-description",
      className: cn(
        "hc-text-sm hc-text-muted-foreground hc-*:[a]:underline hc-*:[a]:underline-offset-3 hc-*:[a]:hover:text-foreground",
        className
      ),
      ...props
    }
  );
}
function Skeleton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-hc-ui": "",
      "data-slot": "skeleton",
      className: cn("hc-animate-pulse hc-rounded-md hc-bg-muted", className),
      ...props
    }
  );
}
const ARTIFACT_ICONS = {
  prototype: File,
  canvas: LayoutDashboard,
  component: Component,
  doc: File,
  site: Globe,
  folder: Folder,
  page: File
};
const DISCLOSURE_GLYPHS = {
  chevron: ["M9 6L15 12L9 18"],
  back: ["M15 6L9 12L15 18"]
};
function TreeIcon({ name, size = 16, ...props }) {
  const paths = DISCLOSURE_GLYPHS[name];
  if (paths) {
    return /* @__PURE__ */ jsx("svg", { "aria-hidden": "true", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: paths.map((d) => /* @__PURE__ */ jsx("path", { d }, d)) });
  }
  const Icon = ARTIFACT_ICONS[name] || File;
  return /* @__PURE__ */ jsx(Icon, { "aria-hidden": "true", size, strokeWidth: 2, ...props });
}
const icon = "hc-size-4 hc-shrink-0 hc-stroke-[2]";
const notebookShellControl = "hc-h-7 hc-rounded-[3px] hc-text-xs hc-leading-4 hc-font-normal hc-gap-1.5 hc-px-2 hc-text-muted-foreground hc-hover:bg-[var(--hc-color-hover)] hc-hover:text-foreground hc-[&_svg]:size-3.5";
forwardRef(function NotebookShellSidebar2({ className, children, ...props }, ref) {
  return /* @__PURE__ */ jsx("aside", { ref, ...props, "data-notebook-shell-sidebar": "", className: cn("hc-box-border hc-[&_*]:box-border hc-[&_*::before]:box-border hc-[&_*::after]:box-border hc-flex hc-h-full hc-w-[var(--sb--notebook-sidebar-width,248px)] hc-min-w-0 hc-shrink-0 hc-flex-col hc-border-r hc-border-border hc-bg-[var(--hc-color-sidebar)] hc-text-sm hc-leading-5 hc-transition-[width] hc-duration-150", className), children });
});
forwardRef(function NotebookShellNavigation2({ className, children, ...props }, ref) {
  return /* @__PURE__ */ jsx("nav", { ref, ...props, className: cn("hc-flex hc-flex-col hc-gap-0.5 hc-min-h-0 hc-flex-1 hc-overflow-auto hc-px-0 hc-pt-2", className), children });
});
forwardRef(function NotebookShellNotice2({ tone = "default", className, children, diagnostic = {}, onClickCapture, ...props }, ref) {
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
const NotebookShellRow = forwardRef(function NotebookShellRow2({ depth = 0, selected, icon: Icon, leading, iconOnly, children, className, style, ...props }, ref) {
  return /* @__PURE__ */ jsxs(Button, { ref, variant: "ghost", ...props, "data-notebook-shell-row": "", "data-selected": selected || void 0, style: { "--depth": depth, ...style }, className: cn(buttonVariants$1({ variant: "ghost", size: "sm" }), "hc-flex hc-h-8 hc-w-full hc-min-w-0 hc-justify-start hc-gap-1.5 hc-border-0 hc-bg-transparent hc-py-0 hc-pl-[calc(8px+var(--depth)*14px)] hc-pr-2 hc-text-left hc-text-sm hc-leading-5 hc-font-normal hc-text-foreground hc-no-underline hc-aria-expanded:not-hover:bg-transparent hc-data-selected:bg-accent", iconOnly && "hc-size-7 hc-p-0 hc-justify-center", className), children: [
    !iconOnly && (leading ?? /* @__PURE__ */ jsx("span", { className: "hc-size-2.5 hc-shrink-0", "aria-hidden": "true" })),
    Icon && /* @__PURE__ */ jsx(Icon, { "aria-hidden": "true", className: cn(icon, selected && "hc-text-foreground", !selected && "hc-text-muted-foreground") }),
    /* @__PURE__ */ jsx("span", { className: cn(iconOnly ? "hc-sr-only" : "hc-flex hc-min-w-0 hc-flex-1 hc-items-center hc-gap-1.5 hc-truncate hc-text-sm hc-leading-5 hc-font-normal hc-subpixel-antialiased"), children })
  ] });
});
forwardRef(function NotebookShellTab2({ className, minimumWidth, style, ...props }, ref) {
  return /* @__PURE__ */ jsx(Button$2, { ref, style: { ...style, ...Number.isFinite(minimumWidth) && minimumWidth > 0 ? { minWidth: minimumWidth } : {} }, variant: "ghost", size: "sm", wrapperClass: "hc-min-w-0 hc-max-w-full", ...props, className: cn(notebookShellControl, "hc-rounded-lg hc-min-w-0 hc-truncate hc-py-0 hc-leading-4 hc-aria-selected:font-semibold hc-aria-selected:text-foreground", className) });
});
const treeRow = "_treeRow_4mt67_2";
const css$1 = {
  treeRow
};
const skeletonRows = [
  { depth: 0, width: "hc-w-24" },
  { depth: 0, width: "hc-w-32" },
  { depth: 1, width: "hc-w-20" },
  { depth: 0, width: "hc-w-28" },
  { depth: 1, width: "hc-w-24" }
];
function folderByPath(tree, path) {
  if (!path) return tree?.root || null;
  const visit = (nodes) => {
    for (const node of nodes || []) {
      if (node.kind !== "folder") continue;
      if (node.path === path) return node;
      const match = visit(node.children);
      if (match) return match;
    }
    return null;
  };
  return visit(tree?.root?.children);
}
function hasHiddenDirectory(path, hideDefaultSupport = false) {
  return (path || "").split("/").filter(Boolean).some((segment) => segment.startsWith("_") || hideDefaultSupport && ["backstage", "publish"].includes(segment));
}
function pruneHiddenSubtrees(tree) {
  if (!tree?.root) return tree;
  const hideDefaultSupport = !Array.isArray(tree.sidebarIgnored);
  const prune = (nodes) => (nodes || []).filter((node) => {
    const hidden = node.kind === "folder" ? node.name.startsWith("_") || hasHiddenDirectory(node.path, hideDefaultSupport) || hasHiddenDirectory(node.parentPath, hideDefaultSupport) : hasHiddenDirectory(node.path || node.parentPath, hideDefaultSupport);
    return !hidden;
  }).map((node) => node.kind === "folder" ? { ...node, children: prune(node.children) } : node);
  return { ...tree, root: { ...tree.root, children: prune(tree.root.children) } };
}
function findArtifactPath(tree, pageId) {
  let found = null;
  const visit = (nodes, ancestors) => {
    for (const node of nodes || []) {
      if (node.kind === "folder") visit(node.children, [...ancestors, node]);
      else if (node.pageId === pageId || node.id === pageId) found = ancestors;
    }
  };
  visit(tree?.root?.children, []);
  return found || [];
}
function findArtifactParentPath(tree, pageId) {
  let parentPath = "";
  const visit = (nodes) => {
    for (const node of nodes || []) {
      if (node.kind === "folder") visit(node.children);
      else if (node.pageId === pageId || node.id === pageId) parentPath = node.parentPath || "";
    }
  };
  visit(tree?.root?.children);
  return parentPath;
}
function childMatches(node, search) {
  if (!search) return true;
  if (node.kind === "artifact") return `${node.title} ${node.name} ${node.artifactKind} ${node.diagnostics?.map((item) => item.message).join(" ") || ""}`.toLowerCase().includes(search);
  return node.name.toLowerCase().includes(search) || node.children.some((child) => childMatches(child, search));
}
function treeDiagnostics(tree, topLevel = []) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const append = (diagnostic) => {
    if (!(diagnostic?.nestedArtifact || diagnostic?.containingArtifact || diagnostic?.code === "NESTED_ARTIFACT")) return;
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(diagnostic);
  };
  for (const diagnostic of topLevel || []) append(diagnostic);
  const visit = (nodes) => (nodes || []).forEach((node) => {
    if (node.kind === "folder") visit(node.children);
    else for (const diagnostic of node.diagnostics || []) append({ ...diagnostic, artifactId: node.id, artifactPath: node.path });
  });
  visit(tree?.root?.children);
  return result;
}
function diagnosticKey(diagnostic) {
  return [
    diagnostic?.code || "",
    diagnostic?.nestedArtifact?.kind || "",
    diagnostic?.nestedArtifact?.path || diagnostic?.path || "",
    diagnostic?.containingArtifact?.kind || "",
    diagnostic?.containingArtifact?.path || "",
    diagnostic?.repairParentPath ?? "",
    diagnostic?.proposedDestination || ""
  ].join(":");
}
function nearestShallowAncestor(tree, path, maxInlineDepth) {
  const parts = (path || "").split("/").filter(Boolean);
  for (let length = parts.length - 1; length > 0; length--) {
    const candidate = folderByPath(tree, parts.slice(0, length).join("/"));
    if (candidate && candidate.depth <= maxInlineDepth) return candidate;
  }
  return null;
}
function NestedArtifactRepairDialog({ diagnostics = [], open, onOpenChange, onRepair }) {
  const [states, setStates] = useState({});
  useEffect(() => {
    if (!open) setStates({});
  }, [open]);
  const repair = async (diagnostic) => {
    const key = diagnosticKey(diagnostic);
    if (typeof onRepair !== "function" || states[key]?.busy) return;
    setStates((current) => ({ ...current, [key]: { busy: true, error: "", success: false } }));
    try {
      await onRepair(diagnostic);
      setStates((current) => ({ ...current, [key]: { busy: false, error: "", success: true } }));
    } catch (error) {
      const details = error?.data && typeof error.data === "object" ? error.data : {};
      const collision = error?.code === "REPAIR_DESTINATION_OCCUPIED" || error?.code === "COLLISION";
      const destination = details.occupiedPath || diagnostic.proposedDestination || (diagnostic.repairParentPath === "" ? "Notebook root" : diagnostic.repairParentPath);
      const collisionMessage = destination ? `The proposed destination ${destination === "Notebook root" ? "Notebook root" : `“${destination}”`} is occupied. Resolve that conflict, then retry this repair.` : "The proposed destination is occupied. Resolve that conflict, then retry this repair.";
      const moved = details.moved === true;
      const partialMessage = moved ? `${error?.message || "The artifact moved, but reconciliation did not finish."} Refresh the tree before taking further action. ${details.fromPath || diagnostic.nestedArtifact?.path || ""} → ${details.toPath || diagnostic.proposedDestination || ""}` : null;
      setStates((current) => ({ ...current, [key]: { busy: false, error: collision ? collisionMessage : partialMessage || error?.message || "Could not repair this artifact.", success: false, moved } }));
    }
  };
  return /* @__PURE__ */ jsx(Dialog, { open, onOpenChange, children: /* @__PURE__ */ jsxs(DialogContent, { className: "hc-max-h-[80vh] hc-overflow-auto", children: [
    /* @__PURE__ */ jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsx(DialogTitle2, { children: "Nested artifact diagnostics" }),
      /* @__PURE__ */ jsx(DialogDescription2, { children: "Review each exact source and proposed destination. Nothing moves until you choose Repair." })
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "hc-m-0 hc-grid hc-list-none hc-gap-3.5 hc-p-0", children: diagnostics.map((diagnostic, index) => {
      const key = diagnosticKey(diagnostic);
      const state = states[key] || {};
      const source = diagnostic.nestedArtifact?.path || diagnostic.path || diagnostic.artifactPath || "Unknown path";
      const proposedDestination = diagnostic.proposedDestination || (diagnostic.repairParentPath === "" ? "Notebook root" : diagnostic.repairParentPath);
      return /* @__PURE__ */ jsxs("li", { className: "hc-grid hc-gap-1 hc-border-t hc-border-border hc-pt-2.5 hc-text-xs hc-[&_p]:m-0 hc-[&_dl]:m-0 hc-[&_dl]:grid hc-[&_dl]:grid-cols-[75px_minmax(0,1fr)] hc-[&_dl]:gap-1 hc-[&_dt]:text-muted-foreground hc-[&_dd]:m-0 hc-[&_dd]:min-w-0 hc-[&_dd]:break-words hc-[&_code]:text-xs", children: [
        /* @__PURE__ */ jsx("strong", { children: diagnostic.code }),
        /* @__PURE__ */ jsx("p", { children: diagnostic.message }),
        /* @__PURE__ */ jsxs("dl", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Nested artifact" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            diagnostic.nestedArtifact?.kind || "Artifact",
            " ",
            /* @__PURE__ */ jsx("code", { children: source })
          ] }),
          diagnostic.containingArtifact && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("dt", { children: "Immediate container" }),
            /* @__PURE__ */ jsxs("dd", { children: [
              diagnostic.containingArtifact.kind || "Artifact",
              " ",
              diagnostic.containingArtifact.path && /* @__PURE__ */ jsx("code", { children: diagnostic.containingArtifact.path })
            ] })
          ] }),
          proposedDestination && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("dt", { children: "Proposed destination" }),
            /* @__PURE__ */ jsx("dd", { children: proposedDestination === "Notebook root" ? proposedDestination : /* @__PURE__ */ jsx("code", { children: proposedDestination }) })
          ] }),
          Object.hasOwn(diagnostic, "repairParentPath") && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("dt", { children: "Destination parent" }),
            /* @__PURE__ */ jsx("dd", { children: diagnostic.repairParentPath === "" ? "Notebook root" : /* @__PURE__ */ jsx("code", { children: diagnostic.repairParentPath }) })
          ] })
        ] }),
        state.error && /* @__PURE__ */ jsx("p", { className: "hc-text-destructive", role: "alert", children: state.error }),
        state.success && /* @__PURE__ */ jsx("p", { role: "status", children: "Repair completed. Waiting for refreshed diagnostics." }),
        /* @__PURE__ */ jsx(Button, { type: "button", disabled: !onRepair || state.busy || state.success || state.moved, onClick: () => void repair(diagnostic), children: state.busy ? "Repairing…" : state.moved ? "Refresh required" : state.error ? "Retry repair" : state.success ? "Repair completed" : onRepair ? "Repair this path" : "Repair service unavailable" })
      ] }, `${key}:${index}`);
    }) })
  ] }) });
}
function NotebookSidebarTree({ tree, loading = false, diagnostics: topLevelDiagnostics = [], diagnosticScopeKey = "", pages = [], sites = [], activePageId, published = false, search = "", onOpenPage, onRepair, renderArtifactActions, renderFolderActions, folderRename, onContextChange, onDrillChange }) {
  const [maxInlineDepth] = useState(() => getConfig().notebookSidebar?.maxFolderLayers ?? DEFAULT_MAX_FOLDER_LAYERS);
  const [expanded, setExpanded] = useState({});
  const [appliedFolderRename, setAppliedFolderRename] = useState(null);
  const [panelPaths, setPanelPaths] = useState([]);
  const drilled = panelPaths.length > 0;
  useEffect(() => {
    onDrillChange?.(drilled);
    return () => onDrillChange?.(false);
  }, [drilled, onDrillChange]);
  const [selectedPath, setSelectedPath] = useState("");
  const [manualRepairOpen, setManualRepairOpen] = useState(false);
  const [openActionMenuKey, setOpenActionMenuKey] = useState(null);
  const [dismissedDiagnosticFingerprint, setDismissedDiagnosticFingerprint] = useState(null);
  const [previousDiagnosticFingerprint, setPreviousDiagnosticFingerprint] = useState("");
  const panelRef = useRef(null);
  const actionReturnFocusRef = useRef(null);
  const restoreRef = useRef(null);
  const panelStateRef = useRef(/* @__PURE__ */ new Map());
  const revealedPageRef = useRef(void 0);
  if (folderRename && appliedFolderRename !== folderRename) {
    const remap = (value) => value === folderRename.from || value.startsWith(`${folderRename.from}/`) ? folderRename.to + value.slice(folderRename.from.length) : value;
    setAppliedFolderRename(folderRename);
    setExpanded((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [remap(key), value])));
    setSelectedPath(remap(selectedPath));
    setPanelPaths((current) => current.map(remap));
  }
  useEffect(() => {
    if (!folderRename) return;
    const remap = (value) => value === folderRename.from || value.startsWith(`${folderRename.from}/`) ? folderRename.to + value.slice(folderRename.from.length) : value;
    panelStateRef.current = new Map([...panelStateRef.current].map(([key, value]) => [remap(key), {
      ...value,
      focusKey: value.focusKey?.startsWith("folder:") ? `folder:${remap(value.focusKey.slice(7))}` : value.focusKey
    }]));
  }, [folderRename]);
  const visibleTree = useMemo(() => pruneHiddenSubtrees(tree), [tree]);
  const diagnostics = useMemo(() => treeDiagnostics(visibleTree, topLevelDiagnostics), [visibleTree, topLevelDiagnostics]);
  const needle = search.trim().toLowerCase();
  const folder = folderByPath(visibleTree, panelPaths.at(-1) || "");
  const visibleChildren = useMemo(() => (folder?.children || []).filter((node) => childMatches(node, needle)), [folder, needle]);
  const currentDiagnosticKeys = diagnostics.map(diagnosticKey);
  const diagnosticFingerprint = JSON.stringify([diagnosticScopeKey, [...new Set(currentDiagnosticKeys)].sort()]);
  if (previousDiagnosticFingerprint !== diagnosticFingerprint) {
    setPreviousDiagnosticFingerprint(diagnosticFingerprint);
    if (diagnostics.length === 0 && dismissedDiagnosticFingerprint !== null) setDismissedDiagnosticFingerprint(null);
  }
  const repairOpen = diagnostics.length > 0 && (manualRepairOpen || dismissedDiagnosticFingerprint !== diagnosticFingerprint);
  const onRepairOpenChange = (open) => {
    if (open) {
      setManualRepairOpen(true);
      return;
    }
    setManualRepairOpen(false);
    setDismissedDiagnosticFingerprint(diagnosticFingerprint);
  };
  useEffect(() => {
    if (revealedPageRef.current === activePageId) return;
    if (!activePageId) {
      revealedPageRef.current = null;
      return;
    }
    if (!visibleTree?.root) return;
    revealedPageRef.current = activePageId;
    setSelectedPath(findArtifactParentPath(visibleTree, activePageId));
    const artifactAncestors = findArtifactPath(visibleTree, activePageId);
    const ancestors = artifactAncestors.filter((node) => node.depth > maxInlineDepth);
    setExpanded((current) => {
      const next = { ...current };
      for (const node of artifactAncestors) if (node.depth <= maxInlineDepth) next[node.path] = true;
      return next;
    });
    setPanelPaths(ancestors.map((node) => node.path));
  }, [activePageId, visibleTree, maxInlineDepth]);
  useEffect(() => {
    const focusedPath = panelPaths.at(-1) || selectedPath;
    if (focusedPath && !folderByPath(visibleTree, focusedPath)) {
      const fallback = nearestShallowAncestor(visibleTree, focusedPath, maxInlineDepth);
      setSelectedPath(fallback?.path || "");
      setPanelPaths((current) => current.filter((path2) => folderByPath(visibleTree, path2) && folderByPath(visibleTree, path2).depth > maxInlineDepth));
      onContextChange?.(fallback?.path || "");
      return;
    }
    let lastValid = -1;
    for (let index = 0; index < panelPaths.length; index++) if (folderByPath(visibleTree, panelPaths[index])) lastValid = index;
    if (lastValid !== panelPaths.length - 1) setPanelPaths((current) => current.slice(0, lastValid + 1));
    const path = lastValid >= 0 ? panelPaths[lastValid] : "";
    onContextChange?.(path || selectedPath || "");
  }, [visibleTree, panelPaths, selectedPath, onContextChange, maxInlineDepth]);
  useEffect(() => {
    if (!restoreRef.current || !panelRef.current) return;
    const { scrollTop, focusKey } = restoreRef.current;
    restoreRef.current = null;
    panelRef.current.scrollTop = scrollTop;
    requestAnimationFrame(() => [...panelRef.current?.querySelectorAll("[data-tree-key]") || []].find((element) => element.dataset.treeKey === focusKey)?.focus());
  }, [panelPaths]);
  const openFolder = (node) => {
    setSelectedPath(node.path);
    if (node.depth <= maxInlineDepth) {
      setExpanded((current) => ({ ...current, [node.path]: current[node.path] === false }));
      onContextChange?.(node.path);
      return;
    }
    panelStateRef.current.set(panelPaths.at(-1) || "", { scrollTop: panelRef.current?.scrollTop || 0, focusKey: document.activeElement?.dataset?.treeKey || "" });
    restoreRef.current = { scrollTop: 0, focusKey: "" };
    setPanelPaths((current) => [...current, node.path]);
  };
  const back = () => {
    const previousPath = panelPaths.length > 1 ? panelPaths.at(-2) : "";
    restoreRef.current = panelStateRef.current.get(previousPath) || { scrollTop: 0, focusKey: "" };
    setPanelPaths((current) => current.length <= 1 ? [] : current.slice(0, -1));
  };
  const openArtifactActions = (event, key, row) => {
    if (window.getSelection?.()?.toString()) return;
    event.preventDefault();
    event.stopPropagation();
    actionReturnFocusRef.current = row;
    setOpenActionMenuKey(key);
  };
  const closeArtifactActions = (key) => {
    setOpenActionMenuKey((current) => current === key ? null : current);
    if (actionReturnFocusRef.current) {
      const row = actionReturnFocusRef.current;
      actionReturnFocusRef.current = null;
      requestAnimationFrame(() => row.isConnected && row.focus());
    }
  };
  useEffect(() => {
    if (!openActionMenuKey) return;
    requestAnimationFrame(() => document.querySelector('[data-slot="dropdown-menu-content"] [role="menuitem"]:not([aria-disabled="true"])')?.focus());
  }, [openActionMenuKey]);
  const renderNodes = (nodes, level = 0) => nodes.filter((node) => childMatches(node, needle)).map((node) => {
    const key = node.kind === "folder" ? `folder:${node.path}` : `artifact:${node.id}:${node.path || node.siteId || ""}`;
    if (node.kind === "folder") {
      const inline = node.depth <= maxInlineDepth && node.children.some((child) => childMatches(child, needle));
      const isExpanded = inline && expanded[node.path] !== false;
      const actionable = !published && node.ref?.kind === "folder" && node.ref.path === node.path && Boolean(renderFolderActions);
      return /* @__PURE__ */ jsxs("li", { className: "hc-min-w-0", children: [
        /* @__PURE__ */ jsxs("div", { className: css$1.treeRow, onContextMenu: (event) => {
          if (actionable) openArtifactActions(event, key, event.currentTarget.querySelector("[data-tree-key]"));
        }, children: [
          /* @__PURE__ */ jsxs(NotebookShellRow, { depth: level, leading: false, "data-tree-key": key, "aria-expanded": inline ? isExpanded : void 0, onKeyDown: (event) => {
            if ((event.key === "ContextMenu" || event.key === "F10" && event.shiftKey) && actionable) openArtifactActions(event, key, event.currentTarget);
          }, onClick: () => openFolder(node), children: [
            /* @__PURE__ */ jsx(TreeIcon, { name: "chevron", size: 14, className: `hc-size-2.5 hc-shrink-0 hc-text-muted-foreground hc-transition-transform ${isExpanded ? "hc-rotate-90" : ""}` }),
            /* @__PURE__ */ jsx(TreeIcon, { name: "folder", className: "hc-size-4 hc-shrink-0 hc-text-muted-foreground" }),
            /* @__PURE__ */ jsx("span", { className: "hc-min-w-0 hc-truncate hc-text-sm hc-leading-5", children: node.name })
          ] }),
          actionable && renderFolderActions(node, {
            open: openActionMenuKey === key,
            onOpenChange: (open) => open ? setOpenActionMenuKey(key) : closeArtifactActions(key)
          })
        ] }),
        inline && isExpanded && /* @__PURE__ */ jsx("ul", { className: "hc-m-0 hc-grid hc-list-none hc-gap-0.5 hc-p-0 hc-pt-0.5", children: renderNodes(node.children, level + 1) })
      ] }, key);
    }
    const page = pages.find((item) => item.id === node.pageId) || pages.find((item) => item.id === node.id);
    const pageView = page ? { ...page, folderPath: node.path, id: node.pageId || node.id, type: node.artifactKind, title: node.title || node.name, route: node.route || page.route, path: node.payloadPath || node.path || page.path, siteId: node.siteId || page.siteId, available: node.available && page.available !== false, diagnostics: [...node.diagnostics || [], ...page.diagnostics || []] } : { ...node, id: node.pageId || node.id, type: node.artifactKind, path: node.payloadPath || node.path, available: false };
    const openable = Boolean(node.pageId && page && node.available && node.ref);
    return /* @__PURE__ */ jsx("li", { className: "hc-min-w-0", children: /* @__PURE__ */ jsxs(
      "div",
      {
        className: css$1.treeRow,
        "data-page-type": node.artifactKind,
        "data-current-page": node.pageId === activePageId ? "true" : void 0,
        onContextMenu: (event) => {
          if (openable && !published) openArtifactActions(event, key, event.currentTarget.querySelector("[data-tree-key]"));
        },
        children: [
          /* @__PURE__ */ jsxs(NotebookShellRow, { depth: level, leading: level === 0 ? false : /* @__PURE__ */ jsx("span", { className: "hc-size-2.5 hc-shrink-0", "aria-hidden": "true" }), selected: node.pageId === activePageId, "data-tree-key": key, disabled: !openable, "aria-current": node.pageId === activePageId ? "page" : void 0, onKeyDown: (event) => {
            if ((event.key === "ContextMenu" || event.key === "F10" && event.shiftKey) && openable && !published) openArtifactActions(event, key, event.currentTarget);
          }, onClick: () => {
            if (openable) {
              setSelectedPath(node.parentPath);
              onContextChange?.(node.parentPath);
              onOpenPage?.(pageView);
            }
          }, children: [
            /* @__PURE__ */ jsx(TreeIcon, { name: node.artifactKind, className: `hc-size-4 hc-shrink-0 ${node.pageId === activePageId ? "hc-text-foreground" : "hc-text-muted-foreground"}` }),
            /* @__PURE__ */ jsx("span", { className: "hc-min-w-0 hc-truncate hc-text-sm hc-leading-5", children: node.title || node.name }),
            !node.available && /* @__PURE__ */ jsx("span", { className: "hc-shrink-0 hc-text-xs", "aria-label": "Unavailable", title: node.diagnostics?.[0]?.message || "Unavailable", children: "!" }),
            node.siteId && /* @__PURE__ */ jsx("span", { className: "hc-shrink-0 hc-text-xs hc-text-success", title: `Site ${sites.find((site) => site.id === node.siteId)?.binding?.status || "unknown"}`, children: sites.find((site) => site.id === node.siteId)?.binding?.status === "running" ? "●" : "○" })
          ] }),
          diagnostics.some((item) => item.artifactId === node.id && item.artifactPath === node.path) && /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "xs", onClick: () => setManualRepairOpen(true), children: "Diagnostics" }),
          !published && openable && renderArtifactActions?.(pageView, {
            open: openActionMenuKey === key,
            onOpenChange: (open) => open ? setOpenActionMenuKey(key) : closeArtifactActions(key)
          })
        ]
      }
    ) }, key);
  });
  const renderedNodes = renderNodes(visibleChildren);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { ref: panelRef, className: "hc-min-h-0 hc-overflow-auto hc-pb-3", "data-testid": "notebook-tree-panel", "aria-busy": loading || void 0, children: loading ? /* @__PURE__ */ jsx("div", { role: "status", "aria-label": "Loading Notebook pages", "data-testid": "notebook-tree-loading", className: "hc-grid hc-gap-0.5 hc-px-1.5 hc-py-0", children: skeletonRows.map(({ depth, width }, index) => /* @__PURE__ */ jsxs("div", { "aria-hidden": "true", "data-notebook-tree-skeleton-row": "", className: "hc-flex hc-h-8 hc-items-center hc-gap-1.5 hc-pl-[calc(8px+var(--depth)*14px)] hc-pr-2", style: { "--depth": depth }, children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "hc-size-4 hc-shrink-0 hc-rounded-sm" }),
      /* @__PURE__ */ jsx(Skeleton, { className: `hc-h-3 hc-rounded-sm ${width}` })
    ] }, index)) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      drilled && /* @__PURE__ */ jsx("div", { className: "hc-sticky hc-top-0 hc-z-10 hc-mb-2 hc-border-b hc-border-border hc-bg-[var(--hc-color-sidebar)] hc-px-1.5 hc-pb-2", children: /* @__PURE__ */ jsx(NotebookShellRow, { leading: false, icon: CornerUpLeft, "data-tree-back": "", "aria-label": "Back", onClick: back, children: folder?.name || "Folder" }) }),
      /* @__PURE__ */ jsx("ul", { className: "hc-m-0 hc-grid hc-list-none hc-gap-0.5 hc-px-1.5 hc-py-0", "aria-label": panelPaths.length ? `${folder?.name || "Folder"} contents` : "Notebook folders and pages", children: renderedNodes })
    ] }) }),
    diagnostics.length > 0 && /* @__PURE__ */ jsxs(Button, { type: "button", variant: "ghost", className: "hc-w-full hc-justify-start", onClick: () => setManualRepairOpen(true), children: [
      "Nested artifact diagnostics (",
      diagnostics.length,
      ")"
    ] }),
    diagnostics.length > 0 && /* @__PURE__ */ jsx(NestedArtifactRepairDialog, { diagnostics, open: repairOpen, onOpenChange: onRepairOpenChange, onRepair })
  ] });
}
function useRender(params) {
  return useRenderElement(params.defaultTagName ?? "div", params, params);
}
const MOBILE_BREAKPOINT = 768;
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(void 0);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return !!isMobile;
}
function Separator({
  className,
  orientation = "horizontal",
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Separator$1,
    {
      "data-hc-ui": "",
      "data-slot": "separator",
      orientation,
      className: cn(
        "hc-shrink-0 hc-bg-border hc-data-horizontal:h-px hc-data-horizontal:w-full hc-data-vertical:w-px hc-data-vertical:self-stretch",
        className
      ),
      ...props
    }
  );
}
function Sheet({
  ...props
}) {
  return /* @__PURE__ */ jsx(DialogRoot, { "data-hc-ui": "", "data-slot": "sheet", ...props });
}
function SheetPortal({
  ...props
}) {
  return /* @__PURE__ */ jsx(DialogPortal$1, { "data-hc-ui": "", "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    DialogBackdrop,
    {
      "data-hc-ui": "",
      "data-slot": "sheet-overlay",
      className: cn(
        "hc-fixed hc-inset-0 hc-z-[10000] hc-bg-black/10 hc-transition-opacity hc-duration-150 hc-data-ending-style:opacity-0 hc-data-starting-style:opacity-0 hc-supports-backdrop-filter:backdrop-blur-xs",
        className
      ),
      ...props
    }
  );
}
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}) {
  return /* @__PURE__ */ jsxs(SheetPortal, { children: [
    /* @__PURE__ */ jsx(SheetOverlay, {}),
    /* @__PURE__ */ jsxs(
      DialogPopup,
      {
        "data-hc-ui": "",
        "data-slot": "sheet-content",
        "data-side": side,
        className: cn(
          "hc-fixed hc-z-[10001] hc-flex hc-flex-col hc-gap-4 hc-bg-popover hc-bg-clip-padding hc-text-sm hc-text-popover-foreground hc-shadow-lg hc-transition hc-duration-200 hc-ease-in-out hc-data-ending-style:opacity-0 hc-data-starting-style:opacity-0 hc-data-[side=bottom]:inset-x-0 hc-data-[side=bottom]:bottom-0 hc-data-[side=bottom]:h-auto hc-data-[side=bottom]:border-t hc-data-[side=bottom]:data-ending-style:translate-y-[2.5rem] hc-data-[side=bottom]:data-starting-style:translate-y-[2.5rem] hc-data-[side=left]:inset-y-0 hc-data-[side=left]:left-0 hc-data-[side=left]:h-full hc-data-[side=left]:w-3/4 hc-data-[side=left]:border-r hc-data-[side=left]:data-ending-style:translate-x-[-2.5rem] hc-data-[side=left]:data-starting-style:translate-x-[-2.5rem] hc-data-[side=right]:inset-y-0 hc-data-[side=right]:right-0 hc-data-[side=right]:h-full hc-data-[side=right]:w-3/4 hc-data-[side=right]:border-l hc-data-[side=right]:data-ending-style:translate-x-[2.5rem] hc-data-[side=right]:data-starting-style:translate-x-[2.5rem] hc-data-[side=top]:inset-x-0 hc-data-[side=top]:top-0 hc-data-[side=top]:h-auto hc-data-[side=top]:border-b hc-data-[side=top]:data-ending-style:translate-y-[-2.5rem] hc-data-[side=top]:data-starting-style:translate-y-[-2.5rem] hc-data-[side=left]:sm:max-w-sm hc-data-[side=right]:sm:max-w-sm",
          className
        ),
        ...props,
        children: [
          children,
          showCloseButton && /* @__PURE__ */ jsxs(
            DialogClose,
            {
              "data-hc-ui": "",
              "data-slot": "sheet-close",
              render: /* @__PURE__ */ jsx(
                Button,
                {
                  variant: "ghost",
                  className: "hc-absolute hc-top-3 hc-right-3",
                  size: "icon-sm"
                }
              ),
              children: [
                /* @__PURE__ */ jsx(
                  X,
                  {}
                ),
                /* @__PURE__ */ jsx("span", { className: "hc-sr-only", children: "Close" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function SheetHeader({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-hc-ui": "",
      "data-slot": "sheet-header",
      className: cn("hc-flex hc-flex-col hc-gap-0.5 hc-p-4", className),
      ...props
    }
  );
}
function SheetTitle({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    DialogTitle$1,
    {
      "data-hc-ui": "",
      "data-slot": "sheet-title",
      className: cn(
        "hc-text-base hc-font-medium hc-text-foreground",
        className
      ),
      ...props
    }
  );
}
function SheetDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    DialogDescription$1,
    {
      "data-hc-ui": "",
      "data-slot": "sheet-description",
      className: cn("hc-text-sm hc-text-muted-foreground", className),
      ...props
    }
  );
}
const TooltipRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") TooltipRootContext.displayName = "TooltipRootContext";
function useTooltipRootContext(optional) {
  const context = React.useContext(TooltipRootContext);
  if (context === void 0 && !optional) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>." : formatErrorMessage(72));
  }
  return context;
}
const selectors = {
  ...popupStoreSelectors,
  disabled: (state) => state.disabled,
  instantType: (state) => state.instantType,
  isInstantPhase: (state) => state.isInstantPhase,
  trackCursorAxis: (state) => state.trackCursorAxis,
  disableHoverablePopup: (state) => state.disableHoverablePopup,
  lastOpenChangeReason: (state) => state.openChangeReason,
  closeOnClick: (state) => state.closeOnClick,
  closeDelay: (state) => state.closeDelay,
  adaptiveOrigin: (state) => state.adaptiveOrigin
};
class TooltipStore extends ReactStore {
  constructor(initialState, floatingId, nested) {
    const triggerElements = new PopupTriggerMap();
    super(createInitialState(initialState, triggerElements, floatingId, nested), createInitialContext(triggerElements), selectors);
  }
  setOpen = (nextOpen, eventDetails) => {
    applyPopupOpenChange(this, nextOpen, eventDetails, {
      extraState: {
        openChangeReason: eventDetails.reason
      }
    });
  };
  // Used by trigger clicks to clear a delayed hover open without reporting a public open-state change.
  cancelPendingOpen(event) {
    this.state.floatingRootContext.dispatchOpenChange(false, createChangeEventDetails(triggerPress, event));
  }
}
function createInitialState(initialState, triggerElements, floatingId, nested = false) {
  const state = {
    ...createInitialPopupStoreState(triggerElements, floatingId, nested),
    disabled: false,
    instantType: void 0,
    isInstantPhase: false,
    trackCursorAxis: "none",
    disableHoverablePopup: false,
    openChangeReason: null,
    closeOnClick: true,
    closeDelay: 0,
    adaptiveOrigin: void 0,
    ...initialState
  };
  return state;
}
function createInitialContext(triggerElements) {
  return {
    popupRef: /* @__PURE__ */ React.createRef(),
    onOpenChange: void 0,
    onOpenChangeComplete: void 0,
    triggerElements
  };
}
const TooltipRoot = fastComponent(function TooltipRoot2(props) {
  const {
    disabled: disabled$1 = false,
    defaultOpen = false,
    open: openProp,
    disableHoverablePopup = false,
    trackCursorAxis = "none",
    actionsRef,
    onOpenChange,
    onOpenChangeComplete,
    handle,
    triggerId: triggerIdProp,
    defaultTriggerId: defaultTriggerIdProp = null,
    children
  } = props;
  const store = usePopupRootStore((floatingId, nested) => new TooltipStore({
    open: defaultOpen,
    openProp,
    activeTriggerId: defaultTriggerIdProp,
    triggerIdProp
  }, floatingId, nested));
  store.useControlledProp("openProp", openProp);
  store.useControlledProp("triggerIdProp", triggerIdProp);
  store.useContextCallback("onOpenChange", onOpenChange);
  store.useContextCallback("onOpenChangeComplete", onOpenChangeComplete);
  const openState = store.useState("open");
  const open = !disabled$1 && openState;
  const activeTriggerId = store.useState("activeTriggerId");
  const mounted = store.useState("mounted");
  const payload = store.useState("payload");
  store.useSyncedValues({
    trackCursorAxis,
    disableHoverablePopup,
    disabled: disabled$1
  });
  useImplicitActiveTrigger(store, {
    closeOnActiveTriggerUnmount: true
  });
  const {
    forceUnmount,
    transitionStatus
  } = useOpenStateTransitions(open, store);
  const isInstantPhase = store.useState("isInstantPhase");
  const instantType = store.useState("instantType");
  const lastOpenChangeReason = store.useState("lastOpenChangeReason");
  const previousInstantTypeRef = React.useRef(null);
  useIsoLayoutEffect(() => {
    if (openState && disabled$1) {
      store.setOpen(false, createChangeEventDetails(disabled));
    }
  }, [openState, disabled$1, store]);
  useIsoLayoutEffect(() => {
    if (transitionStatus === "ending" && lastOpenChangeReason === none || transitionStatus !== "ending" && isInstantPhase) {
      if (instantType !== "delay") {
        previousInstantTypeRef.current = instantType;
      }
      store.set("instantType", "delay");
    } else if (previousInstantTypeRef.current !== null) {
      store.set("instantType", previousInstantTypeRef.current);
      previousInstantTypeRef.current = null;
    }
  }, [transitionStatus, isInstantPhase, lastOpenChangeReason, instantType, store]);
  useIsoLayoutEffect(() => {
    if (open) {
      if (activeTriggerId == null) {
        store.set("payload", void 0);
      }
    }
  }, [store, activeTriggerId, open]);
  React.useImperativeHandle(actionsRef, () => ({
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(imperativeAction))
  }), [forceUnmount, store]);
  const shouldRenderInteractions = open || mounted || !disabled$1 && trackCursorAxis !== "none";
  return /* @__PURE__ */ jsxs(TooltipRootContext.Provider, {
    value: store,
    children: [handle && /* @__PURE__ */ jsx(PopupHandleAttachment, {
      handle,
      store
    }), shouldRenderInteractions && /* @__PURE__ */ jsx(TooltipInteractions, {
      store,
      disabled: disabled$1,
      trackCursorAxis
    }), typeof children === "function" ? children({
      payload
    }) : children]
  });
});
if (process.env.NODE_ENV !== "production") TooltipRoot.displayName = "TooltipRoot";
function TooltipInteractions({
  store,
  disabled: disabled2,
  trackCursorAxis
}) {
  const floatingRootContext = store.useState("floatingRootContext");
  const dismiss = useDismiss(floatingRootContext, {
    enabled: !disabled2,
    referencePress: () => store.select("closeOnClick")
  });
  const clientPoint = useClientPoint(floatingRootContext, {
    enabled: !disabled2 && trackCursorAxis !== "none",
    axis: trackCursorAxis === "none" ? void 0 : trackCursorAxis
  });
  const triggerProps = React.useMemo(() => mergeProps(clientPoint.reference, dismiss.reference), [clientPoint.reference, dismiss.reference]);
  usePopupInteractionProps(store, {
    activeTriggerProps: triggerProps,
    inactiveTriggerProps: triggerProps,
    popupProps: dismiss.floating ?? EMPTY_OBJECT
  });
  return null;
}
const TooltipProviderContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") TooltipProviderContext.displayName = "TooltipProviderContext";
function useTooltipProviderContext() {
  return React.useContext(TooltipProviderContext);
}
const OPEN_DELAY = 600;
const TOOLTIP_TRIGGER_IDENTIFIER = "data-base-ui-tooltip-trigger";
function getTargetElement(event) {
  if ("composedPath" in event) {
    const path = event.composedPath();
    for (let i = 0; i < path.length; i += 1) {
      const element = path[i];
      if (isElement(element)) {
        return element;
      }
    }
  }
  const target = event.target;
  if (isElement(target)) {
    return target;
  }
  return null;
}
function closestEnabledTooltipTrigger(element) {
  let current = element;
  while (current) {
    const trigger = current.closest(`[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
    if (trigger) {
      return trigger;
    }
    const root = current.getRootNode();
    current = "host" in root && isElement(root.host) ? root.host : null;
  }
  return null;
}
const TooltipTrigger$1 = fastComponentRef(function TooltipTrigger(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    handle,
    payload,
    disabled: disabledProp,
    delay,
    closeOnClick = true,
    closeDelay,
    id: idProp,
    ...elementProps
  } = componentProps;
  const rootContext = useTooltipRootContext(true);
  const handleStore = usePopupHandleStore(handle);
  const store = handleStore ?? rootContext;
  if (!store) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle." : formatErrorMessage(82));
  }
  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = store.useState("isTriggerActive", thisTriggerId);
  const isOpenedByThisTrigger = store.useState("isOpenedByTrigger", thisTriggerId);
  const floatingRootContext = store.useState("floatingRootContext");
  const triggerElementRef = React.useRef(null);
  const closeDelayWithDefault = closeDelay ?? 0;
  const {
    registerTrigger,
    isMountedByThisTrigger
  } = useTriggerDataForwarding(thisTriggerId, triggerElementRef, store, {
    payload,
    closeOnClick,
    closeDelay: closeDelayWithDefault
  });
  const providerDelay = useTooltipProviderContext();
  const {
    activeIdRef,
    delayRef,
    isInstantPhase,
    hasProvider
  } = useDelayGroup(floatingRootContext, {
    open: isOpenedByThisTrigger
  });
  const hoverInteraction = useHoverInteractionSharedState(floatingRootContext);
  store.useSyncedValue("isInstantPhase", isInstantPhase);
  const rootDisabled = store.useState("disabled");
  const disabled2 = disabledProp ?? rootDisabled;
  const disabledRef = useValueAsRef(disabled2);
  const trackCursorAxis = store.useState("trackCursorAxis");
  const disableHoverablePopup = store.useState("disableHoverablePopup");
  const isNestedTriggerHoveredRef = React.useRef(false);
  const nestedTriggerOpenTimeout = useTimeout();
  const pointerTypeRef = React.useRef(void 0);
  function getOpenDelay() {
    if (hasProvider && activeIdRef.current != null) {
      return 0;
    }
    return delay ?? providerDelay ?? OPEN_DELAY;
  }
  function isEnabledNestedTriggerTarget(target) {
    const triggerEl = triggerElementRef.current;
    if (!triggerEl || !target) {
      return false;
    }
    const nearestTrigger = closestEnabledTooltipTrigger(target);
    return nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger);
  }
  function detectNestedTriggerHover(target) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);
    isNestedTriggerHoveredRef.current = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      hoverInteraction.openChangeTimeout.clear();
      hoverInteraction.restTimeout.clear();
      hoverInteraction.restTimeoutPending = false;
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }
  const hoverProps = useHoverReferenceInteraction(floatingRootContext, {
    enabled: !disabled2,
    mouseOnly: true,
    move: false,
    handleClose: !disableHoverablePopup && trackCursorAxis !== "both" ? safePolygon() : null,
    restMs: getOpenDelay,
    delay() {
      if (closeDelay == null && hasProvider) {
        return {
          close: getDelay(delayRef.current, "close")
        };
      }
      return {
        close: closeDelayWithDefault
      };
    },
    triggerElementRef,
    isActiveTrigger: isTriggerActive,
    isClosing: () => store.select("transitionStatus") === "ending",
    shouldOpen() {
      return !isNestedTriggerHoveredRef.current;
    }
  });
  const focusProps = useFocus(floatingRootContext, {
    enabled: !disabled2
  }).reference;
  const handleNestedTriggerHover = (event) => {
    const wasNestedTriggerHovered = isNestedTriggerHoveredRef.current;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = triggerElementRef.current;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);
    if (nestedTriggerHovered && store.select("open") && store.select("lastOpenChangeReason") === triggerHover) {
      store.setOpen(false, createChangeEventDetails(triggerHover, event));
      return;
    }
    if (wasNestedTriggerHovered && !nestedTriggerHovered && targetInsideTrigger && !disabledRef.current && !store.select("open") && triggerEl && // Match the hover hook's non-strict mouse fallback for mouse-only event sequences.
    isMouseLikePointerType(pointerTypeRef.current)) {
      const open = () => {
        if (!isNestedTriggerHoveredRef.current && !disabledRef.current && !store.select("open")) {
          store.setOpen(true, createChangeEventDetails(triggerHover, event, triggerEl));
        }
      };
      const openDelay = getOpenDelay();
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  };
  const rootTriggerProps = store.useState("triggerProps", isMountedByThisTrigger);
  const shouldApplyRootTriggerProps = isMountedByThisTrigger || trackCursorAxis !== "none";
  const state = {
    open: isOpenedByThisTrigger
  };
  const element = useRenderElement("button", componentProps, {
    state,
    ref: [forwardedRef, registerTrigger, triggerElementRef],
    props: [hoverProps, focusProps, shouldApplyRootTriggerProps ? rootTriggerProps : void 0, {
      onMouseOver(event) {
        handleNestedTriggerHover(event.nativeEvent);
      },
      onFocus(event) {
        if (isEnabledNestedTriggerTarget(getTargetElement(event.nativeEvent))) {
          event.preventBaseUIHandler();
        }
      },
      onMouseLeave() {
        isNestedTriggerHoveredRef.current = false;
        nestedTriggerOpenTimeout.clear();
        pointerTypeRef.current = void 0;
      },
      onPointerEnter(event) {
        pointerTypeRef.current = event.pointerType;
      },
      onPointerDown(event) {
        pointerTypeRef.current = event.pointerType;
        store.set("closeOnClick", closeOnClick);
        if (closeOnClick && !store.select("open")) {
          store.cancelPendingOpen(event.nativeEvent);
        }
      },
      onClick(event) {
        if (closeOnClick && !store.select("open")) {
          store.cancelPendingOpen(event.nativeEvent);
        }
      },
      id: thisTriggerId,
      [triggerDisabled]: disabled2 ? "" : void 0,
      [TOOLTIP_TRIGGER_IDENTIFIER]: disabled2 ? void 0 : ""
    }, elementProps],
    stateAttributesMapping: triggerOpenStateMapping
  });
  return element;
});
if (process.env.NODE_ENV !== "production") TooltipTrigger$1.displayName = "TooltipTrigger";
const TooltipPortalContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") TooltipPortalContext.displayName = "TooltipPortalContext";
function useTooltipPortalContext() {
  const value = React.useContext(TooltipPortalContext);
  if (value === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Tooltip.Portal> is missing." : formatErrorMessage(70));
  }
  return value;
}
const FloatingPortalLite = /* @__PURE__ */ React.forwardRef(function FloatingPortalLite2(componentProps, forwardedRef) {
  const {
    children,
    container,
    className,
    render,
    style,
    ...elementProps
  } = componentProps;
  const {
    node: portalNode,
    subtree: portalSubtree
  } = useFloatingPortalNode({
    container,
    ref: forwardedRef,
    componentProps,
    elementProps
  });
  if (!portalSubtree && !portalNode) {
    return null;
  }
  return /* @__PURE__ */ jsxs(React.Fragment, {
    children: [portalSubtree, portalNode && /* @__PURE__ */ ReactDOM.createPortal(children, portalNode)]
  });
});
if (process.env.NODE_ENV !== "production") FloatingPortalLite.displayName = "FloatingPortalLite";
const TooltipPortal = /* @__PURE__ */ React.forwardRef(function TooltipPortal2(props, forwardedRef) {
  const {
    keepMounted = false,
    ...portalProps
  } = props;
  const store = useTooltipRootContext();
  const mounted = store.useState("mounted");
  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }
  return /* @__PURE__ */ jsx(TooltipPortalContext.Provider, {
    value: keepMounted,
    children: /* @__PURE__ */ jsx(FloatingPortalLite, {
      ref: forwardedRef,
      ...portalProps
    })
  });
});
if (process.env.NODE_ENV !== "production") TooltipPortal.displayName = "TooltipPortal";
const TooltipPositionerContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") TooltipPositionerContext.displayName = "TooltipPositionerContext";
function useTooltipPositionerContext() {
  const context = React.useContext(TooltipPositionerContext);
  if (context === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>." : formatErrorMessage(71));
  }
  return context;
}
const TooltipPositioner = /* @__PURE__ */ React.forwardRef(function TooltipPositioner2(componentProps, forwardedRef) {
  const {
    render,
    className,
    anchor,
    positionMethod = "absolute",
    side = "top",
    align = "center",
    sideOffset = 0,
    alignOffset = 0,
    collisionBoundary = "clipping-ancestors",
    collisionPadding = 5,
    arrowPadding = 5,
    sticky = false,
    disableAnchorTracking = false,
    collisionAvoidance = POPUP_COLLISION_AVOIDANCE,
    style,
    ...elementProps
  } = componentProps;
  const store = useTooltipRootContext();
  const keepMounted = useTooltipPortalContext();
  const open = store.useState("open");
  const mounted = store.useState("mounted");
  const trackCursorAxis = store.useState("trackCursorAxis");
  const disableHoverablePopup = store.useState("disableHoverablePopup");
  const floatingRootContext = store.useState("floatingRootContext");
  const instantType = store.useState("instantType");
  const transitionStatus = store.useState("transitionStatus");
  const adaptiveOrigin = store.useState("adaptiveOrigin");
  const positioning = useAnchorPositioning({
    anchor,
    positionMethod,
    floatingRootContext,
    mounted,
    side,
    sideOffset,
    align,
    alignOffset,
    collisionBoundary,
    collisionPadding,
    sticky,
    arrowPadding,
    disableAnchorTracking,
    keepMounted,
    collisionAvoidance,
    adaptiveOrigin
  });
  const state = React.useMemo(() => ({
    open,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    instant: trackCursorAxis !== "none" ? "tracking-cursor" : instantType
  }), [open, positioning.side, positioning.align, positioning.anchorHidden, trackCursorAxis, instantType]);
  const element = usePositioner(componentProps, state, {
    styles: positioning.positionerStyles,
    transitionStatus,
    props: elementProps,
    refs: [forwardedRef, store.useStateSetter("positionerElement")],
    hidden: !mounted,
    inert: !open || trackCursorAxis === "both" || disableHoverablePopup
  });
  return /* @__PURE__ */ jsx(TooltipPositionerContext.Provider, {
    value: positioning,
    children: element
  });
});
if (process.env.NODE_ENV !== "production") TooltipPositioner.displayName = "TooltipPositioner";
const TooltipPopup = /* @__PURE__ */ React.forwardRef(function TooltipPopup2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    ...elementProps
  } = componentProps;
  const store = useTooltipRootContext();
  const {
    side,
    align
  } = useTooltipPositionerContext();
  const open = store.useState("open");
  const instantType = store.useState("instantType");
  const transitionStatus = store.useState("transitionStatus");
  const popupProps = store.useState("popupProps");
  const floatingContext = store.useState("floatingRootContext");
  const disabled2 = store.useState("disabled");
  const closeDelay = store.useState("closeDelay");
  useOpenChangeComplete({
    open,
    ref: store.context.popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    }
  });
  useHoverFloatingInteraction(floatingContext, {
    enabled: !disabled2,
    closeDelay
  });
  const setPopupElement = store.useStateSetter("popupElement");
  const state = {
    open,
    side,
    align,
    instant: instantType,
    transitionStatus
  };
  const element = useRenderElement("div", componentProps, {
    state,
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
    props: [FOCUSABLE_POPUP_PROPS, popupProps, getDisabledMountTransitionStyles(transitionStatus), elementProps],
    stateAttributesMapping: popupTransitionStateMapping
  });
  return element;
});
if (process.env.NODE_ENV !== "production") TooltipPopup.displayName = "TooltipPopup";
const TooltipArrow = /* @__PURE__ */ React.forwardRef(function TooltipArrow2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    ...elementProps
  } = componentProps;
  const store = useTooltipRootContext();
  const {
    arrowRef,
    side,
    align,
    arrowUncentered,
    arrowStyles
  } = useTooltipPositionerContext();
  const open = store.useState("open");
  const instantType = store.useState("instantType");
  const state = {
    open,
    side,
    align,
    uncentered: arrowUncentered,
    instant: instantType
  };
  const element = useRenderElement("div", componentProps, {
    state,
    ref: [forwardedRef, arrowRef],
    props: [{
      style: arrowStyles,
      "aria-hidden": true
    }, elementProps],
    stateAttributesMapping: popupStateMapping
  });
  return element;
});
if (process.env.NODE_ENV !== "production") TooltipArrow.displayName = "TooltipArrow";
function Tooltip({
  ...props
}) {
  return /* @__PURE__ */ jsx(TooltipRoot, { "data-hc-ui": "", "data-slot": "tooltip", ...props });
}
function TooltipTrigger2({
  ...props
}) {
  return /* @__PURE__ */ jsx(TooltipTrigger$1, { "data-hc-ui": "", "data-slot": "tooltip-trigger", ...props });
}
function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  positionerClassName,
  arrow = true,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsx(TooltipPortal, { children: /* @__PURE__ */ jsx(
    TooltipPositioner,
    {
      align,
      alignOffset,
      side,
      sideOffset,
      className: cn("hc-isolate hc-z-50", positionerClassName),
      children: /* @__PURE__ */ jsxs(
        TooltipPopup,
        {
          "data-hc-ui": "",
          "data-slot": "tooltip-content",
          className: cn(
            "hc-z-50 hc-inline-flex hc-w-fit hc-max-w-xs hc-origin-(--transform-origin) hc-items-center hc-gap-1.5 hc-rounded-md hc-bg-foreground hc-px-3 hc-py-1.5 hc-text-xs hc-text-background hc-has-data-[slot=kbd]:pr-1.5 hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=inline-end]:slide-in-from-left-2 hc-data-[side=inline-start]:slide-in-from-right-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-**:data-[slot=kbd]:relative hc-**:data-[slot=kbd]:isolate hc-**:data-[slot=kbd]:z-50 hc-**:data-[slot=kbd]:rounded-sm hc-data-[state=delayed-open]:animate-in hc-data-[state=delayed-open]:fade-in-0 hc-data-[state=delayed-open]:zoom-in-95 hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95",
            className
          ),
          ...props,
          children: [
            children,
            arrow && /* @__PURE__ */ jsx(TooltipArrow, { className: "hc-z-50 hc-size-2.5 hc-translate-y-[calc(-50%-2px)] hc-rotate-45 hc-rounded-[2px] hc-bg-foreground hc-fill-foreground hc-data-[side=bottom]:top-1 hc-data-[side=inline-end]:top-1/2! hc-data-[side=inline-end]:-left-1 hc-data-[side=inline-end]:-translate-y-1/2 hc-data-[side=inline-start]:top-1/2! hc-data-[side=inline-start]:-right-1 hc-data-[side=inline-start]:-translate-y-1/2 hc-data-[side=left]:top-1/2! hc-data-[side=left]:-right-1 hc-data-[side=left]:-translate-y-1/2 hc-data-[side=right]:top-1/2! hc-data-[side=right]:-left-1 hc-data-[side=right]:-translate-y-1/2 hc-data-[side=top]:-bottom-2.5" })
          ]
        }
      )
    }
  ) });
}
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SidebarContext = React.createContext(null);
function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}
function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open]
  );
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open2) => !open2) : setOpen((open2) => !open2);
  }, [isMobile, setOpen, setOpenMobile]);
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);
  const state = open ? "expanded" : "collapsed";
  const contextValue = React.useMemo(() => ({
    state,
    open,
    setOpen,
    isMobile,
    openMobile,
    setOpenMobile,
    toggleSidebar
  }), [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]);
  return /* @__PURE__ */ jsx(SidebarContext.Provider, { value: contextValue, children: /* @__PURE__ */ jsx(
    "div",
    {
      "data-hc-ui": "",
      "data-hc-surface": "toolbar",
      "data-slot": "sidebar-wrapper",
      style: {
        "--hc-sidebar-width": SIDEBAR_WIDTH,
        "--hc-sidebar-width-icon": SIDEBAR_WIDTH_ICON,
        ...style
      },
      className: cn(
        "hc-group/sidebar-wrapper hc-flex hc-min-h-svh hc-w-full hc-has-data-[variant=inset]:bg-background",
        className
      ),
      ...props,
      children
    }
  ) });
}
function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  dir,
  ...props
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  if (collapsible === "none") {
    return /* @__PURE__ */ jsx(
      "div",
      {
        "data-hc-ui": "",
        "data-slot": "sidebar",
        className: cn(
          "hc-flex hc-h-full hc-w-(--hc-sidebar-width) hc-flex-col hc-bg-[var(--hc-color-sidebar)] hc-text-foreground",
          className
        ),
        ...props,
        children
      }
    );
  }
  if (isMobile) {
    return /* @__PURE__ */ jsx(Sheet, { open: openMobile, onOpenChange: setOpenMobile, ...props, children: /* @__PURE__ */ jsxs(
      SheetContent,
      {
        dir,
        "data-sidebar": "sidebar",
        "data-hc-ui": "",
        "data-slot": "sidebar",
        "data-mobile": "true",
        className: "hc-w-(--hc-sidebar-width) hc-bg-[var(--hc-color-sidebar)] hc-p-0 hc-text-foreground hc-[&>button]:hidden",
        style: {
          "--hc-sidebar-width": SIDEBAR_WIDTH_MOBILE
        },
        side,
        children: [
          /* @__PURE__ */ jsxs(SheetHeader, { className: "hc-sr-only", children: [
            /* @__PURE__ */ jsx(SheetTitle, { children: "Sidebar" }),
            /* @__PURE__ */ jsx(SheetDescription, { children: "Displays the mobile sidebar." })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "hc-flex hc-h-full hc-w-full hc-flex-col", children })
        ]
      }
    ) });
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "hc-group hc-peer hc-hidden hc-text-foreground hc-md:block",
      "data-state": state,
      "data-collapsible": state === "collapsed" ? collapsible : "",
      "data-variant": variant,
      "data-side": side,
      "data-hc-ui": "",
      "data-slot": "sidebar",
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            "data-hc-ui": "",
            "data-slot": "sidebar-gap",
            className: cn(
              "hc-relative hc-w-(--hc-sidebar-width) hc-bg-transparent hc-transition-[width] hc-duration-200 hc-ease-linear",
              "hc-group-data-[collapsible=offcanvas]:w-0",
              "hc-group-data-[side=right]:rotate-180",
              variant === "floating" || variant === "inset" ? "hc-group-data-[collapsible=icon]:w-[calc(var(--hc-sidebar-width-icon)+(--hc-spacing(4)))]" : "hc-group-data-[collapsible=icon]:w-(--hc-sidebar-width-icon)"
            )
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            "data-hc-ui": "",
            "data-slot": "sidebar-container",
            "data-side": side,
            className: cn(
              "hc-fixed hc-inset-y-0 hc-z-10 hc-hidden hc-h-svh hc-w-(--hc-sidebar-width) hc-transition-[left,right,width] hc-duration-200 hc-ease-linear hc-data-[side=left]:left-0 hc-data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--hc-sidebar-width)*-1)] hc-data-[side=right]:right-0 hc-data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--hc-sidebar-width)*-1)] hc-md:flex",
              // Adjust the padding for floating and inset variants.
              variant === "floating" || variant === "inset" ? "hc-p-2 hc-group-data-[collapsible=icon]:w-[calc(var(--hc-sidebar-width-icon)+(--hc-spacing(4))+2px)]" : "hc-group-data-[collapsible=icon]:w-(--hc-sidebar-width-icon) hc-group-data-[side=left]:border-r hc-group-data-[side=right]:border-l",
              className
            ),
            ...props,
            children: /* @__PURE__ */ jsx(
              "div",
              {
                "data-sidebar": "sidebar",
                "data-hc-ui": "",
                "data-slot": "sidebar-inner",
                className: "hc-flex hc-size-full hc-flex-col hc-bg-[var(--hc-color-sidebar)] hc-group-data-[variant=floating]:rounded-lg hc-group-data-[variant=floating]:shadow-sm hc-group-data-[variant=floating]:ring-1 hc-group-data-[variant=floating]:ring-border",
                children
              }
            )
          }
        )
      ]
    }
  );
}
function SidebarInput({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Input,
    {
      "data-hc-ui": "",
      "data-slot": "sidebar-input",
      "data-sidebar": "input",
      className: cn("hc-h-8 hc-w-full hc-bg-background hc-shadow-none", className),
      ...props
    }
  );
}
function SidebarHeader({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-hc-ui": "",
      "data-slot": "sidebar-header",
      "data-sidebar": "header",
      className: cn("hc-flex hc-flex-col hc-gap-2 hc-p-2", className),
      ...props
    }
  );
}
function SidebarSeparator({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Separator,
    {
      "data-hc-ui": "",
      "data-slot": "sidebar-separator",
      "data-sidebar": "separator",
      className: cn("hc-mx-2 hc-w-auto hc-bg-border", className),
      ...props
    }
  );
}
function SidebarContent({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-hc-ui": "",
      "data-slot": "sidebar-content",
      "data-sidebar": "content",
      className: cn(
        "hc-no-scrollbar hc-flex hc-min-h-0 hc-flex-1 hc-flex-col hc-gap-0 hc-overflow-auto hc-group-data-[collapsible=icon]:overflow-hidden",
        className
      ),
      ...props
    }
  );
}
function SidebarMenu({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "ul",
    {
      "data-hc-ui": "",
      "data-slot": "sidebar-menu",
      "data-sidebar": "menu",
      className: cn("hc-m-0 hc-list-none hc-p-0 hc-flex hc-w-full hc-min-w-0 hc-flex-col hc-gap-0", className),
      ...props
    }
  );
}
function SidebarMenuItem({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "li",
    {
      "data-hc-ui": "",
      "data-slot": "sidebar-menu-item",
      "data-sidebar": "menu-item",
      className: cn("hc-group/menu-item hc-relative hc-m-0 hc-list-none hc-p-0", className),
      ...props
    }
  );
}
const sidebarMenuButtonVariants = cva(
  "hc-peer/menu-button hc-group/menu-button hc-flex hc-w-full hc-items-center hc-gap-2 hc-overflow-hidden hc-rounded-md hc-p-2 hc-text-left hc-text-sm hc-ring-ring hc-outline-hidden hc-transition-[width,height,padding] hc-group-has-data-[sidebar=menu-action]/menu-item:pr-8 hc-group-data-[collapsible=icon]:size-8! hc-group-data-[collapsible=icon]:p-2! hc-hover:bg-muted hc-hover:text-foreground hc-focus-visible:ring-2 hc-active:bg-muted hc-active:text-foreground hc-disabled:pointer-events-none hc-disabled:opacity-50 hc-aria-disabled:pointer-events-none hc-aria-disabled:opacity-50 hc-data-open:hover:bg-muted hc-data-open:hover:text-foreground hc-data-active:bg-muted hc-data-active:font-medium hc-data-active:text-foreground hc-[&_svg]:size-4 hc-[&_svg]:shrink-0 hc-[&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hc-hover:bg-muted hc-hover:text-foreground",
        outline: "hc-bg-background hc-shadow-[0_0_0_1px_var(--hc-color-border)] hc-hover:bg-muted hc-hover:text-foreground hc-hover:shadow-[0_0_0_1px_var(--hc-color-background-muted)]"
      },
      size: {
        default: "hc-h-8 hc-text-sm",
        sm: "hc-h-7 hc-text-xs",
        lg: "hc-h-12 hc-text-sm hc-group-data-[collapsible=icon]:p-0!"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}) {
  const { isMobile, state } = useSidebar();
  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps({
      className: cn(sidebarMenuButtonVariants({ variant, size }), className)
    }, props),
    render: !tooltip ? render : /* @__PURE__ */ jsx(TooltipTrigger2, { render }),
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive
    }
  });
  if (!tooltip) {
    return comp;
  }
  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip
    };
  }
  return /* @__PURE__ */ jsxs(Tooltip, { children: [
    comp,
    /* @__PURE__ */ jsx(
      TooltipContent,
      {
        side: "right",
        align: "center",
        hidden: state !== "collapsed" || isMobile,
        ...tooltip
      }
    )
  ] });
}
function normalizePath(pathname) {
  const path = typeof pathname === "string" ? pathname.split(/[?#]/, 1)[0] : "";
  const normalized = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "/" ? "/" : normalized;
}
function artifactRouteStorageKey(page) {
  if (!page || !["site", "prototype", "component"].includes(page.type)) return null;
  const identity = page.type === "site" ? page.siteId : page.id;
  if (typeof identity !== "string" || !identity) return null;
  return `hypercanvas:artifact:${page.type}:${encodeURIComponent(identity)}:last-route`;
}
function matchesArtifactRoute(page, pathname) {
  if (!page?.route || typeof pathname !== "string") return false;
  const root = normalizePath(page.route);
  const path = normalizePath(pathname);
  if (path === root) return true;
  return ["site", "prototype", "component"].includes(page.type) && root !== "/" && path.startsWith(`${root}/`);
}
function getArtifactRouteLocation(page, pathname, search = "", hash = "") {
  if (!matchesArtifactRoute(page, pathname)) return null;
  const root = normalizePath(page.route);
  const path = normalizePath(pathname);
  const subroute = path === root ? "" : path.slice(root.length);
  const params = new URLSearchParams(search || "");
  for (const key of ["_notebookPage", "edit", "rebind", "terminal"]) params.delete(key);
  const query = params.toString();
  return `${subroute}${query ? `?${query}` : ""}${hash || ""}`;
}
function buildArtifactRoute(page, savedRoute) {
  if (!page?.route) return null;
  const root = page.route.replace(/\/$/, "") || "/";
  if (typeof savedRoute !== "string" || !savedRoute.trim()) return page.route;
  const relative = savedRoute.trim();
  const path = relative.split(/[?#]/, 1)[0];
  if (path && (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))) return page.route;
  if (path.split("/").some((segment) => segment === "." || segment === "..")) return page.route;
  return `${root === "/" ? "" : root}${relative}` || "/";
}
const __iconNode$3 = [
  ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
  ["path", { d: "M19 12H5", key: "x3x0zl" }]
];
const ArrowLeft = createLucideIcon$1("arrow-left", __iconNode$3);
const __iconNode$2 = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
];
const ArrowRight = createLucideIcon$1("arrow-right", __iconNode$2);
const __iconNode$1 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
  ["path", { d: "M9 3v18", key: "fh3hqa" }]
];
const PanelLeft = createLucideIcon$1("panel-left", __iconNode$1);
const __iconNode = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
  ["path", { d: "M15 3v18", key: "14nvp0" }]
];
const PanelRight = createLucideIcon$1("panel-right", __iconNode);
function Breadcrumb({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "nav",
    {
      "aria-label": "breadcrumb",
      "data-hc-ui": "",
      "data-slot": "breadcrumb",
      className: cn(className),
      ...props
    }
  );
}
function BreadcrumbList({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "ol",
    {
      "data-hc-ui": "",
      "data-slot": "breadcrumb-list",
      className: cn(
        "hc-flex hc-flex-wrap hc-items-center hc-gap-1.5 hc-text-sm hc-wrap-break-word hc-text-muted-foreground hc-pl-0",
        className
      ),
      ...props
    }
  );
}
function BreadcrumbItem({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "li",
    {
      "data-hc-ui": "",
      "data-slot": "breadcrumb-item",
      className: cn("hc-inline-flex hc-items-center hc-gap-1", className),
      ...props
    }
  );
}
function BreadcrumbPage({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      "data-hc-ui": "",
      "data-slot": "breadcrumb-page",
      role: "link",
      "aria-disabled": "true",
      "aria-current": "page",
      className: cn("hc-font-normal hc-text-foreground", className),
      ...props
    }
  );
}
const shell = "_shell_8jkb4_3";
const sidebarProvider = "_sidebarProvider_8jkb4_14";
const shellClosed = "_shellClosed_8jkb4_22";
const sidebar = "_sidebar_8jkb4_14";
const notebookIcon = "_notebookIcon_8jkb4_45";
const content = "_content_8jkb4_48";
const contentArtifact = "_contentArtifact_8jkb4_49";
const artifactNavigation = "_artifactNavigation_8jkb4_50";
const artifactViewer = "_artifactViewer_8jkb4_51";
const reopenButton = "_reopenButton_8jkb4_53";
const shellOpen = "_shellOpen_8jkb4_61";
const chromeHidden = "_chromeHidden_8jkb4_80";
const css = {
  shell,
  sidebarProvider,
  shellClosed,
  sidebar,
  notebookIcon,
  content,
  contentArtifact,
  artifactNavigation,
  artifactViewer,
  reopenButton,
  shellOpen,
  chromeHidden
};
const recovery = "_recovery_164ij_1";
const portableCss = {
  recovery
};
const TYPE_SINGULAR = { prototype: "Prototype", canvas: "Canvas", component: "Component", site: "Site" };
const getStorage = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const setStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
};
function NotebookViewer({ catalog }) {
  const location = useLocation();
  const navigate = useNavigate();
  const localPrefKey = `hypercanvas:notebook:${catalog.notebookId}:sidebar`;
  const [open, setOpen] = useState(() => getStorage(localPrefKey, {}).open !== false);
  const [search, setSearch] = useState(() => getStorage(localPrefKey, {}).search || "");
  const view = resolveNotebookView(location.search);
  const hidden = !view.notebookVisible;
  const activePage = catalog.pages.find((page) => matchesArtifactRoute(page, location.pathname));
  const artifactPage = activePage && ["site", "prototype", "component"].includes(activePage.type) ? activePage : null;
  const [artifactHistory, setArtifactHistory] = useState({ entries: [], index: -1 });
  const navigationType = useNavigationType();
  const artifactHistoryLocation = `${location.pathname}${location.search || ""}${location.hash || ""}`;
  const saveOpen = (next) => {
    setOpen(next);
    setStorage(localPrefKey, { open: next, search });
  };
  const canGoBack = artifactHistory.index > 0;
  const canGoForward = artifactHistory.index >= 0 && artifactHistory.index < artifactHistory.entries.length - 1;
  const showNotebookUI = () => {
    const params = new URLSearchParams(location.search);
    params.delete("hideUI");
    const nextSearch = params.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "", hash: location.hash }, { replace: true, state: location.state });
  };
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.notebookSidebarOpen = String(open && !hidden);
    root.classList.toggle("sb-notebook-sidebar-open", open && !hidden && activePage?.type === "canvas");
    root.classList.toggle("sb-artifact-navigation-open", Boolean(artifactPage && !hidden));
    return () => {
      delete root.dataset.notebookSidebarOpen;
      root.classList.remove("sb-notebook-sidebar-open", "sb-artifact-navigation-open");
    };
  }, [open, hidden, activePage?.type, artifactPage]);
  useEffect(() => {
    window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ = catalog;
  }, [catalog]);
  if (artifactHistory.entries[artifactHistory.index]?.key !== location.key || artifactHistory.entries[artifactHistory.index]?.href !== artifactHistoryLocation) {
    const current = { key: location.key, href: artifactHistoryLocation };
    const previous = artifactHistory;
    let next;
    if (previous.index < 0) {
      next = { entries: [current], index: 0 };
    } else if (navigationType === "POP") {
      const found = previous.entries.findIndex((entry) => entry.key === current.key);
      const matchingHref = found >= 0 ? found : previous.entries.findIndex((entry) => entry.href === current.href);
      next = matchingHref >= 0 ? { entries: previous.entries.map((entry, index) => index === matchingHref ? current : entry), index: matchingHref } : { entries: [current], index: 0 };
    } else if (navigationType === "REPLACE") {
      const entries = [...previous.entries];
      entries[previous.index] = current;
      next = { ...previous, entries };
    } else if (previous.entries[previous.index]?.key !== current.key) {
      next = {
        entries: [...previous.entries.slice(0, previous.index + 1), current],
        index: previous.index + 1
      };
    } else {
      next = { ...previous, entries: previous.entries.map((entry, index) => index === previous.index ? current : entry) };
    }
    setArtifactHistory(next);
  }
  useEffect(() => {
    if (artifactPage && !view.embed) {
      const key = artifactRouteStorageKey(artifactPage);
      const route = getArtifactRouteLocation(artifactPage, location.pathname, location.search, location.hash);
      if (key && route !== null) setStorage(key, route);
    }
  }, [artifactHistoryLocation, artifactPage, location.key, location.pathname, location.search, location.hash, navigationType, view.embed]);
  const openPage = (page) => {
    const key = artifactRouteStorageKey(page);
    navigate(buildArtifactRoute(page, key ? getStorage(key, "") : "") || page.route);
    setStorage(`hypercanvas:notebook:${catalog.notebookId}:last-page`, page.id);
  };
  if (view.embed) return /* @__PURE__ */ jsx(Outlet, {});
  return /* @__PURE__ */ jsxs("div", { className: `${css.shell} ${open ? css.shellOpen : css.shellClosed} ${hidden ? css.chromeHidden : ""}`, children: [
    !hidden && /* @__PURE__ */ jsx(SidebarProvider, { className: `${css.sidebarProvider} hc-h-full hc-min-h-0`, open, onOpenChange: saveOpen, children: /* @__PURE__ */ jsxs(Sidebar, { className: css.sidebar, collapsible: "none", "aria-label": "Notebook pages", "aria-hidden": !open, children: [
      /* @__PURE__ */ jsxs(SidebarHeader, { className: css.sidebarHeader, children: [
        /* @__PURE__ */ jsx(SidebarMenu, { children: /* @__PURE__ */ jsx(SidebarMenuItem, { children: /* @__PURE__ */ jsxs(SidebarMenuButton, { size: "lg", className: css.notebookButton, disabled: true, children: [
          /* @__PURE__ */ jsx("span", { className: css.notebookIcon, "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("span", { children: catalog.title }),
          /* @__PURE__ */ jsx(ChevronDown, { className: "hc-ml-auto" })
        ] }) }) }),
        /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", "aria-label": "Close notebook sidebar", onClick: () => saveOpen(false), children: "‹" })
      ] }),
      /* @__PURE__ */ jsx(SidebarSeparator, { className: css.sidebarDivider }),
      getFlag("notebook-sidebar-search") && /* @__PURE__ */ jsx(SidebarInput, { "aria-label": "Search pages", type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search pages…", className: css.sidebarSearch }),
      /* @__PURE__ */ jsx(SidebarContent, { className: css.pageNavigation, role: "navigation", "aria-label": "Primary pages", children: /* @__PURE__ */ jsx(NotebookSidebarTree, { tree: catalog.tree, pages: catalog.pages, sites: catalog.sites, diagnostics: catalog.diagnostics, activePageId: activePage?.id, published: true, search, onOpenPage: openPage }) })
    ] }) }),
    !hidden && !open && !artifactPage && /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", className: css.reopenButton, "aria-label": "Open notebook sidebar", onClick: () => saveOpen(true), children: /* @__PURE__ */ jsx("span", { className: css.notebookIcon, "aria-hidden": "true" }) }),
    hidden && view.recoveryAvailable && /* @__PURE__ */ jsx(Button, { className: portableCss.recovery, "aria-label": "Show Notebook UI", onClick: showNotebookUI, children: /* @__PURE__ */ jsx(PanelRight, { size: 17 }) }),
    /* @__PURE__ */ jsxs("main", { className: `${css.content} ${artifactPage ? css.contentArtifact : ""}`, children: [
      !hidden && artifactPage && activePage?.available !== false && /* @__PURE__ */ jsxs("div", { className: css.artifactNavigation, "aria-label": `${TYPE_SINGULAR[artifactPage.type] || "Artifact"} navigation`, children: [
        /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", className: css.artifactSidebarToggle, onClick: () => saveOpen(!open), "aria-label": open ? "Close notebook sidebar" : "Open notebook sidebar", title: open ? "Close sidebar" : "Open sidebar", children: open ? /* @__PURE__ */ jsx(PanelLeft, { size: 17 }) : /* @__PURE__ */ jsx(PanelRight, { size: 17 }) }),
        /* @__PURE__ */ jsx(Breadcrumb, { className: css.artifactTitle, children: /* @__PURE__ */ jsx(BreadcrumbList, { children: /* @__PURE__ */ jsx(BreadcrumbItem, { children: /* @__PURE__ */ jsx(BreadcrumbPage, { children: artifactPage.title || artifactPage.id }) }) }) }),
        /* @__PURE__ */ jsxs("div", { className: css.artifactNavigationActions, children: [
          /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", "aria-label": "Back", title: "Back", disabled: !canGoBack, onClick: () => navigate(-1), children: /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }) }),
          /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", "aria-label": "Forward", title: "Forward", disabled: !canGoForward, onClick: () => navigate(1), children: /* @__PURE__ */ jsx(ArrowRight, { size: 16 }) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: artifactPage ? css.artifactViewer : void 0, children: /* @__PURE__ */ jsx(Outlet, {}) })
    ] })
  ] });
}
export {
  NotebookViewer as default
};
