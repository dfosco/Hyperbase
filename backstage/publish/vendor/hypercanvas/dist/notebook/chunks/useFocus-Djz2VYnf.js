import * as React from "react";
import { V as useTimeout, aE as getWindow, aR as mergeCleanups, aM as mac, ah as webkit, aI as addEventListener, _ as isElement, aX as createAttribute, aa as activeElement, ab as ownerDocument, ac as contains, bd as isTargetInsideEnabledTrigger, k as createChangeEventDetails, bj as triggerFocus, ag as getTarget, b0 as isTypeableElement, by as matchesFocusVisible, U as isHTMLElement, a as triggerPress, e as escapeKey } from "./composite-WCaVrKIy.js";
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
export {
  useFocus as u
};
