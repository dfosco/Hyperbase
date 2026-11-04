import { jsx, jsxs } from "react/jsx-runtime";
import * as React from "react";
import { forwardRef } from "react";
import { p as fastComponentRef, q as usePopupHandleStore, f as formatErrorMessage, r as useBaseUiId, s as useTriggerDataForwarding, v as useButton, w as useRenderElement, z as triggerOpenStateMapping, C as CLICK_TRIGGER_IDENTIFIER } from "./composite-WCaVrKIy.js";
import { u as useDialogRootContext, D as DialogPortal, a as DialogBackdrop, b as DialogPopup } from "./DialogPortal-C55KPLOF.js";
import { u as useClick, a as useOpenMethodTriggerProps } from "./useOpenInteractionType-evAUFDho.js";
import { a as cn } from "./createLucideIcon-CV-5aOV3.js";
const DialogTrigger = fastComponentRef(function DialogTrigger2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    disabled = false,
    nativeButton = true,
    id: idProp,
    payload,
    handle,
    ...elementProps
  } = componentProps;
  const dialogRootStore = useDialogRootContext(true);
  const handleStore = usePopupHandleStore(handle);
  const store = handleStore ?? dialogRootStore;
  if (!store) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle." : formatErrorMessage(79));
  }
  const thisTriggerId = useBaseUiId(idProp);
  const floatingContext = store.useState("floatingRootContext");
  const isOpenedByThisTrigger = store.useState("isOpenedByTrigger", thisTriggerId);
  const popupId = store.useState("triggerPopupId", thisTriggerId);
  const triggerElementRef = React.useRef(null);
  const {
    registerTrigger,
    isMountedByThisTrigger
  } = useTriggerDataForwarding(thisTriggerId, triggerElementRef, store, {
    payload
  });
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled,
    native: nativeButton
  });
  const click = useClick(floatingContext);
  const interactionTypeProps = useOpenMethodTriggerProps(() => store.select("open"), (interactionType) => {
    store.set("openMethod", interactionType);
  });
  const state = {
    disabled,
    open: isOpenedByThisTrigger
  };
  const rootTriggerProps = store.useState("triggerProps", isMountedByThisTrigger);
  return useRenderElement("button", componentProps, {
    state,
    ref: [buttonRef, forwardedRef, registerTrigger, triggerElementRef],
    props: [click.reference, rootTriggerProps, interactionTypeProps, {
      [CLICK_TRIGGER_IDENTIFIER]: "",
      id: thisTriggerId,
      "aria-haspopup": "dialog",
      "aria-expanded": isOpenedByThisTrigger,
      "aria-controls": popupId
    }, elementProps, getButtonProps],
    stateAttributesMapping: triggerOpenStateMapping
  });
});
if (process.env.NODE_ENV !== "production") DialogTrigger.displayName = "DialogTrigger";
forwardRef(function DialogTrigger22({ asChild, children, ...props }, ref) {
  if (asChild) {
    return /* @__PURE__ */ jsx(DialogTrigger, { ref, render: children, ...props });
  }
  return /* @__PURE__ */ jsx(DialogTrigger, { ref, ...props, children });
});
const backdrop = "_backdrop_13xwk_1";
const popup = "_popup_13xwk_13";
const widthSmall = "_widthSmall_13xwk_36";
const widthMedium = "_widthMedium_13xwk_37";
const widthLarge = "_widthLarge_13xwk_38";
const widthXLarge = "_widthXLarge_13xwk_39";
const heightSmall = "_heightSmall_13xwk_41";
const heightAuto = "_heightAuto_13xwk_42";
const heightLarge = "_heightLarge_13xwk_43";
const heightXLarge = "_heightXLarge_13xwk_44";
const header = "_header_13xwk_46";
const titleGroup = "_titleGroup_13xwk_55";
const title = "_title_13xwk_55";
const subtitle = "_subtitle_13xwk_69";
const closeBtn = "_closeBtn_13xwk_76";
const body = "_body_13xwk_96";
const css = {
  backdrop,
  popup,
  widthSmall,
  widthMedium,
  widthLarge,
  widthXLarge,
  heightSmall,
  heightAuto,
  heightLarge,
  heightXLarge,
  header,
  titleGroup,
  title,
  subtitle,
  closeBtn,
  body
};
const WIDTH_CLASS = {
  small: css.widthSmall,
  medium: css.widthMedium,
  large: css.widthLarge,
  xlarge: css.widthXLarge
};
const HEIGHT_CLASS = {
  small: css.heightSmall,
  auto: css.heightAuto,
  large: css.heightLarge,
  xlarge: css.heightXLarge
};
const DialogContent = forwardRef(function DialogContent2({
  className,
  width = "medium",
  height = "auto",
  children,
  ...props
}, ref) {
  return /* @__PURE__ */ jsxs(DialogPortal, { children: [
    /* @__PURE__ */ jsx(DialogBackdrop, { className: css.backdrop }),
    /* @__PURE__ */ jsx(
      DialogPopup,
      {
        ref,
        className: cn(css.popup, WIDTH_CLASS[width], HEIGHT_CLASS[height], className),
        ...props,
        children
      }
    )
  ] });
});
export {
  DialogContent as D,
  css as c
};
