import { ag as getTarget, ac as contains, G as useIsoLayoutEffect, o as usePopupInteractionProps, R as ReactStore, g as createPopupOpenState, n as usePopupRootStore, u as usePopupRootSync, i as useImplicitActiveTrigger, j as useOpenStateTransitions, k as createChangeEventDetails, l as imperativeAction, m as PopupHandleAttachment, h as fastComponent } from "./composite-WCaVrKIy.js";
import * as React from "react";
import { u as useDismiss, a as useScrollLock, p as popupStoreSelectors, c as createInitialPopupStoreState, P as PopupTriggerMap } from "./useScrollLock-6_AWQWRh.js";
import { u as useDialogRootContext, c as DialogRootContext } from "./DialogPortal-C55KPLOF.js";
import { jsxs, jsx } from "react/jsx-runtime";
function DialogInteractions({
  store,
  parentContext,
  isDrawer
}) {
  const open = store.useState("open");
  const disablePointerDismissal = store.useState("disablePointerDismissal");
  const modal = store.useState("modal");
  const popupElement = store.useState("popupElement");
  const floatingRootContext = store.useState("floatingRootContext");
  const [ownNestedOpenDialogs, setOwnNestedOpenDialogs] = React.useState(0);
  const [ownNestedOpenDrawers, setOwnNestedOpenDrawers] = React.useState(0);
  const isTopmost = ownNestedOpenDialogs === 0;
  const dismiss = useDismiss(floatingRootContext, {
    outsidePressEvent() {
      if (store.context.internalBackdropRef.current || store.context.backdropRef.current) {
        return "intentional";
      }
      return {
        mouse: modal === "trap-focus" ? "sloppy" : "intentional",
        touch: "sloppy"
      };
    },
    outsidePress(event) {
      if (!store.context.outsidePressEnabledRef.current) {
        return false;
      }
      if ("button" in event && event.button !== 0) {
        return false;
      }
      if ("touches" in event) {
        if (event.type === "touchend") {
          if (event.changedTouches.length !== 1 || event.touches.length !== 0) {
            return false;
          }
        } else if (event.touches.length !== 1) {
          return false;
        }
      }
      const target = getTarget(event);
      if (isTopmost && !disablePointerDismissal) {
        if (modal) {
          const internalBackdrop = store.context.internalBackdropRef.current;
          const backdrop = store.context.backdropRef.current;
          return internalBackdrop || backdrop ? internalBackdrop === target || backdrop === target || contains(target, popupElement) && !target?.hasAttribute("data-base-ui-portal") : true;
        }
        return true;
      }
      return false;
    },
    escapeKey: isTopmost
  });
  useScrollLock(open && modal === true, popupElement);
  store.useContextCallback("onNestedDialogOpen", (dialogCount, drawerCount) => {
    setOwnNestedOpenDialogs(dialogCount);
    setOwnNestedOpenDrawers(drawerCount);
  });
  useIsoLayoutEffect(() => {
    if (parentContext?.onNestedDialogOpen) {
      if (open) {
        parentContext.onNestedDialogOpen(ownNestedOpenDialogs + 1, ownNestedOpenDrawers + (isDrawer ? 1 : 0));
      } else {
        parentContext.onNestedDialogOpen(0, 0);
      }
    }
    return () => {
      if (parentContext?.onNestedDialogOpen && open) {
        parentContext.onNestedDialogOpen(0, 0);
      }
    };
  }, [isDrawer, open, ownNestedOpenDialogs, ownNestedOpenDrawers, parentContext]);
  usePopupInteractionProps(store, {
    // `enabled` is not passed to `useDismiss`, so its props are always defined,
    // and `trigger` is the same object as `reference`.
    activeTriggerProps: dismiss.reference,
    inactiveTriggerProps: dismiss.trigger,
    // DialogPopup and DrawerPopup spread `FOCUSABLE_POPUP_PROPS` directly, so
    // this only needs to carry the dismiss handlers.
    popupProps: dismiss.floating,
    nestedOpenDialogCount: ownNestedOpenDialogs,
    nestedOpenDrawerCount: ownNestedOpenDrawers
  });
  return null;
}
const selectors = {
  ...popupStoreSelectors,
  modal: (state) => state.modal,
  nested: (state) => state.nested,
  nestedOpenDialogCount: (state) => state.nestedOpenDialogCount,
  nestedOpenDrawerCount: (state) => state.nestedOpenDrawerCount,
  disablePointerDismissal: (state) => state.disablePointerDismissal,
  openMethod: (state) => state.openMethod,
  descriptionElementId: (state) => state.descriptionElementId,
  titleElementId: (state) => state.titleElementId,
  viewportElement: (state) => state.viewportElement,
  role: (state) => state.role
};
class DialogStore extends ReactStore {
  constructor(initialState, floatingId, nested) {
    const triggerElements = new PopupTriggerMap();
    const state = createInitialState(initialState, triggerElements, floatingId, nested);
    super(state, createInitialContext(triggerElements), selectors);
  }
  setOpen = (nextOpen, eventDetails) => {
    eventDetails.preventUnmountOnClose = () => {
      this.set("preventUnmountingOnClose", true);
    };
    if (!nextOpen && eventDetails.trigger == null && this.state.activeTriggerId != null) {
      eventDetails.trigger = this.state.activeTriggerElement ?? void 0;
    }
    this.context.onOpenChange?.(nextOpen, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    this.state.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);
    this.update(createPopupOpenState(this.state, nextOpen, eventDetails.trigger));
  };
}
function createInitialState(initialState, triggerElements, floatingId, nested = false) {
  const state = {
    ...createInitialPopupStoreState(triggerElements, floatingId, nested),
    modal: true,
    disablePointerDismissal: false,
    viewportElement: null,
    descriptionElementId: void 0,
    titleElementId: void 0,
    openMethod: null,
    nested: false,
    nestedOpenDialogCount: 0,
    nestedOpenDrawerCount: 0,
    role: "dialog",
    ...initialState
  };
  return state;
}
function createInitialContext(triggerElements) {
  return {
    popupRef: /* @__PURE__ */ React.createRef(),
    backdropRef: /* @__PURE__ */ React.createRef(),
    internalBackdropRef: /* @__PURE__ */ React.createRef(),
    outsidePressEnabledRef: {
      current: true
    },
    triggerElements,
    onOpenChange: void 0,
    onOpenChangeComplete: void 0
  };
}
function useRenderDialogRoot(mode, props) {
  const {
    children,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    onOpenChangeComplete,
    disablePointerDismissal: disablePointerDismissalProp = false,
    modal: modalProp = true,
    actionsRef,
    handle,
    triggerId: triggerIdProp,
    defaultTriggerId: defaultTriggerIdProp = null
  } = props;
  const isDrawer = mode === "drawer";
  const modal = modalProp;
  const disablePointerDismissal = disablePointerDismissalProp;
  const role = "dialog";
  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;
  const rootState = {
    modal,
    disablePointerDismissal,
    nested,
    role
  };
  const store = usePopupRootStore((floatingId, floatingNested) => new DialogStore({
    open: defaultOpen,
    openProp,
    activeTriggerId: defaultTriggerIdProp,
    triggerIdProp,
    ...rootState
  }, floatingId, floatingNested), true);
  store.useControlledProp("openProp", openProp);
  store.useControlledProp("triggerIdProp", triggerIdProp);
  store.useSyncedValues(rootState);
  store.useContextCallback("onOpenChange", onOpenChange);
  store.useContextCallback("onOpenChangeComplete", onOpenChangeComplete);
  const open = store.useState("open");
  const mounted = store.useState("mounted");
  const payload = store.useState("payload");
  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const {
    forceUnmount
  } = useOpenStateTransitions(open, store);
  React.useImperativeHandle(actionsRef, () => ({
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(imperativeAction))
  }), [forceUnmount, store]);
  const shouldRenderInteractions = open || mounted;
  return /* @__PURE__ */ jsxs(DialogRootContext.Provider, {
    value: store,
    children: [handle && /* @__PURE__ */ jsx(PopupHandleAttachment, {
      handle,
      store
    }), shouldRenderInteractions && /* @__PURE__ */ jsx(DialogInteractions, {
      store,
      parentContext: parentStore?.context,
      isDrawer
    }), typeof children === "function" ? children({
      payload
    }) : children]
  });
}
const DialogRoot = fastComponent(function DialogRoot2(props) {
  return useRenderDialogRoot("dialog", props);
});
if (process.env.NODE_ENV !== "production") DialogRoot.displayName = "DialogRoot";
export {
  DialogRoot as D
};
