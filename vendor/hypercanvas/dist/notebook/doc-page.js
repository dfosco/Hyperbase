import * as runtime from "react/jsx-runtime";
import { jsx, jsxs } from "react/jsx-runtime";
import * as React from "react";
import { createContext, useRef, useState, useSyncExternalStore, useLayoutEffect, useCallback, useEffect, useMemo, useContext, isValidElement, cloneElement } from "react";
import { useParams, useLocation } from "react-router-dom";
import * as documents from "virtual:hypercanvas-documents";
import { g as getWidgetSurfaceCatalog, C as CanvasWidget, S as Site, P as Prototype, I as Image$1, d as documentCss, D as DocumentContent, a as DocumentContext, b as Document } from "./chunks/Document-DbLUnVhy.js";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./chunks/tooltip-content-CaxwY_7M.js";
import { s as setDynamicActions, c as clearDynamicActions } from "./chunks/commandActions-CvE2nUEH.js";
import { s as subscribeToWidgetRegistry, g as getWidgetRegistrySnapshot } from "./chunks/widgetRegistry-CmXYjxwi.js";
import { I as Icon } from "./chunks/Icon-I4lR4N0q.js";
import { u as useHoverReferenceInteraction, s as safePolygon, a as useAnchorPositioning, b as usePositioner, c as useHoverFloatingInteraction, g as getDisabledMountTransitionStyles, C as CanvasToolsSurface, d as CanvasToolsGroup, e as CanvasToolButton, f as CanvasToolsPopup, I as Input, h as CanvasToolMenuItem, B as Button, i as CanvasToolMenuLabel } from "./chunks/CanvasToolsPresentation-CgLIau-Y.js";
import { c as createLucideIcon, a as cn } from "./chunks/button-Bi0ciDEN.js";
import { C as ChevronDown } from "./chunks/chevron-down-D7UtqrIn.js";
import { u as useTriggerFocusGuards, a as useAnchoredPopupScrollLock, b as useToolbarRootContext, c as useSelectRootContext, d as useSelectRootPropsContext, e as useSelectPositionerContext, L as LIST_FUNCTIONAL_STYLES, s as styleDisableScrollbar, g as getMaxScrollOffset, n as normalizeScrollOffset, S as SCROLL_EDGE_TOLERANCE_PX, f as SelectRoot, h as SelectTrigger$1, i as SelectIcon, j as SelectValue$1, k as SelectPortal, l as SelectPositioner, m as SelectPopup, o as SelectItem$1, p as SelectItemText, q as SelectItemIndicator } from "./chunks/SelectItemText-D9UPRV0P.js";
import { f as formatErrorMessage, R as ReactStore, t as triggerHover, a as triggerPress, e as escapeKey, b as attachPreventUnmountOnClose, c as closePress, P as PATIENT_CLICK_THRESHOLD, d as focusOut, g as createPopupOpenState, T as Timeout, F as FloatingTree, h as fastComponent, u as usePopupRootSync, i as useImplicitActiveTrigger, j as useOpenStateTransitions, k as createChangeEventDetails, l as imperativeAction, m as PopupHandleAttachment, n as usePopupRootStore, o as usePopupInteractionProps, p as fastComponentRef, q as usePopupHandleStore, r as useBaseUiId, s as useTriggerDataForwarding, v as useButton, w as useRenderElement, C as CLICK_TRIGGER_IDENTIFIER, x as FocusGuard, y as pressableTriggerOpenStateMapping, z as triggerOpenStateMapping, A as FloatingPortal, B as POPUP_COLLISION_AVOIDANCE, D as useFloatingNodeId, E as useAnimationsFinished, G as useIsoLayoutEffect, I as InternalBackdrop, H as inertValue, J as FloatingNode, K as useStableCallback, L as useOpenChangeComplete, M as createDefaultInitialFocus, N as FOCUSABLE_POPUP_PROPS, O as popupTransitionStateMapping, Q as COMPOSITE_KEYS, S as FloatingFocusManager, U as isHTMLElement, V as useTimeout, W as useTransitionStatus, X as transitionStatusMapping } from "./chunks/composite-z4dIV_BK.js";
import { u as uploadImage } from "./chunks/canvasApi-HT5Txujd.js";
import * as ReactDOM from "react-dom";
import { p as popupStoreSelectors, c as createInitialPopupStoreState, P as PopupTriggerMap, u as useDismiss } from "./chunks/useScrollLock-DWfGfMje.js";
import { u as useClick, a as useOpenMethodTriggerProps } from "./chunks/useOpenInteractionType-B_v65zSf.js";
import { c as createDocumentResolvers } from "./chunks/resolvers-CjNPHTkb.js";
const page = "_page_8dmqw_1";
const styles = {
  page
};
const __iconData$c = {
  name: "arrow-down",
  size: 24,
  node: [
    ["path", { d: "M12 5v14", key: "s699le" }],
    ["path", { d: "m19 12-7 7-7-7", key: "1idqje" }]
  ]
};
__iconData$c.node;
const ArrowDown = createLucideIcon(__iconData$c);
const __iconData$b = {
  name: "arrow-up",
  size: 24,
  node: [
    ["path", { d: "m5 12 7-7 7 7", key: "hav0vg" }],
    ["path", { d: "M12 19V5", key: "x0mq9r" }]
  ]
};
__iconData$b.node;
const ArrowUp = createLucideIcon(__iconData$b);
const __iconData$a = {
  name: "check",
  size: 24,
  node: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]
};
__iconData$a.node;
const Check = createLucideIcon(__iconData$a);
const __iconData$9 = {
  name: "chevron-up",
  size: 24,
  node: [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]]
};
__iconData$9.node;
const ChevronUp = createLucideIcon(__iconData$9);
const __iconData$8 = {
  name: "file-code-corner",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M4 12.15V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3.35",
        key: "1wthlu"
      }
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
    ["path", { d: "m5 16-3 3 3 3", key: "331omg" }],
    ["path", { d: "m9 22 3-3-3-3", key: "lsp7cz" }]
  ],
  aliases: ["file-code-2"]
};
__iconData$8.node;
const FileCodeCorner = createLucideIcon(__iconData$8);
const __iconData$7 = {
  name: "file-text",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
        key: "1oefj6"
      }
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
    ["path", { d: "M10 9H8", key: "b1mrlr" }],
    ["path", { d: "M16 13H8", key: "t4e002" }],
    ["path", { d: "M16 17H8", key: "z1uh3a" }]
  ]
};
__iconData$7.node;
const FileText = createLucideIcon(__iconData$7);
const __iconData$6 = {
  name: "grip-vertical",
  size: 24,
  node: [
    ["circle", { cx: "9", cy: "12", r: "1", key: "1vctgf" }],
    ["circle", { cx: "9", cy: "5", r: "1", key: "hp0tcf" }],
    ["circle", { cx: "9", cy: "19", r: "1", key: "fkjjf6" }],
    ["circle", { cx: "15", cy: "12", r: "1", key: "1tmaij" }],
    ["circle", { cx: "15", cy: "5", r: "1", key: "19l28e" }],
    ["circle", { cx: "15", cy: "19", r: "1", key: "f4zoj3" }]
  ]
};
__iconData$6.node;
const GripVertical = createLucideIcon(__iconData$6);
const __iconData$5 = {
  name: "pencil",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu"
      }
    ],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
  ]
};
__iconData$5.node;
const Pencil = createLucideIcon(__iconData$5);
const __iconData$4 = {
  name: "redo-2",
  size: 24,
  node: [
    ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
    ["path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13", key: "6uklza" }]
  ]
};
__iconData$4.node;
const Redo2 = createLucideIcon(__iconData$4);
const __iconData$3 = {
  name: "settings-2",
  size: 24,
  node: [
    ["path", { d: "M14 17H5", key: "gfn3mx" }],
    ["path", { d: "M19 7h-9", key: "6i9tg" }],
    ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
    ["circle", { cx: "7", cy: "7", r: "3", key: "dfmy0x" }]
  ]
};
__iconData$3.node;
const Settings2 = createLucideIcon(__iconData$3);
const __iconData$2 = {
  name: "sparkles",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
        key: "1s2grr"
      }
    ],
    ["path", { d: "M20 2v4", key: "1rf3ol" }],
    ["path", { d: "M22 4h-4", key: "gwowj6" }],
    ["circle", { cx: "4", cy: "20", r: "2", key: "6kqj1y" }]
  ],
  aliases: ["stars"]
};
__iconData$2.node;
const Sparkles = createLucideIcon(__iconData$2);
const __iconData$1 = {
  name: "trash",
  size: 24,
  node: [
    ["path", { d: "M10 11v6", key: "nco0om" }],
    ["path", { d: "M14 11v6", key: "outv1u" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }]
  ],
  aliases: ["trash-2"]
};
__iconData$1.node;
const Trash = createLucideIcon(__iconData$1);
const __iconData = {
  name: "undo-2",
  size: 24,
  node: [
    ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
    ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
  ]
};
__iconData.node;
const Undo2 = createLucideIcon(__iconData);
const PopoverRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") PopoverRootContext.displayName = "PopoverRootContext";
function usePopoverRootContext(optional) {
  const context = React.useContext(PopoverRootContext);
  if (context === void 0 && !optional) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>." : formatErrorMessage(47));
  }
  return context;
}
const selectors = {
  ...popupStoreSelectors,
  disabled: (state) => state.disabled,
  instantType: (state) => state.instantType,
  openMethod: (state) => state.openMethod,
  openChangeReason: (state) => state.openChangeReason,
  modal: (state) => state.modal,
  focusManagerModal: (state) => state.focusManagerModal,
  stickIfOpen: (state) => state.stickIfOpen,
  titleElementId: (state) => state.titleElementId,
  descriptionElementId: (state) => state.descriptionElementId,
  openOnHover: (state) => state.openOnHover,
  closeDelay: (state) => state.closeDelay,
  adaptiveOrigin: (state) => state.adaptiveOrigin
};
class PopoverStore extends ReactStore {
  constructor(initialState, floatingId, nested) {
    const triggerElements = new PopupTriggerMap();
    super(createInitialState(initialState, triggerElements, floatingId, nested), createInitialContext(triggerElements), selectors);
  }
  setOpen = (nextOpen, eventDetails) => {
    const isHover = eventDetails.reason === triggerHover;
    const isKeyboardClick = eventDetails.reason === triggerPress && eventDetails.event.detail === 0;
    const isDismissClose = !nextOpen && (eventDetails.reason === escapeKey || eventDetails.reason == null);
    const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);
    const activeTriggerId = this.select("activeTriggerId");
    if (!nextOpen && eventDetails.reason === closePress && eventDetails.trigger == null && activeTriggerId != null) {
      eventDetails.trigger = this.context.triggerElements.getById(activeTriggerId) ?? this.select("activeTriggerElement") ?? void 0;
    }
    this.context.onOpenChange?.(nextOpen, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    this.state.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);
    const changeState = () => {
      const popupOpenState = createPopupOpenState(this.state, nextOpen, eventDetails.trigger, shouldPreventUnmountOnClose());
      popupOpenState.openChangeReason = eventDetails.reason;
      this.update(popupOpenState);
    };
    if (isHover) {
      this.set("stickIfOpen", true);
      this.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        this.set("stickIfOpen", false);
      });
      ReactDOM.flushSync(changeState);
    } else {
      changeState();
    }
    let instantType;
    if (isKeyboardClick) {
      instantType = "click";
    } else if (isDismissClose) {
      instantType = "dismiss";
    } else if (eventDetails.reason === focusOut) {
      instantType = "focus";
    }
    this.set("instantType", instantType);
  };
}
function createInitialState(initialState, triggerElements, floatingId, nested = false) {
  const state = {
    ...createInitialPopupStoreState(triggerElements, floatingId, nested),
    disabled: false,
    modal: false,
    focusManagerModal: false,
    instantType: void 0,
    openMethod: null,
    openChangeReason: null,
    titleElementId: void 0,
    descriptionElementId: void 0,
    stickIfOpen: true,
    openOnHover: false,
    closeDelay: 0,
    adaptiveOrigin: void 0,
    ...initialState
  };
  if (state.open && initialState?.mounted === void 0) {
    state.mounted = true;
  }
  return state;
}
function createInitialContext(triggerElements) {
  return {
    popupRef: /* @__PURE__ */ React.createRef(),
    onOpenChange: void 0,
    onOpenChangeComplete: void 0,
    triggerFocusTargetRef: /* @__PURE__ */ React.createRef(),
    beforeContentFocusGuardRef: /* @__PURE__ */ React.createRef(),
    stickIfOpenTimeout: new Timeout(),
    triggerElements
  };
}
const PopoverRootComponent = fastComponent(function PopoverRootComponent2({
  props
}) {
  const {
    children,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    onOpenChangeComplete,
    modal = false,
    handle,
    triggerId: triggerIdProp,
    defaultTriggerId: defaultTriggerIdProp = null
  } = props;
  const store = usePopoverRootStore(handle, {
    modal,
    open: defaultOpen,
    openProp,
    activeTriggerId: defaultTriggerIdProp,
    triggerIdProp
  });
  store.useControlledProp("openProp", openProp);
  store.useControlledProp("triggerIdProp", triggerIdProp);
  const open = store.useState("open");
  const mounted = store.useState("mounted");
  const payload = store.useState("payload");
  store.useContextCallback("onOpenChange", onOpenChange);
  store.useContextCallback("onOpenChangeComplete", onOpenChangeComplete);
  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const {
    forceUnmount
  } = useOpenStateTransitions(open, store, () => {
    store.update({
      stickIfOpen: true,
      openChangeReason: null
    });
  });
  store.useSyncedValues({
    modal
  });
  React.useEffect(() => {
    if (!open) {
      store.context.stickIfOpenTimeout.clear();
    }
  }, [store, open]);
  React.useImperativeHandle(props.actionsRef, () => ({
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(imperativeAction))
  }), [forceUnmount, store]);
  const shouldRenderInteractions = open || mounted;
  return /* @__PURE__ */ jsxs(PopoverRootContext.Provider, {
    value: store,
    children: [handle && /* @__PURE__ */ jsx(PopupHandleAttachment, {
      handle,
      store
    }), shouldRenderInteractions && /* @__PURE__ */ jsx(PopoverInteractions, {
      store,
      modal
    }), typeof children === "function" ? children({
      payload
    }) : children]
  });
});
if (process.env.NODE_ENV !== "production") PopoverRootComponent.displayName = "PopoverRootComponent";
function PopoverRoot(props) {
  if (usePopoverRootContext(true)) {
    return /* @__PURE__ */ jsx(PopoverRootComponent, {
      props
    });
  }
  return /* @__PURE__ */ jsx(FloatingTree, {
    children: /* @__PURE__ */ jsx(PopoverRootComponent, {
      props
    })
  });
}
function usePopoverRootStore(handle, initialState) {
  const store = usePopupRootStore((floatingId, nested) => new PopoverStore(initialState, floatingId, nested));
  React.useEffect(() => store.context.stickIfOpenTimeout.disposeEffect(), [store]);
  return store;
}
function PopoverInteractions({
  store,
  modal
}) {
  const floatingRootContext = store.useState("floatingRootContext");
  const dismiss = useDismiss(floatingRootContext, {
    outsidePressEvent: {
      // Ensure `aria-hidden` on outside elements is removed immediately
      // on outside press when trapping focus.
      mouse: modal === "trap-focus" ? "sloppy" : "intentional",
      touch: "sloppy"
    }
  });
  const triggerProps = dismiss.reference;
  const popupProps = dismiss.floating;
  usePopupInteractionProps(store, {
    activeTriggerProps: triggerProps,
    inactiveTriggerProps: triggerProps,
    popupProps
  });
  return null;
}
const OPEN_DELAY = 300;
const PopoverTrigger = fastComponentRef(function PopoverTrigger2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    disabled = false,
    nativeButton = true,
    handle,
    payload,
    openOnHover = false,
    delay = OPEN_DELAY,
    closeDelay = 0,
    id: idProp,
    ...elementProps
  } = componentProps;
  const rootStore = usePopoverRootContext(true);
  const handleStore = usePopupHandleStore(handle);
  const store = handleStore ?? rootStore;
  if (!store) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle." : formatErrorMessage(74));
  }
  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = store.useState("isTriggerActive", thisTriggerId);
  const floatingContext = store.useState("floatingRootContext");
  const isOpenedByThisTrigger = store.useState("isOpenedByTrigger", thisTriggerId);
  const popupId = store.useState("triggerPopupId", thisTriggerId);
  const triggerElementRef = React.useRef(null);
  const {
    registerTrigger,
    isMountedByThisTrigger
  } = useTriggerDataForwarding(thisTriggerId, triggerElementRef, store, {
    payload,
    disabled,
    openOnHover,
    closeDelay
  });
  const openReason = store.useState("openChangeReason");
  const stickIfOpen = store.useState("stickIfOpen");
  const openMethod = store.useState("openMethod");
  const focusManagerModal = store.useState("focusManagerModal");
  const hoverProps = useHoverReferenceInteraction(floatingContext, {
    enabled: !disabled && openOnHover && (openMethod !== "touch" || openReason !== triggerPress),
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
    restMs: delay,
    delay: {
      close: closeDelay
    },
    triggerElementRef,
    isActiveTrigger: isTriggerActive,
    isClosing: () => store.select("transitionStatus") === "ending"
  });
  const click = useClick(floatingContext, {
    stickIfOpen
  });
  const interactionTypeProps = useOpenMethodTriggerProps(() => store.select("open"), (interactionType) => {
    store.set("openMethod", interactionType);
  });
  const rootTriggerProps = store.useState("triggerProps", isMountedByThisTrigger);
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled,
    native: nativeButton
  });
  const stateAttributesMapping = {
    open(value) {
      if (value && openReason === triggerPress) {
        return pressableTriggerOpenStateMapping.open(value);
      }
      return triggerOpenStateMapping.open(value);
    }
  };
  const {
    preFocusGuardRef,
    handlePreFocusGuardFocus,
    handleFocusTargetFocus
  } = useTriggerFocusGuards(store, triggerElementRef);
  const state = {
    disabled,
    open: isOpenedByThisTrigger
  };
  const element = useRenderElement("button", componentProps, {
    state,
    ref: [buttonRef, forwardedRef, registerTrigger, triggerElementRef],
    props: [click.reference, hoverProps, rootTriggerProps, interactionTypeProps, {
      [CLICK_TRIGGER_IDENTIFIER]: "",
      id: thisTriggerId,
      "aria-haspopup": "dialog",
      "aria-expanded": isOpenedByThisTrigger,
      "aria-controls": popupId
    }, elementProps, getButtonProps],
    stateAttributesMapping
  });
  const keyedElement = /* @__PURE__ */ jsx(React.Fragment, {
    children: element
  }, thisTriggerId);
  if (isMountedByThisTrigger && !focusManagerModal) {
    return /* @__PURE__ */ jsxs(React.Fragment, {
      children: [/* @__PURE__ */ jsx(FocusGuard, {
        ref: preFocusGuardRef,
        onFocus: handlePreFocusGuardFocus
      }), keyedElement, /* @__PURE__ */ jsx(FocusGuard, {
        ref: store.context.triggerFocusTargetRef,
        onFocus: handleFocusTargetFocus
      })]
    });
  }
  return keyedElement;
});
if (process.env.NODE_ENV !== "production") PopoverTrigger.displayName = "PopoverTrigger";
const PopoverPortalContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") PopoverPortalContext.displayName = "PopoverPortalContext";
function usePopoverPortalContext() {
  const value = React.useContext(PopoverPortalContext);
  if (value === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Popover.Portal> is missing." : formatErrorMessage(45));
  }
  return value;
}
const PopoverPortal = /* @__PURE__ */ React.forwardRef(function PopoverPortal2(props, forwardedRef) {
  const {
    keepMounted = false,
    ...portalProps
  } = props;
  const store = usePopoverRootContext();
  const mounted = store.useState("mounted");
  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }
  return /* @__PURE__ */ jsx(PopoverPortalContext.Provider, {
    value: keepMounted,
    children: /* @__PURE__ */ jsx(FloatingPortal, {
      ref: forwardedRef,
      ...portalProps
    })
  });
});
if (process.env.NODE_ENV !== "production") PopoverPortal.displayName = "PopoverPortal";
const PopoverPositionerContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") PopoverPositionerContext.displayName = "PopoverPositionerContext";
function usePopoverPositionerContext() {
  const context = React.useContext(PopoverPositionerContext);
  if (!context) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>." : formatErrorMessage(46));
  }
  return context;
}
const PopoverPositioner = /* @__PURE__ */ React.forwardRef(function PopoverPositioner2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    anchor,
    // `useAnchorPositioning` applies the same defaults to the undefined values; the names
    // remain destructured to exclude the props from `elementProps`.
    positionMethod,
    side,
    align,
    sideOffset,
    alignOffset,
    collisionBoundary = "clipping-ancestors",
    collisionPadding,
    arrowPadding,
    sticky,
    disableAnchorTracking = false,
    collisionAvoidance = POPUP_COLLISION_AVOIDANCE,
    ...elementProps
  } = componentProps;
  const store = usePopoverRootContext();
  const keepMounted = usePopoverPortalContext();
  const nodeId = useFloatingNodeId();
  const floatingRootContext = store.useState("floatingRootContext");
  const mounted = store.useState("mounted");
  const open = store.useState("open");
  const openReason = store.useState("openChangeReason");
  const triggerElement = store.useState("activeTriggerElement");
  const modal = store.useState("modal");
  const openMethod = store.useState("openMethod");
  const positionerElement = store.useState("positionerElement");
  const instantType = store.useState("instantType");
  const transitionStatus = store.useState("transitionStatus");
  const adaptiveOrigin = store.useState("adaptiveOrigin");
  const prevTriggerElementRef = React.useRef(null);
  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);
  const positioning = useAnchorPositioning({
    anchor,
    floatingRootContext,
    positionMethod,
    mounted,
    side,
    sideOffset,
    align,
    alignOffset,
    arrowPadding,
    collisionBoundary,
    collisionPadding,
    sticky,
    disableAnchorTracking,
    keepMounted,
    nodeId,
    collisionAvoidance,
    adaptiveOrigin
  });
  const domReference = floatingRootContext.useState("domReferenceElement");
  useIsoLayoutEffect(() => {
    const currentTriggerElement = domReference;
    const prevTriggerElement = prevTriggerElementRef.current;
    if (currentTriggerElement) {
      prevTriggerElementRef.current = currentTriggerElement;
    }
    if (prevTriggerElement && currentTriggerElement && currentTriggerElement !== prevTriggerElement) {
      store.set("instantType", void 0);
      const ac = new AbortController();
      runOnceAnimationsFinish(() => {
        store.set("instantType", "trigger-change");
      }, ac.signal);
      return () => {
        ac.abort();
      };
    }
    return void 0;
  }, [domReference, runOnceAnimationsFinish, store]);
  const trueModalNonHover = modal === true && openReason !== triggerHover;
  useAnchoredPopupScrollLock(open && trueModalNonHover, openMethod === "touch", positionerElement, triggerElement);
  const setPositionerElement = store.useStateSetter("positionerElement");
  const state = {
    open,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    instant: instantType
  };
  const element = usePositioner(componentProps, state, {
    styles: positioning.positionerStyles,
    transitionStatus,
    props: elementProps,
    refs: [forwardedRef, setPositionerElement],
    hidden: !mounted,
    inert: !open
  });
  return /* @__PURE__ */ jsxs(PopoverPositionerContext.Provider, {
    value: positioning,
    children: [mounted && trueModalNonHover && /* @__PURE__ */ jsx(InternalBackdrop, {
      inert: inertValue(!open),
      cutout: triggerElement
    }), /* @__PURE__ */ jsx(FloatingNode, {
      id: nodeId,
      children: element
    })]
  });
});
if (process.env.NODE_ENV !== "production") PopoverPositioner.displayName = "PopoverPositioner";
const ClosePartContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") ClosePartContext.displayName = "ClosePartContext";
function useClosePartCount() {
  const [closePartCount, setClosePartCount] = React.useState(0);
  const register = useStableCallback(() => {
    setClosePartCount((count) => count + 1);
    return () => {
      setClosePartCount((count) => Math.max(0, count - 1));
    };
  });
  const context = React.useMemo(() => ({
    register
  }), [register]);
  return {
    context,
    hasClosePart: closePartCount > 0
  };
}
const PopoverPopup = /* @__PURE__ */ React.forwardRef(function PopoverPopup2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    initialFocus,
    finalFocus,
    ...elementProps
  } = componentProps;
  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();
  const insideToolbar = useToolbarRootContext() != null;
  const {
    context: closePartContext,
    hasClosePart
  } = useClosePartCount();
  const open = store.useState("open");
  const openMethod = store.useState("openMethod");
  const instantType = store.useState("instantType");
  const transitionStatus = store.useState("transitionStatus");
  const popupProps = store.useState("popupProps");
  const titleId = store.useState("titleElementId");
  const descriptionId = store.useState("descriptionElementId");
  const modal = store.useState("modal");
  const mounted = store.useState("mounted");
  const openReason = store.useState("openChangeReason");
  const activeTriggerElement = store.useState("activeTriggerElement");
  const floatingContext = store.useState("floatingRootContext");
  const floatingId = floatingContext.useState("floatingId");
  const disabled = store.useState("disabled");
  const openOnHover = store.useState("openOnHover");
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
    enabled: openOnHover && !disabled,
    closeDelay
  });
  const resolvedInitialFocus = initialFocus === void 0 ? createDefaultInitialFocus(store.context.popupRef) : initialFocus;
  const focusManagerModal = modal !== false && hasClosePart;
  store.useSyncedValue("focusManagerModal", focusManagerModal);
  const setPopupElement = store.useStateSetter("popupElement");
  const state = {
    open,
    side: positioner.side,
    align: positioner.align,
    instant: instantType,
    transitionStatus
  };
  const element = useRenderElement("div", componentProps, {
    state,
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
    props: [popupProps, {
      id: floatingId,
      role: "dialog",
      ...FOCUSABLE_POPUP_PROPS,
      "aria-labelledby": titleId,
      "aria-describedby": descriptionId,
      onKeyDown(event) {
        if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      }
    }, getDisabledMountTransitionStyles(transitionStatus), elementProps],
    stateAttributesMapping: popupTransitionStateMapping
  });
  return /* @__PURE__ */ jsx(FloatingFocusManager, {
    context: floatingContext,
    openInteractionType: openMethod,
    modal: focusManagerModal,
    disabled: !mounted || openReason === triggerHover,
    initialFocus: resolvedInitialFocus,
    returnFocus: finalFocus,
    restoreFocus: "popup",
    previousFocusableElement: isHTMLElement(activeTriggerElement) ? activeTriggerElement : void 0,
    nextFocusableElement: store.context.triggerFocusTargetRef,
    beforeContentFocusGuardRef: store.context.beforeContentFocusGuardRef,
    children: /* @__PURE__ */ jsx(ClosePartContext.Provider, {
      value: closePartContext,
      children: element
    })
  });
});
if (process.env.NODE_ENV !== "production") PopoverPopup.displayName = "PopoverPopup";
const PopoverTitle = /* @__PURE__ */ React.forwardRef(function PopoverTitle2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    ...elementProps
  } = componentProps;
  const store = usePopoverRootContext();
  const id = useBaseUiId(elementProps.id);
  store.useSyncedValueWithCleanup("titleElementId", id);
  const element = useRenderElement("h2", componentProps, {
    ref: forwardedRef,
    props: [{
      id
    }, elementProps]
  });
  return element;
});
if (process.env.NODE_ENV !== "production") PopoverTitle.displayName = "PopoverTitle";
function isDocOperation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const operation = value;
  const handle = typeof operation.handle === "string" && operation.handle.length > 0;
  if (operation.type === "insert") return typeof operation.source === "string" && (operation.after === void 0 || operation.after === null || typeof operation.after === "string");
  if (!handle) return false;
  if (operation.type === "remove") return true;
  if (operation.type === "replace") return typeof operation.source === "string";
  if (operation.type === "move") return operation.before === null || typeof operation.before === "string";
  if (operation.type === "width") return operation.width === "full" || operation.width === "half";
  if (operation.type === "convert") return ["paragraph", "heading", "list", "code"].includes(String(operation.kind)) && (operation.depth === void 0 || Number.isInteger(operation.depth) && Number(operation.depth) >= 1 && Number(operation.depth) <= 6) && (operation.language === void 0 || typeof operation.language === "string");
  if (operation.type === "properties") return !!operation.properties && typeof operation.properties === "object" && !Array.isArray(operation.properties);
  return false;
}
const newline = (source) => source.includes("\r\n") ? "\r\n" : "\n";
function patch(source, start, end, value) {
  return source.slice(0, start) + value + source.slice(end);
}
function widthSource(block2, content, width, source) {
  const nl = newline(source);
  return width === "half" ? `<div data-doc-width="half">${nl}${nl}${content}${nl}${nl}</div>` : content;
}
function plainText(block2) {
  const text = block2.content;
  if (block2.type === "heading") return text.replace(/^#{1,6}[ \t]+/, "").replace(/[ \t]+#+[ \t]*$/, "");
  if (block2.type === "code") return text.replace(/^(`{3,}|~{3,})[^\n]*\r?\n/, "").replace(/\r?\n(?:`{3,}|~{3,})[ \t]*$/, "");
  if (block2.type === "list") return text.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, "")).join("\n");
  return text;
}
function applyDocOperation(model, operation) {
  if (!isDocOperation(operation)) throw new Error("Invalid document operation.");
  const { source } = model;
  if (operation.type === "insert") {
    if (typeof operation.source !== "string" || !operation.source.trim()) throw new Error("Block source is required.");
    const anchor = operation.after ? model.blocks.find((block22) => block22.handle === operation.after) : null;
    if (operation.after && !anchor) throw new Error("Block handle is stale. Reparse the source.");
    const at = anchor?.end ?? source.length;
    const nl = newline(source);
    return patch(source, at, at, `${nl}${nl}${operation.source}${nl}`);
  }
  const block2 = model.blocks.find((item) => item.handle === operation.handle);
  if (!block2) throw new Error("Block handle is stale. Reparse the source.");
  if (operation.type === "replace") return patch(source, block2.start, block2.end, operation.source);
  if (operation.type === "remove") return patch(source, block2.start, block2.end, "");
  if (operation.type === "width") return patch(source, block2.start, block2.end, widthSource(block2, block2.content, operation.width, source));
  if (operation.type === "move") {
    const target = operation.before === null ? null : model.blocks.find((item) => item.handle === operation.before);
    if (operation.before && !target) throw new Error("Target handle is stale. Reparse the source.");
    const reordered = model.blocks.filter((item) => item !== block2);
    const index = target ? reordered.indexOf(target) : reordered.length;
    if (target === block2) return source;
    reordered.splice(index, 0, block2);
    let result = source;
    for (let i = model.blocks.length - 1; i >= 0; i--) {
      const slot = model.blocks[i];
      result = patch(result, slot.start, slot.end, reordered[i].source);
    }
    return result;
  }
  if (operation.type === "convert") {
    if (!block2.editable) throw new Error("Use explicit source editing for custom or opaque MDX.");
    const nl = newline(source);
    const text = plainText(block2);
    let content = text;
    if (operation.kind === "heading") content = "#".repeat(Math.min(6, Math.max(1, operation.depth ?? 2))) + " " + text.replace(/\r?\n/g, " ");
    if (operation.kind === "list") content = text.split(/\r?\n/).map((line) => `- ${line}`).join(nl);
    if (operation.kind === "code") {
      const fence = "`".repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((run) => run.length + 1)));
      content = `${fence}${(operation.language ?? "").replace(/[^\w+-]/g, "")}${nl}${text}${nl}${fence}`;
    }
    return patch(source, block2.start, block2.end, widthSource(block2, content, block2.width, source));
  }
  if (operation.type === "properties") {
    if (!block2.name || !/^[A-Z][\w.]*$/.test(block2.name)) throw new Error("This block has no editable component properties.");
    const replacements = Object.entries(operation.properties).map(([name, value]) => {
      const range = block2.propertyRanges?.[name];
      if (!range) throw new Error(`Property ${name} is not a literal. Edit its source explicitly.`);
      return { ...range, value: `${name}={${JSON.stringify(value)}}` };
    }).sort((a, b) => b.start - a.start);
    let result = source;
    for (const replacement of replacements) result = patch(result, replacement.start, replacement.end, replacement.value);
    return result;
  }
  return source;
}
function insertDocBuiltin(model, name, blockSource2, after, range) {
  if (!["Prototype", "Site", "Image", "CanvasWidget"].includes(name)) throw new Error("Unsupported Doc builtin.");
  const imported = model.imports[name] === name;
  if (range && (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < model.bodyOffset || range.end < range.start || range.end > model.source.length)) throw new Error("Insertion range is stale.");
  const nl = newline(model.source);
  let source = range ? patch(model.source, range.start, range.end, `${nl}${nl}${blockSource2}${nl}${nl}`) : applyDocOperation(model, { type: "insert", source: blockSource2, ...{} });
  if (!imported) {
    const nl2 = newline(source);
    source = patch(source, model.bodyOffset, model.bodyOffset, `${nl2}import { ${name} } from 'design-notebook/docs'${nl2}${nl2}`);
  }
  return source;
}
const TEXT_INSERTIONS = [
  { id: "text", label: "Text", source: "Write something…" },
  { id: "heading", label: "Heading", source: "## New heading" },
  { id: "list", label: "List", source: "- First item\n- Second item" },
  { id: "code", label: "Code", source: "```js\n// Your code\n```" }
];
const FRAME_LABELS = { prototype: "Prototype", "site-frame": "Site", story: "Component" };
const HIDDEN_TYPES = /* @__PURE__ */ new Set(["image", "component", "component-set"]);
function getDocInsertCatalog() {
  return [
    ...TEXT_INSERTIONS.map((entry) => ({ ...entry, group: "content", supported: true })),
    ...getWidgetSurfaceCatalog("document").filter((entry) => !HIDDEN_TYPES.has(entry.type)).map((entry) => {
      const props = entry.capabilities?.sizing === "frame" || FRAME_LABELS[entry.type] ? {} : entry.defaultProps || {};
      return {
        id: `widget:${entry.type}`,
        type: entry.type,
        label: FRAME_LABELS[entry.type] || entry.label,
        group: FRAME_LABELS[entry.type] ? "content" : "widgets",
        supported: entry.supported,
        reason: entry.reason,
        builtin: "CanvasWidget",
        source: `<CanvasWidget type=${JSON.stringify(entry.type)} props={${JSON.stringify(props)}} />`
      };
    })
  ];
}
const SelectList = /* @__PURE__ */ React.forwardRef(function SelectList2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    ...elementProps
  } = componentProps;
  const store = useSelectRootContext();
  const {
    multiple,
    readOnly
  } = useSelectRootPropsContext();
  const {
    alignItemWithTriggerActive
  } = useSelectPositionerContext();
  const hasScrollArrows = store.useState("hasScrollArrows");
  const openMethod = store.useState("openMethod");
  const id = store.useState("id");
  const defaultProps = {
    id: `${id}-list`,
    role: "listbox",
    "aria-multiselectable": multiple || void 0,
    "aria-readonly": readOnly || void 0,
    onScroll(event) {
      store.context.scrollHandlerRef.current?.(event.currentTarget);
    },
    ...alignItemWithTriggerActive && {
      style: LIST_FUNCTIONAL_STYLES
    },
    className: hasScrollArrows && openMethod !== "touch" ? styleDisableScrollbar.className : void 0
  };
  const setListElement = store.useStateSetter("listElement");
  return useRenderElement("div", componentProps, {
    ref: [forwardedRef, setListElement],
    props: [defaultProps, elementProps]
  });
});
if (process.env.NODE_ENV !== "production") SelectList.displayName = "SelectList";
const SelectScrollArrow = /* @__PURE__ */ React.forwardRef(function SelectScrollArrow2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    direction,
    keepMounted,
    ...elementProps
  } = componentProps;
  const isUp = direction === "up";
  const store = useSelectRootContext();
  const {
    side,
    scrollDownArrowRef,
    scrollUpArrowRef
  } = useSelectPositionerContext();
  const visibleSelector = isUp ? "scrollUpArrowVisible" : "scrollDownArrowVisible";
  const stateVisible = store.useState(visibleSelector);
  const openMethod = store.useState("openMethod");
  const visible = stateVisible && openMethod !== "touch";
  const timeout = useTimeout();
  const scrollArrowRef = isUp ? scrollUpArrowRef : scrollDownArrowRef;
  const {
    mounted,
    transitionStatus,
    setMounted
  } = useTransitionStatus(visible);
  useIsoLayoutEffect(() => {
    store.context.scrollArrowsMountedCountRef.current += 1;
    store.set("hasScrollArrows", true);
    return () => {
      store.context.scrollArrowsMountedCountRef.current = Math.max(0, store.context.scrollArrowsMountedCountRef.current - 1);
      if (store.context.scrollArrowsMountedCountRef.current === 0) {
        store.set("hasScrollArrows", false);
      }
    };
  }, [store]);
  useOpenChangeComplete({
    open: visible,
    ref: scrollArrowRef,
    onComplete() {
      if (!visible) {
        setMounted(false);
      }
    }
  });
  const state = {
    direction,
    visible,
    side,
    transitionStatus
  };
  const defaultProps = {
    "aria-hidden": true,
    children: isUp ? "▲" : "▼",
    style: {
      position: "absolute"
    },
    onMouseMove(event) {
      if (event.movementX === 0 && event.movementY === 0 || timeout.isStarted()) {
        return;
      }
      store.set("activeIndex", null);
      function scrollNextItem() {
        const scroller = store.state.listElement ?? store.context.popupRef.current;
        if (!scroller) {
          return;
        }
        store.set("activeIndex", null);
        store.context.handleScrollArrowVisibility(scroller);
        const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
        const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
        const isScrolledToEdge = scrollTop === (isUp ? 0 : maxScrollTop);
        const items = store.context.listRef.current;
        if (scrollTop !== scroller.scrollTop) {
          scroller.scrollTop = scrollTop;
        }
        if (isScrolledToEdge) {
          timeout.clear();
          return;
        }
        if (items.length > 0) {
          const scrollArrowHeight = scrollArrowRef.current?.offsetHeight || 0;
          scroller.scrollTop = getTargetScrollTop(items, isUp, scrollTop, scroller.clientHeight, scrollArrowHeight, maxScrollTop);
        }
        timeout.start(40, scrollNextItem);
      }
      timeout.start(40, scrollNextItem);
    },
    onMouseLeave() {
      timeout.clear();
    }
  };
  const element = useRenderElement("div", componentProps, {
    ref: [forwardedRef, scrollArrowRef],
    state,
    props: [defaultProps, elementProps],
    stateAttributesMapping: transitionStatusMapping
  });
  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }
  return element;
});
if (process.env.NODE_ENV !== "production") SelectScrollArrow.displayName = "SelectScrollArrow";
function getTargetScrollTop(items, isUp, scrollTop, clientHeight, scrollArrowHeight, maxScrollTop) {
  if (isUp) {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }
    const targetIndex2 = Math.max(0, firstVisibleIndex - 1);
    const targetItem2 = items[targetIndex2];
    return targetIndex2 < firstVisibleIndex && targetItem2 ? normalizeScrollOffset(targetItem2.offsetTop - scrollArrowHeight, maxScrollTop) : 0;
  }
  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }
  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem ? normalizeScrollOffset(targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight, maxScrollTop) : maxScrollTop;
}
const SelectScrollDownArrow = /* @__PURE__ */ React.forwardRef(function SelectScrollDownArrow2(props, forwardedRef) {
  return /* @__PURE__ */ jsx(SelectScrollArrow, {
    ...props,
    ref: forwardedRef,
    direction: "down"
  });
});
if (process.env.NODE_ENV !== "production") SelectScrollDownArrow.displayName = "SelectScrollDownArrow";
const SelectScrollUpArrow = /* @__PURE__ */ React.forwardRef(function SelectScrollUpArrow2(props, forwardedRef) {
  return /* @__PURE__ */ jsx(SelectScrollArrow, {
    ...props,
    ref: forwardedRef,
    direction: "up"
  });
});
if (process.env.NODE_ENV !== "production") SelectScrollUpArrow.displayName = "SelectScrollUpArrow";
const Select = SelectRoot;
function SelectValue({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SelectValue$1,
    {
      "data-hc-ui": "",
      "data-slot": "select-value",
      className: cn("hc-flex hc-flex-1 hc-text-left", className),
      ...props
    }
  );
}
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    SelectTrigger$1,
    {
      "data-hc-ui": "",
      "data-slot": "select-trigger",
      "data-size": size,
      className: cn(
        "hc-flex hc-w-fit hc-items-center hc-justify-between hc-gap-1.5 hc-rounded-lg hc-border hc-border-input hc-bg-transparent hc-py-2 hc-pr-2 hc-pl-2.5 hc-text-sm hc-whitespace-nowrap hc-transition-colors hc-outline-none hc-select-none hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-disabled:cursor-not-allowed hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-data-placeholder:text-muted-foreground hc-data-[size=default]:h-8 hc-data-[size=sm]:h-7 hc-data-[size=sm]:rounded-[min(var(--hc-radius-md),10px)] hc-*:data-[slot=select-value]:line-clamp-1 hc-*:data-[slot=select-value]:flex hc-*:data-[slot=select-value]:items-center hc-*:data-[slot=select-value]:gap-1.5 hc-dark:bg-input/30 hc-dark:hover:bg-input/50 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx(
          SelectIcon,
          {
            render: /* @__PURE__ */ jsx(ChevronDown, { className: "hc-pointer-events-none hc-size-4 hc-text-muted-foreground" })
          }
        )
      ]
    }
  );
}
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  positionerClassName,
  ...props
}) {
  return /* @__PURE__ */ jsx(SelectPortal, { children: /* @__PURE__ */ jsx(
    SelectPositioner,
    {
      side,
      sideOffset,
      align,
      alignOffset,
      alignItemWithTrigger,
      className: cn("hc-isolate hc-z-50", positionerClassName),
      children: /* @__PURE__ */ jsxs(
        SelectPopup,
        {
          "data-hc-ui": "",
          "data-slot": "select-content",
          "data-align-trigger": alignItemWithTrigger,
          className: cn("hc-font-sans hc-text-xs hc-font-normal hc-leading-4 hc-antialiased hc-relative hc-isolate hc-z-50 hc-max-h-(--available-height) hc-w-(--anchor-width) hc-min-w-36 hc-origin-(--transform-origin) hc-overflow-x-hidden hc-overflow-y-auto hc-rounded-lg hc-bg-popover hc-text-popover-foreground hc-shadow-md hc-ring-1 hc-ring-foreground/10 hc-duration-100 hc-data-[align-trigger=true]:animate-none hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=inline-end]:slide-in-from-left-2 hc-data-[side=inline-start]:slide-in-from-right-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95", className),
          ...props,
          children: [
            /* @__PURE__ */ jsx(SelectScrollUpButton, {}),
            /* @__PURE__ */ jsx(SelectList, { children }),
            /* @__PURE__ */ jsx(SelectScrollDownButton, {})
          ]
        }
      )
    }
  ) });
}
function SelectItem({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    SelectItem$1,
    {
      "data-hc-ui": "",
      "data-slot": "select-item",
      className: cn(
        "hc-relative hc-flex hc-w-full hc-cursor-default hc-items-center hc-gap-1.5 hc-rounded-md hc-py-1 hc-pr-8 hc-pl-1.5 hc-text-sm hc-outline-hidden hc-select-none hc-focus:bg-accent hc-focus:text-accent-foreground hc-not-data-[variant=destructive]:focus:**:text-accent-foreground hc-data-disabled:pointer-events-none hc-data-disabled:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4 hc-*:[span]:last:flex hc-*:[span]:last:items-center hc-*:[span]:last:gap-2",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx(SelectItemText, { className: "hc-flex hc-flex-1 hc-shrink-0 hc-gap-2 hc-whitespace-nowrap", children }),
        /* @__PURE__ */ jsx(
          SelectItemIndicator,
          {
            render: /* @__PURE__ */ jsx("span", { className: "hc-pointer-events-none hc-absolute hc-right-2 hc-flex hc-size-4 hc-items-center hc-justify-center" }),
            children: /* @__PURE__ */ jsx(Check, { className: "hc-pointer-events-none" })
          }
        )
      ]
    }
  );
}
function SelectScrollUpButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SelectScrollUpArrow,
    {
      "data-hc-ui": "",
      "data-slot": "select-scroll-up-button",
      className: cn(
        "hc-top-0 hc-z-10 hc-flex hc-w-full hc-cursor-default hc-items-center hc-justify-center hc-bg-popover hc-py-1 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(
        ChevronUp,
        {}
      )
    }
  );
}
function SelectScrollDownButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SelectScrollDownArrow,
    {
      "data-hc-ui": "",
      "data-slot": "select-scroll-down-button",
      className: cn(
        "hc-bottom-0 hc-z-10 hc-flex hc-w-full hc-cursor-default hc-items-center hc-justify-center hc-bg-popover hc-py-1 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(
        ChevronDown,
        {}
      )
    }
  );
}
const editor = "_editor_29lge_1";
const title = "_title_29lge_2";
const path = "_path_29lge_4";
const dock = "_dock_29lge_5";
const blocks = "_blocks_29lge_11";
const blockSlot = "_blockSlot_29lge_13";
const emptySlot = "_emptySlot_29lge_15";
const block = "_block_29lge_11";
const previewBlock = "_previewBlock_29lge_16";
const selected = "_selected_29lge_19";
const blockTools = "_blockTools_29lge_22";
const blockActions = "_blockActions_29lge_23";
const blockActionGroup = "_blockActionGroup_29lge_24";
const blockTypeOption = "_blockTypeOption_29lge_26";
const blockWidthOption = "_blockWidthOption_29lge_27";
const blockSelectContent = "_blockSelectContent_29lge_28";
const dragButton = "_dragButton_29lge_29";
const textBlock = "_textBlock_29lge_37";
const heading = "_heading_29lge_39";
const code = "_code_29lge_40";
const renderedBlock = "_renderedBlock_29lge_41";
const rawSource = "_rawSource_29lge_44";
const blockSource = "_blockSource_29lge_44";
const blockOptions = "_blockOptions_29lge_47";
const literalProperty = "_literalProperty_29lge_48";
const notice = "_notice_29lge_53";
const conflict = "_conflict_29lge_53";
const footer = "_footer_29lge_57";
const insertBounds = "_insertBounds_29lge_71";
const insertionTarget = "_insertionTarget_29lge_74";
const plusGlyph = "_plusGlyph_29lge_75";
const beforeTarget = "_beforeTarget_29lge_80";
const afterTarget = "_afterTarget_29lge_81";
const emptyTarget = "_emptyTarget_29lge_82";
const css = {
  editor,
  title,
  path,
  dock,
  blocks,
  blockSlot,
  emptySlot,
  block,
  previewBlock,
  selected,
  blockTools,
  blockActions,
  blockActionGroup,
  blockTypeOption,
  blockWidthOption,
  blockSelectContent,
  dragButton,
  textBlock,
  heading,
  code,
  renderedBlock,
  rawSource,
  blockSource,
  blockOptions,
  literalProperty,
  notice,
  conflict,
  footer,
  insertBounds,
  insertionTarget,
  plusGlyph,
  beforeTarget,
  afterTarget,
  emptyTarget
};
function getClipboardImageFile(clipboardData) {
  if (!clipboardData?.items || clipboardData.getData?.("text/plain")) return null;
  for (const item of clipboardData.items) {
    if (!item?.type?.startsWith("image/")) continue;
    const file = item.getAsFile?.();
    if (file) return file;
  }
  return null;
}
const memory = /* @__PURE__ */ new Map();
const docDraftKey = (notebookId, documentId) => `hypercanvas:doc-draft:v1:${encodeURIComponent(notebookId)}:${encodeURIComponent(documentId)}`;
function readDocDraft(key) {
  let value = memory.get(key);
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) value = JSON.parse(stored);
  } catch {
  }
  return value && typeof value.source === "string" && typeof value.baseSource === "string" && typeof value.baseRevision === "string" && value.source !== value.baseSource ? value : null;
}
function writeDocDraft(key, source, base) {
  if (!base.revision) return;
  if (source === base.source) {
    memory.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
    }
    return;
  }
  const value = { source, baseSource: base.source, baseRevision: base.revision };
  memory.set(key, value);
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}
const EditingContext = createContext(null);
const BUILTINS = { Image: Image$1, Prototype, Site, CanvasWidget };
const BLOCK_DRAG_TYPE = "application/x-hypercanvas-doc-block";
const BLOCK_TYPES = { paragraph: "Text", heading: "Heading", list: "List", code: "Code", blockquote: "Quote", thematicBreak: "Divider", mdxJsxFlowElement: "Component", mdxFlowExpression: "Expression" };
const EDITOR_MODES = [{ value: "preview", label: "Preview", Icon: FileText }, { value: "markdown", label: "Edit", Icon: Pencil }, { value: "raw", label: "Edit code", Icon: FileCodeCorner }];
const INSERT_ICON = "iconoir/plus-circle-solid";
async function request(base, route, body) {
  const response = await fetch(`${base.replace(/\/+$/, "")}/_hypercanvas/docs/${route}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : void 0);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Docs request failed (${response.status})`);
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}
function fitTextarea(element) {
  if (!element) return;
  element.style.height = "auto";
  const border = element.offsetHeight - element.clientHeight;
  element.style.height = `${Math.max(38, element.scrollHeight + border)}px`;
}
function renderBlockProperties(block2, editor2) {
  return Object.entries(block2.properties || {}).map(([name, value]) => {
    const update = (event) => {
      if (typeof value === "string") {
        if (event.target.value !== value) {
          void editor2.operation({ type: "properties", handle: block2.handle, properties: { [name]: event.target.value } });
        }
        return;
      }
      try {
        const parsed = JSON.parse(event.target.value);
        if (JSON.stringify(parsed) !== JSON.stringify(value)) {
          void editor2.operation({ type: "properties", handle: block2.handle, properties: { [name]: parsed } });
        }
      } catch {
        editor2.setError(`Property ${name} must be valid JSON. Your source was not changed.`);
      }
    };
    return /* @__PURE__ */ jsxs("label", { className: css.literalProperty, children: [
      name,
      typeof value === "string" ? /* @__PURE__ */ jsx("input", { "aria-label": `Property ${name}`, defaultValue: value, onBlur: update }) : /* @__PURE__ */ jsx("textarea", { "aria-label": `Property ${name}`, defaultValue: JSON.stringify(value, null, 2), rows: 4, onBlur: update })
    ] }, `${block2.handle}:${name}`);
  });
}
function retainBlockIdentity(model, previous, nextId) {
  const unmatched = new Set(previous?.blocks || []);
  for (const block2 of model.blocks) {
    const match = [...unmatched].find((old) => old.type === block2.type && old.content === block2.content);
    if (match) {
      block2.viewId = match.viewId;
      unmatched.delete(match);
    }
  }
  for (const [index, block2] of model.blocks.entries()) {
    if (block2.viewId) continue;
    const old = previous?.blocks[index];
    if (old && unmatched.has(old) && old.type === block2.type && old.name === block2.name) {
      block2.viewId = old.viewId;
      unmatched.delete(old);
    } else block2.viewId = nextId();
  }
}
function keyPreviewBlocks(node, blocks2) {
  if (Array.isArray(node)) return node.map((child) => keyPreviewBlocks(child, blocks2));
  if (!isValidElement(node)) return node;
  const handle = node.props["data-doc-block"];
  if (handle) return cloneElement(node, { key: blocks2.find((block2) => block2.handle === handle)?.viewId });
  return node.props.children ? cloneElement(node, {}, keyPreviewBlocks(node.props.children, blocks2)) : node;
}
function preserveLiveBlockMoves(element) {
  if (!element?.moveBefore) return;
  const { insertBefore, appendChild } = element;
  element.insertBefore = (node, before) => {
    if (node.parentNode === element && node.isConnected) {
      element.moveBefore(node, before);
      return node;
    }
    return insertBefore.call(element, node, before);
  };
  element.appendChild = (node) => {
    if (node.parentNode === element && node.isConnected) {
      element.moveBefore(node, null);
      return node;
    }
    return appendChild.call(element, node);
  };
  return () => {
    element.insertBefore = insertBefore;
    element.appendChild = appendChild;
  };
}
function EditorBlock({ children, ...props }) {
  const editor2 = useContext(EditingContext);
  const documentContext = useContext(DocumentContext);
  const [dropEdge, setDropEdge] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const handle = props["data-doc-block"];
  if (!handle || !editor2) return /* @__PURE__ */ jsx("div", { ...props, children });
  const beforeInsertionKey = `${handle}:before`;
  const afterInsertionKey = `${handle}:after`;
  const index = editor2.analysis.model.blocks.findIndex((block22) => block22.handle === handle);
  const block2 = editor2.analysis.model.blocks[index];
  if (!block2) return /* @__PURE__ */ jsx("div", { children });
  const preview = editor2.mode === "preview";
  const selected2 = editor2.selected === index;
  const showActionBar = !preview && (selected2 || hovered);
  const hasExtendedOptions = block2.type === "code" || !block2.editable || Object.keys(block2.properties || {}).length > 0;
  const blockType = block2.type === "heading" ? `heading-${block2.depth}` : block2.type;
  const blockTypeOptions = [
    { value: "paragraph", label: "Text" },
    ...Array.from({ length: 6 }, (_, depth) => ({ value: `heading-${depth + 1}`, label: `Heading ${depth + 1}` })),
    { value: "list", label: "List" },
    { value: "code", label: "Code" }
  ];
  if (!blockTypeOptions.some((option) => option.value === blockType)) {
    blockTypeOptions.push({ value: blockType, label: BLOCK_TYPES[block2.type] || block2.type });
  }
  const blockWidthOptions = [{ value: "full", label: "Full width" }, { value: "half", label: "Half width" }];
  const isText = !preview && block2.editable && editor2.rawBlock !== index;
  const value = editor2.textEdits.current.get(handle)?.value ?? block2.content;
  const edgeAt = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };
  return /* @__PURE__ */ jsxs("div", { className: css.blockSlot, "data-doc-width": block2.width, "data-doc-insertion-slot": "", children: [
    !preview && index === 0 && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: `${css.insertionTarget} ${css.beforeTarget}`,
        "data-doc-tool": "",
        "data-doc-gap": "before",
        "data-doc-gap-target": beforeInsertionKey,
        "data-doc-gap-bridge": "",
        "aria-haspopup": "dialog",
        "aria-expanded": editor2.insertOpen && editor2.activeInsertionTargetKey === beforeInsertionKey,
        "aria-label": "Insert before first block",
        onFocus: (event) => editor2.captureGap(block2, "before", event.currentTarget),
        onClick: (event) => editor2.openGap(block2, "before", event.currentTarget),
        children: /* @__PURE__ */ jsx("span", { className: css.plusGlyph, "data-doc-plus-icon": "", children: /* @__PURE__ */ jsx(Icon, { name: INSERT_ICON, size: 14, strokeWeight: 2, scale: 1 }) })
      }
    ),
    /* @__PURE__ */ jsxs(
      "section",
      {
        className: preview ? css.previewBlock : `${css.block} ${selected2 ? css.selected : ""}`,
        "data-doc-width": block2.width,
        "data-block-index": index,
        "data-block-type": block2.type,
        "data-doc-drop-edge": dropEdge || void 0,
        tabIndex: preview ? void 0 : 0,
        "aria-label": `${BLOCK_TYPES[block2.type] || block2.type} block ${index + 1}`,
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => {
          if (!preview) editor2.setSelected(index);
        },
        onClick: () => {
          if (!preview) editor2.setSelected(index);
        },
        onKeyDown: (event) => {
          const ownInput = event.target === event.currentTarget || event.target.matches("textarea[data-doc-text]");
          if (!preview && ownInput && event.altKey && !event.isComposing && ["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            editor2.move(index, event.key === "ArrowUp" ? -1 : 1);
          }
        },
        onDragOver: (event) => {
          if (preview || editor2.busy || !Array.from(event.dataTransfer.types).includes(BLOCK_DRAG_TYPE)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          setDropEdge(edgeAt(event));
        },
        onDragLeave: (event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropEdge(null);
        },
        onDragEnd: () => setDropEdge(null),
        onDrop: (event) => {
          setDropEdge(null);
          if (preview || editor2.busy) return;
          let payload;
          try {
            payload = JSON.parse(event.dataTransfer.getData(BLOCK_DRAG_TYPE));
          } catch {
            return;
          }
          if (payload?.documentId !== editor2.documentId || typeof payload.viewId !== "string") return;
          event.preventDefault();
          event.stopPropagation();
          void editor2.operation({ type: "move-view", viewId: payload.viewId, targetViewId: block2.viewId, edge: edgeAt(event) });
        },
        children: [
          /* @__PURE__ */ jsx("div", { className: css.blockTools, hidden: !showActionBar, children: /* @__PURE__ */ jsx(CanvasToolsSurface, { variant: "compact", className: css.blockActions, children: /* @__PURE__ */ jsxs(CanvasToolsGroup, { "aria-label": "Block actions", className: css.blockActionGroup, children: [
            /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", className: css.dragButton, "aria-label": `Drag block ${index + 1}`, disabled: editor2.busy, draggable: !preview && !editor2.busy, onDragStart: (event) => {
              event.stopPropagation();
              event.dataTransfer.setData(BLOCK_DRAG_TYPE, JSON.stringify({ documentId: editor2.documentId, viewId: block2.viewId }));
              event.dataTransfer.effectAllowed = "move";
            }, children: /* @__PURE__ */ jsx(GripVertical, { size: 14 }) }),
            block2.editable && /* @__PURE__ */ jsxs(Select, { value: blockType, items: blockTypeOptions, disabled: editor2.busy, onValueChange: (value2) => {
              if (typeof value2 !== "string") return;
              const [kind, depth] = value2.split("-");
              void editor2.operation({ type: "convert", handle: block2.handle, kind, ...depth ? { depth: Number(depth) } : {} });
            }, children: [
              /* @__PURE__ */ jsx(SelectTrigger, { "data-doc-tool": "", size: "sm", className: `${css.blockOption} ${css.blockTypeOption}`, "aria-label": "Block type", title: "Block type", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
              /* @__PURE__ */ jsx(SelectContent, { align: "start", alignItemWithTrigger: false, positionerClassName: "hc-z-[10000]", className: css.blockSelectContent, children: blockTypeOptions.map((option) => /* @__PURE__ */ jsx(SelectItem, { value: option.value, children: option.label }, option.value)) })
            ] }),
            /* @__PURE__ */ jsxs(Select, { value: block2.width, items: blockWidthOptions, disabled: editor2.busy, onValueChange: (value2) => {
              if (typeof value2 === "string") void editor2.operation({ type: "width", handle: block2.handle, width: value2 });
            }, children: [
              /* @__PURE__ */ jsx(SelectTrigger, { "data-doc-tool": "", size: "sm", className: `${css.blockOption} ${css.blockWidthOption}`, "aria-label": "Block width", title: "Block width", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
              /* @__PURE__ */ jsx(SelectContent, { align: "start", alignItemWithTrigger: false, positionerClassName: "hc-z-[10000]", className: css.blockSelectContent, children: blockWidthOptions.map((option) => /* @__PURE__ */ jsx(SelectItem, { value: option.value, children: option.label }, option.value)) })
            ] }),
            /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": `Move block ${index + 1} up`, title: "Move up", disabled: editor2.busy || index === 0, onClick: () => editor2.move(index, -1), children: /* @__PURE__ */ jsx(ArrowUp, { size: 14 }) }),
            /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": `Remove block ${index + 1}`, title: "Delete block", disabled: editor2.busy, onClick: () => void editor2.operation({ type: "remove", handle }, null), children: /* @__PURE__ */ jsx(Trash, { size: 14 }) }),
            /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": `Move block ${index + 1} down`, title: "Move down", disabled: editor2.busy || index === editor2.analysis.model.blocks.length - 1, onClick: () => editor2.move(index, 1), children: /* @__PURE__ */ jsx(ArrowDown, { size: 14 }) }),
            /* @__PURE__ */ jsxs(Tooltip, { children: [
              /* @__PURE__ */ jsx(TooltipTrigger, { children: /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": "Ask Hyper Agent", disabled: editor2.busy, onClick: () => editor2.ask(block2), children: /* @__PURE__ */ jsx(Sparkles, { size: 14 }) }) }),
              /* @__PURE__ */ jsx(TooltipContent, { side: "top", children: "Ask Hyper Agent" })
            ] }),
            hasExtendedOptions && /* @__PURE__ */ jsxs(PopoverRoot, { open: optionsOpen, onOpenChange: setOptionsOpen, children: [
              /* @__PURE__ */ jsx(PopoverTrigger, { render: /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": "Block options", title: "Block options", disabled: editor2.busy, children: /* @__PURE__ */ jsx(Settings2, { size: 14 }) }) }),
              /* @__PURE__ */ jsx(PopoverPortal, { children: /* @__PURE__ */ jsx(PopoverPositioner, { side: "bottom", align: "end", sideOffset: 6, collisionPadding: 12, className: "hc-z-[10000]", children: /* @__PURE__ */ jsxs(PopoverPopup, { className: css.blockOptions, "aria-label": "Block options", children: [
                /* @__PURE__ */ jsx(PopoverTitle, { className: "hc-sr-only", children: "Block options" }),
                block2.type === "code" && /* @__PURE__ */ jsxs("label", { className: css.literalProperty, children: [
                  "Language",
                  /* @__PURE__ */ jsx("input", { "aria-label": "Code language", defaultValue: block2.language || "", onBlur: (event) => {
                    if (event.target.value !== (block2.language || "")) void editor2.operation({ type: "convert", handle: block2.handle, kind: "code", language: event.target.value });
                  } }, block2.handle)
                ] }),
                block2.name && renderBlockProperties(block2, editor2),
                !block2.editable && /* @__PURE__ */ jsxs("details", { className: css.blockSource, children: [
                  /* @__PURE__ */ jsx("summary", { children: "Explicit block source" }),
                  /* @__PURE__ */ jsx("textarea", { "aria-label": "Selected block source", defaultValue: block2.source, rows: 6, spellCheck: false, onBlur: (event) => {
                    if (event.target.value !== block2.source) void editor2.operation({ type: "replace", handle: block2.handle, source: event.target.value });
                  } }, block2.handle)
                ] })
              ] }) }) })
            ] })
          ] }) }) }),
          isText ? /* @__PURE__ */ jsx(
            "textarea",
            {
              className: `${css.textBlock} ${css[block2.type] || ""}`,
              "aria-label": `Markdown block ${index + 1}`,
              "data-doc-text": index,
              value,
              rows: 1,
              spellCheck: block2.type !== "code",
              ref: fitTextarea,
              onFocus: (event) => {
                editor2.beginText(block2);
                editor2.selectText(block2, event.currentTarget);
              },
              onSelect: (event) => editor2.selectText(block2, event.currentTarget),
              onChange: (event) => {
                fitTextarea(event.currentTarget);
                editor2.editText(block2, event.target.value);
                editor2.selectText(block2, event.currentTarget);
              },
              onBlur: () => editor2.finishText(),
              onCompositionStart: () => editor2.setComposing(true),
              onCompositionEnd: () => editor2.setComposing(false)
            }
          ) : /* @__PURE__ */ jsx("div", { className: css.renderedBlock, children: /* @__PURE__ */ jsx(DocumentContext.Provider, { value: { ...documentContext, onUpdateWidget: (patch2) => editor2.operation({ type: "properties", handle: block2.handle, properties: { props: { ...block2.properties?.props || {}, ...patch2 } } }, index) }, children }) })
        ]
      }
    ),
    !preview && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: `${css.insertionTarget} ${css.afterTarget}`,
        "data-doc-tool": "",
        "data-doc-gap": "after",
        "data-doc-gap-target": afterInsertionKey,
        "data-doc-gap-bridge": "",
        "aria-haspopup": "dialog",
        "aria-expanded": editor2.insertOpen && editor2.activeInsertionTargetKey === afterInsertionKey,
        "aria-label": `Insert after block ${index + 1}`,
        onFocus: (event) => editor2.captureGap(block2, "after", event.currentTarget),
        onClick: (event) => editor2.openGap(block2, "after", event.currentTarget),
        children: /* @__PURE__ */ jsx("span", { className: css.plusGlyph, "data-doc-plus-icon": "", children: /* @__PURE__ */ jsx(Icon, { name: INSERT_ICON, size: 14, strokeWeight: 2, scale: 1 }) })
      }
    )
  ] });
}
function DocEditor({ artifact, source: initialSource = "", resolveArtifact, resolveAsset, base = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", notebookId = "source" }) {
  const draftKey = docDraftKey(notebookId, artifact.id);
  const lifecycle = useRef(0);
  const [recovered, setRecovered] = useState(false);
  const [draft, setDraft] = useState(initialSource);
  const draftRef = useRef(initialSource);
  const baseRef = useRef({ source: initialSource, revision: null });
  const [analysis, setAnalysis] = useState(null);
  const analysisRef = useRef(null);
  const [mode, setMode] = useState("markdown");
  const [selected2, setSelected] = useState(null);
  const [rawBlock, setRawBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [compositionVersion, setCompositionVersion] = useState(0);
  const [error, setError] = useState("");
  const [conflict2, setConflict] = useState(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertSearch, setInsertSearch] = useState("");
  const [activeInsertionTarget, setActiveInsertionTarget] = useState(null);
  const [activeInsertionTargetKey, setActiveInsertionTargetKey] = useState(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useRef({ past: [], future: [] });
  const activeEdit = useRef(null);
  const textEdits = useRef(/* @__PURE__ */ new Map());
  const insertionTarget2 = useRef(null);
  const insertionFocus = useRef(null);
  const insertReturnFocus = useRef(null);
  const insertionHandler = useRef(null);
  const selectedText = useRef(null);
  const composing = useRef(false);
  const parseTimer = useRef(null);
  const requestSequence = useRef(0);
  const focusToRestore = useRef(null);
  const rootRef = useRef(null);
  const rawSourceRef = useRef(null);
  const blocksRef = useRef(null);
  const insertTriggerRef = useRef(null);
  const insertSearchRef = useRef(null);
  const nextBlockId = useRef(0);
  const widgetVersion = useSyncExternalStore(subscribeToWidgetRegistry, getWidgetRegistrySnapshot, getWidgetRegistrySnapshot);
  const savedRevision = baseRef.current.revision;
  const dirty = draft !== baseRef.current.source;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver !== "function") return;
    let previousWidth = -1;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === previousWidth) return;
      previousWidth = entry.contentRect.width;
      root.querySelectorAll("textarea[data-doc-text], textarea[data-doc-source]").forEach(fitTextarea);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    fitTextarea(rawSourceRef.current);
  }, [draft, mode]);
  const remember = useCallback((value) => {
    const state = history.current;
    if (state.past.at(-1) !== value) state.past.push(value);
    if (state.past.length > 100) state.past.shift();
    state.future = [];
    setHistoryVersion((version) => version + 1);
  }, []);
  const changeDraft = useCallback((value, record = true) => {
    if (value === draftRef.current) return;
    setSaveError("");
    if (record) remember(draftRef.current);
    draftRef.current = value;
    setDraft(value);
  }, [remember]);
  const parse = useCallback(async (text) => {
    const sequence = ++requestSequence.current;
    const epoch = lifecycle.current;
    setBusy(true);
    try {
      const focused = rootRef.current?.querySelector("textarea:focus[data-doc-text]");
      const previousBlock = focused && analysisRef.current?.model?.blocks[Number(focused.dataset.docText)];
      if (previousBlock) {
        const shift = [...textEdits.current.values()].filter((edit) => edit.block.contentEnd <= previousBlock.contentStart).reduce((sum, edit) => sum + edit.value.length - (edit.block.contentEnd - edit.block.contentStart), 0);
        focusToRestore.current = { element: focused, offset: previousBlock.contentStart + shift + focused.selectionStart, end: previousBlock.contentStart + shift + focused.selectionEnd, direction: focused.selectionDirection };
      }
      const result = await request(base, "analyze", { documentId: artifact.id, source: text });
      if (epoch !== lifecycle.current || sequence !== requestSequence.current || text !== draftRef.current || composing.current) return null;
      if (focusToRestore.current && document.activeElement !== focusToRestore.current.element) focusToRestore.current = null;
      if (result.model) retainBlockIdentity(result.model, analysisRef.current?.model, () => `block-${++nextBlockId.current}`);
      analysisRef.current = result;
      setAnalysis(result);
      activeEdit.current = null;
      textEdits.current.clear();
      setError("");
      return result;
    } catch (problem) {
      if (epoch === lifecycle.current && sequence === requestSequence.current) setError(problem.message);
      return null;
    } finally {
      if (epoch === lifecycle.current && sequence === requestSequence.current) setBusy(false);
    }
  }, [artifact.id, base]);
  const scheduleAnalysis = useCallback(() => {
    clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      if (!composing.current && !rootRef.current?.querySelector("textarea:focus[data-doc-text]")) void parse(draftRef.current);
    }, 450);
  }, [parse]);
  useEffect(() => {
    scheduleAnalysis();
    return () => clearTimeout(parseTimer.current);
  }, [draft, scheduleAnalysis]);
  useLayoutEffect(() => {
    const focus = focusToRestore.current;
    if (!focus || composing.current || !analysis?.model) return;
    focusToRestore.current = null;
    const blocks2 = analysis.model.blocks;
    const index = blocks2.findIndex((block2) => focus.offset >= block2.contentStart && focus.offset <= block2.contentEnd);
    const textarea = rootRef.current?.querySelector(`textarea[data-doc-text="${index}"]`);
    if (textarea) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(Math.max(0, focus.offset - blocks2[index].contentStart), Math.max(0, focus.end - blocks2[index].contentStart), focus.direction || "none");
    }
  }, [analysis]);
  useEffect(() => {
    let alive = true;
    const epoch = ++lifecycle.current;
    setPersistenceReady(false);
    savingRef.current = false;
    setSaving(false);
    setSaveError("");
    setConflict(null);
    request(base, `read?documentId=${encodeURIComponent(artifact.id)}`).then((result) => {
      if (!alive) return;
      if (epoch !== lifecycle.current) return;
      const recoveredDraft = readDocDraft(draftKey);
      const stored = recoveredDraft?.source !== result.source ? recoveredDraft : null;
      const source = stored?.source ?? result.source;
      baseRef.current = stored ? { source: stored.baseSource, revision: stored.baseRevision } : { source: result.source, revision: result.revision };
      if (stored) {
        setRecovered(true);
        if (stored.baseRevision !== result.revision) setConflict(result);
      }
      draftRef.current = source;
      setDraft(source);
      setPersistenceReady(true);
      void parse(source);
    }).catch((problem) => {
      if (alive) setError(problem.message);
    });
    return () => {
      alive = false;
      lifecycle.current = epoch + 1;
      clearTimeout(parseTimer.current);
      writeDocDraft(draftKey, draftRef.current, baseRef.current);
    };
  }, [artifact.id, notebookId, base, parse, draftKey]);
  useEffect(() => {
    writeDocDraft(draftKey, draft, baseRef.current);
  }, [draftKey, draft, historyVersion]);
  useEffect(() => {
    if (saving || !baseRef.current.revision || initialSource === baseRef.current.source) return;
    let alive = true;
    request(base, `read?documentId=${encodeURIComponent(artifact.id)}`).then((result) => {
      if (!alive || savingRef.current || result.source === baseRef.current.source) return;
      if (draftRef.current !== baseRef.current.source && draftRef.current !== result.source) setConflict(result);
      else {
        baseRef.current = { source: result.source, revision: result.revision };
        changeDraft(result.source, false);
        void parse(result.source);
      }
    }).catch((problem) => {
      if (alive) setError(problem.message);
    });
    return () => {
      alive = false;
    };
  }, [initialSource, artifact.id, base, changeDraft, parse, saving]);
  useEffect(() => {
    const openInsert = () => {
      setActiveInsertionTarget(null);
      setActiveInsertionTargetKey(null);
      setInsertOpen(true);
      setInsertSearch("");
    };
    window.addEventListener("hypercanvas:doc-insert", openInsert);
    const unload = (event) => {
      if (draftRef.current !== baseRef.current.source) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("hypercanvas:doc-insert", openInsert);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  const operation = async (action, nextSelected = selected2) => {
    clearTimeout(parseTimer.current);
    const basis = analysisRef.current;
    const edits = [...textEdits.current.values()];
    const current = basis?.source === draftRef.current ? basis : await parse(draftRef.current);
    if (!current?.model) return;
    const remap = (handle) => {
      if (handle === null || current.model.blocks.some((block2) => block2.handle === handle)) return handle;
      const original = basis?.model?.blocks.find((block2) => block2.handle === handle);
      if (!original || !edits.length || basis.model.blocks.length !== current.model.blocks.length) throw new Error("Document blocks changed. Select the block again.");
      const shift = edits.filter((edit) => edit.block.contentEnd <= original.start).reduce((sum, edit) => sum + edit.value.length - (edit.block.contentEnd - edit.block.contentStart), 0);
      const mapped = current.model.blocks.find((block2) => block2.start === original.start + shift);
      if (!mapped) throw new Error("The block changed while editing. Select it again.");
      return mapped.handle;
    };
    try {
      let mapped;
      if (action.type === "move-view") {
        const blocks2 = current.model.blocks;
        const from = blocks2.find((block2) => block2.viewId === action.viewId);
        const target = blocks2.find((block2) => block2.viewId === action.targetViewId);
        if (!from || !target) throw new Error("Document blocks changed. Drag the block again.");
        if (from === target) return;
        const destination = blocks2.indexOf(target) + (action.edge === "after" ? 1 : 0);
        mapped = { type: "move", handle: from.handle, before: blocks2[destination]?.handle || null };
        nextSelected = destination - (blocks2.indexOf(from) < destination ? 1 : 0);
      } else mapped = { ...action, ..."handle" in action ? { handle: remap(action.handle) } : {}, ...action.type === "move" ? { before: remap(action.before) } : {} };
      const next = applyDocOperation(current.model, mapped);
      changeDraft(next);
      setSelected(nextSelected);
      setRawBlock(null);
      await parse(next);
    } catch (problem) {
      setError(problem.message);
    }
  };
  const move = (index, direction) => {
    const blocks2 = analysisRef.current?.model?.blocks || [];
    const target = index + direction;
    if (target < 0 || target >= blocks2.length || busy) return;
    void operation({ type: "move", handle: blocks2[index].handle, before: direction < 0 ? blocks2[target].handle : blocks2[target + 1]?.handle || null }, target);
  };
  const beginText = (block2) => {
    if (activeEdit.current?.handle !== block2.handle) activeEdit.current = { handle: block2.handle, recorded: false };
  };
  const editText = (block2, value) => {
    if (!activeEdit.current || activeEdit.current.handle !== block2.handle) beginText(block2);
    if (!activeEdit.current.recorded) {
      remember(draftRef.current);
      activeEdit.current.recorded = true;
    }
    textEdits.current.set(block2.handle, { block: block2, value });
    let source = analysisRef.current.model.source;
    for (const edit of [...textEdits.current.values()].sort((a, b) => b.block.contentStart - a.block.contentStart)) source = source.slice(0, edit.block.contentStart) + edit.value + source.slice(edit.block.contentEnd);
    changeDraft(source, false);
  };
  const shiftedOffset = (offset) => offset + [...textEdits.current.values()].filter((edit) => edit.block.contentEnd <= offset && edit.block.contentStart < offset).reduce((sum, edit) => sum + edit.value.length - (edit.block.contentEnd - edit.block.contentStart), 0);
  const captureGap = (block2, side, element) => {
    const offset = block2 ? shiftedOffset(side === "before" ? block2.start : block2.end) : draftRef.current.length;
    insertionTarget2.current = { source: draftRef.current, start: offset, end: offset, element };
    setActiveInsertionTarget(element);
    setActiveInsertionTargetKey(element?.dataset.docGapTarget ?? null);
  };
  const openGap = (block2, side, element) => {
    insertReturnFocus.current = element;
    captureGap(block2, side, element);
    setInsertSearch("");
    setInsertOpen(true);
  };
  const setComposing = (value) => {
    composing.current = value;
    if (!value) {
      scheduleAnalysis();
      setCompositionVersion((version) => version + 1);
    }
  };
  const finishText = () => {
    if (!composing.current) scheduleAnalysis();
  };
  const selectText = (block2, element) => {
    selectedText.current = { start: block2.contentStart, text: element.value.slice(element.selectionStart, element.selectionEnd) };
    const offset = shiftedOffset(block2.contentStart);
    insertionTarget2.current = { source: draftRef.current, start: offset + element.selectionStart, end: offset + element.selectionEnd, element };
  };
  const ask = (block2) => {
    const edits = [...textEdits.current.values()];
    const shiftedOffset2 = (offset) => offset + edits.filter((edit) => edit.block.contentEnd <= offset).reduce((sum, edit) => sum + edit.value.length - (edit.block.contentEnd - edit.block.contentStart), 0);
    const currentBlock = block2 ? { ...block2, start: shiftedOffset2(block2.start), end: shiftedOffset2(block2.end) } : null;
    if (currentBlock) currentBlock.source = draftRef.current.slice(currentBlock.start, currentBlock.end);
    const selection = window.getSelection()?.toString() || (selectedText.current?.start === block2?.contentStart ? selectedText.current.text : "") || "";
    window.dispatchEvent(new CustomEvent("hypercanvas:hyperagent-context", { detail: { source: "doc", documentId: artifact.id, title: artifact.title, path: artifact.path, url: window.location.href, block: currentBlock ? { handle: currentBlock.handle, type: currentBlock.type, source: currentBlock.source, start: currentBlock.start, end: currentBlock.end } : null, selection, prompt: "" } }));
  };
  const save = useCallback(async () => {
    if (!persistenceReady || !baseRef.current.revision || savingRef.current || composing.current || conflict2 || draftRef.current === baseRef.current.source) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const source = draftRef.current;
    const epoch = lifecycle.current;
    try {
      const result = await request(base, "write", { documentId: artifact.id, notebookId, expectedRevision: baseRef.current.revision, source });
      if (epoch !== lifecycle.current) return;
      baseRef.current = { source: result.source, revision: result.revision };
      writeDocDraft(draftKey, draftRef.current, baseRef.current);
      setRecovered(false);
      setSaveError("");
      setHistoryVersion((value) => value + 1);
    } catch (problem) {
      if (epoch !== lifecycle.current) return;
      if (problem.status === 409 && problem.data.current) setConflict(problem.data.current);
      setSaveError(problem.message);
    } finally {
      if (epoch === lifecycle.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [artifact.id, base, notebookId, draftKey, persistenceReady, conflict2]);
  useEffect(() => {
    if (!persistenceReady || !dirty || saving || conflict2 || saveError || composing.current) return;
    const timer = setTimeout(() => void save(), 600);
    return () => clearTimeout(timer);
  }, [draft, dirty, savedRevision, persistenceReady, saving, conflict2, saveError, compositionVersion, save]);
  const acceptLatest = () => {
    remember(draftRef.current);
    baseRef.current = { source: conflict2.source, revision: conflict2.revision };
    changeDraft(conflict2.source, false);
    setConflict(null);
    setRecovered(false);
    setSaveError("");
    setError("");
    void parse(conflict2.source);
  };
  const rebaseDraft = () => {
    baseRef.current = { source: conflict2.source, revision: conflict2.revision };
    setConflict(null);
    setSaveError("");
    setError("");
    setHistoryVersion((value) => value + 1);
  };
  const travel = (direction) => {
    const state = history.current;
    const from = direction === "undo" ? state.past : state.future;
    const to = direction === "undo" ? state.future : state.past;
    if (!from.length) return;
    to.push(draftRef.current);
    const source = from.pop();
    changeDraft(source, false);
    activeEdit.current = null;
    textEdits.current.clear();
    setHistoryVersion((value) => value + 1);
    void parse(source);
  };
  const insert = async (source, builtin, captured = insertionTarget2.current) => {
    const epoch = lifecycle.current;
    const basis = draftRef.current;
    if (captured && captured.source !== basis) {
      setError("Document changed. Choose the insertion position again.");
      return;
    }
    const current = analysisRef.current?.source === basis ? analysisRef.current : await parse(basis);
    if (!current?.model || epoch !== lifecycle.current || basis !== draftRef.current) return;
    try {
      const fallback = current.model.blocks[selected2]?.end ?? basis.length;
      const range = captured || { start: fallback, end: fallback };
      const nl = basis.includes("\r\n") ? "\r\n" : "\n";
      const next = builtin ? insertDocBuiltin(current.model, builtin, source, void 0, range) : basis.slice(0, range.start) + `${nl}${nl}${source}${nl}${nl}` + basis.slice(range.end);
      const addedImportLength = builtin && current.model.imports[builtin] !== builtin ? next.length - basis.length - (source.length + nl.length * 4 - (range.end - range.start)) : 0;
      insertionFocus.current = range.start + addedImportLength + nl.length * 2;
      insertionTarget2.current = null;
      insertReturnFocus.current = false;
      focusToRestore.current = null;
      setActiveInsertionTarget(null);
      setActiveInsertionTargetKey(null);
      changeDraft(next);
      setInsertOpen(false);
      await parse(next);
    } catch (problem) {
      setError(problem.message);
    }
  };
  insertionHandler.current = (entry) => {
    if (entry.supported) void insert(entry.source, entry.builtin);
  };
  const catalog = useMemo(() => getDocInsertCatalog(), [widgetVersion]);
  useEffect(() => {
    if (mode === "raw" || false) return;
    const route = window.location.pathname;
    const relativeRoute = route.startsWith(base.replace(/\/+$/, "") + "/") ? route.slice(base.replace(/\/+$/, "").length) : route;
    const routePattern = relativeRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const group = `doc-insert:${notebookId}:${artifact.id}`;
    const actions = catalog.map((entry) => ({ id: `${group}:${entry.id}`, label: `Insert ${entry.label}`, disabled: !entry.supported, excludeRoutes: [`^(?!${routePattern}$)`], hideFromCommandMenu: true }));
    const handlers = Object.fromEntries(catalog.map((entry, index) => [actions[index].id, () => {
      if (rootRef.current?.isConnected && window.location.pathname === route && entry.supported) insertionHandler.current(entry);
    }]));
    setDynamicActions(group, actions, handlers);
    return () => clearDynamicActions(group);
  }, [artifact.id, notebookId, base, mode, catalog]);
  useEffect(() => {
    const capture = () => {
      const element = document.activeElement;
      const index = Number(element?.dataset?.docText);
      const block2 = analysisRef.current?.model?.blocks[index];
      if (element?.matches("textarea[data-doc-text]") && block2 && rootRef.current?.contains(element)) {
        const offset = shiftedOffset(block2.contentStart);
        insertionTarget2.current = { source: draftRef.current, start: offset + element.selectionStart, end: offset + element.selectionEnd, element };
      }
    };
    const key = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") capture();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("storyboard:open-palette", capture, true);
    document.addEventListener("storyboard:toggle-palette", capture, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("storyboard:open-palette", capture, true);
      document.removeEventListener("storyboard:toggle-palette", capture, true);
    };
  }, []);
  useLayoutEffect(() => {
    if (insertionFocus.current === null || !analysis?.model || analysis.source !== draftRef.current) return;
    const offset = insertionFocus.current;
    insertionFocus.current = null;
    const index = analysis.model.blocks.findIndex((block2) => offset >= block2.start && offset <= block2.end);
    const element = rootRef.current?.querySelector(`textarea[data-doc-text="${index}"]`) || rootRef.current?.querySelector(`[data-block-index="${index}"]`);
    element?.focus({ preventScroll: true });
    if (element?.tagName === "TEXTAREA") element.setSelectionRange(0, 0);
  }, [analysis]);
  const imageAssetPrefix = `${"../".repeat((artifact.folderPath || "").split("/").filter(Boolean).length)}assets/canvas/images/`;
  const resolveEditorAsset = (reference, options) => {
    const resolved = resolveAsset?.(reference, options);
    if (resolved?.available || !reference.startsWith(imageAssetPrefix)) return resolved;
    const filename = reference.slice(imageAssetPrefix.length);
    return /^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif)$/.test(filename) ? { available: true, url: `${base.replace(/\/+$/, "")}/_hypercanvas/canvas/images/${encodeURIComponent(filename)}` } : resolved;
  };
  const pasteImage = (event) => {
    const target = event.target;
    if (!target.matches('[data-doc-gap], [data-doc-gap] *, textarea[data-doc-text], textarea[aria-label="Raw document source"]') || target.closest("[data-widget-surface]")) return;
    const atGap = !!target.closest("[data-doc-gap]");
    const file = getClipboardImageFile(event.clipboardData);
    if (atGap && !file) {
      const text = event.clipboardData.getData("text/plain");
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        void insert(text);
      }
      return;
    }
    if (!file || !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) return;
    event.preventDefault();
    event.stopPropagation();
    const source = draftRef.current;
    const epoch = lifecycle.current;
    const block2 = analysisRef.current?.model?.blocks[Number(target.dataset.docText)];
    let start = target.selectionStart, end = target.selectionEnd;
    if (atGap) {
      if (!insertionTarget2.current || insertionTarget2.current.source !== source) return;
      ({ start, end } = insertionTarget2.current);
    } else if (block2) {
      const shift = [...textEdits.current.values()].filter((edit) => edit.block.contentEnd <= block2.contentStart && edit.block.contentStart < block2.contentStart).reduce((sum, edit) => sum + edit.value.length - (edit.block.contentEnd - edit.block.contentStart), 0);
      start += block2.contentStart + shift;
      end += block2.contentStart + shift;
    }
    void (async () => {
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read clipboard image."));
          reader.readAsDataURL(file);
        });
        const saved = await uploadImage(dataUrl);
        if (!saved.success || !saved.filename) throw new Error(saved.error || "Could not store clipboard image.");
        if (epoch !== lifecycle.current) return;
        if (draftRef.current !== source) throw new Error("Document changed while the image was uploading. Paste it again at the intended position.");
        const current = analysisRef.current?.source === source ? analysisRef.current : await parse(source);
        if (!current?.model) throw new Error("Correct the document source before pasting an image.");
        const reference = imageAssetPrefix + saved.filename;
        const next = insertDocBuiltin(current.model, "Image", `<Image src=${JSON.stringify(reference)} alt="Pasted image" />`, void 0, { start, end });
        changeDraft(next);
        insertionTarget2.current = null;
        textEdits.current.clear();
        focusToRestore.current = null;
        await parse(next);
      } catch (problem) {
        if (epoch === lifecycle.current) setError(problem.message);
      }
    })();
  };
  const Content = useMemo(() => {
    if (!analysis?.previewCode) return null;
    try {
      return new Function(analysis.previewCode)(runtime).default;
    } catch {
      return null;
    }
  }, [analysis?.previewCode]);
  const previewComponents = useMemo(() => ({ div: EditorBlock, ...Object.fromEntries(Object.entries(analysis?.aliases || {}).map(([alias, name]) => [alias, BUILTINS[name]])) }), [analysis?.aliases]);
  const preview = useMemo(() => {
    if (!Content || !analysis?.model) return null;
    try {
      return keyPreviewBlocks(Content({ components: previewComponents }), analysis.model.blocks);
    } catch (problem) {
      return /* @__PURE__ */ jsxs("p", { role: "status", children: [
        "Document rendering failed: ",
        problem.message
      ] });
    }
  }, [Content, previewComponents, analysis?.model]);
  const hasPreview = !!preview;
  useLayoutEffect(() => preserveLiveBlockMoves(blocksRef.current), [hasPreview]);
  const filteredInsertions = catalog.filter((entry) => `${entry.label} ${entry.id}`.toLowerCase().includes(insertSearch.toLowerCase()));
  const editor2 = { documentId: draftKey, analysis, mode, selected: selected2, setSelected, rawBlock, busy, activeEdit, textEdits, insertOpen, activeInsertionTarget, activeInsertionTargetKey, setComposing, beginText, editText, selectText, finishText, captureGap, openGap, scheduleAnalysis, operation, move, ask, setError };
  return /* @__PURE__ */ jsxs(
    "article",
    {
      ref: rootRef,
      className: `${documentCss.document} ${css.editor}`,
      onPaste: pasteImage,
      "data-document-id": artifact.id,
      "data-doc-editor": true,
      "data-dirty": dirty ? "true" : "false",
      onKeyDown: (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          void save();
        }
        if (event.key === "Escape" && !insertOpen && !event.defaultPrevented && !event.target.closest("[data-widget-surface]")) {
          setSelected(null);
          if (event.target.closest("[data-block-index]")) event.target.blur();
        }
      },
      children: [
        /* @__PURE__ */ jsxs("header", { className: css.title, children: [
          /* @__PURE__ */ jsx("h1", { children: artifact.title }),
          /* @__PURE__ */ jsx("span", { className: css.path, children: artifact.path })
        ] }),
        /* @__PURE__ */ jsxs(PopoverRoot, { open: insertOpen, onOpenChange: (open) => {
          setInsertOpen(open);
          if (open) setInsertSearch("");
          else {
            setActiveInsertionTarget(null);
            setActiveInsertionTargetKey(null);
          }
        }, children: [
          /* @__PURE__ */ jsx("div", { className: css.dock, "data-hc-ui": "", "data-hc-surface": "toolbar", children: /* @__PURE__ */ jsxs(
            CanvasToolsSurface,
            {
              role: "toolbar",
              "aria-label": "Doc editor",
              onKeyDown: (event) => {
                if (!event.target.matches("button[data-doc-tool]") || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                const buttons = [...event.currentTarget.querySelectorAll("button[data-doc-tool]:not(:disabled)")];
                const index = buttons.indexOf(event.target);
                const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
                event.preventDefault();
                buttons[next]?.focus();
              },
              children: [
                /* @__PURE__ */ jsxs(CanvasToolsGroup, { "aria-label": "Document editing", children: [
                  /* @__PURE__ */ jsx(PopoverTrigger, { render: /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", ref: insertTriggerRef, type: "button", "aria-label": "Insert block", title: "Insert block", onClick: () => {
                    insertReturnFocus.current = insertTriggerRef.current;
                    insertionTarget2.current = null;
                    setActiveInsertionTarget(null);
                    setActiveInsertionTargetKey(null);
                  }, disabled: mode === "raw" }), children: /* @__PURE__ */ jsx(Icon, { name: INSERT_ICON, size: 16, strokeWeight: 2, scale: 1 }) }),
                  /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": "Undo document edit", title: "Undo document edit", disabled: !history.current.past.length || busy, onClick: () => travel("undo"), children: /* @__PURE__ */ jsx(Undo2, {}) }),
                  /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": "Redo document edit", title: "Redo document edit", disabled: !history.current.future.length || busy, onClick: () => travel("redo"), children: /* @__PURE__ */ jsx(Redo2, {}) })
                ] }),
                /* @__PURE__ */ jsx(CanvasToolsGroup, { "aria-label": "Document mode", children: EDITOR_MODES.map(({ value, label, Icon: Icon2 }) => /* @__PURE__ */ jsxs(Tooltip, { children: [
                  /* @__PURE__ */ jsx(TooltipTrigger, { children: /* @__PURE__ */ jsx(CanvasToolButton, { "data-doc-tool": "", type: "button", "aria-label": label, "aria-pressed": mode === value, onClick: () => {
                    setMode(value);
                    setInsertOpen(false);
                    if (value !== "raw") void parse(draftRef.current);
                  }, children: /* @__PURE__ */ jsx(Icon2, {}) }) }),
                  /* @__PURE__ */ jsx(TooltipContent, { side: "top", children: label })
                ] }, value)) })
              ]
            }
          ) }),
          /* @__PURE__ */ jsx(PopoverPortal, { children: /* @__PURE__ */ jsx(PopoverPositioner, { anchor: insertOpen ? activeInsertionTarget?.querySelector("[data-doc-plus-icon]") : void 0, side: insertOpen && activeInsertionTarget ? "bottom" : "top", align: "start", sideOffset: insertOpen && activeInsertionTarget ? 4 : 8, collisionPadding: 12, className: "hc-z-[10000]", "data-doc-insertion-positioner": "", "data-doc-insertion-anchor": insertOpen && activeInsertionTarget ? "inline" : "dock", children: /* @__PURE__ */ jsxs(CanvasToolsPopup, { as: PopoverPopup, className: `${css.insertBounds} hc-shadow-[0_4px_12px_rgb(0_0_0/12%)]`, "aria-label": "Insert document block", initialFocus: insertSearchRef, finalFocus: () => insertReturnFocus.current === false ? false : insertReturnFocus.current?.isConnected ? insertReturnFocus.current : insertTriggerRef.current, children: [
            /* @__PURE__ */ jsx(PopoverTitle, { className: "hc-sr-only", children: "Insert document block" }),
            /* @__PURE__ */ jsx(Input, { ref: insertSearchRef, type: "search", "aria-label": "Search blocks", placeholder: "Text, component or widget…", value: insertSearch, onChange: (event) => setInsertSearch(event.target.value) }),
            /* @__PURE__ */ jsx("div", { className: "hc-mt-1.5", children: filteredInsertions.filter((entry) => entry.group === "content").map((entry) => /* @__PURE__ */ jsx(CanvasToolMenuItem, { as: Button, type: "button", disabled: !entry.supported, title: entry.reason || entry.label, onClick: () => insertionHandler.current(entry), children: entry.label }, entry.id)) }),
            /* @__PURE__ */ jsx(CanvasToolMenuLabel, { as: "h2", children: "Canvas widgets" }),
            filteredInsertions.filter((entry) => entry.group === "widgets").map((entry) => /* @__PURE__ */ jsx(CanvasToolMenuItem, { as: Button, type: "button", "aria-label": entry.label, disabled: !entry.supported, title: entry.reason || entry.label, onClick: () => insertionHandler.current(entry), children: entry.label }, entry.id))
          ] }) }) })
        ] }),
        recovered && /* @__PURE__ */ jsxs("p", { className: css.notice, role: "status", children: [
          "Restored your unsaved draft for this Notebook. ",
          /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setRecovered(false), children: "Dismiss" })
        ] }),
        saveError && !conflict2 && /* @__PURE__ */ jsxs("p", { className: css.notice, role: "alert", children: [
          "Could not save your document: ",
          saveError,
          " Your draft is retained. ",
          /* @__PURE__ */ jsx("button", { type: "button", disabled: saving, onClick: () => void save(), children: "Retry saving" })
        ] }),
        error && /* @__PURE__ */ jsx("p", { className: css.notice, role: "alert", children: error }),
        conflict2 && /* @__PURE__ */ jsxs("section", { className: css.conflict, role: "alert", "aria-label": "Document revision conflict", children: [
          /* @__PURE__ */ jsx("h2", { children: "This document changed on disk" }),
          /* @__PURE__ */ jsx("p", { children: "Your draft is retained. Compare the latest source, then choose a save basis." }),
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "Latest source on disk" }),
            /* @__PURE__ */ jsx("pre", { children: conflict2.source })
          ] }),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: acceptLatest, children: "Load latest source (draft kept in Undo)" }),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: rebaseDraft, children: "Keep draft against latest revision" })
        ] }),
        analysis?.diagnostics?.length > 0 && /* @__PURE__ */ jsxs("section", { className: css.notice, role: "status", "aria-label": "Document source diagnostics", children: [
          /* @__PURE__ */ jsx("ul", { children: analysis.diagnostics.map((diagnostic, index) => /* @__PURE__ */ jsxs("li", { children: [
            diagnostic.path,
            ":",
            diagnostic.line || 1,
            " ",
            diagnostic.message
          ] }, index)) }),
          /* @__PURE__ */ jsx("p", { children: "Source is retained. Use Edit code to correct it and resume autosave." })
        ] }),
        mode === "raw" && /* @__PURE__ */ jsx("textarea", { ref: rawSourceRef, "data-doc-source": "", className: css.rawSource, "aria-label": "Raw document source", value: draft, spellCheck: false, onFocus: () => remember(draftRef.current), onChange: (event) => changeDraft(event.target.value, false), onBlur: () => {
          void save();
        }, onCompositionStart: () => setComposing(true), onCompositionEnd: () => setComposing(false) }),
        preview ? /* @__PURE__ */ jsx(EditingContext.Provider, { value: editor2, children: /* @__PURE__ */ jsxs("div", { ref: blocksRef, className: css.blocks, hidden: mode === "raw", "aria-busy": busy, children: [
          analysis.model.blocks.length === 0 && mode !== "preview" && /* @__PURE__ */ jsx("div", { className: `${css.blockSlot} ${css.emptySlot}`, "data-doc-insertion-slot": "", children: /* @__PURE__ */ jsx("button", { type: "button", className: `${css.insertionTarget} ${css.emptyTarget}`, "data-doc-tool": "", "data-doc-gap": "empty", "data-doc-gap-target": "empty", "data-doc-gap-bridge": "", "aria-haspopup": "dialog", "aria-expanded": insertOpen && activeInsertionTargetKey === "empty", "aria-label": "Insert first block", onFocus: (event) => captureGap(null, "after", event.currentTarget), onClick: (event) => openGap(null, "after", event.currentTarget), children: /* @__PURE__ */ jsx("span", { className: css.plusGlyph, "data-doc-plus-icon": "", children: /* @__PURE__ */ jsx(Icon, { name: INSERT_ICON, size: 14, strokeWeight: 2, scale: 1 }) }) }) }),
          /* @__PURE__ */ jsx(DocumentContent, { artifact, mode: "local", base, resolveArtifact, resolveAsset: resolveEditorAsset, source: analysis.source, children: preview })
        ] }) }) : mode !== "raw" && /* @__PURE__ */ jsx("p", { role: "status", children: busy ? "Preparing document…" : "Preview unavailable. Use Edit code to inspect this document." }),
        /* @__PURE__ */ jsxs("footer", { className: css.footer, children: [
          "Markdown source · ",
          analysis?.model?.blocks.length || 0,
          " blocks"
        ] })
      ]
    }
  );
}
function DocPage() {
  const { docId } = useParams();
  const { search } = useLocation();
  const readonly = new URLSearchParams(search).has("_sb_embed") || new URLSearchParams(search).get("docMode") === "read";
  const [data, setData] = useState(() => documents.getDocumentSnapshot());
  useEffect(() => {
    const update = (event) => setData(event.detail);
    window.addEventListener("hypercanvas:documents-updated", update);
    return () => window.removeEventListener("hypercanvas:documents-updated", update);
  }, []);
  const { documents: documents$1, artifacts, contents, assets, mode, notebookId } = data;
  const resolvers = useMemo(() => createDocumentResolvers({ artifacts, assets, mode, base: globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ }), [artifacts, assets, mode]);
  const matches = documents$1.filter((item) => item.id === docId);
  const artifact = matches[0];
  const entry = artifact && contents[artifact.path];
  return /* @__PURE__ */ jsx("div", { className: `${styles.page} hc-notebook-grid`, "data-document-page": "", "data-sb-surface": "content", children: !readonly && mode === "local" && matches.length === 1 && artifact.available !== false ? /* @__PURE__ */ jsx(DocEditor, { notebookId, ...resolvers, artifact, artifacts, source: entry?.source || "" }, `${notebookId}:${docId}`) : /* @__PURE__ */ jsx(Document, { ...resolvers, artifact: matches.length === 1 ? artifact : { ...artifact, available: false }, artifacts, contents, Content: entry?.Content, source: entry?.source, diagnostics: entry?.diagnostics, mode }) });
}
export {
  DocPage as default
};
