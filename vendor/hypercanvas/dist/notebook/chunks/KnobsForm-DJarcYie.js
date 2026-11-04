import * as React from "react";
import { useContext, useMemo, useSyncExternalStore, forwardRef, useId as useId$1, useEffect, useCallback } from "react";
import { S as StoryboardContext } from "./StoryboardContext-a5DglSkK.js";
import "@dfosco/statefully/core";
import { getPrototypeKnobs } from "../core-1.js";
import { c as createHypercanvasKnobRuntime, a as isKnobHighlightEnabled, r as resolveKnobColor } from "./highlight-BdnfQn3S.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { j as useLabelableContext, L as LabelableContext, d as useFormContext, D as DEFAULT_VALIDITY_STATE, k as fieldValidityMapping, m as FieldRootContext, e as useFieldRootContext, c as useHoverFloatingInteraction, g as getDisabledMountTransitionStyles, a as useAnchorPositioning, b as usePositioner, l as useDirection, u as useHoverReferenceInteraction, s as safePolygon, f as useLabelableId, h as useControlled, i as useRegisterFieldControl, F as FieldControl } from "./FieldControl-s34cBhar.js";
import { f as formatErrorMessage, r as useBaseUiId, $ as useRefWithInit, K as useStableCallback, G as useIsoLayoutEffect, ag as getTarget, ab as ownerDocument, U as isHTMLElement, V as useTimeout, az as mergeProps, av as EMPTY_OBJECT, w as useRenderElement, bg as SafeReact, bf as error$1, W as useTransitionStatus, L as useOpenChangeComplete, X as transitionStatusMapping, O as popupTransitionStateMapping, Q as COMPOSITE_KEYS, ay as outsidePress, S as FloatingFocusManager, k as createChangeEventDetails, A as FloatingPortal, aH as DROPDOWN_COLLISION_AVOIDANCE, E as useAnimationsFinished, B as POPUP_COLLISION_AVOIDANCE, t as triggerHover, I as InternalBackdrop, H as inertValue, J as FloatingNode, bh as siblingOpen, R as ReactStore, bi as FloatingTreeStore, h as fastComponent, Y as useId, Z as useFloatingParentNodeId, D as useFloatingNodeId, i as useImplicitActiveTrigger, j as useOpenStateTransitions, b as attachPreventUnmountOnClose, bj as triggerFocus, a as triggerPress, aL as itemPress, e as escapeKey, g as createPopupOpenState, d as focusOut, ae as listNavigation, bk as useSyncedFloatingRootContext, l as imperativeAction, aq as EMPTY_ARRAY, bl as TYPEAHEAD_RESET_MS, N as FOCUSABLE_POPUP_PROPS, o as usePopupInteractionProps, m as PopupHandleAttachment, F as FloatingTree, bm as useCompositeRootContext, aA as useMergedRefs, aT as isLastTraversableNode, aU as getParentNode, p as fastComponentRef, q as usePopupHandleStore, a4 as useFloatingTree, s as useTriggerDataForwarding, v as useButton, ac as contains, aG as cancelOpen, y as pressableTriggerOpenStateMapping, x as FocusGuard, P as PATIENT_CLICK_THRESHOLD, ax as useValueChanged, aN as dispatchClickWithModifiers, aE as getWindow, aB as visuallyHiddenInput, aC as visuallyHidden, aD as none, bn as scrollIntoViewIfNeeded, ap as isListIndexDisabled, af as findNonDisabledListIndex, a7 as isIndexOutOfListBounds, bo as HOME, bp as END, bq as isNativeInput, a8 as getMinListIndex, a9 as getMaxListIndex, br as ARROW_DOWN, bs as ARROW_UP, bt as ARROW_LEFT, bu as ARROW_RIGHT, bv as MODIFIER_KEYS$1, bw as CompositeRootContext, bx as SHIFT, aw as NOOP } from "./composite-WCaVrKIy.js";
import { r as useMenuRootContext, t as useMenuPositionerContext, b as useToolbarRootContext, v as useContextMenuRootContext, a as useAnchoredPopupScrollLock, w as MenuPositionerContext, C as CompositeList, x as useListNavigation, y as useTypeahead, z as MenuRootContext, A as useCompositeListItem, B as isMouseWithinBounds, u as useTriggerFocusGuards, D as isElementDisabled, E as serializeValue, f as SelectRoot, h as SelectTrigger, j as SelectValue, i as SelectIcon, k as SelectPortal, l as SelectPositioner, m as SelectPopup, o as SelectItem, p as SelectItemText, q as SelectItemIndicator, M as MenuItem$1 } from "./MenuItem-O40zxRgT.js";
import { b as useOpenInteractionType, u as useClick } from "./useOpenInteractionType-evAUFDho.js";
import { p as popupStoreSelectors, c as createInitialPopupStoreState, P as PopupTriggerMap, u as useDismiss } from "./useScrollLock-6_AWQWRh.js";
import { u as useFocus } from "./useFocus-Djz2VYnf.js";
const FieldsetRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") FieldsetRootContext.displayName = "FieldsetRootContext";
function useFieldsetRootContext(optional = false) {
  const context = React.useContext(FieldsetRootContext);
  if (!context && !optional) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>." : formatErrorMessage(86));
  }
  return context;
}
const LabelableProvider = function LabelableProvider2(props) {
  const defaultId = useBaseUiId();
  const [controlIdState, setControlIdState] = React.useState(defaultId);
  const [labelId, setLabelId] = React.useState();
  const [messageIds, setMessageIds] = React.useState([]);
  const controlId = controlIdState === void 0 ? defaultId : controlIdState;
  const registrationsRef = useRefWithInit(() => /* @__PURE__ */ new Map());
  const {
    messageIds: parentMessageIds
  } = useLabelableContext();
  const registerControlId = useStableCallback((source, nextId) => {
    const registrations = registrationsRef.current;
    if (nextId === void 0) {
      registrations.delete(source);
    } else {
      registrations.set(source, nextId);
    }
    setControlIdState((prev) => {
      if (registrations.size === 0) {
        return prev;
      }
      let nextControlId;
      for (const id of registrations.values()) {
        if (id === prev) {
          return prev;
        }
        if (nextControlId === void 0) {
          nextControlId = id;
        }
      }
      return nextControlId;
    });
  });
  const resetControlId = useStableCallback(() => {
    if (registrationsRef.current.size === 0) {
      setControlIdState(defaultId);
    }
  });
  const getDescriptionProps = React.useCallback((externalProps) => {
    const ids = externalProps["aria-describedby"] ? externalProps["aria-describedby"].split(" ") : [];
    ids.push(...parentMessageIds, ...messageIds);
    return {
      ...externalProps,
      "aria-describedby": Array.from(new Set(ids)).join(" ") || void 0
    };
  }, [parentMessageIds, messageIds]);
  const contextValue = React.useMemo(() => ({
    controlId,
    registerControlId,
    resetControlId,
    labelId,
    setLabelId,
    messageIds,
    setMessageIds,
    getDescriptionProps
  }), [controlId, registerControlId, resetControlId, labelId, setLabelId, messageIds, setMessageIds, getDescriptionProps]);
  return /* @__PURE__ */ jsx(LabelableContext.Provider, {
    value: contextValue,
    children: props.children
  });
};
if (process.env.NODE_ENV !== "production") LabelableProvider.displayName = "LabelableProvider";
function useAriaLabelledBy(explicitAriaLabelledBy, labelId, labelSourceRef, enableFallback = true, labelSourceId) {
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = React.useState();
  const generatedLabelId = useBaseUiId(labelSourceId ? `${labelSourceId}-label` : void 0);
  const ariaLabelledBy = explicitAriaLabelledBy ?? labelId ?? fallbackAriaLabelledBy;
  useIsoLayoutEffect(() => {
    const nextAriaLabelledBy = explicitAriaLabelledBy || labelId || !enableFallback ? void 0 : getAriaLabelledBy(labelSourceRef.current, generatedLabelId);
    if (fallbackAriaLabelledBy !== nextAriaLabelledBy) {
      setFallbackAriaLabelledBy(nextAriaLabelledBy);
    }
  });
  return ariaLabelledBy;
}
function getAriaLabelledBy(labelSource, generatedLabelId) {
  const label2 = findAssociatedLabel(labelSource);
  if (!label2) {
    return void 0;
  }
  if (!label2.id && generatedLabelId) {
    label2.id = generatedLabelId;
  }
  return label2.id || void 0;
}
function findAssociatedLabel(labelSource) {
  if (!labelSource) {
    return void 0;
  }
  const parent = labelSource.parentElement;
  if (parent && parent.tagName === "LABEL") {
    return parent;
  }
  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }
  const labels = labelSource.labels;
  return labels && labels[0];
}
function useRegisteredLabelId(idProp, setLabelId) {
  const id = useBaseUiId(idProp);
  useIsoLayoutEffect(() => {
    setLabelId(id);
    return () => {
      setLabelId((currentId) => currentId === id ? void 0 : currentId);
    };
  }, [id, setLabelId]);
  return id;
}
function useLabel(params = {}) {
  const {
    id: idProp,
    fallbackControlId,
    native = false,
    setLabelId: setLabelIdProp,
    focusControl: focusControlProp
  } = params;
  const {
    controlId: contextControlId,
    setLabelId: setContextLabelId
  } = useLabelableContext();
  const syncLabelId = useStableCallback((nextLabelId) => {
    setContextLabelId(nextLabelId);
    setLabelIdProp?.(nextLabelId);
  });
  const id = useRegisteredLabelId(idProp, syncLabelId);
  const resolvedControlId = contextControlId ?? fallbackControlId;
  function focusControl(event) {
    if (focusControlProp) {
      focusControlProp(event, resolvedControlId);
      return;
    }
    if (!resolvedControlId) {
      return;
    }
    const controlElement = ownerDocument(event.currentTarget).getElementById(resolvedControlId);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }
  function handleInteraction(event) {
    const target = getTarget(event.nativeEvent);
    if (target?.closest("button,input,select,textarea")) {
      return;
    }
    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }
    if (native) {
      return;
    }
    focusControl(event);
  }
  return native ? {
    id,
    htmlFor: resolvedControlId,
    onMouseDown: handleInteraction
  } : {
    id,
    onClick: handleInteraction,
    onPointerDown(event) {
      event.preventDefault();
    }
  };
}
function focusElementWithVisible(element) {
  element.focus({
    // Available from Chrome 144+ (January 2026).
    // Safari and Firefox already support it.
    focusVisible: true
  });
}
function getCombinedFieldValidityData(validityData, invalid) {
  return {
    ...validityData,
    state: {
      ...validityData.state,
      valid: !invalid && validityData.state.valid
    }
  };
}
const validityKeys = Object.keys(DEFAULT_VALIDITY_STATE);
function isEligibleInput(input2, formElement) {
  if (input2.matches(":disabled")) {
    return false;
  }
  if (!formElement || input2.form === formElement) {
    return true;
  }
  return input2.form === null && !input2.hasAttribute("form");
}
function findRepresentativeInput(inputs, formElement) {
  let fallback = null;
  for (const input2 of inputs.keys()) {
    if (!isEligibleInput(input2, formElement)) {
      continue;
    }
    if (!input2.validity.valid) {
      return input2;
    }
    fallback ??= input2;
  }
  return fallback;
}
function makeState(customError) {
  return {
    ...DEFAULT_VALIDITY_STATE,
    valid: !customError,
    customError
  };
}
function getNativeErrors(element) {
  return element && element.validationMessage ? [element.validationMessage] : [];
}
function useFieldValidation(params) {
  const {
    elementRef,
    formRef
  } = useFormContext();
  const {
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    invalid,
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    validationMode,
    registeredFieldIdRef
  } = params;
  const {
    controlId,
    getDescriptionProps
  } = useLabelableContext();
  const timeout = useTimeout();
  const inputRef = React.useRef(null);
  const registeredInputs = useRefWithInit(() => /* @__PURE__ */ new Map()).current;
  const validationCommitIdRef = React.useRef(0);
  const customValidityRef = React.useRef(null);
  const registerInput = React.useCallback((element, registration) => {
    registeredInputs.set(element, registration);
    return () => {
      registeredInputs.delete(element);
    };
  }, [registeredInputs]);
  const getInputControl = useStableCallback(() => {
    const element = findRepresentativeInput(registeredInputs, elementRef.current);
    return element && registeredInputs.get(element)?.controlRef.current || null;
  });
  const commit = useStableCallback(async (value, revalidate = false) => {
    validationCommitIdRef.current += 1;
    const validationCommitId = validationCommitIdRef.current;
    function updateRegisteredFieldValidity(nextValidityData, externalInvalid = invalid) {
      const fieldId = registeredFieldIdRef.current ?? controlId;
      if (fieldId == null) {
        return;
      }
      const currentFieldData = formRef.current.fields.get(fieldId);
      if (!currentFieldData) {
        return;
      }
      const validityDataWithFormErrors = getCombinedFieldValidityData(nextValidityData, externalInvalid);
      formRef.current.fields.set(fieldId, {
        ...currentFieldData,
        validityData: validityDataWithFormErrors
      });
    }
    function makeValidityData(validityState, errorMessages) {
      const errors = validityState.valid === false ? errorMessages : [];
      return {
        value,
        state: validityState,
        error: errors[0] ?? "",
        errors,
        initialValue: validityData.initialValue
      };
    }
    function setCustomValidity(element2, message) {
      const displaced = element2.validity.customError ? element2.validationMessage : "";
      const ownedMessage = message.replace(/\r\n?/g, "\n");
      element2.setCustomValidity(ownedMessage);
      customValidityRef.current = [element2, ownedMessage, displaced];
    }
    function clearCustomValidity() {
      const record = customValidityRef.current;
      customValidityRef.current = null;
      if (record && (!record[0].willValidate || record[0].validationMessage === record[1])) {
        record[0].setCustomValidity(record[2]);
      }
    }
    function publish(validityState, errorMessages, externalInvalid) {
      const nextValidityData = makeValidityData(validityState, errorMessages);
      updateRegisteredFieldValidity(nextValidityData, externalInvalid);
      setValidityData(nextValidityData);
    }
    function getState(el) {
      const computedState = validityKeys.reduce((acc, key) => {
        acc[key] = el.validity[key];
        return acc;
      }, {});
      let hasOnlyValueMissingError = false;
      for (const key of validityKeys) {
        if (key === "valid") {
          continue;
        }
        if (key === "valueMissing" && computedState[key]) {
          hasOnlyValueMissingError = true;
        } else if (computedState[key]) {
          return computedState;
        }
      }
      if (hasOnlyValueMissingError && !markedDirtyRef.current) {
        computedState.valid = true;
        computedState.valueMissing = false;
      }
      return computedState;
    }
    function resolveRepresentativeInput() {
      return registeredInputs.size > 0 ? findRepresentativeInput(registeredInputs, elementRef.current) : inputRef.current;
    }
    let element = resolveRepresentativeInput();
    function refreshState() {
      element = resolveRepresentativeInput();
      return element?.willValidate ? getState(element) : makeState(false);
    }
    if (revalidate) {
      if (state.valid !== false || !element) {
        return;
      }
      if (!element.validity.valueMissing) {
        clearCustomValidity();
        const currentElement = resolveRepresentativeInput();
        const foreign = currentElement?.validity.customError ? getNativeErrors(currentElement) : [];
        publish(makeState(foreign.length > 0), foreign, false);
        return;
      }
      for (const key of validityKeys) {
        if (key !== "valid" && key !== "valueMissing" && key !== "customError" && element.validity[key]) {
          return;
        }
      }
    }
    timeout.clear();
    clearCustomValidity();
    let nextState = refreshState();
    let validationErrors = getNativeErrors(element);
    const isValidatingOnChange = shouldValidateOnChange();
    if (validationErrors.length === 0 || isValidatingOnChange) {
      const formValues = Array.from(formRef.current.fields.values()).reduce((acc, field2) => {
        if (field2.name) {
          acc[field2.name] = field2.getValue();
        }
        return acc;
      }, {});
      const resultOrPromise = validate(value, formValues);
      let result;
      if (typeof resultOrPromise === "object" && resultOrPromise !== null && "then" in resultOrPromise) {
        if (nextState.valid === false) {
          publish(nextState, validationErrors);
        } else if (validationMode === "onSubmit" || !validityData.state.customError) {
          nextState.valid = null;
          publish(nextState, validationErrors);
        }
        result = await resultOrPromise;
        if (validationCommitId !== validationCommitIdRef.current) {
          return;
        }
        nextState = refreshState();
      } else {
        result = resultOrPromise;
      }
      validationErrors = result ? [].concat(result).filter(Boolean) : [];
      if (validationErrors.length > 0) {
        nextState.valid = false;
        nextState.customError = true;
        if (element?.willValidate) {
          setCustomValidity(element, validationErrors.join("\n"));
        }
      } else {
        validationErrors = getNativeErrors(element);
      }
    }
    publish(nextState, validationErrors);
  });
  const change = useStableCallback((value, cancelPending = false) => {
    timeout.clear();
    validationCommitIdRef.current += 1;
    if (cancelPending) {
      return;
    }
    const validateOnChange = shouldValidateOnChange();
    if (validateOnChange && value !== "" && validationDebounceTime) {
      timeout.start(validationDebounceTime, () => {
        commit(value);
      });
    } else {
      commit(value, !validateOnChange);
    }
  });
  const getValidationProps = React.useCallback((disabled, externalProps = {}) => mergeProps(getDescriptionProps(externalProps), state.valid === false && !state.disabled && !disabled ? {
    "aria-invalid": true
  } : EMPTY_OBJECT), [getDescriptionProps, state.disabled, state.valid]);
  return React.useMemo(() => ({
    getValidationProps,
    inputRef,
    registeredInputs,
    registerInput,
    getInputControl,
    commit,
    change
  }), [getValidationProps, registeredInputs, registerInput, getInputControl, commit, change]);
}
function useFieldControlRegistration(params) {
  const {
    change,
    commit,
    invalid,
    markedDirtyRef,
    name,
    setRegisteredFieldName,
    registeredFieldIdRef,
    setValidityData,
    validityData
  } = params;
  const {
    formRef
  } = useFormContext();
  const activeFieldControlSourceRef = React.useRef(null);
  const registrationRef = React.useRef(null);
  const initialValueCapturedRef = React.useRef(false);
  const getValueForForm = useStableCallback(() => {
    const registration = registrationRef.current;
    if (!registration) {
      return void 0;
    }
    if (registration.getValue) {
      return registration.getValue();
    }
    return registration.value;
  });
  function getRegistrationValue(registration) {
    return registration.value === void 0 ? getValueForForm() : registration.value;
  }
  const validate = useStableCallback(() => {
    const registration = registrationRef.current;
    markedDirtyRef.current = true;
    if (!registration) {
      commit(validityData.value);
      return;
    }
    commit(getRegistrationValue(registration));
  });
  function refreshRegistration() {
    const registration = registrationRef.current;
    if (!registration || !registration.id) {
      return;
    }
    formRef.current.fields.set(registration.id, {
      getValue: getValueForForm,
      name: name ?? registration.name,
      controlRef: registration.controlRef,
      validityData: getCombinedFieldValidityData(validityData, invalid),
      validate
    });
  }
  function deleteRegistration(id = registrationRef.current?.id) {
    if (id) {
      formRef.current.fields.delete(id);
    }
  }
  function captureInitialValue(registration) {
    if (initialValueCapturedRef.current) {
      return;
    }
    initialValueCapturedRef.current = true;
    const initialValue = getRegistrationValue(registration);
    setValidityData((prev) => prev.initialValue === initialValue ? prev : {
      ...prev,
      initialValue
    });
  }
  useIsoLayoutEffect(() => {
    const registration = registrationRef.current;
    if (!registration || !registration.id) {
      return;
    }
    setRegisteredFieldName(name ? void 0 : registration.name);
    formRef.current.fields.set(registration.id, {
      getValue: getValueForForm,
      name: name ?? registration.name,
      controlRef: registration.controlRef,
      validityData: getCombinedFieldValidityData(validityData, invalid),
      validate
    });
  }, [formRef, getValueForForm, invalid, name, setRegisteredFieldName, validate, validityData]);
  useIsoLayoutEffect(() => {
    const fields2 = formRef.current.fields;
    return () => {
      const id = registrationRef.current?.id;
      if (id) {
        fields2.delete(id);
      }
    };
  }, [formRef]);
  const register = useStableCallback((source, registration) => {
    if (!registration) {
      if (activeFieldControlSourceRef.current === source) {
        activeFieldControlSourceRef.current = null;
        change(void 0, true);
        deleteRegistration();
        registrationRef.current = null;
        setRegisteredFieldName(void 0);
        registeredFieldIdRef.current = void 0;
      }
      return;
    }
    const previousId = registrationRef.current?.id;
    const previousSource = activeFieldControlSourceRef.current;
    if (previousSource && previousSource !== source) {
      change(void 0, true);
    }
    activeFieldControlSourceRef.current = source;
    registrationRef.current = registration;
    if (!name) {
      setRegisteredFieldName(registration.name);
    }
    registeredFieldIdRef.current = registration.id;
    if (previousId && previousId !== registration.id) {
      deleteRegistration(previousId);
    }
    captureInitialValue(registration);
    refreshRegistration();
  });
  return [validate, register];
}
const FieldRootInner = /* @__PURE__ */ React.forwardRef(function FieldRootInner2(componentProps, forwardedRef) {
  const {
    errors,
    validationMode: formValidationMode,
    submitCountRef
  } = useFormContext();
  const {
    render,
    className,
    validate: validateProp,
    validationDebounceTime = 0,
    validationMode = formValidationMode,
    name,
    disabled: disabledProp = false,
    invalid: invalidProp,
    dirty: dirtyProp,
    touched: touchedProp,
    actionsRef,
    style,
    ...elementProps
  } = componentProps;
  const disabledFieldset = useFieldsetRootContext(true)?.disabled;
  const validate = useStableCallback(validateProp || (() => null));
  const disabled = disabledFieldset || disabledProp;
  const [touchedState, setTouchedUnwrapped] = React.useState(false);
  const [dirtyState, setDirtyUnwrapped] = React.useState(false);
  const [filled, setFilled] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const dirty = dirtyProp ?? dirtyState;
  const touched = touchedProp ?? touchedState;
  const markedDirtyRef = React.useRef(dirty);
  const registeredFieldIdRef = React.useRef(void 0);
  const [registeredFieldName, setRegisteredFieldName] = React.useState();
  const effectiveName = name ?? registeredFieldName;
  useIsoLayoutEffect(() => {
    if (dirtyProp !== void 0) {
      markedDirtyRef.current = dirtyProp;
    }
  }, [dirtyProp]);
  const setDirty = useStableCallback((value) => {
    if (dirtyProp !== void 0) {
      return;
    }
    if (value) {
      markedDirtyRef.current = true;
    }
    setDirtyUnwrapped(value);
  });
  const setTouched = useStableCallback((value) => {
    if (touchedProp !== void 0) {
      return;
    }
    setTouchedUnwrapped(value);
  });
  const shouldValidateOnChange = useStableCallback(() => validationMode === "onChange" || validationMode === "onSubmit" && submitCountRef.current > 0);
  const formError = effectiveName && Object.hasOwn(errors, effectiveName) ? errors[effectiveName] : null;
  const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
  const invalid = invalidProp === true || hasFormError;
  const [validityData, setValidityData] = React.useState({
    state: DEFAULT_VALIDITY_STATE,
    error: "",
    errors: [],
    value: null,
    initialValue: null
  });
  const valid = !invalid && (disabled ? null : validityData.state.valid);
  const state = React.useMemo(() => ({
    disabled,
    touched,
    dirty,
    valid,
    filled,
    focused
  }), [disabled, touched, dirty, valid, filled, focused]);
  const validation = useFieldValidation({
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    invalid,
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    validationMode,
    registeredFieldIdRef
  });
  const [validateFieldControl, registerFieldControl] = useFieldControlRegistration({
    change: validation.change,
    commit: validation.commit,
    invalid,
    markedDirtyRef,
    name,
    setRegisteredFieldName,
    registeredFieldIdRef,
    setValidityData,
    validityData
  });
  React.useImperativeHandle(actionsRef, () => ({
    validate: validateFieldControl
  }), [validateFieldControl]);
  const contextValue = React.useMemo(() => ({
    invalid,
    name: effectiveName,
    validityData,
    setValidityData,
    disabled,
    setTouched,
    setDirty,
    setFilled,
    setFocused,
    validationMode,
    shouldValidateOnChange,
    state,
    registerFieldControl,
    validation
  }), [invalid, effectiveName, validityData, disabled, setTouched, setDirty, setFilled, setFocused, validationMode, shouldValidateOnChange, state, registerFieldControl, validation]);
  const element = useRenderElement("div", componentProps, {
    ref: forwardedRef,
    state,
    props: elementProps,
    stateAttributesMapping: fieldValidityMapping
  });
  return /* @__PURE__ */ jsx(FieldRootContext.Provider, {
    value: contextValue,
    children: element
  });
});
if (process.env.NODE_ENV !== "production") FieldRootInner.displayName = "FieldRootInner";
const FieldRoot = /* @__PURE__ */ React.forwardRef(function FieldRoot2(componentProps, forwardedRef) {
  return /* @__PURE__ */ jsx(LabelableProvider, {
    children: /* @__PURE__ */ jsx(FieldRootInner, {
      ...componentProps,
      ref: forwardedRef
    })
  });
});
if (process.env.NODE_ENV !== "production") FieldRoot.displayName = "FieldRoot";
const FieldItemContext = /* @__PURE__ */ React.createContext({
  disabled: false
});
if (process.env.NODE_ENV !== "production") FieldItemContext.displayName = "FieldItemContext";
function useFieldItemContext() {
  const context = React.useContext(FieldItemContext);
  return context;
}
const FieldLabel = /* @__PURE__ */ React.forwardRef(function FieldLabel2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    id: idProp,
    nativeLabel = true,
    ...elementProps
  } = componentProps;
  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const {
    labelId
  } = useLabelableContext();
  const state = {
    ...fieldRootContext.state,
    disabled: fieldRootContext.disabled || fieldItemContext.disabled
  };
  const labelRef = React.useRef(null);
  const labelProps = useLabel({
    id: labelId ?? idProp,
    native: nativeLabel
  });
  if (process.env.NODE_ENV !== "production") {
    React.useEffect(() => {
      if (!labelRef.current) {
        return;
      }
      const isLabelTag = labelRef.current.tagName === "LABEL";
      if (nativeLabel) {
        if (!isLabelTag) {
          const ownerStackMessage = SafeReact.captureOwnerStack?.() || "";
          const message = "<Field.Label> expected a <label> element because the `nativeLabel` prop is true. Rendering a non-<label> disables native label association, so `htmlFor` will not work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.";
          error$1(`${message}${ownerStackMessage}`);
        }
      } else if (isLabelTag) {
        const ownerStackMessage = SafeReact.captureOwnerStack?.() || "";
        const message = "<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. Rendering a <label> assumes native label behavior while Base UI treats it as non-native, which can cause unexpected pointer behavior. Use a non-<label> in the `render` prop, or set `nativeLabel` to `true`.";
        error$1(`${message}${ownerStackMessage}`);
      }
    }, [nativeLabel]);
  }
  const element = useRenderElement("label", componentProps, {
    ref: [forwardedRef, labelRef],
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping
  });
  return element;
});
if (process.env.NODE_ENV !== "production") FieldLabel.displayName = "FieldLabel";
const stateAttributesMapping$1 = {
  ...fieldValidityMapping,
  ...transitionStatusMapping
};
const FieldError = /* @__PURE__ */ React.forwardRef(function FieldError2(componentProps, forwardedRef) {
  const {
    render,
    id: idProp,
    className,
    match,
    style,
    ...elementProps
  } = componentProps;
  const id = useBaseUiId(idProp);
  const {
    validityData,
    state: fieldState,
    name
  } = useFieldRootContext(false);
  const {
    setMessageIds
  } = useLabelableContext();
  const {
    errors
  } = useFormContext();
  const formError = name && Object.hasOwn(errors, name) ? errors[name] : null;
  const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
  const hasSpecificMatch = typeof match === "string";
  let rendered = false;
  if (match === true) {
    rendered = true;
  } else if (fieldState.disabled) {
    rendered = false;
  } else if (hasSpecificMatch) {
    rendered = Boolean(validityData.state[match]);
  } else {
    rendered = hasFormError || validityData.state.valid === false;
  }
  const {
    mounted,
    transitionStatus,
    setMounted
  } = useTransitionStatus(rendered);
  useIsoLayoutEffect(() => {
    if (!rendered || !id) {
      return void 0;
    }
    setMessageIds((v) => v.concat(id));
    return () => {
      setMessageIds((v) => v.filter((item) => item !== id));
    };
  }, [rendered, id, setMessageIds]);
  const errorRef = React.useRef(null);
  const [lastRenderedMessage, setLastRenderedMessage] = React.useState(null);
  const [lastRenderedMessageKey, setLastRenderedMessageKey] = React.useState(null);
  let error2 = validityData.error;
  if (!hasSpecificMatch && hasFormError) {
    error2 = formError;
  } else if (validityData.errors.length > 1) {
    error2 = validityData.errors;
  }
  let errorMessage = error2;
  if (Array.isArray(error2)) {
    errorMessage = error2.length > 1 ? /* @__PURE__ */ jsx("ul", {
      children: error2.map((message) => /* @__PURE__ */ jsx("li", {
        children: message
      }, message))
    }) : error2[0];
  }
  const errorKey = Array.isArray(error2) ? JSON.stringify(error2) : error2;
  if (rendered && errorKey !== lastRenderedMessageKey) {
    setLastRenderedMessageKey(errorKey);
    setLastRenderedMessage(errorMessage);
  }
  useOpenChangeComplete({
    open: rendered,
    ref: errorRef,
    onComplete() {
      if (!rendered) {
        setMounted(false);
      }
    }
  });
  const state = {
    ...fieldState,
    transitionStatus
  };
  const element = useRenderElement("div", componentProps, {
    ref: [forwardedRef, errorRef],
    state,
    props: [{
      id,
      children: rendered ? errorMessage : lastRenderedMessage
    }, elementProps],
    stateAttributesMapping: stateAttributesMapping$1,
    enabled: mounted
  });
  if (!mounted) {
    return null;
  }
  return element;
});
if (process.env.NODE_ENV !== "production") FieldError.displayName = "FieldError";
const FieldDescription = /* @__PURE__ */ React.forwardRef(function FieldDescription2(componentProps, forwardedRef) {
  const {
    render,
    id: idProp,
    className,
    style,
    ...elementProps
  } = componentProps;
  const id = useBaseUiId(idProp);
  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const {
    setMessageIds
  } = useLabelableContext();
  const state = {
    ...fieldRootContext.state,
    disabled: fieldRootContext.disabled || fieldItemContext.disabled
  };
  useIsoLayoutEffect(() => {
    if (!id) {
      return void 0;
    }
    setMessageIds((v) => v.concat(id));
    return () => {
      setMessageIds((v) => v.filter((item) => item !== id));
    };
  }, [id, setMessageIds]);
  const element = useRenderElement("p", componentProps, {
    ref: forwardedRef,
    state,
    props: [{
      id
    }, elementProps],
    stateAttributesMapping: fieldValidityMapping
  });
  return element;
});
if (process.env.NODE_ENV !== "production") FieldDescription.displayName = "FieldDescription";
const SelectGroupContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") SelectGroupContext.displayName = "SelectGroupContext";
function useSelectGroupContext() {
  const context = React.useContext(SelectGroupContext);
  if (context === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>." : formatErrorMessage(56));
  }
  return context;
}
const SelectGroup = /* @__PURE__ */ React.forwardRef(function SelectGroup2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    ...elementProps
  } = componentProps;
  const [labelId, setLabelId] = React.useState();
  const contextValue = React.useMemo(() => ({
    labelId,
    setLabelId
  }), [labelId, setLabelId]);
  const element = useRenderElement("div", componentProps, {
    ref: forwardedRef,
    props: [{
      role: "group",
      "aria-labelledby": labelId
    }, elementProps]
  });
  return /* @__PURE__ */ jsx(SelectGroupContext.Provider, {
    value: contextValue,
    children: element
  });
});
if (process.env.NODE_ENV !== "production") SelectGroup.displayName = "SelectGroup";
const SelectGroupLabel = /* @__PURE__ */ React.forwardRef(function SelectGroupLabel2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    id: idProp,
    ...elementProps
  } = componentProps;
  const {
    setLabelId
  } = useSelectGroupContext();
  const id = useBaseUiId(idProp);
  useIsoLayoutEffect(() => {
    setLabelId(id);
    return () => {
      setLabelId((currentId) => currentId === id ? void 0 : currentId);
    };
  }, [id, setLabelId]);
  const element = useRenderElement("div", componentProps, {
    ref: forwardedRef,
    props: [{
      id,
      "aria-hidden": true
    }, elementProps]
  });
  return element;
});
if (process.env.NODE_ENV !== "production") SelectGroupLabel.displayName = "SelectGroupLabel";
const MenuPopup = /* @__PURE__ */ React.forwardRef(function MenuPopup2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    finalFocus,
    ...elementProps
  } = componentProps;
  const {
    store
  } = useMenuRootContext();
  const {
    side,
    align
  } = useMenuPositionerContext();
  const insideToolbar = useToolbarRootContext() != null;
  const open = store.useState("open");
  const transitionStatus = store.useState("transitionStatus");
  const popupProps = store.useState("popupProps");
  const mounted = store.useState("mounted");
  const instantType = store.useState("instantType");
  const activeTriggerElement = store.useState("activeTriggerElement");
  const parent = store.useState("parent");
  const lastOpenChangeReason = store.useState("lastOpenChangeReason");
  const rootId = store.useState("rootId");
  const floatingContext = store.useState("floatingRootContext");
  const floatingTreeRoot = store.useState("floatingTreeRoot");
  const closeDelay = store.useState("closeDelay");
  const hoverEnabled = store.useState("hoverEnabled");
  const disabled = store.useState("disabled");
  const openMethod = store.useState("openMethod");
  const isContextMenu = parent.type === "context-menu";
  useOpenChangeComplete({
    open,
    ref: store.context.popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    }
  });
  React.useEffect(() => {
    function handleClose(event) {
      store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
    }
    floatingTreeRoot.events.on("close", handleClose);
    return () => {
      floatingTreeRoot.events.off("close", handleClose);
    };
  }, [floatingTreeRoot.events, store]);
  useHoverFloatingInteraction(floatingContext, {
    enabled: hoverEnabled && !disabled && !isContextMenu && parent.type !== "menubar",
    closeDelay
  });
  const setPopupElement = store.useStateSetter("popupElement");
  const state = {
    transitionStatus,
    side,
    align,
    open,
    nested: parent.type === "menu",
    instant: instantType
  };
  const element = useRenderElement("div", componentProps, {
    state,
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
    stateAttributesMapping: popupTransitionStateMapping,
    props: [popupProps, {
      onKeyDown(event) {
        if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      }
    }, getDisabledMountTransitionStyles(transitionStatus), elementProps, {
      "data-rootownerid": rootId
    }]
  });
  let returnFocus = parent.type === void 0 || isContextMenu;
  if (activeTriggerElement || parent.type === "menubar" && lastOpenChangeReason !== outsidePress) {
    returnFocus = true;
  }
  return /* @__PURE__ */ jsx(FloatingFocusManager, {
    context: floatingContext,
    openInteractionType: openMethod,
    modal: isContextMenu,
    disabled: !mounted,
    returnFocus: finalFocus === void 0 ? returnFocus : finalFocus,
    initialFocus: parent.type !== "menu",
    restoreFocus: true,
    externalTree: parent.type !== "menubar" ? floatingTreeRoot : void 0,
    previousFocusableElement: activeTriggerElement,
    nextFocusableElement: parent.type === void 0 ? store.context.triggerFocusTargetRef : void 0,
    beforeContentFocusGuardRef: parent.type === void 0 ? store.context.beforeContentFocusGuardRef : void 0,
    children: element
  });
});
if (process.env.NODE_ENV !== "production") MenuPopup.displayName = "MenuPopup";
const MenuPortalContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") MenuPortalContext.displayName = "MenuPortalContext";
function useMenuPortalContext() {
  const value = React.useContext(MenuPortalContext);
  if (value === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Menu.Portal> is missing." : formatErrorMessage(32));
  }
  return value;
}
const MenuPortal = /* @__PURE__ */ React.forwardRef(function MenuPortal2(props, forwardedRef) {
  const {
    keepMounted = false,
    ...portalProps
  } = props;
  const {
    store,
    parent
  } = useMenuRootContext();
  const mounted = store.useState("mounted");
  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }
  const portalOwnerRole = parent.type === "menu" || parent.type === "menubar" ? "group" : void 0;
  return /* @__PURE__ */ jsx(MenuPortalContext.Provider, {
    value: keepMounted,
    children: /* @__PURE__ */ jsx(FloatingPortal, {
      ref: forwardedRef,
      ...portalProps,
      portalOwnerRole
    })
  });
});
if (process.env.NODE_ENV !== "production") MenuPortal.displayName = "MenuPortal";
const MenuPositioner = /* @__PURE__ */ React.forwardRef(function MenuPositioner2(componentProps, forwardedRef) {
  const {
    anchor: anchorProp,
    positionMethod: positionMethodProp = "absolute",
    className,
    render,
    side,
    align: alignProp,
    sideOffset: sideOffsetProp = 0,
    alignOffset: alignOffsetProp = 0,
    collisionBoundary = "clipping-ancestors",
    collisionPadding = 5,
    arrowPadding = 5,
    sticky = false,
    disableAnchorTracking = false,
    collisionAvoidance: collisionAvoidanceProp = DROPDOWN_COLLISION_AVOIDANCE,
    style,
    ...elementProps
  } = componentProps;
  const {
    store
  } = useMenuRootContext();
  const keepMounted = useMenuPortalContext();
  const contextMenuContext = useContextMenuRootContext(true);
  const parent = store.useState("parent");
  const floatingRootContext = store.useState("floatingRootContext");
  const floatingTreeRoot = store.useState("floatingTreeRoot");
  const mounted = store.useState("mounted");
  const open = store.useState("open");
  const modal = store.useState("modal");
  const openMethod = store.useState("openMethod");
  const triggerElement = store.useState("activeTriggerElement");
  const transitionStatus = store.useState("transitionStatus");
  const positionerElement = store.useState("positionerElement");
  const instantType = store.useState("instantType");
  const adaptiveOrigin = store.useState("adaptiveOrigin");
  const lastOpenChangeReason = store.useState("lastOpenChangeReason");
  const floatingNodeId = store.useState("floatingNodeId");
  const floatingParentNodeId = store.useState("floatingParentNodeId");
  const domReference = floatingRootContext.useState("domReferenceElement");
  const previousTriggerRef = React.useRef(null);
  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);
  let anchor = anchorProp;
  let sideOffset = sideOffsetProp;
  let alignOffset = alignOffsetProp;
  let align = alignProp;
  let collisionAvoidance = collisionAvoidanceProp;
  if (parent.type === "context-menu") {
    anchor = anchorProp ?? parent.context?.anchor;
    align = align ?? "start";
    if (!side && align !== "center") {
      alignOffset = componentProps.alignOffset ?? 2;
      sideOffset = componentProps.sideOffset ?? -5;
    }
  }
  let computedSide = side;
  let computedAlign = align;
  if (parent.type === "menu") {
    computedSide = computedSide ?? "inline-end";
    computedAlign = computedAlign ?? "start";
    collisionAvoidance = componentProps.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE;
  } else if (parent.type === "menubar") {
    computedSide = computedSide ?? (parent.context.orientation === "vertical" ? "inline-end" : "bottom");
    computedAlign = computedAlign ?? "start";
  }
  const contextMenu = parent.type === "context-menu";
  const positioner = useAnchorPositioning({
    anchor,
    floatingRootContext,
    positionMethod: contextMenuContext ? "fixed" : positionMethodProp,
    mounted,
    side: computedSide,
    sideOffset,
    align: computedAlign,
    alignOffset,
    arrowPadding: contextMenu ? 0 : arrowPadding,
    collisionBoundary,
    collisionPadding,
    sticky,
    nodeId: floatingNodeId,
    keepMounted,
    disableAnchorTracking,
    collisionAvoidance,
    shift: contextMenu ? {
      crossAxis: !("side" in collisionAvoidance && collisionAvoidance.side === "flip"),
      rootBoundary: "layoutViewport"
    } : void 0,
    externalTree: floatingTreeRoot,
    adaptiveOrigin
  });
  React.useEffect(() => {
    function onMenuOpenChange(details) {
      if (details.open) {
        if (details.parentNodeId === floatingNodeId) {
          store.set("hoverEnabled", false);
        }
        if (details.nodeId !== floatingNodeId && details.parentNodeId === store.select("floatingParentNodeId")) {
          store.setOpen(false, createChangeEventDetails(siblingOpen));
        }
      }
    }
    floatingTreeRoot.events.on("menuopenchange", onMenuOpenChange);
    return () => {
      floatingTreeRoot.events.off("menuopenchange", onMenuOpenChange);
    };
  }, [store, floatingTreeRoot.events, floatingNodeId]);
  React.useEffect(() => {
    if (store.select("floatingParentNodeId") == null) {
      return void 0;
    }
    function onParentClose(details) {
      if (details.open || details.nodeId !== store.select("floatingParentNodeId")) {
        return;
      }
      const reason = details.reason ?? siblingOpen;
      store.setOpen(false, createChangeEventDetails(reason));
    }
    floatingTreeRoot.events.on("menuopenchange", onParentClose);
    return () => {
      floatingTreeRoot.events.off("menuopenchange", onParentClose);
    };
  }, [floatingTreeRoot.events, store]);
  const closeTimeout = useTimeout();
  React.useEffect(() => {
    if (!open) {
      closeTimeout.clear();
    }
  }, [open, closeTimeout]);
  React.useEffect(() => {
    function onItemHover(event) {
      if (!open || event.nodeId !== store.select("floatingParentNodeId")) {
        return;
      }
      if (event.target && triggerElement && triggerElement !== event.target) {
        const delay = store.select("closeDelay");
        if (delay > 0) {
          if (!closeTimeout.isStarted()) {
            closeTimeout.start(delay, () => {
              store.setOpen(false, createChangeEventDetails(siblingOpen));
            });
          }
        } else {
          store.setOpen(false, createChangeEventDetails(siblingOpen));
        }
      } else {
        closeTimeout.clear();
      }
    }
    floatingTreeRoot.events.on("itemhover", onItemHover);
    return () => {
      floatingTreeRoot.events.off("itemhover", onItemHover);
    };
  }, [floatingTreeRoot.events, open, triggerElement, store, closeTimeout]);
  React.useEffect(() => {
    const eventDetails = {
      open,
      nodeId: floatingNodeId,
      parentNodeId: floatingParentNodeId,
      reason: store.select("lastOpenChangeReason")
    };
    floatingTreeRoot.events.emit("menuopenchange", eventDetails);
  }, [floatingTreeRoot.events, open, store, floatingNodeId, floatingParentNodeId]);
  useIsoLayoutEffect(() => {
    const currentTrigger = domReference;
    const previousTrigger = previousTriggerRef.current;
    if (currentTrigger) {
      previousTriggerRef.current = currentTrigger;
    }
    if (previousTrigger && currentTrigger && currentTrigger !== previousTrigger) {
      store.set("instantType", void 0);
      const abortController = new AbortController();
      runOnceAnimationsFinish(() => {
        store.set("instantType", "trigger-change");
      }, abortController.signal);
      return () => {
        abortController.abort();
      };
    }
    return void 0;
  }, [domReference, runOnceAnimationsFinish, store]);
  const state = {
    open,
    side: positioner.side,
    align: positioner.align,
    anchorHidden: positioner.anchorHidden,
    nested: parent.type === "menu",
    instant: instantType
  };
  const menubarModal = parent.type === "menubar" && parent.context.modal;
  const popupModal = modal && lastOpenChangeReason !== triggerHover;
  useAnchoredPopupScrollLock(open && (menubarModal || popupModal), openMethod === "touch", positionerElement, triggerElement);
  const element = usePositioner(componentProps, state, {
    styles: positioner.positionerStyles,
    transitionStatus,
    props: elementProps,
    refs: [forwardedRef, store.useStateSetter("positionerElement")],
    hidden: !mounted,
    inert: !open
  });
  const shouldRenderBackdrop = mounted && parent.type !== "menu" && (parent.type !== "menubar" && modal && lastOpenChangeReason !== triggerHover || parent.type === "menubar" && parent.context.modal);
  let backdropCutout = null;
  if (parent.type === "menubar") {
    backdropCutout = parent.context.contentElement;
  } else if (parent.type === void 0) {
    backdropCutout = triggerElement;
  }
  return /* @__PURE__ */ jsxs(MenuPositionerContext.Provider, {
    value: positioner,
    children: [shouldRenderBackdrop && /* @__PURE__ */ jsx(InternalBackdrop, {
      ref: parent.type === "context-menu" || parent.type === "nested-context-menu" ? parent.context.internalBackdropRef : null,
      inert: inertValue(!open),
      cutout: backdropCutout
    }), /* @__PURE__ */ jsx(FloatingNode, {
      id: floatingNodeId,
      children: /* @__PURE__ */ jsx(CompositeList, {
        elementsRef: store.context.itemDomElements,
        labelsRef: store.context.itemLabels,
        children: element
      })
    })]
  });
});
if (process.env.NODE_ENV !== "production") MenuPositioner.displayName = "MenuPositioner";
const MenubarContext = /* @__PURE__ */ React.createContext(null);
if (process.env.NODE_ENV !== "production") MenubarContext.displayName = "MenubarContext";
function useMenubarContext(optional) {
  const context = React.useContext(MenubarContext);
  return context;
}
const selectors = {
  ...popupStoreSelectors,
  disabled: (state) => state.parent.type === "menubar" ? state.parent.context.disabled || state.disabled : state.disabled,
  modal: (state) => (state.parent.type === void 0 || state.parent.type === "context-menu") && (state.modal ?? true),
  openMethod: (state) => state.openMethod,
  allowMouseEnter: (state) => state.allowMouseEnter,
  highlightItemOnHover: (state) => state.highlightItemOnHover,
  parent: (state) => state.parent,
  rootId: (state) => {
    if (state.parent.type === "menu") {
      return state.parent.store.select("rootId");
    }
    return state.parent.type !== void 0 ? state.parent.context.rootId : state.rootId;
  },
  activeIndex: (state) => state.activeIndex,
  isActive: (state, itemIndex) => state.activeIndex === itemIndex,
  hoverEnabled: (state) => state.hoverEnabled,
  instantType: (state) => state.instantType,
  lastOpenChangeReason: (state) => state.openChangeReason,
  floatingTreeRoot: (state) => {
    if (state.parent.type === "menu") {
      return state.parent.store.select("floatingTreeRoot");
    }
    return state.floatingTreeRoot;
  },
  floatingNodeId: (state) => state.floatingNodeId,
  floatingParentNodeId: (state) => state.floatingParentNodeId,
  itemProps: (state) => state.itemProps,
  closeDelay: (state) => state.closeDelay,
  adaptiveOrigin: (state) => state.adaptiveOrigin,
  keyboardEventRelay: (state) => {
    if (state.keyboardEventRelay) {
      return state.keyboardEventRelay;
    }
    if (state.parent.type === "menu") {
      return state.parent.store.select("keyboardEventRelay");
    }
    return void 0;
  }
};
class MenuStore extends ReactStore {
  constructor(initialState, floatingId, nested = false) {
    const triggerElements = new PopupTriggerMap();
    const state = createInitialState(triggerElements, floatingId, nested, initialState);
    super(state, createInitialContext(triggerElements), selectors);
    this.unsubscribeParentListener = this.observe("parent", (parent) => {
      this.unsubscribeParentListener?.();
      if (parent.type === "menu") {
        let rootId = parent.store.select("rootId");
        let floatingTreeRoot = parent.store.select("floatingTreeRoot");
        let keyboardEventRelay = parent.store.select("keyboardEventRelay");
        this.unsubscribeParentListener = parent.store.subscribe(() => {
          const nextRootId = parent.store.select("rootId");
          const nextFloatingTreeRoot = parent.store.select("floatingTreeRoot");
          const nextKeyboardEventRelay = parent.store.select("keyboardEventRelay");
          if (rootId === nextRootId && floatingTreeRoot === nextFloatingTreeRoot && keyboardEventRelay === nextKeyboardEventRelay) {
            return;
          }
          rootId = nextRootId;
          floatingTreeRoot = nextFloatingTreeRoot;
          keyboardEventRelay = nextKeyboardEventRelay;
          this.notifyAll();
        });
        this.context.allowMouseUpTriggerRef = parent.store.context.allowMouseUpTriggerRef;
        return;
      }
      if (parent.type !== void 0) {
        this.context.allowMouseUpTriggerRef = parent.context.allowMouseUpTriggerRef;
      }
      this.unsubscribeParentListener = null;
    });
  }
  setOpen(open, eventDetails) {
    this.state.floatingRootContext.context.events.emit("setOpen", {
      open,
      eventDetails
    });
  }
  unsubscribeParentListener = null;
}
function createInitialContext(triggerElements) {
  return {
    positionerRef: /* @__PURE__ */ React.createRef(),
    popupRef: /* @__PURE__ */ React.createRef(),
    typingRef: {
      current: false
    },
    itemDomElements: {
      current: []
    },
    itemLabels: {
      current: []
    },
    allowMouseUpTriggerRef: {
      current: false
    },
    triggerFocusTargetRef: /* @__PURE__ */ React.createRef(),
    beforeContentFocusGuardRef: /* @__PURE__ */ React.createRef(),
    onOpenChangeComplete: void 0,
    triggerElements
  };
}
function createInitialState(triggerElements, floatingId, nested = false, initialState) {
  return {
    ...createInitialPopupStoreState(triggerElements, floatingId, nested),
    disabled: false,
    modal: true,
    openMethod: null,
    allowMouseEnter: false,
    highlightItemOnHover: true,
    parent: {
      type: void 0
    },
    rootId: void 0,
    activeIndex: null,
    hoverEnabled: true,
    instantType: void 0,
    openChangeReason: null,
    floatingTreeRoot: new FloatingTreeStore(),
    floatingNodeId: void 0,
    floatingParentNodeId: null,
    itemProps: EMPTY_OBJECT,
    keyboardEventRelay: void 0,
    closeDelay: 0,
    adaptiveOrigin: void 0,
    ...initialState
  };
}
const MenuSubmenuRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") MenuSubmenuRootContext.displayName = "MenuSubmenuRootContext";
function useMenuSubmenuRootContext() {
  return React.useContext(MenuSubmenuRootContext);
}
const MenuRoot$1 = fastComponent(function MenuRoot(props) {
  const {
    children,
    open: openProp,
    onOpenChange,
    onOpenChangeComplete,
    defaultOpen = false,
    disabled: disabledProp = false,
    modal: modalProp,
    loopFocus = true,
    orientation = "vertical",
    actionsRef,
    closeParentOnEsc = false,
    handle,
    triggerId: triggerIdProp,
    defaultTriggerId: defaultTriggerIdProp = null,
    highlightItemOnHover = true
  } = props;
  const contextMenuContext = useContextMenuRootContext(true);
  const parentMenuRootContext = useMenuRootContext(true);
  const menubarContext = useMenubarContext(true);
  const isSubmenu = useMenuSubmenuRootContext();
  const parentFromContext = React.useMemo(() => {
    if (isSubmenu && parentMenuRootContext) {
      return {
        type: "menu",
        store: parentMenuRootContext.store
      };
    }
    if (menubarContext) {
      return {
        type: "menubar",
        context: menubarContext
      };
    }
    if (contextMenuContext && !parentMenuRootContext) {
      return {
        type: "context-menu",
        context: contextMenuContext
      };
    }
    return {
      type: void 0
    };
  }, [contextMenuContext, parentMenuRootContext, menubarContext, isSubmenu]);
  const rootId = useId();
  const floatingId = useId();
  const floatingParentNodeIdFromContext = useFloatingParentNodeId();
  const parentMenuStore = parentFromContext.type === "menu" ? parentFromContext.store : void 0;
  const animateInitialOpen = (openProp ?? defaultOpen) && parentMenuStore?.state.transitionStatus === "starting";
  const seededInstantType = useRefWithInit(() => animateInitialOpen ? parentMenuStore?.state.instantType : void 0).current;
  const store = useMenuRootStore({
    open: defaultOpen,
    openProp,
    activeTriggerId: defaultTriggerIdProp,
    triggerIdProp,
    parent: parentFromContext,
    disabled: disabledProp,
    highlightItemOnHover,
    modal: parentFromContext.type === void 0 ? modalProp : void 0,
    rootId,
    instantType: seededInstantType
  }, floatingId, floatingParentNodeIdFromContext != null);
  store.useControlledProp("openProp", openProp);
  store.useControlledProp("triggerIdProp", triggerIdProp);
  store.useContextCallback("onOpenChangeComplete", onOpenChangeComplete);
  const floatingTreeRoot = store.useState("floatingTreeRoot");
  const floatingNodeIdFromContext = useFloatingNodeId(floatingTreeRoot);
  const open = store.useState("open");
  const activeTriggerElement = store.useState("activeTriggerElement");
  const positionerElement = store.useState("positionerElement");
  const hoverEnabled = store.useState("hoverEnabled");
  const disabled = store.useState("disabled");
  const lastOpenChangeReason = store.useState("lastOpenChangeReason");
  const parent = store.useState("parent");
  const activeIndex = store.useState("activeIndex");
  const payload = store.useState("payload");
  const floatingParentNodeId = store.useState("floatingParentNodeId");
  const openEventRef = React.useRef(null);
  const allowOutsidePressDismissalRef = React.useRef(parent.type !== "context-menu");
  const allowOutsidePressDismissalTimeout = useTimeout();
  const allowTouchToCloseRef = React.useRef(true);
  const allowTouchToCloseTimeout = useTimeout();
  const nested = floatingParentNodeId != null;
  if (process.env.NODE_ENV !== "production") {
    if (parent.type !== void 0 && modalProp !== void 0) {
      console.warn("Base UI: The `modal` prop is not supported on nested menus. It will be ignored.");
    }
  }
  const {
    openMethod,
    triggerProps: interactionTypeProps
  } = useOpenInteractionType(open);
  store.useSyncedValues({
    disabled: disabledProp,
    highlightItemOnHover,
    modal: parent.type === void 0 ? modalProp : void 0,
    openMethod,
    rootId
  });
  useImplicitActiveTrigger(store);
  const {
    forceUnmount,
    transitionStatus
  } = useOpenStateTransitions(open, store, () => {
    store.set("allowMouseEnter", false);
  }, animateInitialOpen);
  const runOnceAnimationsFinish = useAnimationsFinished(store.context.popupRef);
  React.useEffect(() => {
    if (seededInstantType === void 0) {
      return void 0;
    }
    const clearSeededInstantType = () => {
      if (store.state.instantType === seededInstantType) {
        store.set("instantType", void 0);
      }
    };
    if (!open) {
      clearSeededInstantType();
      return void 0;
    }
    if (transitionStatus !== void 0) {
      return void 0;
    }
    if (store.context.popupRef.current == null) {
      clearSeededInstantType();
      return void 0;
    }
    const abortController = new AbortController();
    runOnceAnimationsFinish(clearSeededInstantType, abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [seededInstantType, open, transitionStatus, runOnceAnimationsFinish, store]);
  useIsoLayoutEffect(() => {
    if (contextMenuContext && !parentMenuRootContext) {
      store.update({
        parent: {
          type: "context-menu",
          context: contextMenuContext
        },
        floatingNodeId: floatingNodeIdFromContext,
        floatingParentNodeId: floatingParentNodeIdFromContext
      });
    } else if (parentMenuRootContext) {
      store.update({
        floatingNodeId: floatingNodeIdFromContext,
        floatingParentNodeId: floatingParentNodeIdFromContext
      });
    }
  }, [contextMenuContext, parentMenuRootContext, floatingNodeIdFromContext, floatingParentNodeIdFromContext, store]);
  React.useEffect(() => {
    if (!open) {
      openEventRef.current = null;
    }
    if (parent.type !== "context-menu") {
      return;
    }
    if (!open) {
      allowOutsidePressDismissalTimeout.clear();
      allowOutsidePressDismissalRef.current = false;
      return;
    }
    allowOutsidePressDismissalTimeout.start(500, () => {
      allowOutsidePressDismissalRef.current = true;
    });
  }, [allowOutsidePressDismissalTimeout, open, parent.type]);
  useIsoLayoutEffect(() => {
    if (!open && !hoverEnabled) {
      store.set("hoverEnabled", true);
    }
  }, [open, hoverEnabled, store]);
  const setOpen = useStableCallback((nextOpen, eventDetails) => {
    const reason = eventDetails.reason;
    if (!nextOpen && !store.select("open")) {
      return;
    }
    if (open === nextOpen && eventDetails.trigger === activeTriggerElement && lastOpenChangeReason === reason) {
      return;
    }
    const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);
    if (!nextOpen && eventDetails.trigger == null) {
      eventDetails.trigger = activeTriggerElement ?? void 0;
    }
    onOpenChange?.(nextOpen, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    store.state.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);
    const nativeEvent = eventDetails.event;
    if (nextOpen === false && nativeEvent?.type === "click" && nativeEvent.pointerType === "touch" && !allowTouchToCloseRef.current) {
      return;
    }
    if (nextOpen && reason === triggerFocus) {
      allowTouchToCloseRef.current = false;
      allowTouchToCloseTimeout.start(300, () => {
        allowTouchToCloseRef.current = true;
      });
    } else {
      allowTouchToCloseRef.current = true;
      allowTouchToCloseTimeout.clear();
    }
    const isKeyboardClick = (reason === triggerPress || reason === itemPress) && nativeEvent.detail === 0;
    const isDismissClose = !nextOpen && (reason === escapeKey || reason == null);
    openEventRef.current = eventDetails.event;
    const popupOpenState = createPopupOpenState(store.state, nextOpen, eventDetails.trigger, shouldPreventUnmountOnClose());
    popupOpenState.openChangeReason = reason;
    if (parent.type === "menubar" && (reason === triggerFocus || reason === focusOut || reason === triggerHover || reason === listNavigation || reason === siblingOpen)) {
      popupOpenState.instantType = "group";
    } else if (isKeyboardClick || isDismissClose) {
      popupOpenState.instantType = isKeyboardClick ? "click" : "dismiss";
    } else {
      popupOpenState.instantType = void 0;
    }
    store.update(popupOpenState);
  });
  const floatingRootContext = useSyncedFloatingRootContext({
    popupStore: store,
    floatingRootContext: store.state.floatingRootContext,
    floatingId,
    nested: floatingParentNodeIdFromContext != null,
    onOpenChange: setOpen
  });
  const floatingEvents = floatingRootContext.context.events;
  useIsoLayoutEffect(() => {
    const handleSetOpenEvent = ({
      open: nextOpen,
      eventDetails
    }) => setOpen(nextOpen, eventDetails);
    floatingEvents.on("setOpen", handleSetOpenEvent);
    return () => {
      floatingEvents?.off("setOpen", handleSetOpenEvent);
    };
  }, [floatingEvents, setOpen]);
  const handleImperativeClose = React.useCallback(() => {
    store.setOpen(false, createChangeEventDetails(imperativeAction));
  }, [store]);
  React.useImperativeHandle(actionsRef, () => ({
    unmount: forceUnmount,
    close: handleImperativeClose
  }), [forceUnmount, handleImperativeClose]);
  let ctx;
  if (parent.type === "context-menu") {
    ctx = parent.context;
  }
  React.useImperativeHandle(ctx?.positionerRef, () => positionerElement, [positionerElement]);
  React.useImperativeHandle(ctx?.actionsRef, () => ({
    setOpen
  }), [setOpen]);
  const dismiss = useDismiss(floatingRootContext, {
    enabled: !disabled,
    bubbles: {
      escapeKey: closeParentOnEsc && parent.type === "menu"
    },
    outsidePress() {
      if (parent.type !== "context-menu" || openEventRef.current?.type === "contextmenu") {
        return true;
      }
      return allowOutsidePressDismissalRef.current;
    },
    externalTree: nested ? floatingTreeRoot : void 0
  });
  const direction = useDirection();
  const setActiveIndex = React.useCallback((index) => {
    if (store.select("activeIndex") === index) {
      return;
    }
    store.set("activeIndex", index);
  }, [store]);
  const listNavigation$1 = useListNavigation(floatingRootContext, {
    enabled: !disabled,
    listRef: store.context.itemDomElements,
    activeIndex,
    nested: parent.type !== void 0,
    loopFocus,
    orientation,
    parentOrientation: parent.type === "menubar" ? parent.context.orientation : void 0,
    rtl: direction === "rtl",
    disabledIndices: EMPTY_ARRAY,
    onNavigate: setActiveIndex,
    openOnArrowKeyDown: parent.type !== "context-menu",
    externalTree: nested ? floatingTreeRoot : void 0,
    focusItemOnHover: highlightItemOnHover
  });
  const onTyping = React.useCallback((nextTyping) => {
    store.context.typingRef.current = nextTyping;
  }, [store]);
  const typeahead = useTypeahead(floatingRootContext, {
    enabled: !disabled,
    listRef: store.context.itemLabels,
    elementsRef: store.context.itemDomElements,
    activeIndex,
    resetMs: TYPEAHEAD_RESET_MS,
    onMatch: (index) => {
      if (open && index !== activeIndex) {
        store.set("activeIndex", index);
      }
    },
    onTyping
  });
  const activeTriggerProps = React.useMemo(() => {
    const mergedProps = mergeProps(typeahead.reference, listNavigation$1.reference, dismiss.reference, {
      onMouseMove() {
        store.set("allowMouseEnter", true);
      }
    }, interactionTypeProps);
    mergedProps["aria-haspopup"] = "menu";
    mergedProps["aria-expanded"] = open;
    return mergedProps;
  }, [store, typeahead.reference, listNavigation$1.reference, dismiss.reference, interactionTypeProps, open]);
  const inactiveTriggerProps = React.useMemo(() => {
    const mergedProps = mergeProps(listNavigation$1.trigger, dismiss.trigger, interactionTypeProps);
    mergedProps["aria-haspopup"] = "menu";
    mergedProps["aria-expanded"] = false;
    return mergedProps;
  }, [listNavigation$1.trigger, dismiss.trigger, interactionTypeProps]);
  useRefWithInit(() => {
    store.update({
      inactiveTriggerProps
    });
    return null;
  });
  const popupProps = React.useMemo(() => mergeProps(FOCUSABLE_POPUP_PROPS, {
    id: floatingId,
    role: "menu",
    // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
    "aria-orientation": orientation === "horizontal" ? "horizontal" : void 0,
    "aria-labelledby": activeTriggerElement?.id,
    onMouseMove() {
      store.set("allowMouseEnter", true);
      if (parent.type === "menu") {
        store.set("hoverEnabled", false);
      }
    },
    onClick() {
      if (store.select("hoverEnabled")) {
        store.set("hoverEnabled", false);
      }
    },
    onKeyDown(event) {
      const relay = store.select("keyboardEventRelay");
      if (relay && !event.isPropagationStopped()) {
        relay(event);
      }
    }
  }, typeahead.floating, listNavigation$1.floating, dismiss.floating), [activeTriggerElement, floatingId, orientation, parent.type, store, typeahead.floating, listNavigation$1.floating, dismiss.floating]);
  const itemProps = listNavigation$1.item ?? EMPTY_OBJECT;
  usePopupInteractionProps(store, {
    floatingRootContext,
    activeTriggerProps,
    inactiveTriggerProps,
    popupProps,
    itemProps
  });
  const context = React.useMemo(() => ({
    store,
    parent: parentFromContext
  }), [store, parentFromContext]);
  const content = /* @__PURE__ */ jsxs(MenuRootContext.Provider, {
    value: context,
    children: [handle && /* @__PURE__ */ jsx(PopupHandleAttachment, {
      handle,
      store
    }), typeof children === "function" ? children({
      payload
    }) : children]
  });
  if (parent.type === void 0 || parent.type === "context-menu") {
    return /* @__PURE__ */ jsx(FloatingTree, {
      externalTree: floatingTreeRoot,
      children: content
    });
  }
  return content;
});
if (process.env.NODE_ENV !== "production") MenuRoot$1.displayName = "MenuRoot";
function useMenuRootStore(initialState, floatingId, nested) {
  const store = useRefWithInit(() => new MenuStore(initialState, floatingId, nested)).current;
  return store;
}
function useCompositeItem(params = {}) {
  const {
    highlightItemOnHover,
    highlightedIndex,
    onHighlightedIndexChange
  } = useCompositeRootContext();
  const {
    ref,
    index
  } = useCompositeListItem(params);
  const isHighlighted = highlightedIndex === index;
  const itemRef = React.useRef(null);
  const mergedRef = useMergedRefs(ref, itemRef);
  const compositeProps = {
    tabIndex: isHighlighted ? 0 : -1,
    onFocus() {
      onHighlightedIndexChange(index);
    },
    onMouseMove() {
      const item = itemRef.current;
      if (!highlightItemOnHover || !item) {
        return;
      }
      const disabled = item.hasAttribute("disabled") || item.ariaDisabled === "true";
      if (!isHighlighted && !disabled) {
        item.focus();
      }
    }
  };
  return {
    compositeProps,
    compositeRef: mergedRef,
    index
  };
}
function CompositeItem(componentProps) {
  const {
    render,
    className,
    style,
    state = EMPTY_OBJECT,
    props = EMPTY_ARRAY,
    refs = EMPTY_ARRAY,
    metadata,
    stateAttributesMapping: stateAttributesMapping2,
    tag = "div",
    ...elementProps
  } = componentProps;
  const {
    compositeProps,
    compositeRef
  } = useCompositeItem({
    metadata
  });
  return useRenderElement(tag, componentProps, {
    state,
    // The composite ref attaches first so an outer item wins when nested items share a DOM node.
    ref: [compositeRef, ...refs],
    props: [compositeProps, ...props, elementProps],
    stateAttributesMapping: stateAttributesMapping2
  });
}
function findRootOwnerId(node) {
  if (isHTMLElement(node) && node.hasAttribute("data-rootownerid")) {
    return node.getAttribute("data-rootownerid");
  }
  if (isLastTraversableNode(node)) {
    return void 0;
  }
  return findRootOwnerId(getParentNode(node));
}
function useMixedToggleClickHandler(params) {
  const {
    enabled = true,
    mouseDownAction,
    open
  } = params;
  const ignoreClickRef = React.useRef(false);
  return React.useMemo(() => {
    if (!enabled) {
      return EMPTY_OBJECT;
    }
    return {
      onMouseDown: (event) => {
        if (mouseDownAction === "open" && !open || mouseDownAction === "close" && open) {
          ignoreClickRef.current = true;
          ownerDocument(event.currentTarget).addEventListener("click", () => {
            ignoreClickRef.current = false;
          }, {
            once: true
          });
        }
      },
      onClick: (event) => {
        if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          event.preventBaseUIHandler();
        }
      }
    };
  }, [enabled, mouseDownAction, open]);
}
const MenuTrigger = fastComponentRef(function MenuTrigger2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    disabled: disabledProp = false,
    nativeButton = true,
    id: idProp,
    openOnHover: openOnHoverProp,
    delay = 100,
    closeDelay = 0,
    handle,
    payload,
    ...elementProps
  } = componentProps;
  const rootContext = useMenuRootContext(true);
  const handleStore = usePopupHandleStore(handle);
  const store = handleStore ?? rootContext?.store;
  if (!store) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle." : formatErrorMessage(85));
  }
  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = store.useState("isTriggerActive", thisTriggerId);
  const floatingRootContext = store.useState("floatingRootContext");
  const isOpenedByThisTrigger = store.useState("isOpenedByTrigger", thisTriggerId);
  const popupId = store.useState("triggerPopupId", thisTriggerId);
  const triggerElementRef = React.useRef(null);
  const parent = useMenuParent();
  const compositeRootContext = useCompositeRootContext(true);
  const floatingTreeRootFromContext = useFloatingTree();
  const floatingTreeRoot = React.useMemo(() => {
    return floatingTreeRootFromContext ?? new FloatingTreeStore();
  }, [floatingTreeRootFromContext]);
  const floatingNodeId = useFloatingNodeId(floatingTreeRoot);
  const floatingParentNodeId = useFloatingParentNodeId();
  const {
    registerTrigger,
    isMountedByThisTrigger
  } = useTriggerDataForwarding(thisTriggerId, triggerElementRef, store, {
    payload,
    closeDelay,
    parent,
    floatingTreeRoot,
    floatingNodeId,
    floatingParentNodeId,
    keyboardEventRelay: compositeRootContext?.relayKeyboardEvent
  });
  const isInMenubar = parent.type === "menubar";
  const rootDisabled = store.useState("disabled");
  const disabled = disabledProp || rootDisabled || isInMenubar && parent.context.disabled;
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled,
    native: nativeButton
  });
  React.useEffect(() => {
    if (!isOpenedByThisTrigger && parent.type === void 0) {
      store.context.allowMouseUpTriggerRef.current = false;
    }
  }, [store, isOpenedByThisTrigger, parent.type]);
  const triggerRef = React.useRef(null);
  const allowMouseUpTriggerTimeout = useTimeout();
  const handleDocumentMouseUp = useStableCallback((mouseEvent) => {
    if (!triggerRef.current) {
      return;
    }
    allowMouseUpTriggerTimeout.clear();
    store.context.allowMouseUpTriggerRef.current = false;
    const mouseUpTarget = mouseEvent.target;
    if (contains(triggerRef.current, mouseUpTarget) || contains(store.select("positionerElement"), mouseUpTarget) || mouseUpTarget === triggerRef.current) {
      return;
    }
    if (mouseUpTarget != null && findRootOwnerId(mouseUpTarget) === store.select("rootId")) {
      return;
    }
    if (isMouseWithinBounds(mouseEvent, triggerRef.current)) {
      return;
    }
    floatingTreeRoot.events.emit("close", {
      domEvent: mouseEvent,
      reason: cancelOpen
    });
  });
  React.useEffect(() => {
    if (isOpenedByThisTrigger && store.select("lastOpenChangeReason") === triggerHover) {
      const doc = ownerDocument(triggerRef.current);
      doc.addEventListener("mouseup", handleDocumentMouseUp, {
        once: true
      });
    }
  }, [isOpenedByThisTrigger, handleDocumentMouseUp, store]);
  const parentMenubarHasSubmenuOpen = isInMenubar && parent.context.hasSubmenuOpen;
  const openOnHover = openOnHoverProp ?? parentMenubarHasSubmenuOpen;
  const hoverProps = useHoverReferenceInteraction(floatingRootContext, {
    enabled: openOnHover && !disabled && (!isInMenubar || parentMenubarHasSubmenuOpen && !isMountedByThisTrigger),
    handleClose: safePolygon({
      blockPointerEvents: !isInMenubar
    }),
    mouseOnly: true,
    move: false,
    restMs: parent.type === void 0 ? delay : void 0,
    delay: {
      close: closeDelay
    },
    triggerElementRef,
    externalTree: floatingTreeRoot,
    isActiveTrigger: isTriggerActive,
    isClosing: () => store.select("transitionStatus") === "ending"
  });
  const stickIfOpen = useStickIfOpen(isOpenedByThisTrigger, store.select("lastOpenChangeReason"));
  const click = useClick(floatingRootContext, {
    enabled: !disabled,
    event: isOpenedByThisTrigger && isInMenubar ? "click" : "mousedown",
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: parent.type === void 0 ? stickIfOpen : false
  });
  const focus = useFocus(floatingRootContext, {
    enabled: !disabled && parentMenubarHasSubmenuOpen
  });
  const mixedToggleHandlers = useMixedToggleClickHandler({
    open: isOpenedByThisTrigger,
    enabled: isInMenubar,
    mouseDownAction: "open"
  });
  const localInteractionProps = React.useMemo(() => mergeProps(focus.reference, click.reference), [focus.reference, click.reference]);
  const rootTriggerProps = store.useState("triggerProps", isMountedByThisTrigger);
  const {
    preFocusGuardRef,
    handlePreFocusGuardFocus,
    handleFocusTargetFocus
  } = useTriggerFocusGuards(store, triggerElementRef);
  const state = {
    disabled,
    open: isOpenedByThisTrigger
  };
  const ref = [triggerRef, forwardedRef, buttonRef, registerTrigger, triggerElementRef];
  const props = [localInteractionProps, hoverProps ?? EMPTY_OBJECT, rootTriggerProps, {
    "aria-haspopup": "menu",
    "aria-controls": popupId,
    id: thisTriggerId,
    onMouseDown: (event) => {
      if (store.select("open")) {
        return;
      }
      allowMouseUpTriggerTimeout.start(200, () => {
        store.context.allowMouseUpTriggerRef.current = true;
      });
      const doc = ownerDocument(event.currentTarget);
      doc.addEventListener("mouseup", handleDocumentMouseUp, {
        once: true
      });
    }
  }, isInMenubar ? {
    role: "menuitem"
  } : {}, mixedToggleHandlers, elementProps, getButtonProps];
  const element = useRenderElement("button", componentProps, {
    enabled: !isInMenubar,
    stateAttributesMapping: pressableTriggerOpenStateMapping,
    state,
    ref,
    props
  });
  if (isInMenubar) {
    return /* @__PURE__ */ jsx(CompositeItem, {
      tag: "button",
      render,
      className,
      style,
      state,
      refs: ref,
      props,
      stateAttributesMapping: pressableTriggerOpenStateMapping
    });
  }
  if (isOpenedByThisTrigger) {
    return /* @__PURE__ */ jsxs(React.Fragment, {
      children: [/* @__PURE__ */ jsx(FocusGuard, {
        ref: preFocusGuardRef,
        onFocus: handlePreFocusGuardFocus
      }, `${thisTriggerId}-pre-focus-guard`), /* @__PURE__ */ jsx(React.Fragment, {
        children: element
      }, thisTriggerId), /* @__PURE__ */ jsx(FocusGuard, {
        ref: store.context.triggerFocusTargetRef,
        onFocus: handleFocusTargetFocus
      }, `${thisTriggerId}-post-focus-guard`)]
    });
  }
  return /* @__PURE__ */ jsx(React.Fragment, {
    children: element
  }, thisTriggerId);
});
if (process.env.NODE_ENV !== "production") MenuTrigger.displayName = "MenuTrigger";
function useStickIfOpen(open, openReason) {
  const stickIfOpenTimeout = useTimeout();
  const [stickIfOpen, setStickIfOpen] = React.useState(false);
  useIsoLayoutEffect(() => {
    if (open && openReason === triggerHover) {
      setStickIfOpen(true);
      stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        setStickIfOpen(false);
      });
    } else if (!open) {
      stickIfOpenTimeout.clear();
      setStickIfOpen(false);
    }
  }, [open, openReason, stickIfOpenTimeout]);
  return stickIfOpen;
}
function useMenuParent() {
  const menubarContext = useMenubarContext();
  const parent = React.useMemo(() => {
    if (menubarContext) {
      return {
        type: "menubar",
        context: menubarContext
      };
    }
    return {
      type: void 0
    };
  }, [menubarContext]);
  return parent;
}
function detectKnobRoute(pathname = window.location.pathname, basePath = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/") {
  let path = pathname;
  const base = basePath.replace(/\/+$/, "");
  if (base && base !== "/" && path.startsWith(base)) {
    path = path.slice(base.length) || "/";
  }
  path = path.replace(/^\/prototypes\.html(?=\/|$)/, "") || "/";
  path = path.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  const branchSegment = segments[0]?.startsWith("branch--") ? segments[0] : null;
  const protoIdx = branchSegment ? 1 : 0;
  const prototypeName = segments[protoIdx] || null;
  const routeSegments = prototypeName ? segments.slice(protoIdx + 1) : [];
  const route = routeSegments.length > 0 ? `/${routeSegments.join("/")}` : void 0;
  return { prototypeName, route };
}
function useKnob(id, { route, scope } = {}) {
  const context = useContext(StoryboardContext);
  const detected = detectKnobRoute();
  const hasExplicitRoute = route !== void 0 || scope !== void 0;
  const routeValue = route !== void 0 ? route : scope;
  const resolvedRoute = hasExplicitRoute ? routeValue : detected.route;
  const prototypeName = context?.prototypeName ?? detected.prototypeName;
  const knobs = useMemo(() => prototypeName ? getPrototypeKnobs(prototypeName) : [], [prototypeName]);
  const runtime = useMemo(() => createHypercanvasKnobRuntime(knobs, {
    ...resolvedRoute === void 0 ? {} : { route: resolvedRoute }
  }), [knobs, resolvedRoute]);
  useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const definition = hasExplicitRoute ? runtime.store.resolve(id, resolvedRoute) : runtime.store.resolve(id);
  const state = definition ? runtime.read(definition) : null;
  if (state) return state.value;
  return hasExplicitRoute ? runtime.store.getKnob(id, void 0, resolvedRoute) : runtime.store.getKnob(id);
}
function getDefaultFormSubmitter(form2) {
  if (!form2) {
    return null;
  }
  for (const candidate of form2.elements) {
    const tagName = candidate.tagName;
    if (tagName === "BUTTON" || tagName === "INPUT") {
      const button2 = candidate;
      if (button2.type === "submit") {
        return button2;
      }
    }
  }
  return null;
}
const checked$1 = "data-checked";
const unchecked$1 = "data-unchecked";
function getCheckboxStateAttributesMapping(state) {
  return {
    checked(value) {
      if (state.indeterminate) {
        return {};
      }
      if (value) {
        return {
          [checked$1]: ""
        };
      }
      return {
        [unchecked$1]: ""
      };
    },
    ...fieldValidityMapping
  };
}
const CheckboxGroupContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") CheckboxGroupContext.displayName = "CheckboxGroupContext";
function useCheckboxGroupContext() {
  return React.useContext(CheckboxGroupContext);
}
const CheckboxRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") CheckboxRootContext.displayName = "CheckboxRootContext";
function useCheckboxRootContext() {
  const context = React.useContext(CheckboxRootContext);
  if (context === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>." : formatErrorMessage(14));
  }
  return context;
}
const PARENT_CHECKBOX = "data-parent";
const CheckboxRoot = /* @__PURE__ */ React.forwardRef(function CheckboxRoot2(componentProps, forwardedRef) {
  const {
    checked: checkedProp,
    className,
    defaultChecked = false,
    "aria-labelledby": ariaLabelledByProp,
    disabled: disabledProp = false,
    form: form2,
    id: idProp,
    indeterminate = false,
    inputRef: inputRefProp,
    name: nameProp,
    onCheckedChange,
    parent = false,
    readOnly = false,
    render,
    required = false,
    uncheckedValue,
    value: valueProp,
    nativeButton = false,
    style,
    ...elementProps
  } = componentProps;
  const {
    clearErrors
  } = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    setDirty,
    setFilled,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const {
    labelId,
    registerControlId,
    getDescriptionProps
  } = useLabelableContext();
  const groupContext = useCheckboxGroupContext();
  const parentContext = groupContext?.allValues === void 0 ? void 0 : groupContext.parent;
  const isGroupedWithParent = parentContext !== void 0;
  const disabled = rootDisabled || fieldItemContext.disabled || groupContext?.disabled || disabledProp;
  const name = fieldName ?? nameProp;
  const value = valueProp ?? name;
  const id = useBaseUiId();
  const ownsControlId = groupContext?.registerControlId !== registerControlId;
  const controlId = useLabelableId({
    id: idProp || void 0,
    enabled: ownsControlId
  });
  const rootId = nativeButton ? controlId : id;
  let groupProps = {};
  if (isGroupedWithParent) {
    if (parent) {
      groupProps = parentContext.getParentProps();
    } else if (value !== void 0) {
      groupProps = parentContext.getChildProps(value);
    }
  }
  const {
    checked: groupChecked = checkedProp,
    indeterminate: groupIndeterminate = indeterminate,
    onCheckedChange: groupOnChange,
    ...otherGroupProps
  } = groupProps;
  const groupValue = groupContext?.value;
  const controlRef = React.useRef(null);
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled,
    native: nativeButton
  });
  const validation = groupContext?.validation ?? localValidation;
  const [checked2, setCheckedState] = useControlled({
    controlled: value !== void 0 && groupValue !== void 0 && !parent ? groupValue.includes(value) : groupChecked,
    default: defaultChecked,
    name: "Checkbox",
    state: "checked"
  });
  const computedChecked = isGroupedWithParent ? Boolean(groupChecked) : checked2;
  const computedIndeterminate = isGroupedWithParent ? groupIndeterminate || indeterminate : indeterminate;
  useRegisterFieldControl(controlRef, id, checked2, void 0, !groupContext && !disabled, nameProp);
  const registerChildId = parentContext?.registerChildId;
  const inputRef = React.useRef(null);
  const registerFieldInput = validation.registerInput;
  const registeredInputValue = groupContext ? value : void 0;
  const registerInput = React.useCallback((element2) => registerFieldInput(element2, {
    controlRef,
    value: registeredInputValue
  }), [registerFieldInput, registeredInputValue]);
  const mergedInputRef = useMergedRefs(inputRefProp, inputRef, parent ? void 0 : registerInput);
  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, inputRef, !nativeButton, controlId);
  useIsoLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = computedIndeterminate;
    }
    if (!groupContext) {
      setFilled(checked2);
    }
  }, [checked2, computedIndeterminate, groupContext, setFilled]);
  useValueChanged(checked2, () => {
    if (groupContext) {
      return;
    }
    clearErrors(name);
    setDirty(checked2 !== validityData.initialValue);
    validation.change(checked2);
  });
  const inputProps = mergeProps(
    {
      checked: checked2,
      disabled,
      form: form2,
      // parent checkboxes unset `name` to be excluded from form submission
      name: parent ? void 0 : name,
      // Set `id` to stop Chrome warning about an unassociated input.
      // When using a native button, the `id` is applied to the button instead.
      id: nativeButton ? void 0 : controlId,
      required,
      ref: mergedInputRef,
      style: name ? visuallyHiddenInput : visuallyHidden,
      tabIndex: -1,
      type: "checkbox",
      "aria-hidden": true,
      onChange(event) {
        if (event.nativeEvent.defaultPrevented) {
          return;
        }
        if (readOnly) {
          event.preventDefault();
          return;
        }
        const nextChecked = event.currentTarget.checked;
        const details = createChangeEventDetails(none, event.nativeEvent);
        onCheckedChange?.(nextChecked, details);
        if (details.isCanceled) {
          return;
        }
        groupOnChange?.(nextChecked, details);
        if (details.isCanceled) {
          return;
        }
        setCheckedState(nextChecked);
        if (value !== void 0 && groupContext !== void 0 && !parent && !isGroupedWithParent) {
          const nextGroupValue = nextChecked ? [...groupContext.value, value] : groupContext.value.filter((item) => item !== value);
          groupContext.setValue(nextGroupValue, details);
        }
      },
      onClick(event) {
        event.stopPropagation();
      },
      onFocus() {
        controlRef.current?.focus();
      }
    },
    // React <19 sets an empty value if `undefined` is passed explicitly
    // To avoid this, we only set the value if it's defined
    valueProp !== void 0 ? {
      value: (groupContext ? checked2 && valueProp : valueProp) || ""
    } : EMPTY_OBJECT,
    getDescriptionProps,
    (props) => validation.getValidationProps(disabled, props)
  );
  React.useEffect(() => {
    if (!parentContext || value === void 0) {
      return void 0;
    }
    const disabledStates = parentContext.disabledStatesRef.current;
    disabledStates.set(value, disabled);
    return () => {
      disabledStates.delete(value);
    };
  }, [parentContext, disabled, value]);
  const state = React.useMemo(() => ({
    ...fieldState,
    checked: computedChecked,
    disabled,
    readOnly,
    required,
    indeterminate: computedIndeterminate
  }), [fieldState, computedChecked, disabled, readOnly, required, computedIndeterminate]);
  const stateAttributesMapping2 = getCheckboxStateAttributesMapping(state);
  const element = useRenderElement("span", componentProps, {
    state,
    ref: [buttonRef, controlRef, forwardedRef],
    props: [{
      id: rootId,
      role: "checkbox",
      "aria-checked": computedIndeterminate ? "mixed" : computedChecked,
      "aria-readonly": readOnly || void 0,
      "aria-required": required || void 0,
      "aria-labelledby": ariaLabelledBy,
      [PARENT_CHECKBOX]: parent ? "" : void 0,
      onFocus() {
        if (!disabled) {
          setFocused(true);
        }
      },
      onBlur() {
        const inputEl = inputRef.current;
        if (!inputEl) {
          return;
        }
        setTouched(true);
        setFocused(false);
        if (validationMode === "onBlur") {
          validation.commit(groupContext ? groupValue : inputEl.checked);
        }
      },
      onKeyDown(event) {
        if (event.key !== "Enter") {
          return;
        }
        event.preventBaseUIHandler();
        if (event.defaultPrevented) {
          return;
        }
        const formToSubmit = inputRef.current?.form ?? null;
        const currentTarget = event.currentTarget;
        const nativeEvent = event.nativeEvent;
        const originalPreventDefault = event.preventDefault;
        const originalNativePreventDefault = nativeEvent.preventDefault;
        let preventDefaultCalledAfterPropagation = false;
        event.preventDefault = () => {
          preventDefaultCalledAfterPropagation = true;
          originalPreventDefault.call(event);
        };
        nativeEvent.preventDefault = () => {
          preventDefaultCalledAfterPropagation = true;
          originalNativePreventDefault.call(nativeEvent);
        };
        originalNativePreventDefault.call(nativeEvent);
        getWindow(currentTarget).queueMicrotask(() => {
          event.preventDefault = originalPreventDefault;
          nativeEvent.preventDefault = originalNativePreventDefault;
          if (!preventDefaultCalledAfterPropagation) {
            getDefaultFormSubmitter(formToSubmit)?.click();
          }
        });
      },
      onClick(event) {
        if (readOnly || disabled) {
          return;
        }
        event.preventDefault();
        const input2 = inputRef.current;
        if (!input2) {
          return;
        }
        dispatchClickWithModifiers(input2, event);
      }
    }, elementProps, otherGroupProps, getButtonProps, getDescriptionProps, (props) => validation.getValidationProps(disabled, props)],
    stateAttributesMapping: stateAttributesMapping2
  });
  const renderedId = element.props.id;
  useIsoLayoutEffect(() => {
    if (!registerChildId || parent || value === void 0 || renderedId === void 0) {
      return void 0;
    }
    return registerChildId(value, renderedId);
  }, [registerChildId, parent, value, renderedId]);
  return /* @__PURE__ */ jsxs(CheckboxRootContext.Provider, {
    value: state,
    children: [element, !checked2 && !groupContext && name && !parent && uncheckedValue !== void 0 && /* @__PURE__ */ jsx("input", {
      type: "hidden",
      form: form2,
      name,
      value: uncheckedValue,
      disabled
    }), /* @__PURE__ */ jsx("input", {
      ...inputProps,
      suppressHydrationWarning: true
    })]
  });
});
if (process.env.NODE_ENV !== "production") CheckboxRoot.displayName = "CheckboxRoot";
const CheckboxIndicator = /* @__PURE__ */ React.forwardRef(function CheckboxIndicator2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    keepMounted = false,
    ...elementProps
  } = componentProps;
  const rootState = useCheckboxRootContext();
  const rendered = rootState.checked || rootState.indeterminate;
  const {
    mounted,
    transitionStatus,
    setMounted
  } = useTransitionStatus(rendered);
  const indicatorRef = React.useRef(null);
  const state = {
    ...rootState,
    transitionStatus
  };
  useOpenChangeComplete({
    batch: true,
    enabled: !rendered,
    open: rendered,
    ref: indicatorRef,
    onComplete() {
      if (!rendered) {
        setMounted(false);
      }
    }
  });
  const baseStateAttributesMapping = getCheckboxStateAttributesMapping(rootState);
  const stateAttributesMapping2 = {
    ...baseStateAttributesMapping,
    ...transitionStatusMapping
  };
  const shouldRender = keepMounted || mounted;
  const element = useRenderElement("span", componentProps, {
    ref: [forwardedRef, indicatorRef],
    state,
    stateAttributesMapping: stateAttributesMapping2,
    props: elementProps
  });
  if (!shouldRender) {
    return null;
  }
  return element;
});
if (process.env.NODE_ENV !== "production") CheckboxIndicator.displayName = "CheckboxIndicator";
const ACTIVE_COMPOSITE_ITEM = "data-composite-item-active";
function useCompositeRoot(params) {
  const {
    loopFocus = true,
    orientation = "both",
    grid,
    onLoop,
    direction,
    highlightedIndex: externalHighlightedIndex,
    onHighlightedIndexChange: externalSetHighlightedIndex,
    rootRef: externalRef,
    enableHomeAndEndKeys = false,
    stopEventPropagation,
    disabledIndices,
    modifierKeys = EMPTY_ARRAY
  } = params;
  const [internalHighlightedIndex, internalSetHighlightedIndex] = React.useState(0);
  const isGrid = grid != null;
  const rootRef = React.useRef(null);
  const mergedRef = useMergedRefs(rootRef, externalRef);
  const elementsRef = React.useRef([]);
  const hasSetDefaultIndexRef = React.useRef(false);
  const highlightedElementRef = React.useRef(null);
  const highlightedIndex = externalHighlightedIndex ?? internalHighlightedIndex;
  const onHighlightedIndexChange = useStableCallback((index, shouldScrollIntoView = false) => {
    highlightedElementRef.current = elementsRef.current[index] ?? null;
    (externalSetHighlightedIndex ?? internalSetHighlightedIndex)(index);
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.current[index];
      scrollIntoViewIfNeeded(rootRef.current, newActiveItem, direction, orientation);
    }
  });
  const onMapChange = useStableCallback((map) => {
    if (map.size === 0) {
      return;
    }
    if (hasSetDefaultIndexRef.current) {
      const elements = elementsRef.current;
      const nextIndex = elements.indexOf(highlightedElementRef.current);
      if (nextIndex === -1) {
        const replacement = elements[highlightedIndex];
        if (!replacement || isListIndexDisabled(elements, highlightedIndex, disabledIndices)) {
          onHighlightedIndexChange(getFallbackIndex(elements, disabledIndices));
        } else {
          highlightedElementRef.current = replacement;
        }
      } else if (nextIndex !== highlightedIndex) {
        onHighlightedIndexChange(nextIndex);
      }
      return;
    }
    hasSetDefaultIndexRef.current = true;
    const sortedElements = Array.from(map.keys());
    const activeItem = sortedElements.find((compositeElement) => compositeElement?.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
    const activeIndex = activeItem ? map.get(activeItem)?.index ?? -1 : -1;
    if (activeIndex !== -1) {
      onHighlightedIndexChange(activeIndex);
    } else if (isListIndexDisabled(sortedElements, highlightedIndex, disabledIndices)) {
      const firstEnabledIndex = findNonDisabledListIndex(sortedElements, {
        disabledIndices
      });
      if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }
    scrollIntoViewIfNeeded(rootRef.current, activeItem, direction, orientation);
  });
  useIsoLayoutEffect(() => {
    if (disabledIndices == null || externalHighlightedIndex != null || !hasSetDefaultIndexRef.current) {
      return;
    }
    const elements = elementsRef.current;
    if (isListIndexDisabled(elements, highlightedIndex, disabledIndices)) {
      const firstEnabledIndex = findNonDisabledListIndex(elements, {
        disabledIndices
      });
      if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }
  }, [disabledIndices, externalHighlightedIndex, highlightedIndex, elementsRef, onHighlightedIndexChange]);
  const wrappedOnLoop = useStableCallback((event, prevIndex, nextIndex) => {
    if (!onLoop) {
      return nextIndex;
    }
    return onLoop(event, prevIndex, nextIndex, elementsRef);
  });
  const onKeyDown = useStableCallback((event) => {
    const isHomeOrEnd = event.key === HOME || event.key === END;
    if (!COMPOSITE_KEYS.has(event.key) || !enableHomeAndEndKeys && isHomeOrEnd) {
      return;
    }
    if (isModifierKeySet(event, modifierKeys)) {
      return;
    }
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const isRtl = direction === "rtl";
    const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
    const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
    const forwardKey = orientation === "vertical" ? ARROW_DOWN : horizontalForwardKey;
    const backwardKey = orientation === "vertical" ? ARROW_UP : horizontalBackwardKey;
    const target = getTarget(event.nativeEvent);
    if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const textContent = target.value;
      if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
        return;
      }
      if (event.key !== backwardKey && selectionStart < textContent.length) {
        return;
      }
      if (event.key !== forwardKey && selectionStart > 0) {
        return;
      }
    }
    let nextIndex = highlightedIndex;
    const minIndex = getMinListIndex(elementsRef, disabledIndices);
    const maxIndex = getMaxListIndex(elementsRef, disabledIndices);
    if (grid != null) {
      nextIndex = grid({
        disabledIndices,
        elementsRef,
        event,
        highlightedIndex,
        loopFocus,
        maxIndex,
        minIndex,
        onLoop: wrappedOnLoop,
        orientation,
        rtl: isRtl
      });
    }
    const isForwardKey = orientation !== "vertical" && event.key === horizontalForwardKey || orientation !== "horizontal" && event.key === ARROW_DOWN;
    const isBackwardKey = orientation !== "vertical" && event.key === horizontalBackwardKey || orientation !== "horizontal" && event.key === ARROW_UP;
    if (enableHomeAndEndKeys) {
      if (event.key === HOME) {
        nextIndex = minIndex;
      } else if (event.key === END) {
        nextIndex = maxIndex;
      }
    }
    if (nextIndex === highlightedIndex && (isForwardKey || isBackwardKey)) {
      if (loopFocus && nextIndex === maxIndex && isForwardKey) {
        nextIndex = minIndex;
        if (onLoop) {
          nextIndex = onLoop(event, highlightedIndex, nextIndex, elementsRef);
        }
      } else if (loopFocus && nextIndex === minIndex && isBackwardKey) {
        nextIndex = maxIndex;
        if (onLoop) {
          nextIndex = onLoop(event, highlightedIndex, nextIndex, elementsRef);
        }
      } else {
        nextIndex = findNonDisabledListIndex(elementsRef.current, {
          startingIndex: nextIndex,
          decrement: isBackwardKey,
          disabledIndices
        });
      }
    }
    if (nextIndex !== highlightedIndex && !isIndexOutOfListBounds(elementsRef.current, nextIndex)) {
      if (stopEventPropagation) {
        event.stopPropagation();
      }
      if (isGrid || isHomeOrEnd || isForwardKey || isBackwardKey) {
        event.preventDefault();
      }
      onHighlightedIndexChange(nextIndex, true);
      queueMicrotask(() => {
        elementsRef.current[nextIndex]?.focus();
      });
    }
  });
  const props = {
    ref: mergedRef,
    onFocus(event) {
      const element = rootRef.current;
      const target = getTarget(event.nativeEvent);
      if (!element || target == null || !isNativeInput(target)) {
        return;
      }
      target.setSelectionRange(0, target.value.length);
    },
    onKeyDown
  };
  return {
    props,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    onMapChange,
    relayKeyboardEvent: onKeyDown
  };
}
function getFallbackIndex(elements, disabledIndices) {
  let fallbackIndex = -1;
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }
    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }
    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }
  return Math.max(fallbackIndex, 0);
}
function isModifierKeySet(event, ignoredModifierKeys) {
  for (const key of MODIFIER_KEYS$1) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }
  return false;
}
function CompositeRoot(componentProps) {
  const {
    render,
    className,
    style,
    refs = EMPTY_ARRAY,
    props = EMPTY_ARRAY,
    state = EMPTY_OBJECT,
    stateAttributesMapping: stateAttributesMapping2,
    highlightedIndex: highlightedIndexProp,
    onHighlightedIndexChange: onHighlightedIndexChangeProp,
    orientation,
    grid,
    loopFocus,
    onLoop,
    enableHomeAndEndKeys,
    onMapChange: onMapChangeProp,
    stopEventPropagation = true,
    rootRef,
    disabledIndices,
    modifierKeys,
    highlightItemOnHover = false,
    tag = "div",
    ...elementProps
  } = componentProps;
  const direction = useDirection();
  const {
    props: defaultProps,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    onMapChange: onMapChangeUnwrapped,
    relayKeyboardEvent
  } = useCompositeRoot({
    grid,
    loopFocus,
    onLoop,
    orientation,
    highlightedIndex: highlightedIndexProp,
    onHighlightedIndexChange: onHighlightedIndexChangeProp,
    rootRef,
    stopEventPropagation,
    enableHomeAndEndKeys,
    direction,
    disabledIndices,
    modifierKeys
  });
  const element = useRenderElement(tag, componentProps, {
    state,
    ref: refs,
    props: [defaultProps, ...props, elementProps],
    stateAttributesMapping: stateAttributesMapping2
  });
  const contextValue = React.useMemo(() => ({
    highlightedIndex,
    onHighlightedIndexChange,
    highlightItemOnHover,
    relayKeyboardEvent
  }), [highlightedIndex, onHighlightedIndexChange, highlightItemOnHover, relayKeyboardEvent]);
  return /* @__PURE__ */ jsx(CompositeRootContext.Provider, {
    value: contextValue,
    children: /* @__PURE__ */ jsx(CompositeList, {
      elementsRef,
      onMapChange: (newMap) => {
        onMapChangeProp?.(newMap);
        onMapChangeUnwrapped(newMap);
      },
      children: element
    })
  });
}
const RadioGroupContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") RadioGroupContext.displayName = "RadioGroupContext";
function useRadioGroupContext() {
  return React.useContext(RadioGroupContext);
}
const MODIFIER_KEYS = [SHIFT];
const RadioGroup$1 = /* @__PURE__ */ React.forwardRef(function RadioGroup(componentProps, forwardedRef) {
  const {
    render,
    className,
    disabled: disabledProp,
    readOnly,
    required,
    onValueChange: onValueChangeProp,
    value: externalValue,
    defaultValue,
    form: form2,
    name: nameProp,
    inputRef: inputRefProp,
    id: idProp,
    style,
    ...elementProps
  } = componentProps;
  const {
    setTouched: setFieldTouched,
    setFocused,
    validationMode,
    name: fieldName,
    disabled: fieldDisabled,
    state: fieldState,
    validation,
    setDirty,
    setFilled,
    validityData
  } = useFieldRootContext();
  const {
    labelId
  } = useLabelableContext();
  const {
    clearErrors,
    elementRef
  } = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);
  const disabled = fieldDisabled || disabledProp;
  const name = fieldName ?? nameProp;
  const id = useBaseUiId(idProp);
  const [checkedValue, setCheckedValueUnwrapped] = useControlled({
    controlled: externalValue,
    default: defaultValue,
    name: "RadioGroup",
    state: "value"
  });
  const [touched, setTouched] = React.useState(false);
  const setCheckedValue = useStableCallback((value, eventDetails) => {
    onValueChangeProp?.(value, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    setCheckedValueUnwrapped(value);
  });
  const getInputControl = validation.getInputControl;
  const controlRef = React.useMemo(() => ({
    get current() {
      return getInputControl();
    }
  }), [getInputControl]);
  const groupInputRef = React.useRef(null);
  const firstEnabledInputRef = React.useRef(null);
  function setInputRef(hiddenInput) {
    let cleanup = void 0;
    if (inputRefProp) {
      if (typeof inputRefProp === "function") {
        cleanup = inputRefProp(hiddenInput);
      } else {
        inputRefProp.current = hiddenInput;
      }
    }
    groupInputRef.current = hiddenInput;
    return cleanup;
  }
  const registerInputRef = useStableCallback((input2) => {
    if (!input2 || input2.disabled) {
      return void 0;
    }
    if (!firstEnabledInputRef.current) {
      firstEnabledInputRef.current = input2;
    }
    const currentInput = groupInputRef.current;
    const cleanup = input2.checked || currentInput == null || currentInput.disabled ? setInputRef(input2) : void 0;
    return () => {
      if (firstEnabledInputRef.current === input2) {
        firstEnabledInputRef.current = null;
      }
      if (groupInputRef.current === input2) {
        if (cleanup) {
          cleanup();
          groupInputRef.current = null;
        } else {
          void setInputRef(null);
        }
      } else {
        cleanup?.();
      }
    };
  });
  const getFormValue = useStableCallback(() => {
    const formElement = elementRef.current;
    if (!formElement) {
      return checkedValue ?? null;
    }
    for (const input2 of validation.registeredInputs.keys()) {
      if (input2.checked && isEligibleInput(input2, formElement)) {
        return checkedValue ?? null;
      }
    }
    return null;
  });
  useRegisterFieldControl(controlRef, id, checkedValue ?? null, getFormValue, !disabled, nameProp);
  useValueChanged(checkedValue, () => {
    clearErrors(name);
    setDirty(checkedValue !== validityData.initialValue);
    setFilled(checkedValue != null);
    validation.change(checkedValue);
    const fallbackInput = firstEnabledInputRef.current;
    if (checkedValue == null && fallbackInput && !fallbackInput.disabled) {
      void setInputRef(fallbackInput);
    }
  });
  const ariaLabelledby = labelId ?? fieldsetContext?.legendId;
  const state = {
    ...fieldState,
    disabled: disabled ?? false,
    required: required ?? false,
    readOnly: readOnly ?? false
  };
  const contextValue = React.useMemo(() => ({
    checkedValue,
    disabled,
    form: form2,
    validation,
    name,
    readOnly,
    registerInputRef,
    required,
    setCheckedValue,
    setTouched,
    touched
  }), [checkedValue, disabled, form2, validation, name, readOnly, registerInputRef, required, setCheckedValue, setTouched, touched]);
  const defaultProps = {
    id: idProp,
    role: "radiogroup",
    "aria-required": required || void 0,
    "aria-disabled": disabled || void 0,
    "aria-readonly": readOnly || void 0,
    "aria-labelledby": ariaLabelledby,
    onFocus() {
      setFocused(true);
    },
    onBlur(event) {
      if (!contains(event.currentTarget, event.relatedTarget)) {
        setFieldTouched(true);
        setFocused(false);
        if (validationMode === "onBlur") {
          validation.commit(checkedValue);
        }
      }
    },
    onKeyDownCapture(event) {
      if (event.key.startsWith("Arrow")) {
        setTouched(true);
        setFocused(true);
      }
    }
  };
  return /* @__PURE__ */ jsx(RadioGroupContext.Provider, {
    value: contextValue,
    children: /* @__PURE__ */ jsx(CompositeRoot, {
      render,
      className,
      style,
      state,
      props: [defaultProps, elementProps, (props) => validation.getValidationProps(disabled ?? false, props)],
      refs: [forwardedRef],
      stateAttributesMapping: fieldValidityMapping,
      enableHomeAndEndKeys: false,
      modifierKeys: MODIFIER_KEYS
    })
  });
});
if (process.env.NODE_ENV !== "production") RadioGroup$1.displayName = "RadioGroup";
const checked = "data-checked";
const unchecked = "data-unchecked";
const stateAttributesMapping = {
  checked(value) {
    if (value) {
      return {
        [checked]: ""
      };
    }
    return {
      [unchecked]: ""
    };
  },
  ...transitionStatusMapping,
  ...fieldValidityMapping
};
const RadioRootContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") RadioRootContext.displayName = "RadioRootContext";
function useRadioRootContext() {
  const value = React.useContext(RadioRootContext);
  if (value === void 0) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>." : formatErrorMessage(52));
  }
  return value;
}
const RadioRoot = /* @__PURE__ */ React.forwardRef(function RadioRoot2(componentProps, forwardedRef) {
  const {
    render,
    className,
    disabled: disabledProp = false,
    readOnly: readOnlyProp = false,
    required: requiredProp = false,
    "aria-labelledby": ariaLabelledByProp,
    value,
    inputRef: inputRefProp,
    nativeButton = false,
    id: idProp,
    style,
    ...elementProps
  } = componentProps;
  const groupContext = useRadioGroupContext();
  const {
    disabled: disabledGroup,
    readOnly: readOnlyGroup,
    required: requiredGroup,
    form: formGroup,
    checkedValue,
    touched = false,
    validation,
    name,
    setCheckedValue = NOOP,
    setTouched = NOOP,
    registerInputRef = NOOP
  } = groupContext ?? {};
  const {
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const {
    labelId,
    getDescriptionProps
  } = useLabelableContext();
  const disabled = fieldDisabled || fieldItemContext.disabled || disabledGroup || disabledProp;
  const readOnly = readOnlyGroup || readOnlyProp;
  const required = requiredGroup || requiredProp;
  const form2 = formGroup;
  const checked2 = groupContext ? checkedValue === value : value === "";
  const radioRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const registerFieldInput = validation?.registerInput;
  const registerInput = React.useCallback((element2) => registerFieldInput?.(element2, {
    controlRef: radioRef,
    value: void 0
  }), [registerFieldInput]);
  const mergedInputRef = useMergedRefs(inputRefProp, inputRef, registerInputRef, registerInput);
  useIsoLayoutEffect(() => {
    if (inputRef.current?.checked) {
      setFilled(true);
    }
  }, [setFilled]);
  useIsoLayoutEffect(() => {
    if (!inputRef.current) {
      return;
    }
    if (disabled && checked2) {
      registerInputRef(null);
      return;
    }
    registerInputRef(inputRef.current);
  }, [checked2, disabled, registerInputRef]);
  const id = useBaseUiId();
  const inputId = useLabelableId({
    id: idProp
  });
  const hiddenInputId = nativeButton ? void 0 : inputId;
  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, inputRef, !nativeButton, hiddenInputId);
  const rootProps = {
    role: "radio",
    "aria-checked": checked2,
    "aria-labelledby": ariaLabelledBy,
    [ACTIVE_COMPOSITE_ITEM]: checked2 ? "" : void 0,
    id: nativeButton ? inputId : id,
    onKeyDown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
      }
    },
    onClick(event) {
      if (event.defaultPrevented || disabled || readOnly) {
        return;
      }
      event.preventDefault();
      const input2 = inputRef.current;
      if (!input2) {
        return;
      }
      dispatchClickWithModifiers(input2, event);
    },
    onFocus(event) {
      if (event.defaultPrevented || disabled || readOnly || !touched) {
        return;
      }
      inputRef.current?.click();
      setTouched(false);
    }
  };
  const {
    getButtonProps,
    buttonRef
  } = useButton({
    disabled,
    native: nativeButton,
    composite: false
  });
  const inputProps = {
    type: "radio",
    ref: mergedInputRef,
    form: form2,
    id: hiddenInputId,
    name,
    tabIndex: -1,
    style: name ? visuallyHiddenInput : visuallyHidden,
    "aria-hidden": true,
    ...value !== void 0 ? {
      value: serializeValue(value)
    } : EMPTY_OBJECT,
    disabled,
    checked: checked2,
    required,
    readOnly,
    onChange(event) {
      if (event.nativeEvent.defaultPrevented) {
        return;
      }
      if (disabled || readOnly || value === void 0) {
        return;
      }
      const details = createChangeEventDetails(none, event.nativeEvent);
      setCheckedValue(value, details);
      if (details.isCanceled) {
        return;
      }
      setFieldTouched(true);
    },
    onClick(event) {
      event.stopPropagation();
    },
    onFocus() {
      radioRef.current?.focus();
    }
  };
  const state = React.useMemo(() => ({
    ...fieldState,
    required,
    disabled,
    readOnly,
    checked: checked2
  }), [fieldState, disabled, readOnly, checked2, required]);
  const contextValue = state;
  const isRadioGroup = groupContext !== void 0;
  const refs = [forwardedRef, radioRef, buttonRef];
  const props = [rootProps, elementProps, getButtonProps, getDescriptionProps, validation ? (validationProps) => validation.getValidationProps(disabled, validationProps) : EMPTY_OBJECT];
  const element = useRenderElement("span", componentProps, {
    enabled: !isRadioGroup,
    state,
    ref: refs,
    props,
    stateAttributesMapping
  });
  return /* @__PURE__ */ jsxs(RadioRootContext.Provider, {
    value: contextValue,
    children: [isRadioGroup ? /* @__PURE__ */ jsx(CompositeItem, {
      tag: "span",
      render,
      className,
      style,
      state,
      refs,
      props,
      stateAttributesMapping
    }) : element, /* @__PURE__ */ jsx("input", {
      ...inputProps,
      suppressHydrationWarning: true
    })]
  });
});
if (process.env.NODE_ENV !== "production") RadioRoot.displayName = "RadioRoot";
const RadioIndicator = /* @__PURE__ */ React.forwardRef(function RadioIndicator2(componentProps, forwardedRef) {
  const {
    render,
    className,
    style,
    keepMounted = false,
    ...elementProps
  } = componentProps;
  const rootState = useRadioRootContext();
  const rendered = rootState.checked;
  const {
    mounted,
    transitionStatus,
    setMounted
  } = useTransitionStatus(rendered);
  const state = {
    ...rootState,
    transitionStatus
  };
  const indicatorRef = React.useRef(null);
  const shouldRender = keepMounted || mounted;
  const element = useRenderElement("span", componentProps, {
    ref: [forwardedRef, indicatorRef],
    state,
    props: elementProps,
    stateAttributesMapping
  });
  useOpenChangeComplete({
    batch: true,
    enabled: !rendered,
    open: rendered,
    ref: indicatorRef,
    onComplete() {
      if (!rendered) {
        setMounted(false);
      }
    }
  });
  if (!shouldRender) {
    return null;
  }
  return element;
});
if (process.env.NODE_ENV !== "production") RadioIndicator.displayName = "RadioIndicator";
const form = "_form_l4y3h_6";
const field = "_field_l4y3h_16";
const label = "_label_l4y3h_22";
const labelHidden = "_labelHidden_l4y3h_32";
const requiredMark = "_requiredMark_l4y3h_44";
const description = "_description_l4y3h_49";
const error = "_error_l4y3h_55";
const input = "_input_l4y3h_63";
const textarea = "_textarea_l4y3h_64";
const selectTrigger = "_selectTrigger_l4y3h_124";
const selectPlaceholder = "_selectPlaceholder_l4y3h_166";
const selectIcon = "_selectIcon_l4y3h_170";
const selectPositioner = "_selectPositioner_l4y3h_177";
const selectPopup = "_selectPopup_l4y3h_181";
const selectGroup = "_selectGroup_l4y3h_195";
const selectGroupLabel = "_selectGroupLabel_l4y3h_205";
const selectItem = "_selectItem_l4y3h_214";
const selectItemIndicator = "_selectItemIndicator_l4y3h_242";
const checkboxLabel = "_checkboxLabel_l4y3h_251";
const checkboxRoot = "_checkboxRoot_l4y3h_261";
const checkboxIndicator = "_checkboxIndicator_l4y3h_293";
const button = "_button_l4y3h_310";
const buttonSize_small = "_buttonSize_small_l4y3h_337";
const buttonSize_medium = "_buttonSize_medium_l4y3h_342";
const buttonSize_large = "_buttonSize_large_l4y3h_347";
const buttonVariant_primary = "_buttonVariant_primary_l4y3h_352";
const buttonVariant_secondary = "_buttonVariant_secondary_l4y3h_363";
const buttonVariant_invisible = "_buttonVariant_invisible_l4y3h_374";
const buttonVariant_danger = "_buttonVariant_danger_l4y3h_385";
const flash = "_flash_l4y3h_398";
const flashVariant_info = "_flashVariant_info_l4y3h_409";
const flashVariant_warning = "_flashVariant_warning_l4y3h_415";
const flashVariant_danger = "_flashVariant_danger_l4y3h_421";
const flashVariant_success = "_flashVariant_success_l4y3h_427";
const menuButton = "_menuButton_l4y3h_435";
const menuButtonLabel = "_menuButtonLabel_l4y3h_467";
const menuButtonIcon = "_menuButtonIcon_l4y3h_474";
const menuPositioner = "_menuPositioner_l4y3h_481";
const menuPopup = "_menuPopup_l4y3h_485";
const menuItem = "_menuItem_l4y3h_498";
const menuItemSelected = "_menuItemSelected_l4y3h_517";
const menuItemBody = "_menuItemBody_l4y3h_521";
const menuItemLabel = "_menuItemLabel_l4y3h_528";
const menuItemDescription = "_menuItemDescription_l4y3h_534";
const menuItemCheck = "_menuItemCheck_l4y3h_541";
const rangeWithValue = "_rangeWithValue_l4y3h_551";
const rangeInput = "_rangeInput_l4y3h_558";
const rangeValue = "_rangeValue_l4y3h_645";
const radioGroup = "_radioGroup_l4y3h_661";
const radioLabel = "_radioLabel_l4y3h_667";
const radioRoot = "_radioRoot_l4y3h_677";
const radioIndicator = "_radioIndicator_l4y3h_716";
const dateInput = "_dateInput_l4y3h_726";
const css = {
  form,
  field,
  label,
  labelHidden,
  requiredMark,
  description,
  error,
  input,
  textarea,
  selectTrigger,
  selectPlaceholder,
  selectIcon,
  selectPositioner,
  selectPopup,
  selectGroup,
  selectGroupLabel,
  selectItem,
  selectItemIndicator,
  checkboxLabel,
  checkboxRoot,
  checkboxIndicator,
  button,
  buttonSize_small,
  buttonSize_medium,
  buttonSize_large,
  buttonVariant_primary,
  buttonVariant_secondary,
  buttonVariant_invisible,
  buttonVariant_danger,
  flash,
  flashVariant_info,
  flashVariant_warning,
  flashVariant_danger,
  flashVariant_success,
  menuButton,
  menuButtonLabel,
  menuButtonIcon,
  menuPositioner,
  menuPopup,
  menuItem,
  menuItemSelected,
  menuItemBody,
  menuItemLabel,
  menuItemDescription,
  menuItemCheck,
  rangeWithValue,
  rangeInput,
  rangeValue,
  radioGroup,
  radioLabel,
  radioRoot,
  radioIndicator,
  dateInput
};
const Form = forwardRef(function Form2({ className, ...rest }, ref) {
  return /* @__PURE__ */ jsx("form", { ref, className: `${css.form} ${className || ""}`, ...rest });
});
function Field({ children, invalid, className, ...rest }) {
  return /* @__PURE__ */ jsx(
    FieldRoot,
    {
      className: `${css.field} ${className || ""}`,
      invalid: invalid || void 0,
      ...rest,
      children
    }
  );
}
function Label({ children, required, visuallyHidden: visuallyHidden2, ...rest }) {
  const cn = visuallyHidden2 ? css.labelHidden : css.label;
  return /* @__PURE__ */ jsxs(FieldLabel, { className: cn, ...rest, children: [
    children,
    required && /* @__PURE__ */ jsx("span", { className: css.requiredMark, "aria-hidden": "true", children: "*" })
  ] });
}
function Description({ children, ...rest }) {
  if (!children) return null;
  return /* @__PURE__ */ jsx(FieldDescription, { className: css.description, ...rest, children });
}
function Validation({ children, ...rest }) {
  if (!children) return null;
  return /* @__PURE__ */ jsx(FieldError, { match: true, className: css.error, ...rest, children });
}
const TextInput = forwardRef(function TextInput2({ className, invalid, ...rest }, ref) {
  return /* @__PURE__ */ jsx(
    FieldControl,
    {
      ref,
      className: `${css.input} ${className || ""}`,
      "data-invalid": invalid || void 0,
      ...rest
    }
  );
});
const Textarea = forwardRef(function Textarea2({ className, invalid, rows = 3, ...rest }, ref) {
  return /* @__PURE__ */ jsx(
    FieldControl,
    {
      ref,
      render: /* @__PURE__ */ jsx("textarea", { rows }),
      className: `${css.textarea} ${className || ""}`,
      "data-invalid": invalid || void 0,
      ...rest
    }
  );
});
const RangeInput = forwardRef(function RangeInput2({ className, invalid, value, onChange, min, max, step, ...rest }, ref) {
  return /* @__PURE__ */ jsxs("div", { className: css.rangeWithValue, children: [
    /* @__PURE__ */ jsx(
      FieldControl,
      {
        ref,
        type: "range",
        value,
        onChange: (event) => onChange(Number(event.target.value)),
        min,
        max,
        step,
        className: `${css.rangeInput} ${className || ""}`,
        "data-invalid": invalid || void 0,
        ...rest
      }
    ),
    /* @__PURE__ */ jsx("span", { className: css.rangeValue, "aria-hidden": "true", children: value })
  ] });
});
const DateInput = forwardRef(function DateInput2({ className, invalid, value, onChange, min, max, ...rest }, ref) {
  return /* @__PURE__ */ jsx(
    FieldControl,
    {
      ref,
      type: "date",
      value,
      onChange: (event) => onChange(event.target.value),
      min,
      max,
      className: `${css.dateInput} ${className || ""}`,
      "data-invalid": invalid || void 0,
      ...rest
    }
  );
});
function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  invalid,
  modal = true,
  preserveWidgetSelection = false
}) {
  const norm = (options || []).map(
    (o) => typeof o === "string" ? { value: o, label: o, group: null } : { group: null, ...o }
  );
  const grouped = norm.some((o) => o.group);
  const groups = grouped ? norm.reduce((acc, opt) => {
    const key = opt.group || "Other";
    (acc[key] = acc[key] || []).push(opt);
    return acc;
  }, {}) : null;
  const selectedLabel = norm.find((o) => o.value === value)?.label;
  return /* @__PURE__ */ jsxs(SelectRoot, { value: value || "", onValueChange: (v) => onChange(v), disabled, modal, children: [
    /* @__PURE__ */ jsxs(
      SelectTrigger,
      {
        className: css.selectTrigger,
        "data-invalid": invalid || void 0,
        children: [
          /* @__PURE__ */ jsx(SelectValue, { placeholder, children: () => selectedLabel || /* @__PURE__ */ jsx("span", { className: css.selectPlaceholder, children: placeholder }) }),
          /* @__PURE__ */ jsx(SelectIcon, { className: css.selectIcon, children: /* @__PURE__ */ jsx(ChevronDown, {}) })
        ]
      }
    ),
    /* @__PURE__ */ jsx(SelectPortal, { children: /* @__PURE__ */ jsx(SelectPositioner, { className: css.selectPositioner, "data-widget-interaction-portal": preserveWidgetSelection ? "" : void 0, sideOffset: 6, alignItemWithTrigger: false, children: /* @__PURE__ */ jsx(SelectPopup, { className: css.selectPopup, children: grouped ? Object.entries(groups).map(([group, opts]) => /* @__PURE__ */ jsxs(SelectGroup, { className: css.selectGroup, children: [
      /* @__PURE__ */ jsx(SelectGroupLabel, { className: css.selectGroupLabel, children: group }),
      opts.map((opt) => /* @__PURE__ */ jsxs(SelectItem, { value: opt.value, className: css.selectItem, children: [
        /* @__PURE__ */ jsx(SelectItemText, { children: opt.label }),
        /* @__PURE__ */ jsx(SelectItemIndicator, { className: css.selectItemIndicator, children: "✓" })
      ] }, opt.value))
    ] }, group)) : norm.map((opt) => /* @__PURE__ */ jsxs(SelectItem, { value: opt.value, className: css.selectItem, children: [
      /* @__PURE__ */ jsx(SelectItemText, { children: opt.label }),
      /* @__PURE__ */ jsx(SelectItemIndicator, { className: css.selectItemIndicator, children: "✓" })
    ] }, opt.value)) }) }) })
  ] });
}
function ChevronDown() {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": "true", children: /* @__PURE__ */ jsx(
    "path",
    {
      d: "m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427z",
      fill: "currentColor"
    }
  ) });
}
function Checkbox({ checked: checked2, onChange, children, disabled }) {
  const id = useId$1();
  return /* @__PURE__ */ jsxs("label", { className: css.checkboxLabel, htmlFor: id, children: [
    /* @__PURE__ */ jsx(
      CheckboxRoot,
      {
        id,
        checked: !!checked2,
        onCheckedChange: (v) => onChange(!!v),
        disabled,
        className: css.checkboxRoot,
        children: /* @__PURE__ */ jsx(CheckboxIndicator, { className: css.checkboxIndicator, children: /* @__PURE__ */ jsx(CheckMark, {}) })
      }
    ),
    /* @__PURE__ */ jsx("span", { children })
  ] });
}
function RadioGroup2({
  value,
  onChange,
  options,
  name,
  invalid,
  className,
  ...rest
}) {
  const norm = (options || []).map((option) => {
    if (typeof option === "string") return { value: option, label: option };
    const optionValue2 = option?.value ?? "";
    return { value: optionValue2, label: option?.label ?? optionValue2 };
  });
  return /* @__PURE__ */ jsx(
    RadioGroup$1,
    {
      value: value || "",
      onValueChange: (v) => onChange(v),
      name,
      className: `${css.radioGroup} ${className || ""}`,
      "data-invalid": invalid || void 0,
      ...rest,
      children: norm.map((option) => /* @__PURE__ */ jsxs("label", { className: css.radioLabel, children: [
        /* @__PURE__ */ jsx(RadioRoot, { value: option.value, className: css.radioRoot, children: /* @__PURE__ */ jsx(RadioIndicator, { className: css.radioIndicator }) }),
        /* @__PURE__ */ jsx("span", { children: option.label })
      ] }, option.value))
    }
  );
}
function CheckMark() {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 16 16", width: "12", height: "12", "aria-hidden": "true", children: /* @__PURE__ */ jsx(
    "path",
    {
      d: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z",
      fill: "currentColor"
    }
  ) });
}
const Button = forwardRef(function Button2({ variant = "secondary", size = "medium", className, type = "button", ...rest }, ref) {
  const cn = [
    css.button,
    css[`buttonVariant_${variant}`],
    css[`buttonSize_${size}`],
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsx("button", { ref, type, className: cn, ...rest });
});
function MenuRoot2({ children }) {
  return /* @__PURE__ */ jsx(MenuRoot$1, { children });
}
function MenuButton({ children, className, ...rest }) {
  return /* @__PURE__ */ jsxs(MenuTrigger, { className: `${css.menuButton} ${className || ""}`, ...rest, children: [
    /* @__PURE__ */ jsx("span", { className: css.menuButtonLabel, children }),
    /* @__PURE__ */ jsx("span", { className: css.menuButtonIcon, "aria-hidden": "true", children: /* @__PURE__ */ jsx(ChevronDown, {}) })
  ] });
}
function MenuItems({ children }) {
  return /* @__PURE__ */ jsx(MenuPortal, { children: /* @__PURE__ */ jsx(MenuPositioner, { className: css.menuPositioner, sideOffset: 6, align: "start", children: /* @__PURE__ */ jsx(MenuPopup, { className: css.menuPopup, children }) }) });
}
function MenuItem({ children, onSelect, selected, description: description2 }) {
  return /* @__PURE__ */ jsxs(
    MenuItem$1,
    {
      className: `${css.menuItem} ${selected ? css.menuItemSelected : ""}`,
      onClick: onSelect,
      children: [
        /* @__PURE__ */ jsxs("div", { className: css.menuItemBody, children: [
          /* @__PURE__ */ jsx("div", { className: css.menuItemLabel, children }),
          description2 && /* @__PURE__ */ jsx("div", { className: css.menuItemDescription, children: description2 })
        ] }),
        selected && /* @__PURE__ */ jsx("span", { className: css.menuItemCheck, "aria-hidden": "true", children: /* @__PURE__ */ jsx(CheckMark, {}) })
      ]
    }
  );
}
Object.assign(MenuRoot2, {
  Button: MenuButton,
  Items: MenuItems,
  Item: MenuItem
});
function filterKnobsByName(knobs, search) {
  const needle = search.trim().toLowerCase();
  if (!needle) return knobs;
  const matches = knobs.filter((def) => {
    const name = def.label || String(def.id).split(".").pop() || "";
    const humanized = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
    return `${name} ${humanized} ${def.id}`.toLowerCase().includes(needle);
  });
  return knobs.filter((def) => matches.some((match) => {
    if ((def.scope || "") !== (match.scope || "")) return false;
    return def.id === match.id || def.type === "object" && match.id.startsWith(`${def.id}.`) || match.type === "object" && def.id.startsWith(`${match.id}.`);
  }));
}
const formShell = "_formShell_9v3qw_1";
const sections = "_sections_9v3qw_12";
const section = "_section_9v3qw_12";
const sectionHeader = "_sectionHeader_9v3qw_24";
const fields = "_fields_9v3qw_34";
const nestedFields = "_nestedFields_9v3qw_35";
const knobField = "_knobField_9v3qw_45";
const knobLabel$1 = "_knobLabel_9v3qw_49";
const knobLegend = "_knobLegend_9v3qw_50";
const knobLabelText = "_knobLabelText_9v3qw_57";
const knobDot = "_knobDot_9v3qw_62";
const rangeTuple = "_rangeTuple_9v3qw_87";
const rangeTupleItem = "_rangeTupleItem_9v3qw_93";
const arrayEditor = "_arrayEditor_9v3qw_105";
const arrayRow = "_arrayRow_9v3qw_111";
const arrayRemove = "_arrayRemove_9v3qw_118";
const arrayAdd = "_arrayAdd_9v3qw_126";
const objectField = "_objectField_9v3qw_131";
const objectDescription = "_objectDescription_9v3qw_148";
const unsupported = "_unsupported_9v3qw_155";
const emptyState = "_emptyState_9v3qw_165";
const resetAll = "_resetAll_9v3qw_178";
const styles = {
  formShell,
  sections,
  section,
  sectionHeader,
  fields,
  nestedFields,
  knobField,
  knobLabel: knobLabel$1,
  knobLegend,
  knobLabelText,
  knobDot,
  rangeTuple,
  rangeTupleItem,
  arrayEditor,
  arrayRow,
  arrayRemove,
  arrayAdd,
  objectField,
  objectDescription,
  unsupported,
  emptyState,
  resetAll
};
const DEFAULT_EMPTY_MESSAGE = "No knobs are available for this selection yet.";
function humanize(value) {
  const last = String(value || "").split(".").pop();
  return last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (char) => char.toUpperCase());
}
function knobLabel(def) {
  return def?.label || humanize(def?.id);
}
function notifyHashChange(targetWindow) {
  try {
    const Ctor = targetWindow.HashChangeEvent || HashChangeEvent;
    targetWindow.dispatchEvent(new Ctor("hashchange"));
    return;
  } catch {
  }
  try {
    const Ctor = targetWindow.Event || Event;
    targetWindow.dispatchEvent(new Ctor("hashchange"));
  } catch {
  }
}
function defaultValueFor(def) {
  if (def?.default !== void 0) return def.default;
  switch (def?.type) {
    case "boolean":
      return false;
    case "number":
    case "slider":
      return def?.min ?? "";
    case "range":
      return [def?.min ?? "", def?.max ?? ""];
    case "string-array":
      return [];
    case "text":
    case "textarea":
    case "select":
    case "radio":
    case "date":
    default:
      return "";
  }
}
function optionValue(option) {
  if (option && typeof option === "object" && "value" in option) return option.value;
  return option;
}
function numberValue(value, fallback = "") {
  if (value == null || value === "") return fallback;
  return Number.isNaN(Number(value)) ? fallback : Number(value);
}
function clampNumber(value, def) {
  if (value === "") return "";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  let clamped = numeric;
  if (def?.min !== void 0) clamped = Math.max(Number(def.min), clamped);
  if (def?.max !== void 0) clamped = Math.min(Number(def.max), clamped);
  return clamped;
}
function validateRawValue(rawValue, def, coercedValue) {
  if (def?.type === "slider" && (def.min === void 0 || def.max === void 0)) {
    return "Slider knobs require min and max values.";
  }
  if (rawValue == null || def?.type === "string-array" && rawValue === "") return null;
  if (coercedValue === void 0) {
    if (def?.type === "select" || def?.type === "radio") return "Choose one of the available options.";
    if (def?.type === "date") return "Enter a valid date in YYYY-MM-DD format.";
    if (def?.type === "string-array") return "Enter a valid string array.";
    if (def?.type === "boolean") return "Expected true or false.";
    return "Enter a valid value.";
  }
  if (def?.type === "number" || def?.type === "slider") {
    if (def.min !== void 0 && coercedValue < Number(def.min)) return `Must be at least ${def.min}.`;
    if (def.max !== void 0 && coercedValue > Number(def.max)) return `Must be at most ${def.max}.`;
  }
  if (def?.type === "range" && Array.isArray(coercedValue)) {
    const [minValue, maxValue] = coercedValue;
    if (minValue > maxValue) return "Minimum must be less than or equal to maximum.";
    if (def.min !== void 0 && (minValue < Number(def.min) || maxValue < Number(def.min))) {
      return `Values must be at least ${def.min}.`;
    }
    if (def.max !== void 0 && (minValue > Number(def.max) || maxValue > Number(def.max))) {
      return `Values must be at most ${def.max}.`;
    }
  }
  if (def?.type === "date") {
    if (def.min && coercedValue < def.min) return `Date must be on or after ${def.min}.`;
    if (def.max && coercedValue > def.max) return `Date must be on or before ${def.max}.`;
  }
  return null;
}
function useKnobValue(def, { runtime } = {}) {
  const targetWindow = runtime.targetWindow;
  const isCrossWindow = !!(targetWindow && targetWindow !== window);
  const defaultValue = defaultValueFor(def);
  useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const state = runtime.read(def, defaultValue);
  const error2 = validateRawValue(state.rawValue, def, state.errorValue);
  return {
    key: state.key,
    targetWindow,
    isCrossWindow,
    rawValue: state.rawValue,
    value: state.value,
    defaultValue,
    error: error2,
    mixed: !!state.mixed,
    hasOverride: state.hasOverride,
    setOverride: (value) => runtime.set(def, value),
    clearOverride: () => runtime.clear(def)
  };
}
function notifyWindows(windows) {
  for (const targetWindow of windows) {
    if (targetWindow && targetWindow !== window) notifyHashChange(targetWindow);
  }
}
function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function createSharedLedger(signature) {
  return { signature, ops: [], cursors: /* @__PURE__ */ new Map() };
}
function applyLedgerOp(runtime, op) {
  if (op.kind === "set") runtime.set(op.def, op.value);
  else if (op.kind === "clear") runtime.clear(op.def);
  else runtime.reset();
}
function replayLedger(ledger, id, runtime) {
  const cursor = ledger.cursors.get(id) ?? 0;
  for (const op of ledger.ops.slice(cursor)) applyLedgerOp(runtime, op);
  ledger.cursors.set(id, ledger.ops.length);
}
function schemaSignature(definitions) {
  return JSON.stringify(definitions.map((def) => [def?.id, def?.type, scopeKey(def)]));
}
function createFanOutKnobRuntime(definitions, targets, route, ledger) {
  const live = targets.filter(({ window: targetWindow }) => targetWindow).map(({ id, window: targetWindow }) => ({
    id,
    window: targetWindow,
    runtime: createHypercanvasKnobRuntime(definitions, { target: targetWindow, route })
  }));
  for (const entry of live) replayLedger(ledger, entry.id, entry.runtime);
  const runtimes = live.map((entry) => entry.runtime);
  const primary = runtimes[0];
  const windows = live.map((entry) => entry.window);
  function record(op) {
    ledger.ops.push(op);
    for (const entry of live) {
      applyLedgerOp(entry.runtime, op);
      ledger.cursors.set(entry.id, ledger.ops.length);
    }
    if (targets.every((target) => (ledger.cursors.get(target.id) ?? 0) === ledger.ops.length)) {
      ledger.ops.length = 0;
      ledger.cursors.clear();
    }
    notifyWindows(windows);
  }
  return Object.freeze({
    store: primary.store,
    session: primary.session,
    targetWindow: primary.targetWindow,
    listKnobs: () => primary.listKnobs(),
    subscribe(listener) {
      const unsubscribers = runtimes.map((runtime) => runtime.subscribe(listener));
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
    getSnapshot: () => runtimes.map((runtime) => runtime.getSnapshot()).join("|"),
    read(def, fallback) {
      const state = primary.read(def, fallback);
      const mixed = runtimes.slice(1).some((runtime) => !sameValue(runtime.read(def, fallback).value, state.value));
      return { ...state, mixed };
    },
    set(def, value) {
      record({ kind: "set", def, value });
    },
    clear(def) {
      record({ kind: "clear", def });
    },
    reset() {
      record({ kind: "reset" });
    },
    dispose() {
      runtimes.forEach((runtime) => runtime.dispose());
    }
  });
}
function scopeKey(def) {
  return def?.scope == null ? "" : String(def.scope);
}
function sameScope(left, right) {
  return scopeKey(left) === scopeKey(right);
}
function isChildOf(parent, child) {
  if (!parent || !child || !sameScope(parent, child)) return false;
  return child.id.startsWith(`${parent.id}.`);
}
function isImmediateChildOf(parent, child) {
  if (!isChildOf(parent, child)) return false;
  const rest = child.id.slice(parent.id.length + 1);
  return rest.length > 0 && !rest.includes(".");
}
function hasObjectAncestor(def, allKnobs) {
  const parts = String(def.id).split(".");
  for (let index = 1; index < parts.length; index += 1) {
    const ancestorId = parts.slice(0, index).join(".");
    const ancestor = allKnobs.find(
      (candidate) => candidate.type === "object" && candidate.id === ancestorId && sameScope(candidate, def)
    );
    if (ancestor) return true;
  }
  return false;
}
function rootKnobs(allKnobs) {
  return allKnobs.filter((def) => !hasObjectAncestor(def, allKnobs));
}
function childKnobs(parent, allKnobs) {
  return allKnobs.filter((def) => isImmediateChildOf(parent, def));
}
function groupSections(knobs) {
  const sections2 = [];
  for (const def of knobs) {
    const key = scopeKey(def);
    let section2 = sections2.find((candidate) => candidate.key === key);
    if (!section2) {
      section2 = { key, label: key, knobs: [] };
      sections2.push(section2);
    }
    section2.knobs.push(def);
  }
  return sections2;
}
function RangeTupleInput({ def, value, error: error2, onChange }) {
  const label2 = knobLabel(def);
  const tuple = Array.isArray(value) ? value : ["", ""];
  function updateAt(index, nextValue) {
    const next = [...tuple];
    next[index] = clampNumber(nextValue, def);
    onChange(next);
  }
  return /* @__PURE__ */ jsxs("div", { className: styles.rangeTuple, children: [
    /* @__PURE__ */ jsxs("label", { className: styles.rangeTupleItem, children: [
      /* @__PURE__ */ jsx("span", { children: "min" }),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          type: "number",
          value: tuple[0] ?? "",
          onChange: (event) => updateAt(0, event.target.value),
          min: def.min,
          max: def.max,
          step: def.step,
          "aria-label": `${label2} min`,
          invalid: !!error2
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("label", { className: styles.rangeTupleItem, children: [
      /* @__PURE__ */ jsx("span", { children: "max" }),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          type: "number",
          value: tuple[1] ?? "",
          onChange: (event) => updateAt(1, event.target.value),
          min: def.min,
          max: def.max,
          step: def.step,
          "aria-label": `${label2} max`,
          invalid: !!error2
        }
      )
    ] })
  ] });
}
function StringArrayInput({ def, value, error: error2, onChange }) {
  const label2 = knobLabel(def);
  const items = Array.isArray(value) ? value : [];
  function updateItem(index, nextValue) {
    const next = items.slice();
    next[index] = def.itemType === "number" ? Number(nextValue) : nextValue;
    onChange(next);
  }
  function removeItem(index) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }
  return /* @__PURE__ */ jsxs("div", { className: styles.arrayEditor, children: [
    items.map((item, index) => /* @__PURE__ */ jsxs("div", { className: styles.arrayRow, children: [
      /* @__PURE__ */ jsx(
        TextInput,
        {
          type: def.itemType === "number" ? "number" : void 0,
          value: item || "",
          onChange: (event) => updateItem(index, event.target.value),
          "aria-label": `${label2} item ${index + 1}`,
          invalid: !!error2
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "button",
          variant: "invisible",
          size: "small",
          className: styles.arrayRemove,
          onClick: () => removeItem(index),
          "aria-label": `Remove ${label2} item ${index + 1}`,
          children: "×"
        }
      )
    ] }, `${index}-${items.length}`)),
    /* @__PURE__ */ jsx(
      Button,
      {
        type: "button",
        variant: "secondary",
        size: "small",
        className: styles.arrayAdd,
        onClick: () => onChange([...items, ""]),
        children: "+ Add"
      }
    )
  ] });
}
function FieldRenderer({ def, state, onChange }) {
  const value = state.value;
  const invalid = !!state.error;
  switch (def.type) {
    case "text":
      return /* @__PURE__ */ jsx(
        TextInput,
        {
          value: value || "",
          onChange: (event) => onChange(event.target.value),
          placeholder: def.placeholder,
          invalid
        }
      );
    case "textarea":
      return /* @__PURE__ */ jsx(
        Textarea,
        {
          value: value || "",
          onChange: (event) => onChange(event.target.value),
          placeholder: def.placeholder,
          rows: def.rows || 3,
          invalid
        }
      );
    case "number":
      return /* @__PURE__ */ jsx(
        TextInput,
        {
          type: "number",
          value: value ?? "",
          onChange: (event) => onChange(clampNumber(event.target.value, def)),
          placeholder: def.placeholder,
          min: def.min,
          max: def.max,
          step: def.step,
          invalid
        }
      );
    case "slider": {
      const min = numberValue(def.min, 0);
      const max = numberValue(def.max, 100);
      const sliderValue = numberValue(value, min);
      return /* @__PURE__ */ jsx(
        RangeInput,
        {
          value: sliderValue,
          onChange: (nextValue) => onChange(clampNumber(nextValue, def)),
          min,
          max,
          step: def.step,
          invalid
        }
      );
    }
    case "boolean": {
      const onLabel = def.onLabel ?? "Enabled";
      const offLabel = def.offLabel ?? "Disabled";
      return /* @__PURE__ */ jsx(Checkbox, { checked: !!value, onChange: (nextValue) => onChange(nextValue), children: value ? onLabel : offLabel });
    }
    case "select":
      return /* @__PURE__ */ jsx(
        Select,
        {
          value: value || "",
          onChange: (nextValue) => onChange(nextValue),
          options: def.options || [],
          placeholder: def.placeholder || "Select…",
          invalid,
          modal: false,
          preserveWidgetSelection: state.isCrossWindow
        }
      );
    case "radio":
      return /* @__PURE__ */ jsx(
        RadioGroup2,
        {
          value: value || "",
          onChange: (nextValue) => onChange(nextValue),
          options: def.options || [],
          name: state.key,
          invalid
        }
      );
    case "range":
      return /* @__PURE__ */ jsx(RangeTupleInput, { def, value, error: state.error, onChange });
    case "date":
      return /* @__PURE__ */ jsx(
        DateInput,
        {
          value: value || "",
          onChange: (nextValue) => onChange(nextValue),
          min: def.min,
          max: def.max,
          invalid
        }
      );
    case "string-array":
      return /* @__PURE__ */ jsx(StringArrayInput, { def, value, error: state.error, onChange });
    default:
      return /* @__PURE__ */ jsxs("p", { className: styles.unsupported, children: [
        "Unsupported knob type: ",
        def.type || "unknown"
      ] });
  }
}
function KnobDot({ color }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: styles.knobDot,
      style: { background: color },
      "aria-hidden": "true"
    }
  );
}
function KnobField({ def, allKnobs, runtime, target }) {
  const state = useKnobValue(def, { runtime });
  const label2 = knobLabel(def);
  const highlightEnabled = isKnobHighlightEnabled(def);
  const dotColor = highlightEnabled ? resolveKnobColor(def) : null;
  const writeValue = useCallback((nextValue) => {
    if (state.isCrossWindow) {
      state.setOverride(nextValue);
      notifyHashChange(state.targetWindow);
    } else {
      state.setOverride(nextValue);
    }
  }, [state]);
  if (def.type === "object") {
    const children = childKnobs(def, allKnobs);
    return /* @__PURE__ */ jsxs(
      "fieldset",
      {
        className: styles.objectField,
        style: highlightEnabled ? { "--sb-knob-color": dotColor } : void 0,
        children: [
          /* @__PURE__ */ jsxs("legend", { className: styles.knobLegend, children: [
            /* @__PURE__ */ jsx("span", { className: styles.knobLabelText, children: label2 }),
            highlightEnabled && /* @__PURE__ */ jsx(KnobDot, { color: dotColor })
          ] }),
          def.description && /* @__PURE__ */ jsx("p", { className: styles.objectDescription, children: def.description }),
          /* @__PURE__ */ jsx(KnobsFields, { allKnobs, parentDef: def, runtime, target, nested: true }),
          children.length === 0 && /* @__PURE__ */ jsx("p", { className: styles.objectDescription, children: "No nested knobs are defined." })
        ]
      }
    );
  }
  const optionValues = Array.isArray(def.options) ? def.options.map(optionValue) : [];
  return /* @__PURE__ */ jsxs(
    Field,
    {
      invalid: !!state.error,
      className: styles.knobField,
      "data-knob-id": def.id,
      style: highlightEnabled ? { "--sb-knob-color": dotColor } : void 0,
      children: [
        /* @__PURE__ */ jsxs(Label, { className: styles.knobLabel, children: [
          /* @__PURE__ */ jsx("span", { className: styles.knobLabelText, children: label2 }),
          highlightEnabled && /* @__PURE__ */ jsx(KnobDot, { color: dotColor })
        ] }),
        /* @__PURE__ */ jsx(FieldRenderer, { def, state, onChange: writeValue }),
        state.error && /* @__PURE__ */ jsx(Validation, { children: state.error }),
        !state.error && state.mixed && /* @__PURE__ */ jsx(Description, { children: "Mixed values across connected frames. Editing sets every frame." }),
        !state.error && !state.mixed && def.description && /* @__PURE__ */ jsx(Description, { children: def.description }),
        !state.error && optionValues.length === 0 && (def.type === "select" || def.type === "radio") && /* @__PURE__ */ jsx(Validation, { children: "No options are defined for this knob." })
      ]
    }
  );
}
function KnobsFields({ allKnobs, parentDef, runtime, target, nested = false }) {
  const flatKnobs = allKnobs;
  const visibleKnobs = useMemo(() => parentDef ? childKnobs(parentDef, flatKnobs) : rootKnobs(flatKnobs), [flatKnobs, parentDef]);
  if (nested) {
    return /* @__PURE__ */ jsx("div", { className: styles.nestedFields, children: visibleKnobs.map((def) => /* @__PURE__ */ jsx(
      KnobField,
      {
        def,
        allKnobs: flatKnobs,
        runtime,
        target
      },
      `${scopeKey(def)}:${def.id}`
    )) });
  }
  const sections2 = groupSections(visibleKnobs);
  return /* @__PURE__ */ jsx("div", { className: styles.sections, children: sections2.map((section2) => /* @__PURE__ */ jsxs("section", { className: styles.section, children: [
    section2.label && /* @__PURE__ */ jsx("h3", { className: styles.sectionHeader, children: section2.label }),
    /* @__PURE__ */ jsx("div", { className: styles.fields, children: section2.knobs.map((def) => /* @__PURE__ */ jsx(
      KnobField,
      {
        def,
        allKnobs: flatKnobs,
        runtime,
        target
      },
      `${scopeKey(def)}:${def.id}`
    )) })
  ] }, section2.key || "default")) });
}
function ResetAllButton({ runtime }) {
  const targetWindow = runtime.targetWindow;
  const isCrossWindow = !!(targetWindow && targetWindow !== window);
  const handleReset = useCallback(() => {
    runtime.reset();
    if (isCrossWindow) notifyHashChange(targetWindow);
    else notifyHashChange(window);
  }, [runtime, isCrossWindow, targetWindow]);
  return /* @__PURE__ */ jsx("div", { className: styles.resetAll, children: /* @__PURE__ */ jsx(
    Button,
    {
      type: "button",
      variant: "invisible",
      size: "small",
      onClick: handleReset,
      children: "Reset to defaults"
    }
  ) });
}
function KnobsForm({
  knobs,
  target = null,
  targets = null,
  route,
  className,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  search = ""
}) {
  const safeKnobs = useMemo(() => Array.isArray(knobs) ? knobs : [], [knobs]);
  const signature = useMemo(() => schemaSignature(safeKnobs), [safeKnobs]);
  const ledger = useMemo(() => createSharedLedger(signature), [signature]);
  const runtime = useMemo(() => {
    if (!targets) return createHypercanvasKnobRuntime(safeKnobs, { target, route });
    if (!targets.some((entry) => entry.window)) return null;
    return createFanOutKnobRuntime(safeKnobs, targets, route, ledger);
  }, [safeKnobs, target, targets, route, ledger]);
  useEffect(() => () => runtime?.dispose(), [runtime]);
  const flatKnobs = runtime ? runtime.listKnobs() : [];
  const filteredKnobs = filterKnobsByName(flatKnobs, search);
  if (safeKnobs.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: `${styles.emptyState} ${className || ""}`, children: emptyMessage });
  }
  if (!runtime) {
    return /* @__PURE__ */ jsx("p", { className: `${styles.emptyState} ${className || ""}`, role: "status", children: "Waiting for connected frames to load before writing knobs." });
  }
  return /* @__PURE__ */ jsxs(
    Form,
    {
      className: `${styles.formShell} ${className || ""}`,
      onSubmit: (event) => event.preventDefault(),
      children: [
        filteredKnobs.length > 0 ? /* @__PURE__ */ jsx(KnobsFields, { allKnobs: filteredKnobs, runtime, target }) : /* @__PURE__ */ jsx("p", { className: styles.emptyState, role: "status", children: "No knobs match your search." }),
        /* @__PURE__ */ jsx(ResetAllButton, { runtime })
      ]
    }
  );
}
export {
  KnobsForm as K,
  detectKnobRoute as d,
  useKnob as u
};
