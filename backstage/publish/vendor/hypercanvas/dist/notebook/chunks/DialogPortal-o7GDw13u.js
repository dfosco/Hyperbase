import * as React from "react";
import { f as formatErrorMessage, w as useRenderElement, O as popupTransitionStateMapping, X as transitionStatusMapping, as as popupStateMapping, L as useOpenChangeComplete, M as createDefaultInitialFocus, S as FloatingFocusManager, N as FOCUSABLE_POPUP_PROPS, Q as COMPOSITE_KEYS, A as FloatingPortal, I as InternalBackdrop, H as inertValue } from "./composite-z4dIV_BK.js";
import { jsx, jsxs } from "react/jsx-runtime";
const DialogRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") DialogRootContext.displayName = "DialogRootContext";
function useDialogRootContext(optional) {
  const store = React.useContext(DialogRootContext);
  if (!optional && store === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>." : formatErrorMessage(27));
  }
  return store;
}
const DialogBackdrop = /* @__PURE__ */ React.forwardRef(function DialogBackdrop2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    forceRender = false,
    ...elementProps
  } = componentProps;
  const store = useDialogRootContext();
  const open = store.useState("open");
  const nested = store.useState("nested");
  const mounted = store.useState("mounted");
  const transitionStatus = store.useState("transitionStatus");
  const state = {
    open,
    transitionStatus
  };
  return useRenderElement("div", componentProps, {
    state,
    ref: [store.context.backdropRef, forwardedRef],
    stateAttributesMapping: popupTransitionStateMapping,
    props: [{
      role: "presentation",
      hidden: !mounted,
      style: {
        userSelect: "none",
        WebkitUserSelect: "none"
      }
    }, elementProps],
    enabled: forceRender || !nested
  });
});
if (process.env.NODE_ENV !== "production") DialogBackdrop.displayName = "DialogBackdrop";
const DialogPortalContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") DialogPortalContext.displayName = "DialogPortalContext";
function useDialogPortalContext() {
  const value = React.useContext(DialogPortalContext);
  if (value === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Dialog.Portal> is missing." : formatErrorMessage(26));
  }
  return value;
}
const nestedDialogs = "--nested-dialogs";
const nestedDialogOpen = "data-nested-dialog-open";
const dialogStateAttributesMapping = {
  ...popupStateMapping,
  ...transitionStatusMapping,
  nestedDialogOpen(value) {
    return value ? {
      [nestedDialogOpen]: ""
    } : null;
  }
};
const DialogPopup = /* @__PURE__ */ React.forwardRef(function DialogPopup2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    finalFocus,
    initialFocus,
    ...elementProps
  } = componentProps;
  const store = useDialogRootContext();
  const descriptionElementId = store.useState("descriptionElementId");
  const disablePointerDismissal = store.useState("disablePointerDismissal");
  const floatingRootContext = store.useState("floatingRootContext");
  const rootPopupProps = store.useState("popupProps");
  const modal = store.useState("modal");
  const mounted = store.useState("mounted");
  const nested = store.useState("nested");
  const nestedOpenDialogCount = store.useState("nestedOpenDialogCount");
  const open = store.useState("open");
  const openMethod = store.useState("openMethod");
  const titleElementId = store.useState("titleElementId");
  const transitionStatus = store.useState("transitionStatus");
  const role = store.useState("role");
  const floatingId = floatingRootContext.useState("floatingId");
  useDialogPortalContext();
  useOpenChangeComplete({
    open,
    ref: store.context.popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    }
  });
  const resolvedInitialFocus = initialFocus === void 0 ? createDefaultInitialFocus(store.context.popupRef) : initialFocus;
  const nestedDialogOpen2 = nestedOpenDialogCount > 0;
  const setPopupElement = store.useStateSetter("popupElement");
  const state = {
    open,
    nested,
    transitionStatus,
    nestedDialogOpen: nestedDialogOpen2
  };
  const element = useRenderElement("div", componentProps, {
    state,
    props: [rootPopupProps, {
      id: floatingId,
      "aria-labelledby": titleElementId,
      "aria-describedby": descriptionElementId,
      role,
      ...FOCUSABLE_POPUP_PROPS,
      hidden: !mounted,
      onKeyDown(event) {
        if (COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      },
      style: {
        [nestedDialogs]: nestedOpenDialogCount
      }
    }, elementProps],
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
    stateAttributesMapping: dialogStateAttributesMapping
  });
  return /* @__PURE__ */ jsx(FloatingFocusManager, {
    context: floatingRootContext,
    openInteractionType: openMethod,
    disabled: !mounted,
    closeOnFocusOut: !disablePointerDismissal,
    initialFocus: resolvedInitialFocus,
    returnFocus: finalFocus,
    modal: modal !== false,
    restoreFocus: "popup",
    children: element
  });
});
if (process.env.NODE_ENV !== "production") DialogPopup.displayName = "DialogPopup";
const DialogPortal = /* @__PURE__ */ React.forwardRef(function DialogPortal2(props, forwardedRef) {
  const {
    keepMounted = false,
    ...portalProps
  } = props;
  const store = useDialogRootContext();
  const mounted = store.useState("mounted");
  const modal = store.useState("modal");
  const open = store.useState("open");
  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }
  return /* @__PURE__ */ jsx(DialogPortalContext.Provider, {
    value: keepMounted,
    children: /* @__PURE__ */ jsxs(FloatingPortal, {
      ref: forwardedRef,
      ...portalProps,
      children: [mounted && modal === true && /* @__PURE__ */ jsx(InternalBackdrop, {
        ref: store.context.internalBackdropRef,
        inert: inertValue(!open)
      }), props.children]
    })
  });
});
if (process.env.NODE_ENV !== "production") DialogPortal.displayName = "DialogPortal";
export {
  DialogPortal as D,
  DialogBackdrop as a,
  DialogPopup as b,
  DialogRootContext as c,
  useDialogRootContext as u
};
