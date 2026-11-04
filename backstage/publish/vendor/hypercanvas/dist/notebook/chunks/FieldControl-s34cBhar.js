import * as React from "react";
import { useLayoutEffect } from "react";
import { a$ as isMouseLikePointerType, _ as isElement, b1 as getDocumentElement, b2 as getOverflowAncestors, U as isHTMLElement, aW as getComputedStyle$1, aE as getWindow, b3 as isTopLayer, aU as getParentNode, aT as isLastTraversableNode, b4 as isTableElement, b5 as isContainingBlock, b6 as getContainingBlock, b7 as getNodeName, aZ as isOverflowElement, b8 as getNodeScroll, b9 as isWebKit, ba as getFrameElement, a4 as useFloatingTree, G as useIsoLayoutEffect, $ as useRefWithInit, bb as useOnMount, T as Timeout, Z as useFloatingParentNodeId, V as useTimeout, K as useStableCallback, ab as ownerDocument, aR as mergeCleanups, aI as addEventListener, k as createChangeEventDetails, t as triggerHover, ag as getTarget, bc as isInteractiveElement, bd as isTargetInsideEnabledTrigger, aO as getNodeChildren, ac as contains, a3 as useValueAsRef, be as DISABLED_TRANSITIONS_STYLE, av as EMPTY_OBJECT, w as useRenderElement, aJ as popupStateMapping, aw as NOOP, f as formatErrorMessage, r as useBaseUiId, bf as error, ax as useValueChanged, aa as activeElement, aD as none } from "./composite-WCaVrKIy.js";
import * as ReactDOM from "react-dom";
function resolveValue(value, pointerType) {
  if (pointerType != null && !isMouseLikePointerType(pointerType)) {
    return 0;
  }
  if (typeof value === "function") {
    return value();
  }
  return value;
}
function getDelay(value, prop, pointerType) {
  const result = resolveValue(value, pointerType);
  if (typeof result === "number") {
    return result;
  }
  return result?.[prop];
}
function getRestMs(value) {
  if (typeof value === "function") {
    return value();
  }
  return value;
}
function isClickLikeOpenEvent(openEventType, interactedInside) {
  return interactedInside || openEventType === "click" || openEventType === "mousedown";
}
function isHoverOpenEvent(openEventType) {
  return openEventType?.includes("mouse") && openEventType !== "mousedown";
}
const min = Math.min;
const max = Math.max;
const round = Math.round;
const floor = Math.floor;
const createCoords = (v) => ({
  x: v,
  y: v
});
const oppositeSideMap = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function clamp(start, value, end) {
  return max(start, min(value, end));
}
function evaluate(value, param) {
  return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
  return placement.split("-")[0];
}
function getAlignment(placement) {
  return placement.split("-")[1];
}
function getOppositeAxis(axis) {
  return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
  return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
  const firstChar = placement[0];
  return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
const lrPlacement = ["left", "right"];
const rlPlacement = ["right", "left"];
const tbPlacement = ["top", "bottom"];
const btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
  switch (side) {
    case "top":
    case "bottom":
      if (rtl) return isStart ? rlPlacement : lrPlacement;
      return isStart ? lrPlacement : rlPlacement;
    case "left":
    case "right":
      return isStart ? tbPlacement : btPlacement;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === "start", rtl);
  if (alignment) {
    list = list.map((side) => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  const side = getSide(placement);
  return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
  var _padding$top, _padding$right, _padding$bottom, _padding$left;
  return {
    top: (_padding$top = padding.top) != null ? _padding$top : 0,
    right: (_padding$right = padding.right) != null ? _padding$right : 0,
    bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
    left: (_padding$left = padding.left) != null ? _padding$left : 0
  };
}
function getPaddingObject(padding) {
  return typeof padding !== "number" ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x,
    y,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    x,
    y
  };
}
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === "y";
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case "top":
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case "bottom":
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case "right":
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case "left":
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  const alignment = getAlignment(placement);
  if (alignment) {
    coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
  }
  return coords;
}
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x,
    y,
    platform: platform2,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = "clippingAncestors",
    rootBoundary = "viewport",
    elementContext = "floating",
    altBoundary = false,
    padding = 0
  } = evaluate(options, state);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === "floating" ? "reference" : "floating";
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform2.getClippingRect({
    element: ((_await$platform$isEle = await (platform2.isElement == null ? void 0 : platform2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform2.getDocumentElement == null ? void 0 : platform2.getDocumentElement(elements.floating)),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === "floating" ? {
    x,
    y,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(elements.floating));
  const offsetScale = await (platform2.isElement == null ? void 0 : platform2.isElement(offsetParent)) && await (platform2.getScale == null ? void 0 : platform2.getScale(offsetParent)) || {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform2.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}
const MAX_RESET_COUNT = 50;
const computePosition$1 = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2
  } = config;
  const platformWithDetectOverflow = platform2.detectOverflow ? platform2 : {
    ...platform2,
    detectOverflow
  };
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(floating));
  let rects = await platform2.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x,
    y
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let resetCount = 0;
  const middlewareData = {};
  for (let i = 0; i < middleware.length; i++) {
    const currentMiddleware = middleware[i];
    if (!currentMiddleware) {
      continue;
    }
    const {
      name,
      fn
    } = currentMiddleware;
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform: platformWithDetectOverflow,
      elements: {
        reference,
        floating
      }
    });
    x = nextX != null ? nextX : x;
    y = nextY != null ? nextY : y;
    middlewareData[name] = {
      ...middlewareData[name],
      ...data
    };
    if (reset && resetCount < MAX_RESET_COUNT) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform2.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x,
          y
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};
const flip$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "flip",
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform: platform2,
        elements
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = "bestFit",
        fallbackAxisSideDirection = "none",
        flipAlignment = true,
        ...detectOverflowOptions
      } = evaluate(options, state);
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements = [initialPlacement, ...fallbackPlacements];
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides[0]], overflow[sides[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];
      if (!overflows.every((side2) => side2 <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements[nextIndex];
        if (nextPlacement) {
          const ignoreCrossAxisOverflow = checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          if (!ignoreCrossAxisOverflow || // We leave the current main axis only if every placement on that axis
          // overflows the main axis.
          overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) {
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }
        let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case "bestFit": {
              var _overflowsData$filter2;
              const placement2 = (_overflowsData$filter2 = overflowsData.filter((d) => {
                if (hasFallbackAxisSideDirection) {
                  const currentSideAxis = getSideAxis(d.placement);
                  return currentSideAxis === initialSideAxis || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  currentSideAxis === "y";
                }
                return true;
              }).map((d) => [d.placement, d.overflows.filter((overflow2) => overflow2 > 0).reduce((acc, overflow2) => acc + overflow2, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
              if (placement2) {
                resetPlacement = placement2;
              }
              break;
            }
            case "initialPlacement":
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};
const originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
  const {
    placement,
    platform: platform2,
    elements
  } = state;
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
  const side = getSide(placement);
  const alignment = getAlignment(placement);
  const isVertical = getSideAxis(placement) === "y";
  const mainAxisMulti = originSides.has(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = evaluate(options, state);
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === "number" ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === "number") {
    crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}
const offset$2 = function(options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: "offset",
    options,
    async fn(state) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x,
        y,
        placement,
        middlewareData
      } = state;
      const diffCoords = await convertValueToCoords(state, options);
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x + diffCoords.x,
        y: y + diffCoords.y,
        data: {
          ...diffCoords,
          placement
        }
      };
    }
  };
};
const shift$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "shift",
    options,
    async fn(state) {
      const {
        x,
        y,
        placement,
        platform: platform2
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = false,
        limiter = {
          fn: (_ref) => {
            let {
              x: x2,
              y: y2
            } = _ref;
            return {
              x: x2,
              y: y2
            };
          }
        },
        ...detectOverflowOptions
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const clampCoord = (axis, coord) => clamp(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
      if (checkMainAxis) {
        mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
      }
      if (checkCrossAxis) {
        crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
      }
      const limitedCoords = limiter.fn({
        ...state,
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      });
      return {
        ...limitedCoords,
        data: {
          x: limitedCoords.x - x,
          y: limitedCoords.y - y,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      };
    }
  };
};
const limitShift$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    options,
    fn(state) {
      var _rawOffset$mainAxis, _rawOffset$crossAxis;
      const {
        x,
        y,
        placement,
        rects,
        middlewareData
      } = state;
      const {
        offset: offset2 = 0,
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const rawOffset = evaluate(offset2, state);
      const computedOffset = typeof rawOffset === "number" ? {
        mainAxis: rawOffset,
        crossAxis: 0
      } : {
        mainAxis: (_rawOffset$mainAxis = rawOffset.mainAxis) != null ? _rawOffset$mainAxis : 0,
        crossAxis: (_rawOffset$crossAxis = rawOffset.crossAxis) != null ? _rawOffset$crossAxis : 0
      };
      if (checkMainAxis) {
        const len = mainAxis === "y" ? "height" : "width";
        const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
        const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
        if (mainAxisCoord < limitMin) {
          mainAxisCoord = limitMin;
        } else if (mainAxisCoord > limitMax) {
          mainAxisCoord = limitMax;
        }
      }
      if (checkCrossAxis) {
        var _middlewareData$offse, _middlewareData$offse2;
        const len = mainAxis === "y" ? "width" : "height";
        const isOriginSide = originSides.has(getSide(placement));
        const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
        const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
        if (crossAxisCoord < limitMin) {
          crossAxisCoord = limitMin;
        } else if (crossAxisCoord > limitMax) {
          crossAxisCoord = limitMax;
        }
      }
      return {
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      };
    }
  };
};
const size$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "size",
    options,
    async fn(state) {
      const {
        placement,
        rects,
        platform: platform2,
        elements
      } = state;
      const {
        apply = () => {
        },
        ...detectOverflowOptions
      } = evaluate(options, state);
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const side = getSide(placement);
      const alignment = getAlignment(placement);
      const isYAxis = getSideAxis(placement) === "y";
      const {
        width,
        height
      } = rects.floating;
      let heightSide;
      let widthSide;
      if (side === "top" || side === "bottom") {
        heightSide = side;
        widthSide = alignment === (await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating)) ? "start" : "end") ? "left" : "right";
      } else {
        widthSide = side;
        heightSide = alignment === "end" ? "top" : "bottom";
      }
      const maximumClippingHeight = height - overflow.top - overflow.bottom;
      const maximumClippingWidth = width - overflow.left - overflow.right;
      const overflowAvailableHeight = min(height - overflow[heightSide], maximumClippingHeight);
      const overflowAvailableWidth = min(width - overflow[widthSide], maximumClippingWidth);
      const shiftData = state.middlewareData.shift;
      const noShift = !shiftData;
      let availableHeight2 = overflowAvailableHeight;
      let availableWidth2 = overflowAvailableWidth;
      if (shiftData != null && shiftData.enabled.x) {
        availableWidth2 = maximumClippingWidth;
      }
      if (shiftData != null && shiftData.enabled.y) {
        availableHeight2 = maximumClippingHeight;
      }
      if (noShift && !alignment) {
        if (isYAxis) {
          availableWidth2 = width - 2 * max(overflow.left, overflow.right);
        } else {
          availableHeight2 = height - 2 * max(overflow.top, overflow.bottom);
        }
      }
      await apply({
        ...state,
        availableWidth: availableWidth2,
        availableHeight: availableHeight2
      });
      const nextDimensions = await platform2.getDimensions(elements.floating);
      if (width !== nextDimensions.width || height !== nextDimensions.height) {
        return {
          reset: {
            rects: true
          }
        };
      }
      return {};
    }
  };
};
function getCssDimensions(element) {
  const css = getComputedStyle$1(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $
  } = getCssDimensions(domElement);
  let x = ($ ? round(rect.width) : rect.width) / width;
  let y = ($ ? round(rect.height) : rect.height) / height;
  if (!x || !Number.isFinite(x)) {
    x = 1;
  }
  if (!y || !Number.isFinite(y)) {
    y = 1;
  }
  return {
    x,
    y
  };
}
const noOffsets = /* @__PURE__ */ createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x = (clientRect.left + visualOffsets.x) / scale.x;
  let y = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement && offsetParent) {
    const win = getWindow(domElement);
    const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle$1(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x *= iframeScale.x;
      y *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x += left;
      y += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x,
    y
  });
}
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
  const htmlRect = documentElement.getBoundingClientRect();
  const x = htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect);
  const y = htmlRect.top + scroll.scrollTop;
  return {
    x,
    y
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === "fixed";
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
  const scroll = getNodeScroll(html);
  const body = html.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x = -scroll.scrollLeft + getWindowScrollBarX(html);
  const y = -scroll.scrollTop;
  if (getComputedStyle$1(body).direction === "rtl") {
    x += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}
const SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
  if (rootBoundary === void 0) {
    rootBoundary = "viewport";
  }
  const isLayoutViewport = rootBoundary === "layoutViewport";
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
    if (isLayoutViewport) {
      if (!layoutRelativeClientCoords) {
        x = -visualViewport.offsetLeft;
        y = -visualViewport.offsetTop;
      }
    } else {
      width = visualViewport.width;
      height = visualViewport.height;
      if (layoutRelativeClientCoords) {
        x = visualViewport.offsetLeft;
        y = visualViewport.offsetTop;
      }
    }
  }
  const windowScrollbarX = getWindowScrollBarX(html);
  if (windowScrollbarX <= 0) {
    const doc = html.ownerDocument;
    const body = doc.body;
    const bodyStyles = getComputedStyle(body);
    const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
    const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
    const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
    if (gutter <= SCROLLBAR_MAX) {
      width -= gutter;
    }
  }
  return {
    width,
    height,
    x,
    y
  };
}
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = getScale(element);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x = left * scale.x;
  const y = top * scale.y;
  return {
    width,
    height,
    x,
    y
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") {
    rect = getViewportRect(element, strategy, clippingAncestor);
  } else if (clippingAncestor === "document") {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
  let lastKeptComputedStyle = null;
  const elementIsFixed = getComputedStyle$1(element).position === "fixed";
  let currentNode = elementIsFixed ? getParentNode(element) : element;
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle$1(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
    const shouldDropCurrentNode = !currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static");
    if (shouldDropCurrentNode) {
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      lastKeptComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
  let top = firstRect.top;
  let right = firstRect.right;
  let bottom = firstRect.bottom;
  let left = firstRect.left;
  for (let i = 1; i < clippingAncestors.length; i++) {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
    top = max(rect.top, top);
    right = min(rect.right, right);
    bottom = min(rect.bottom, bottom);
    left = max(rect.left, left);
  }
  return {
    width: right - left,
    height: bottom - top,
    x: left,
    y: top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === "fixed";
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  if (!isOffsetParentAnElement && documentElement) {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x,
    y,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle$1(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle$1(element).position === "fixed") {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
const getElementRects = async function(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle$1(element).direction === "rtl";
}
const platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function observeMove(element, onMove, ancestorResize) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        return refresh();
      }
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1e3);
        } else {
          refresh(false, ratio);
        }
      }
      isFirstUpdate = false;
    }
    try {
      io = new IntersectionObserver(handleObserve, {
        ...options,
        // Handle <iframe>s
        root: root.ownerDocument
      });
    } catch (_e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  const win = getWindow(element);
  const handleResize = () => refresh(ancestorResize);
  win.addEventListener("resize", handleResize);
  refresh(true);
  return () => {
    win.removeEventListener("resize", handleResize);
    cleanup();
  };
}
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === "function",
    layoutShift = typeof IntersectionObserver === "function",
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
  ancestors.forEach((ancestor) => {
    ancestorScroll && ancestor.addEventListener("scroll", update);
    ancestorResize && ancestor.addEventListener("resize", update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update, ancestorResize) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver((_ref) => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    if (floating) {
      resizeObserver.observe(floating);
    }
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach((ancestor) => {
      ancestorScroll && ancestor.removeEventListener("scroll", update);
      ancestorResize && ancestor.removeEventListener("resize", update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}
const offset$1 = offset$2;
const shift$1 = shift$2;
const flip$1 = flip$2;
const size$1 = size$2;
const limitShift$1 = limitShift$2;
const computePosition = (reference, floating, options) => {
  const cache = /* @__PURE__ */ new Map();
  const mergedOptions = options != null ? options : {};
  const platformWithCache = {
    ...platform,
    ...mergedOptions.platform,
    _c: cache
  };
  return computePosition$1(reference, floating, {
    ...mergedOptions,
    platform: platformWithCache
  });
};
var isClient = typeof document !== "undefined";
var noop = function noop2() {
};
var index = isClient ? useLayoutEffect : noop;
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === "function" && a.toString() === b.toString()) {
    return true;
  }
  let length;
  let i;
  let keys;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a)) {
      length = a.length;
      if (length !== b.length) return false;
      for (i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) {
      return false;
    }
    for (i = length; i-- !== 0; ) {
      if (!{}.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }
    for (i = length; i-- !== 0; ) {
      const key = keys[i];
      if (key === "_owner" && a.$$typeof) {
        continue;
      }
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return a !== a && b !== b;
}
function getDPR(element) {
  if (typeof window === "undefined") {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}
function roundByDPR(element, value) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}
function useLatestRef(value) {
  const ref = React.useRef(value);
  index(() => {
    ref.current = value;
  });
  return ref;
}
function useFloating(options) {
  if (options === void 0) {
    options = {};
  }
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2,
    elements: {
      reference: externalReference,
      floating: externalFloating
    } = {},
    transform = true,
    whileElementsMounted,
    open
  } = options;
  const [data, setData] = React.useState({
    x: 0,
    y: 0,
    strategy,
    placement,
    middlewareData: {},
    isPositioned: false
  });
  const [latestMiddleware, setLatestMiddleware] = React.useState(middleware);
  if (!deepEqual(latestMiddleware, middleware)) {
    setLatestMiddleware(middleware);
  }
  const [_reference, _setReference] = React.useState(null);
  const [_floating, _setFloating] = React.useState(null);
  const setReference = React.useCallback((node) => {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      _setReference(node);
    }
  }, []);
  const setFloating = React.useCallback((node) => {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      _setFloating(node);
    }
  }, []);
  const referenceEl = externalReference || _reference;
  const floatingEl = externalFloating || _floating;
  const referenceRef = React.useRef(null);
  const floatingRef = React.useRef(null);
  const dataRef = React.useRef(data);
  const hasWhileElementsMounted = whileElementsMounted != null;
  const whileElementsMountedRef = useLatestRef(whileElementsMounted);
  const platformRef = useLatestRef(platform2);
  const openRef = useLatestRef(open);
  const update = React.useCallback(() => {
    if (!referenceRef.current || !floatingRef.current) {
      return;
    }
    const config = {
      placement,
      strategy,
      middleware: latestMiddleware
    };
    if (platformRef.current) {
      config.platform = platformRef.current;
    }
    computePosition(referenceRef.current, floatingRef.current, config).then((data2) => {
      const fullData = {
        ...data2,
        // The floating element's position may be recomputed while it's closed
        // but still mounted (such as when transitioning out). To ensure
        // `isPositioned` will be `false` initially on the next open, avoid
        // setting it to `true` when `open === false` (must be specified).
        isPositioned: openRef.current !== false
      };
      if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
        dataRef.current = fullData;
        ReactDOM.flushSync(() => {
          setData(fullData);
        });
      }
    });
  }, [latestMiddleware, placement, strategy, platformRef, openRef]);
  index(() => {
    if (open === false && dataRef.current.isPositioned) {
      dataRef.current.isPositioned = false;
      setData((data2) => ({
        ...data2,
        isPositioned: false
      }));
    }
  }, [open]);
  const isMountedRef = React.useRef(false);
  index(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  index(() => {
    if (referenceEl) referenceRef.current = referenceEl;
    if (floatingEl) floatingRef.current = floatingEl;
    if (referenceEl && floatingEl) {
      if (whileElementsMountedRef.current) {
        return whileElementsMountedRef.current(referenceEl, floatingEl, update);
      }
      update();
    }
  }, [referenceEl, floatingEl, update, whileElementsMountedRef, hasWhileElementsMounted]);
  const refs = React.useMemo(() => ({
    reference: referenceRef,
    floating: floatingRef,
    setReference,
    setFloating
  }), [setReference, setFloating]);
  const elements = React.useMemo(() => ({
    reference: referenceEl,
    floating: floatingEl
  }), [referenceEl, floatingEl]);
  const floatingStyles = React.useMemo(() => {
    const initialStyles = {
      position: strategy,
      left: 0,
      top: 0
    };
    if (!elements.floating) {
      return initialStyles;
    }
    const x = roundByDPR(elements.floating, data.x);
    const y = roundByDPR(elements.floating, data.y);
    if (transform) {
      return {
        ...initialStyles,
        transform: "translate(" + x + "px, " + y + "px)",
        ...getDPR(elements.floating) >= 1.5 && {
          willChange: "transform"
        }
      };
    }
    return {
      position: strategy,
      left: x,
      top: y
    };
  }, [strategy, transform, elements.floating, data.x, data.y]);
  return React.useMemo(() => ({
    ...data,
    update,
    refs,
    elements,
    floatingStyles
  }), [data, update, refs, elements, floatingStyles]);
}
const offset = (options, deps) => {
  const result = offset$1(options);
  return {
    name: result.name,
    fn: result.fn,
    options: [options, deps]
  };
};
const shift = (options, deps) => {
  const result = shift$1(options);
  return {
    name: result.name,
    fn: result.fn,
    options: [options, deps]
  };
};
const limitShift = (options, deps) => {
  const result = limitShift$1(options);
  return {
    fn: result.fn,
    options: [options, deps]
  };
};
const flip = (options, deps) => {
  const result = flip$1(options);
  return {
    name: result.name,
    fn: result.fn,
    options: [options, deps]
  };
};
const size = (options, deps) => {
  const result = size$1(options);
  return {
    name: result.name,
    fn: result.fn,
    options: [options, deps]
  };
};
function useBaseUIFloating(options) {
  return useFloatingWithStore(options, options.rootContext);
}
function useFloatingWithStore(options, store) {
  const {
    nodeId,
    externalTree
  } = options;
  const referenceElement = store.useState("referenceElement");
  const floatingElement = store.useState("floatingElement");
  const domReferenceElement = store.useState("domReferenceElement");
  const open = store.useState("open");
  const floatingId = store.useState("floatingId");
  const [positionReference, setPositionReferenceRaw] = React.useState(null);
  const [localDomReference, setLocalDomReference] = React.useState(void 0);
  const [localFloatingElement, setLocalFloatingElement] = React.useState(void 0);
  const domReferenceRef = React.useRef(null);
  const tree = useFloatingTree(externalTree);
  const storeElements = React.useMemo(() => ({
    reference: referenceElement,
    floating: floatingElement,
    domReference: domReferenceElement
  }), [referenceElement, floatingElement, domReferenceElement]);
  const position = useFloating({
    ...options,
    elements: {
      ...storeElements,
      ...positionReference && {
        reference: positionReference
      }
    }
  });
  const localDomReferenceElement = isElement(localDomReference) ? localDomReference : null;
  const syncedFloatingElement = localFloatingElement === void 0 ? store.state.floatingElement : localFloatingElement;
  store.useSyncedValue("referenceElement", localDomReference ?? null);
  store.useSyncedValue("domReferenceElement", localDomReference === void 0 ? domReferenceElement : localDomReferenceElement);
  store.useSyncedValue("floatingElement", syncedFloatingElement);
  const setPositionReference = React.useCallback((node) => {
    const computedPositionReference = isElement(node) ? {
      getBoundingClientRect: () => node.getBoundingClientRect(),
      getClientRects: () => node.getClientRects(),
      contextElement: node
    } : node;
    setPositionReferenceRaw(computedPositionReference);
    position.refs.setReference(computedPositionReference);
  }, [position.refs]);
  const setReference = React.useCallback((node) => {
    if (isElement(node) || node === null) {
      domReferenceRef.current = node;
      setLocalDomReference(node);
    }
    if (isElement(position.refs.reference.current) || position.refs.reference.current === null || // Don't allow setting virtual elements using the old technique back to
    // `null` to support `positionReference` + an unstable `reference`
    // callback ref.
    node !== null && !isElement(node)) {
      position.refs.setReference(node);
    }
  }, [position.refs, setLocalDomReference]);
  const setFloating = React.useCallback((node) => {
    setLocalFloatingElement(node);
    position.refs.setFloating(node);
  }, [position.refs]);
  const refs = React.useMemo(() => ({
    ...position.refs,
    setReference,
    setFloating,
    setPositionReference,
    domReference: domReferenceRef
  }), [position.refs, setReference, setFloating, setPositionReference]);
  const elements = React.useMemo(() => ({
    ...position.elements,
    domReference: domReferenceElement
  }), [position.elements, domReferenceElement]);
  const context = React.useMemo(() => ({
    ...position,
    dataRef: store.context.dataRef,
    open,
    onOpenChange: store.setOpen,
    events: store.context.events,
    floatingId,
    refs,
    elements,
    nodeId,
    rootStore: store
  }), [position, refs, elements, nodeId, store, open, floatingId]);
  useIsoLayoutEffect(() => {
    if (domReferenceElement) {
      domReferenceRef.current = domReferenceElement;
    }
  }, [domReferenceElement]);
  useIsoLayoutEffect(() => {
    store.context.dataRef.current.floatingContext = context;
    const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.context = context;
    }
  });
  return React.useMemo(() => ({
    ...position,
    context,
    refs,
    elements,
    rootStore: store
  }), [position, refs, elements, context, store]);
}
class HoverInteraction {
  constructor() {
    this.pointerType = void 0;
    this.interactedInside = false;
    this.handler = void 0;
    this.blockMouseMove = true;
    this.performedPointerEventsMutation = false;
    this.pointerEventsScopeElement = null;
    this.pointerEventsReferenceElement = null;
    this.pointerEventsFloatingElement = null;
    this.restTimeoutPending = false;
    this.openChangeTimeout = new Timeout();
    this.restTimeout = new Timeout();
    this.handleCloseOptions = void 0;
  }
  static create() {
    return new HoverInteraction();
  }
  dispose = () => {
    this.openChangeTimeout.clear();
    this.restTimeout.clear();
  };
  disposeEffect = () => {
    return this.dispose;
  };
}
const pointerEventsMutationOwnerByScopeElement = /* @__PURE__ */ new WeakMap();
function clearSafePolygonPointerEventsMutation(instance) {
  if (!instance.performedPointerEventsMutation) {
    return;
  }
  const scopeElement = instance.pointerEventsScopeElement;
  if (scopeElement && pointerEventsMutationOwnerByScopeElement.get(scopeElement) === instance) {
    instance.pointerEventsScopeElement?.style.removeProperty("pointer-events");
    instance.pointerEventsReferenceElement?.style.removeProperty("pointer-events");
    instance.pointerEventsFloatingElement?.style.removeProperty("pointer-events");
    pointerEventsMutationOwnerByScopeElement.delete(scopeElement);
  }
  instance.performedPointerEventsMutation = false;
  instance.pointerEventsScopeElement = null;
  instance.pointerEventsReferenceElement = null;
  instance.pointerEventsFloatingElement = null;
}
function applySafePolygonPointerEventsMutation(instance, options) {
  const {
    scopeElement,
    referenceElement,
    floatingElement
  } = options;
  const existingOwner = pointerEventsMutationOwnerByScopeElement.get(scopeElement);
  if (existingOwner && existingOwner !== instance) {
    clearSafePolygonPointerEventsMutation(existingOwner);
  }
  clearSafePolygonPointerEventsMutation(instance);
  instance.performedPointerEventsMutation = true;
  instance.pointerEventsScopeElement = scopeElement;
  instance.pointerEventsReferenceElement = referenceElement;
  instance.pointerEventsFloatingElement = floatingElement;
  pointerEventsMutationOwnerByScopeElement.set(scopeElement, instance);
  scopeElement.style.pointerEvents = "none";
  referenceElement.style.pointerEvents = "auto";
  floatingElement.style.pointerEvents = "auto";
}
function useHoverInteractionSharedState(store) {
  const data = store.context.dataRef.current;
  const instance = useRefWithInit(() => data.hoverInteractionState ?? HoverInteraction.create()).current;
  if (!data.hoverInteractionState) {
    data.hoverInteractionState = instance;
  }
  useOnMount(data.hoverInteractionState.disposeEffect);
  return data.hoverInteractionState;
}
function useHoverFloatingInteraction(context, parameters = {}) {
  const {
    enabled = true,
    closeDelay: closeDelayProp = 0,
    nodeId: nodeIdProp
  } = parameters;
  const store = "rootStore" in context ? context.rootStore : context;
  const open = store.useState("open");
  const floatingElement = store.useState("floatingElement");
  const domReferenceElement = store.useState("domReferenceElement");
  const {
    dataRef
  } = store.context;
  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();
  const instance = useHoverInteractionSharedState(store);
  const childClosedTimeout = useTimeout();
  const isClickLikeOpenEvent$1 = useStableCallback(() => {
    return isClickLikeOpenEvent(dataRef.current.openEvent?.type, instance.interactedInside);
  });
  const isHoverOpen = useStableCallback(() => {
    return isHoverOpenEvent(dataRef.current.openEvent?.type);
  });
  const clearPointerEvents = useStableCallback(() => {
    clearSafePolygonPointerEventsMutation(instance);
  });
  useIsoLayoutEffect(() => {
    if (!open) {
      instance.pointerType = void 0;
      instance.restTimeoutPending = false;
      instance.interactedInside = false;
      clearPointerEvents();
    }
  }, [open, instance, clearPointerEvents]);
  React.useEffect(() => {
    return clearPointerEvents;
  }, [clearPointerEvents]);
  useIsoLayoutEffect(() => {
    if (!enabled) {
      return void 0;
    }
    if (open && instance.handleCloseOptions?.blockPointerEvents && isHoverOpen() && isElement(domReferenceElement) && floatingElement) {
      const ref = domReferenceElement;
      const floatingEl = floatingElement;
      const doc = ownerDocument(floatingElement);
      const parentFloating = tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.elements.floating;
      if (parentFloating) {
        parentFloating.style.pointerEvents = "";
      }
      const cachedScopeElement = instance.pointerEventsScopeElement !== floatingEl ? instance.pointerEventsScopeElement : null;
      const parentScopeElement = parentFloating !== floatingEl ? parentFloating : null;
      const scopeElement = instance.handleCloseOptions?.getScope?.() ?? cachedScopeElement ?? parentScopeElement ?? ref.closest("[data-rootownerid]") ?? doc.body;
      applySafePolygonPointerEventsMutation(instance, {
        scopeElement,
        referenceElement: ref,
        floatingElement: floatingEl
      });
      return () => {
        clearPointerEvents();
      };
    }
    return void 0;
  }, [enabled, open, domReferenceElement, floatingElement, instance, isHoverOpen, tree, parentId, clearPointerEvents]);
  React.useEffect(() => {
    if (!enabled) {
      return void 0;
    }
    function hasParentChildren() {
      return !!(tree && parentId && getNodeChildren(tree.nodesRef.current, parentId).length > 0);
    }
    function closeWithDelay(event) {
      const closeDelay = getDelay(closeDelayProp, "close", instance.pointerType);
      const close = () => {
        store.setOpen(false, createChangeEventDetails(triggerHover, event));
        tree?.events.emit("floating.closed", event);
      };
      if (closeDelay) {
        instance.openChangeTimeout.start(closeDelay, close);
      } else {
        instance.openChangeTimeout.clear();
        close();
      }
    }
    function handleInteractInside(event) {
      const target = getTarget(event);
      if (!isInteractiveElement(target)) {
        instance.interactedInside = false;
        return;
      }
      instance.interactedInside = target?.closest("[aria-haspopup]") != null;
    }
    function onFloatingMouseEnter() {
      instance.openChangeTimeout.clear();
      childClosedTimeout.clear();
      tree?.events.off("floating.closed", onNodeClosed);
      clearPointerEvents();
    }
    function onFloatingMouseLeave(event) {
      if (hasParentChildren() && tree) {
        tree.events.on("floating.closed", onNodeClosed);
        return;
      }
      if (isTargetInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements)) {
        return;
      }
      const currentNodeId = dataRef.current.floatingContext?.nodeId ?? nodeIdProp;
      const relatedTarget = event.relatedTarget;
      const isMovingIntoDescendantFloating = tree && currentNodeId && isElement(relatedTarget) && getNodeChildren(tree.nodesRef.current, currentNodeId, false).some((node) => contains(node.context?.elements.floating, relatedTarget));
      if (isMovingIntoDescendantFloating) {
        return;
      }
      if (instance.handler) {
        instance.handler(event);
        return;
      }
      clearPointerEvents();
      if (isHoverOpen() && !isClickLikeOpenEvent$1()) {
        closeWithDelay(event);
      }
    }
    function onNodeClosed(event) {
      if (!tree || !parentId || hasParentChildren()) {
        return;
      }
      childClosedTimeout.start(0, () => {
        tree.events.off("floating.closed", onNodeClosed);
        store.setOpen(false, createChangeEventDetails(triggerHover, event));
        tree.events.emit("floating.closed", event);
      });
    }
    const floating = floatingElement;
    return mergeCleanups(floating && addEventListener(floating, "mouseenter", onFloatingMouseEnter), floating && addEventListener(floating, "mouseleave", onFloatingMouseLeave), floating && addEventListener(floating, "pointerdown", handleInteractInside, true), () => {
      tree?.events.off("floating.closed", onNodeClosed);
    });
  }, [enabled, floatingElement, store, dataRef, closeDelayProp, nodeIdProp, isHoverOpen, isClickLikeOpenEvent$1, clearPointerEvents, instance, tree, parentId, childClosedTimeout]);
}
const EMPTY_REF = {
  current: null
};
function useHoverReferenceInteraction(context, props = {}) {
  const {
    enabled = true,
    delay = 0,
    handleClose = null,
    mouseOnly = false,
    restMs = 0,
    move = true,
    triggerElementRef = EMPTY_REF,
    externalTree,
    isActiveTrigger = true,
    getHandleCloseContext,
    isClosing,
    shouldOpen: shouldOpenProp,
    guardStaleOpen = false
  } = props;
  const store = "rootStore" in context ? context.rootStore : context;
  const {
    dataRef,
    events
  } = store.context;
  const tree = useFloatingTree(externalTree);
  const instance = useHoverInteractionSharedState(store);
  const isHoverCloseActiveRef = React.useRef(false);
  const handleCloseRef = useValueAsRef(handleClose);
  const delayRef = useValueAsRef(delay);
  const restMsRef = useValueAsRef(restMs);
  const enabledRef = useValueAsRef(enabled);
  const shouldOpenRef = useValueAsRef(shouldOpenProp);
  const isClosingRef = useValueAsRef(isClosing);
  const isClickLikeOpenEvent$1 = useStableCallback(() => {
    return isClickLikeOpenEvent(dataRef.current.openEvent?.type, instance.interactedInside);
  });
  const checkShouldOpen = useStableCallback(() => {
    return shouldOpenRef.current?.() !== false;
  });
  const isOverInactiveTrigger = useStableCallback((currentDomReference, currentTarget, target) => {
    const allTriggers = store.context.triggerElements;
    if (allTriggers.hasElement(currentTarget)) {
      return !currentDomReference || !contains(currentDomReference, currentTarget);
    }
    if (!isElement(target)) {
      return false;
    }
    const targetElement = target;
    return allTriggers.hasMatchingElement((trigger) => contains(trigger, targetElement)) && (!currentDomReference || !contains(currentDomReference, targetElement));
  });
  const cleanupMouseMoveHandler = useStableCallback(() => {
    if (!instance.handler) {
      return;
    }
    const doc = ownerDocument(store.select("domReferenceElement"));
    doc.removeEventListener("mousemove", instance.handler);
    instance.handler = void 0;
  });
  const clearPointerEvents = useStableCallback(() => {
    clearSafePolygonPointerEventsMutation(instance);
  });
  if (isActiveTrigger) {
    instance.handleCloseOptions = handleClose?.__options;
  }
  React.useEffect(() => cleanupMouseMoveHandler, [cleanupMouseMoveHandler]);
  React.useEffect(() => {
    if (!enabled) {
      return void 0;
    }
    function onOpenChangeLocal(details) {
      if (!details.open) {
        isHoverCloseActiveRef.current = details.reason === triggerHover;
        cleanupMouseMoveHandler();
        instance.openChangeTimeout.clear();
        instance.restTimeout.clear();
        instance.blockMouseMove = true;
        instance.restTimeoutPending = false;
      } else {
        isHoverCloseActiveRef.current = false;
      }
    }
    events.on("openchange", onOpenChangeLocal);
    return () => {
      events.off("openchange", onOpenChangeLocal);
    };
  }, [enabled, events, instance, cleanupMouseMoveHandler]);
  React.useEffect(() => {
    if (!enabled) {
      return void 0;
    }
    function closeWithDelay(event, runElseBranch = true) {
      const closeDelay = getDelay(delayRef.current, "close", instance.pointerType);
      if (closeDelay) {
        instance.openChangeTimeout.start(closeDelay, () => {
          store.setOpen(false, createChangeEventDetails(triggerHover, event));
          tree?.events.emit("floating.closed", event);
        });
      } else if (runElseBranch) {
        instance.openChangeTimeout.clear();
        store.setOpen(false, createChangeEventDetails(triggerHover, event));
        tree?.events.emit("floating.closed", event);
      }
    }
    const trigger = triggerElementRef.current ?? (isActiveTrigger ? store.select("domReferenceElement") : null);
    if (!isElement(trigger)) {
      return void 0;
    }
    function onMouseEnter(event) {
      instance.openChangeTimeout.clear();
      instance.blockMouseMove = false;
      if (mouseOnly && !isMouseLikePointerType(instance.pointerType)) {
        return;
      }
      const restMsValue = getRestMs(restMsRef.current);
      const openDelay = getDelay(delayRef.current, "open", instance.pointerType);
      const eventTarget = getTarget(event);
      const currentTarget = event.currentTarget ?? null;
      const currentDomReference = store.select("domReferenceElement");
      let triggerNode = currentTarget;
      if (isElement(eventTarget) && !store.context.triggerElements.hasElement(eventTarget)) {
        for (const triggerElement of store.context.triggerElements.elements()) {
          if (contains(triggerElement, eventTarget)) {
            triggerNode = triggerElement;
            break;
          }
        }
      }
      if (isElement(currentTarget) && isElement(currentDomReference) && !store.context.triggerElements.hasElement(currentTarget) && contains(currentTarget, currentDomReference)) {
        triggerNode = currentDomReference;
      }
      const isOverInactive = triggerNode == null ? false : isOverInactiveTrigger(currentDomReference, triggerNode, eventTarget);
      const isOpen = store.select("open");
      const isInClosingTransition = isClosingRef.current?.() ?? store.select("transitionStatus") === "ending";
      const isHoverCloseTransition = !isOpen && isInClosingTransition && isHoverCloseActiveRef.current;
      const isReenteringSameTriggerDuringCloseTransition = !isOverInactive && isElement(triggerNode) && isElement(currentDomReference) && contains(currentDomReference, triggerNode) && isHoverCloseTransition;
      const isRestOnlyDelay = restMsValue > 0 && !openDelay;
      const shouldOpenImmediately = isOverInactive && (isOpen || isHoverCloseTransition) || isReenteringSameTriggerDuringCloseTransition;
      const shouldOpen = !isOpen || isOverInactive;
      if (shouldOpenImmediately) {
        if (checkShouldOpen()) {
          store.setOpen(true, createChangeEventDetails(triggerHover, event, triggerNode));
        }
        return;
      }
      if (isRestOnlyDelay) {
        return;
      }
      if (openDelay) {
        instance.openChangeTimeout.start(openDelay, () => {
          if (shouldOpen && checkShouldOpen()) {
            store.setOpen(true, createChangeEventDetails(triggerHover, event, triggerNode));
          }
        });
      } else if (shouldOpen) {
        if (checkShouldOpen()) {
          store.setOpen(true, createChangeEventDetails(triggerHover, event, triggerNode));
        }
      }
    }
    function onMouseLeave(event) {
      if (isClickLikeOpenEvent$1()) {
        clearPointerEvents();
        return;
      }
      cleanupMouseMoveHandler();
      const domReferenceElement = store.select("domReferenceElement");
      const doc = ownerDocument(domReferenceElement);
      instance.restTimeout.clear();
      instance.restTimeoutPending = false;
      const handleCloseContextBase = dataRef.current.floatingContext ?? getHandleCloseContext?.();
      if (isTargetInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements)) {
        return;
      }
      if (handleCloseRef.current && handleCloseContextBase) {
        if (!store.select("open")) {
          instance.openChangeTimeout.clear();
        }
        const currentTrigger = triggerElementRef.current;
        instance.handler = handleCloseRef.current({
          ...handleCloseContextBase,
          tree,
          x: event.clientX,
          y: event.clientY,
          onClose() {
            clearPointerEvents();
            cleanupMouseMoveHandler();
            if (enabledRef.current && !isClickLikeOpenEvent$1() && currentTrigger === store.select("domReferenceElement")) {
              closeWithDelay(event, true);
            }
          }
        });
        doc.addEventListener("mousemove", instance.handler);
        instance.handler(event);
        return;
      }
      const shouldClose = instance.pointerType === "touch" ? !contains(store.select("floatingElement"), event.relatedTarget) : true;
      if (shouldClose) {
        closeWithDelay(event);
      }
    }
    function onMouseOut(event) {
      if (contains(trigger, event.relatedTarget)) {
        return;
      }
      instance.openChangeTimeout.clear();
      instance.restTimeout.clear();
      instance.restTimeoutPending = false;
    }
    const staleOpenGuard = guardStaleOpen ? addEventListener(trigger, "mouseout", onMouseOut) : void 0;
    if (move) {
      return mergeCleanups(addEventListener(trigger, "mousemove", onMouseEnter, {
        once: true
      }), addEventListener(trigger, "mouseenter", onMouseEnter), addEventListener(trigger, "mouseleave", onMouseLeave), staleOpenGuard);
    }
    return mergeCleanups(addEventListener(trigger, "mouseenter", onMouseEnter), addEventListener(trigger, "mouseleave", onMouseLeave), staleOpenGuard);
  }, [cleanupMouseMoveHandler, clearPointerEvents, dataRef, delayRef, store, enabled, handleCloseRef, instance, isActiveTrigger, isOverInactiveTrigger, isClickLikeOpenEvent$1, mouseOnly, move, restMsRef, triggerElementRef, tree, enabledRef, getHandleCloseContext, isClosingRef, checkShouldOpen, guardStaleOpen]);
  return React.useMemo(() => {
    if (!enabled) {
      return void 0;
    }
    function setPointerRef(event) {
      instance.pointerType = event.pointerType;
    }
    return {
      onPointerDown: setPointerRef,
      onPointerEnter: setPointerRef,
      onMouseMove(event) {
        const {
          nativeEvent
        } = event;
        const trigger = event.currentTarget;
        const currentDomReference = store.select("domReferenceElement");
        const currentOpen = store.select("open");
        const isOverInactive = isOverInactiveTrigger(currentDomReference, trigger, event.target);
        if (mouseOnly && !isMouseLikePointerType(instance.pointerType)) {
          return;
        }
        if (currentOpen && isOverInactive && instance.handleCloseOptions?.blockPointerEvents) {
          const floatingElement = store.select("floatingElement");
          if (floatingElement) {
            const scopeElement = instance.handleCloseOptions?.getScope?.() ?? trigger.ownerDocument.body;
            applySafePolygonPointerEventsMutation(instance, {
              scopeElement,
              referenceElement: trigger,
              floatingElement
            });
          }
        }
        const restMsValue = getRestMs(restMsRef.current);
        if (currentOpen && !isOverInactive || restMsValue === 0) {
          return;
        }
        if (!isOverInactive && instance.restTimeoutPending && event.movementX ** 2 + event.movementY ** 2 < 2) {
          return;
        }
        instance.restTimeout.clear();
        function handleMouseMove() {
          instance.restTimeoutPending = false;
          if (isClickLikeOpenEvent$1()) {
            return;
          }
          const latestOpen = store.select("open");
          if (!instance.blockMouseMove && (!latestOpen || isOverInactive) && checkShouldOpen()) {
            store.setOpen(true, createChangeEventDetails(triggerHover, nativeEvent, trigger));
          }
        }
        if (instance.pointerType === "touch") {
          ReactDOM.flushSync(() => {
            handleMouseMove();
          });
        } else if (isOverInactive && currentOpen) {
          handleMouseMove();
        } else {
          instance.restTimeoutPending = true;
          instance.restTimeout.start(restMsValue, handleMouseMove);
        }
      }
    };
  }, [enabled, instance, isClickLikeOpenEvent$1, isOverInactiveTrigger, mouseOnly, store, restMsRef, checkShouldOpen]);
}
const CURSOR_SPEED_THRESHOLD = 0.1;
const CURSOR_SPEED_THRESHOLD_SQUARED = CURSOR_SPEED_THRESHOLD * CURSOR_SPEED_THRESHOLD;
const POLYGON_BUFFER = 0.5;
function hasIntersectingEdge(pointX, pointY, xi, yi, xj, yj) {
  return yi >= pointY !== yj >= pointY && pointX <= (xj - xi) * (pointY - yi) / (yj - yi) + xi;
}
function isPointInQuadrilateral(pointX, pointY, x1, y1, x2, y2, x3, y3, x4, y4) {
  let isInsideValue = false;
  if (hasIntersectingEdge(pointX, pointY, x1, y1, x2, y2)) {
    isInsideValue = !isInsideValue;
  }
  if (hasIntersectingEdge(pointX, pointY, x2, y2, x3, y3)) {
    isInsideValue = !isInsideValue;
  }
  if (hasIntersectingEdge(pointX, pointY, x3, y3, x4, y4)) {
    isInsideValue = !isInsideValue;
  }
  if (hasIntersectingEdge(pointX, pointY, x4, y4, x1, y1)) {
    isInsideValue = !isInsideValue;
  }
  return isInsideValue;
}
function isInsideRect(pointX, pointY, rect) {
  return pointX >= rect.x && pointX <= rect.x + rect.width && pointY >= rect.y && pointY <= rect.y + rect.height;
}
function isInsideAxisAlignedRect(pointX, pointY, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return pointX >= minX && pointX <= maxX && pointY >= minY && pointY <= maxY;
}
function safePolygon(options = {}) {
  const {
    blockPointerEvents = false
  } = options;
  const timeout = new Timeout();
  const fn = ({
    x,
    y,
    placement,
    elements,
    onClose,
    nodeId,
    tree
  }) => {
    const side = placement?.split("-")[0];
    let hasLanded = false;
    let lastX = null;
    let lastY = null;
    let lastCursorTime = typeof performance !== "undefined" ? performance.now() : 0;
    function isCursorMovingSlowly(nextX, nextY) {
      const currentTime = performance.now();
      const elapsedTime = currentTime - lastCursorTime;
      if (lastX === null || lastY === null || elapsedTime === 0) {
        lastX = nextX;
        lastY = nextY;
        lastCursorTime = currentTime;
        return false;
      }
      const deltaX = nextX - lastX;
      const deltaY = nextY - lastY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const thresholdSquared = elapsedTime * elapsedTime * CURSOR_SPEED_THRESHOLD_SQUARED;
      lastX = nextX;
      lastY = nextY;
      lastCursorTime = currentTime;
      return distanceSquared < thresholdSquared;
    }
    function close() {
      timeout.clear();
      onClose();
    }
    return function onMouseMove(event) {
      timeout.clear();
      const domReference = elements.domReference;
      const floating = elements.floating;
      if (!domReference || !floating || side == null || x == null || y == null) {
        return void 0;
      }
      const {
        clientX,
        clientY
      } = event;
      const target = getTarget(event);
      const isLeave = event.type === "mouseleave";
      const isOverFloatingEl = contains(floating, target);
      const isOverReferenceEl = contains(domReference, target);
      if (isOverFloatingEl) {
        hasLanded = true;
        if (!isLeave) {
          return void 0;
        }
      }
      if (isOverReferenceEl) {
        hasLanded = false;
        if (!isLeave) {
          hasLanded = true;
          return void 0;
        }
      }
      if (isLeave && isElement(event.relatedTarget) && contains(floating, event.relatedTarget)) {
        return void 0;
      }
      function hasOpenChildNode() {
        return Boolean(tree && getNodeChildren(tree.nodesRef.current, nodeId).length > 0);
      }
      function closeIfNoOpenChild() {
        if (!hasOpenChildNode()) {
          close();
        }
      }
      if (hasOpenChildNode()) {
        return void 0;
      }
      const refRect = domReference.getBoundingClientRect();
      const rect = floating.getBoundingClientRect();
      const cursorLeaveFromRight = x > rect.right - rect.width / 2;
      const cursorLeaveFromBottom = y > rect.bottom - rect.height / 2;
      const isFloatingWider = rect.width > refRect.width;
      const isFloatingTaller = rect.height > refRect.height;
      const left = (isFloatingWider ? refRect : rect).left;
      const right = (isFloatingWider ? refRect : rect).right;
      const top = (isFloatingTaller ? refRect : rect).top;
      const bottom = (isFloatingTaller ? refRect : rect).bottom;
      if (side === "top" && y >= refRect.bottom - 1 || side === "bottom" && y <= refRect.top + 1 || side === "left" && x >= refRect.right - 1 || side === "right" && x <= refRect.left + 1) {
        closeIfNoOpenChild();
        return void 0;
      }
      let isInsideTroughRect = false;
      switch (side) {
        case "top":
          isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, left, refRect.top + 1, right, rect.bottom - 1);
          break;
        case "bottom":
          isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, left, rect.top + 1, right, refRect.bottom - 1);
          break;
        case "left":
          isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, rect.right - 1, bottom, refRect.left + 1, top);
          break;
        case "right":
          isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, refRect.right - 1, bottom, rect.left + 1, top);
          break;
      }
      if (isInsideTroughRect) {
        return void 0;
      }
      if (hasLanded && !isInsideRect(clientX, clientY, refRect)) {
        closeIfNoOpenChild();
        return void 0;
      }
      if (!isLeave && isCursorMovingSlowly(clientX, clientY)) {
        closeIfNoOpenChild();
        return void 0;
      }
      let isInsidePolygon = false;
      switch (side) {
        case "top": {
          const cursorXOffset = isFloatingWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneX = isFloatingWider ? x + cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
          const cursorPointTwoX = isFloatingWider ? x - cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
          const cursorPointY = y + POLYGON_BUFFER + 1;
          const commonYLeft = cursorLeaveFromRight ? rect.bottom - POLYGON_BUFFER : isFloatingWider ? rect.bottom - POLYGON_BUFFER : rect.top;
          const commonYRight = cursorLeaveFromRight ? isFloatingWider ? rect.bottom - POLYGON_BUFFER : rect.top : rect.bottom - POLYGON_BUFFER;
          isInsidePolygon = isPointInQuadrilateral(clientX, clientY, cursorPointOneX, cursorPointY, cursorPointTwoX, cursorPointY, rect.left, commonYLeft, rect.right, commonYRight);
          break;
        }
        case "bottom": {
          const cursorXOffset = isFloatingWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneX = isFloatingWider ? x + cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
          const cursorPointTwoX = isFloatingWider ? x - cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
          const cursorPointY = y - POLYGON_BUFFER;
          const commonYLeft = cursorLeaveFromRight ? rect.top + POLYGON_BUFFER : isFloatingWider ? rect.top + POLYGON_BUFFER : rect.bottom;
          const commonYRight = cursorLeaveFromRight ? isFloatingWider ? rect.top + POLYGON_BUFFER : rect.bottom : rect.top + POLYGON_BUFFER;
          isInsidePolygon = isPointInQuadrilateral(clientX, clientY, cursorPointOneX, cursorPointY, cursorPointTwoX, cursorPointY, rect.left, commonYLeft, rect.right, commonYRight);
          break;
        }
        case "left": {
          const cursorYOffset = isFloatingTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneY = isFloatingTaller ? y + cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
          const cursorPointTwoY = isFloatingTaller ? y - cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
          const cursorPointX = x + POLYGON_BUFFER + 1;
          const commonXTop = cursorLeaveFromBottom ? rect.right - POLYGON_BUFFER : isFloatingTaller ? rect.right - POLYGON_BUFFER : rect.left;
          const commonXBottom = cursorLeaveFromBottom ? isFloatingTaller ? rect.right - POLYGON_BUFFER : rect.left : rect.right - POLYGON_BUFFER;
          isInsidePolygon = isPointInQuadrilateral(clientX, clientY, commonXTop, rect.top, commonXBottom, rect.bottom, cursorPointX, cursorPointOneY, cursorPointX, cursorPointTwoY);
          break;
        }
        case "right": {
          const cursorYOffset = isFloatingTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneY = isFloatingTaller ? y + cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
          const cursorPointTwoY = isFloatingTaller ? y - cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
          const cursorPointX = x - POLYGON_BUFFER;
          const commonXTop = cursorLeaveFromBottom ? rect.left + POLYGON_BUFFER : isFloatingTaller ? rect.left + POLYGON_BUFFER : rect.right;
          const commonXBottom = cursorLeaveFromBottom ? isFloatingTaller ? rect.left + POLYGON_BUFFER : rect.right : rect.left + POLYGON_BUFFER;
          isInsidePolygon = isPointInQuadrilateral(clientX, clientY, cursorPointX, cursorPointOneY, cursorPointX, cursorPointTwoY, commonXTop, rect.top, commonXBottom, rect.bottom);
          break;
        }
      }
      if (!isInsidePolygon) {
        closeIfNoOpenChild();
      } else if (!hasLanded) {
        timeout.start(40, closeIfNoOpenChild);
      }
      return void 0;
    };
  };
  fn.__options = {
    ...options,
    blockPointerEvents
  };
  return fn;
}
const DirectionContext = /* @__PURE__ */ React.createContext(void 0);
if (process.env.NODE_ENV !== "production") DirectionContext.displayName = "DirectionContext";
function useDirection() {
  const context = React.useContext(DirectionContext);
  return context?.direction ?? "ltr";
}
const baseArrow = (options) => ({
  name: "arrow",
  options,
  async fn(state) {
    const {
      x,
      y,
      placement,
      rects,
      platform: platform2,
      elements,
      middlewareData
    } = state;
    const {
      element,
      padding = 0,
      offsetParent = "real"
    } = evaluate(options, state) || {};
    if (element == null) {
      return {};
    }
    const paddingObject = getPaddingObject(padding);
    const coords = {
      x,
      y
    };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform2.getDimensions(element);
    const isYAxis = axis === "y";
    const minProp = isYAxis ? "top" : "left";
    const maxProp = isYAxis ? "bottom" : "right";
    const clientProp = isYAxis ? "clientHeight" : "clientWidth";
    const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];
    const arrowOffsetParent = offsetParent === "real" ? await platform2.getOffsetParent?.(element) : elements.floating;
    let clientSize = elements.floating[clientProp] || rects.floating[length];
    if (!clientSize || !await platform2.isElement?.(arrowOffsetParent)) {
      clientSize = elements.floating[clientProp] || rects.floating[length];
    }
    const centerToReference = endDiff / 2 - startDiff / 2;
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = Math.min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = Math.min(paddingObject[maxProp], largestPossiblePadding);
    const min2 = minPadding;
    const max2 = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset2 = clamp(min2, center, max2);
    const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset2 && rects.reference[length] / 2 - (center < min2 ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
    const alignmentOffset = shouldAddOffset ? center < min2 ? center - min2 : center - max2 : 0;
    return {
      [axis]: coords[axis] + alignmentOffset,
      data: {
        [axis]: offset2,
        centerOffset: center - offset2 - alignmentOffset,
        ...shouldAddOffset && {
          alignmentOffset
        }
      },
      reset: shouldAddOffset
    };
  }
});
const arrow = (options, deps) => {
  const {
    name,
    fn
  } = baseArrow(options);
  return {
    name,
    fn,
    options: [options, deps]
  };
};
const hide = {
  name: "hide",
  async fn(state) {
    const {
      width,
      height,
      x,
      y
    } = state.rects.reference;
    const anchorHidden = width === 0 && height === 0 && x === 0 && y === 0;
    const overflow = await state.platform.detectOverflow(state, {
      elementContext: "reference"
    });
    const referenceHidden = overflow.top - height >= 0 || overflow.right - width >= 0 || overflow.bottom - height >= 0 || overflow.left - width >= 0;
    return {
      data: {
        referenceHidden: referenceHidden || anchorHidden
      }
    };
  }
};
const DEFAULT_SIDES = {
  sideX: "left",
  sideY: "top"
};
const availableWidth = "--available-width";
const availableHeight = "--available-height";
const anchorWidth = "--anchor-width";
const anchorHeight = "--anchor-height";
const transformOrigin = "--transform-origin";
const AVAILABLE_WIDTH_VAR = availableWidth;
const AVAILABLE_HEIGHT_VAR = availableHeight;
function getLogicalSide(sideParam, renderedSide, isRtl) {
  const isLogicalSideParam = sideParam === "inline-start" || sideParam === "inline-end";
  const logicalRight = isRtl ? "inline-start" : "inline-end";
  const logicalLeft = isRtl ? "inline-end" : "inline-start";
  return {
    top: "top",
    right: isLogicalSideParam ? logicalRight : "right",
    bottom: "bottom",
    left: isLogicalSideParam ? logicalLeft : "left"
  }[renderedSide];
}
function getOffsetData(state, sideParam, isRtl) {
  const {
    rects,
    placement
  } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || "center",
    anchor: {
      width: rects.reference.width,
      height: rects.reference.height
    },
    positioner: {
      width: rects.floating.width,
      height: rects.floating.height
    }
  };
  return data;
}
function useAnchorPositioning(params) {
  return useAnchorPositioningWithHook(params, useBaseUIFloating);
}
function useAnchorPositioningWithHook(params, useFloatingHook) {
  const {
    // Public parameters
    anchor,
    positionMethod = "absolute",
    side: sideParam = "bottom",
    sideOffset = 0,
    align = "center",
    alignOffset = 0,
    collisionBoundary,
    collisionPadding: collisionPaddingParam = 5,
    sticky = false,
    arrowPadding = 5,
    disableAnchorTracking = false,
    inline: inlineMiddleware,
    // Private parameters
    keepMounted = false,
    floatingRootContext,
    mounted,
    collisionAvoidance,
    shift: shift$12,
    nodeId,
    adaptiveOrigin,
    lazyFlip = false,
    externalTree
  } = params;
  const [mountSide, setMountSide] = React.useState(null);
  if (!mounted && mountSide !== null) {
    setMountSide(null);
  }
  const collisionAvoidanceSide = collisionAvoidance.side || "flip";
  const collisionAvoidanceAlign = collisionAvoidance.align || "flip";
  const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || "end";
  const shiftCrossAxis = shift$12?.crossAxis ?? false;
  const shiftRootBoundary = shift$12?.rootBoundary;
  const anchorFn = typeof anchor === "function" ? anchor : void 0;
  const anchorFnCallback = useStableCallback(anchorFn);
  const anchorDep = anchorFn ? anchorFnCallback : anchor;
  const anchorValueRef = useValueAsRef(anchor);
  const mountedRef = useValueAsRef(mounted);
  const direction = useDirection();
  const isRtl = direction === "rtl";
  const side = mountSide || {
    top: "top",
    right: "right",
    bottom: "bottom",
    left: "left",
    "inline-end": isRtl ? "left" : "right",
    "inline-start": isRtl ? "right" : "left"
  }[sideParam];
  const placement = align === "center" ? side : `${side}-${align}`;
  let collisionPadding = collisionPaddingParam;
  if (typeof collisionPadding === "number") {
    collisionPadding = {
      top: collisionPadding,
      right: collisionPadding,
      bottom: collisionPadding,
      left: collisionPadding
    };
  } else if (collisionPadding) {
    collisionPadding = {
      top: collisionPadding.top || 0,
      right: collisionPadding.right || 0,
      bottom: collisionPadding.bottom || 0,
      left: collisionPadding.left || 0
    };
  }
  const bias = 1;
  const biasTop = sideParam === "bottom" ? bias : 0;
  const biasBottom = sideParam === "top" ? bias : 0;
  const biasLeft = sideParam === "right" ? bias : 0;
  const biasRight = sideParam === "left" ? bias : 0;
  const commonCollisionProps = {
    boundary: collisionBoundary === "clipping-ancestors" ? "clippingAncestors" : collisionBoundary,
    padding: collisionPadding
  };
  const arrowRef = React.useRef(null);
  const sideOffsetRef = useValueAsRef(sideOffset);
  const alignOffsetRef = useValueAsRef(alignOffset);
  const sideOffsetDep = typeof sideOffset !== "function" ? sideOffset : 0;
  const alignOffsetDep = typeof alignOffset !== "function" ? alignOffset : 0;
  const middleware = [];
  if (inlineMiddleware) {
    middleware.push(inlineMiddleware);
  }
  middleware.push(offset((state) => {
    const data = getOffsetData(state, sideParam, isRtl);
    const sideAxis = typeof sideOffsetRef.current === "function" ? sideOffsetRef.current(data) : sideOffsetRef.current;
    const alignAxis = typeof alignOffsetRef.current === "function" ? alignOffsetRef.current(data) : alignOffsetRef.current;
    return {
      mainAxis: sideAxis,
      crossAxis: alignAxis,
      alignmentAxis: alignAxis
    };
  }, [sideOffsetDep, alignOffsetDep, isRtl, sideParam]));
  const shiftDisabled = collisionAvoidanceAlign === "none" && collisionAvoidanceSide !== "shift";
  const crossAxisShiftEnabled = !shiftDisabled && (sticky || shiftCrossAxis || collisionAvoidanceSide === "shift");
  const flipMiddleware = collisionAvoidanceSide === "none" ? null : flip({
    ...commonCollisionProps,
    // Ensure the popup flips if it's been limited by its --available-height and it resizes.
    // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
    padding: {
      top: collisionPadding.top + bias + biasTop,
      right: collisionPadding.right + bias + biasRight,
      bottom: collisionPadding.bottom + bias + biasBottom,
      left: collisionPadding.left + bias + biasLeft
    },
    mainAxis: !shiftCrossAxis && collisionAvoidanceSide === "flip",
    crossAxis: collisionAvoidanceAlign === "flip" ? "alignment" : false,
    fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide
  });
  const shiftMiddleware = shiftDisabled ? null : shift({
    ...commonCollisionProps,
    // Use the Layout Viewport to avoid shifting around when pinch-zooming.
    rootBoundary: shiftRootBoundary,
    mainAxis: collisionAvoidanceAlign !== "none",
    crossAxis: crossAxisShiftEnabled,
    limiter: sticky || shiftCrossAxis ? void 0 : limitShift((limitData) => {
      if (!arrowRef.current) {
        return {};
      }
      const {
        width,
        height
      } = arrowRef.current.getBoundingClientRect();
      const sideAxis = getSideAxis(getSide(limitData.placement));
      const arrowSize = sideAxis === "y" ? width : height;
      const offsetAmount = sideAxis === "y" ? collisionPadding.left + collisionPadding.right : collisionPadding.top + collisionPadding.bottom;
      return {
        offset: arrowSize / 2 + offsetAmount / 2
      };
    })
  }, [commonCollisionProps, sticky, shiftCrossAxis, shiftRootBoundary, collisionPadding, collisionAvoidanceAlign]);
  if (collisionAvoidanceSide === "shift" || collisionAvoidanceAlign === "shift" || align === "center") {
    middleware.push(shiftMiddleware, flipMiddleware);
  } else {
    middleware.push(flipMiddleware, shiftMiddleware);
  }
  middleware.push(size({
    ...commonCollisionProps,
    apply({
      elements: {
        floating
      },
      availableWidth: availableWidth2,
      availableHeight: availableHeight2,
      rects
    }) {
      if (!mountedRef.current) {
        return;
      }
      const floatingStyle = floating.style;
      floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth2}px`);
      floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight2}px`);
      const dpr = getWindow(floating).devicePixelRatio || 1;
      const {
        x: x2,
        y: y2,
        width,
        height
      } = rects.reference;
      const anchorWidth$1 = (Math.round((x2 + width) * dpr) - Math.round(x2 * dpr)) / dpr;
      const anchorHeight$1 = (Math.round((y2 + height) * dpr) - Math.round(y2 * dpr)) / dpr;
      floatingStyle.setProperty(anchorWidth, `${anchorWidth$1}px`);
      floatingStyle.setProperty(anchorHeight, `${anchorHeight$1}px`);
    }
  }), arrow((state) => ({
    // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
    // we'll create a fake element.
    element: arrowRef.current || ownerDocument(state.elements.floating).createElement("div"),
    // No padding for the fake arrow: it would displace aligned popups on narrow anchors.
    padding: arrowRef.current ? arrowPadding : 0,
    offsetParent: "floating"
  }), [arrowPadding]), {
    name: "transformOrigin",
    fn(state) {
      const {
        elements: {
          floating
        },
        middlewareData: middlewareData2,
        placement: renderedPlacement2,
        platform: platform2,
        rects,
        y: y2
      } = state;
      const renderedSide2 = getSide(renderedPlacement2);
      const renderedAlign2 = getAlignment(renderedPlacement2);
      const isVertical = getSideAxis(renderedSide2) === "y";
      const arrowEl = arrowRef.current;
      const sideOffsetValue = typeof sideOffset === "function" ? sideOffset(getOffsetData(state, sideParam, isRtl)) : sideOffset;
      let crossOrigin;
      if (!arrowEl && renderedAlign2 && Math.abs(isVertical ? middlewareData2.shift?.x || 0 : middlewareData2.shift?.y || 0) <= 1) {
        crossOrigin = renderedAlign2 === "start" === (isVertical && platform2.isRTL?.(floating) === true) ? "100%" : "0%";
      } else {
        const arrowOffset = isVertical ? middlewareData2.arrow?.x || 0 : middlewareData2.arrow?.y || 0;
        const arrowSize = isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0;
        crossOrigin = `${arrowOffset + arrowSize / 2}px`;
      }
      let sideOrigin = renderedSide2 === "top" || renderedSide2 === "left" ? `calc(100% + ${sideOffsetValue}px)` : `${-sideOffsetValue}px`;
      if (crossAxisShiftEnabled && isVertical && Math.abs(middlewareData2.shift?.y || 0) > sideOffsetValue) {
        sideOrigin = `${rects.reference.y + rects.reference.height / 2 - y2}px`;
      }
      floating.style.setProperty(transformOrigin, isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`);
      return {};
    }
  }, hide, adaptiveOrigin);
  useIsoLayoutEffect(() => {
    if (!mounted && floatingRootContext) {
      floatingRootContext.update({
        referenceElement: null,
        floatingElement: null,
        domReferenceElement: null,
        positionReference: null
      });
    }
  }, [mounted, floatingRootContext]);
  const autoUpdateOptions = React.useMemo(() => ({
    ancestorScroll: !disableAnchorTracking,
    elementResize: !disableAnchorTracking && typeof ResizeObserver !== "undefined",
    layoutShift: !disableAnchorTracking && typeof IntersectionObserver !== "undefined"
  }), [disableAnchorTracking]);
  const {
    refs,
    elements,
    x,
    y,
    middlewareData,
    update,
    placement: renderedPlacement,
    context,
    isPositioned,
    floatingStyles: originalFloatingStyles
  } = useFloatingHook({
    rootContext: floatingRootContext,
    open: keepMounted ? mounted : void 0,
    placement,
    middleware,
    strategy: positionMethod,
    whileElementsMounted: keepMounted ? void 0 : (...args) => autoUpdate(...args, autoUpdateOptions),
    nodeId,
    externalTree
  });
  const {
    sideX,
    sideY
  } = middlewareData.adaptiveOrigin || DEFAULT_SIDES;
  const resolvedPosition = isPositioned ? positionMethod : "fixed";
  const floatingStyles = React.useMemo(() => {
    let base;
    if (!isPositioned) {
      base = {
        position: resolvedPosition,
        top: 0,
        left: 0
      };
    } else if (adaptiveOrigin) {
      base = {
        position: resolvedPosition,
        [sideX]: x,
        [sideY]: y
      };
    } else {
      base = {
        ...originalFloatingStyles,
        position: resolvedPosition
      };
    }
    base[AVAILABLE_WIDTH_VAR] = "100vw";
    base[AVAILABLE_HEIGHT_VAR] = "100vh";
    if (!isPositioned) {
      base.opacity = 0;
    }
    return base;
  }, [adaptiveOrigin, resolvedPosition, sideX, x, sideY, y, originalFloatingStyles, isPositioned]);
  const registeredPositionReferenceRef = React.useRef(null);
  useIsoLayoutEffect(() => {
    if (!mounted) {
      return;
    }
    const anchorValue = anchorValueRef.current;
    const resolvedAnchor = typeof anchorValue === "function" ? anchorValue() : anchorValue;
    const unwrappedElement = (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null;
    const finalAnchor = unwrappedElement || null;
    if (finalAnchor !== registeredPositionReferenceRef.current) {
      refs.setPositionReference(finalAnchor);
      registeredPositionReferenceRef.current = finalAnchor;
    }
  }, [mounted, refs, anchorDep, anchorValueRef]);
  React.useEffect(() => {
    if (!mounted) {
      return;
    }
    const anchorValue = anchorValueRef.current;
    if (typeof anchorValue === "function") {
      return;
    }
    if (isRef(anchorValue) && anchorValue.current !== registeredPositionReferenceRef.current) {
      refs.setPositionReference(anchorValue.current);
      registeredPositionReferenceRef.current = anchorValue.current;
    }
  }, [mounted, refs, anchorDep, anchorValueRef]);
  React.useEffect(() => {
    if (keepMounted && mounted && elements.reference && elements.floating) {
      return autoUpdate(elements.reference, elements.floating, update, autoUpdateOptions);
    }
    return void 0;
  }, [keepMounted, mounted, elements, update, autoUpdateOptions]);
  const renderedSide = getSide(renderedPlacement);
  const logicalRenderedSide = getLogicalSide(sideParam, renderedSide, isRtl);
  const renderedAlign = getAlignment(renderedPlacement) || "center";
  const anchorHidden = Boolean(middlewareData.hide?.referenceHidden);
  useIsoLayoutEffect(() => {
    if (lazyFlip && mounted && isPositioned && renderedSide !== side) {
      setMountSide(renderedSide);
    }
  }, [lazyFlip, mounted, isPositioned, renderedSide, side]);
  const arrowStyles = React.useMemo(() => ({
    position: "absolute",
    top: middlewareData.arrow?.y,
    left: middlewareData.arrow?.x
  }), [middlewareData.arrow]);
  const arrowUncentered = middlewareData.arrow?.centerOffset !== 0;
  return React.useMemo(() => ({
    positionerStyles: floatingStyles,
    arrowStyles,
    arrowRef,
    arrowUncentered,
    side: logicalRenderedSide,
    align: renderedAlign,
    physicalSide: renderedSide,
    anchorHidden,
    refs,
    context,
    isPositioned,
    update
  }), [floatingStyles, arrowStyles, arrowRef, arrowUncentered, logicalRenderedSide, renderedAlign, renderedSide, anchorHidden, refs, context, isPositioned, update]);
}
function isRef(param) {
  return param != null && "current" in param;
}
function getDisabledMountTransitionStyles(transitionStatus) {
  return transitionStatus === "starting" ? DISABLED_TRANSITIONS_STYLE : EMPTY_OBJECT;
}
function usePositioner(componentProps, state, {
  styles,
  transitionStatus,
  props,
  refs,
  hidden,
  inert = false
}) {
  const style = {
    ...styles
  };
  if (inert) {
    style.pointerEvents = "none";
  }
  return useRenderElement("div", componentProps, {
    state,
    ref: refs,
    props: [{
      role: "presentation",
      hidden,
      style
    }, getDisabledMountTransitionStyles(transitionStatus), props],
    stateAttributesMapping: popupStateMapping
  });
}
const valid = "data-valid";
const invalid = "data-invalid";
const DEFAULT_VALIDITY_STATE = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valid: null,
  valueMissing: false
};
const DEFAULT_FIELD_STATE_ATTRIBUTES = {
  valid: null,
  touched: false,
  dirty: false,
  filled: false,
  focused: false
};
const DEFAULT_FIELD_ROOT_STATE = {
  disabled: false,
  ...DEFAULT_FIELD_STATE_ATTRIBUTES
};
const fieldValidityMapping = {
  valid(value) {
    if (value === null) {
      return null;
    }
    if (value) {
      return {
        [valid]: ""
      };
    }
    return {
      [invalid]: ""
    };
  }
};
const DEFAULT_FIELD_ROOT_CONTEXT = {
  invalid: void 0,
  name: void 0,
  validityData: {
    state: DEFAULT_VALIDITY_STATE,
    errors: [],
    error: "",
    value: "",
    initialValue: null
  },
  setValidityData: NOOP,
  disabled: void 0,
  setTouched: NOOP,
  setDirty: NOOP,
  setFilled: NOOP,
  setFocused: NOOP,
  validationMode: "onSubmit",
  shouldValidateOnChange: () => false,
  state: DEFAULT_FIELD_ROOT_STATE,
  registerFieldControl: NOOP,
  validation: {
    getValidationProps: (_disabled, props = EMPTY_OBJECT) => props,
    inputRef: {
      current: null
    },
    registeredInputs: /* @__PURE__ */ new Map(),
    registerInput: NOOP,
    getInputControl: () => null,
    commit: async () => {
    },
    change: NOOP
  }
};
const FieldRootContext = /* @__PURE__ */ React.createContext(DEFAULT_FIELD_ROOT_CONTEXT);
if (process.env.NODE_ENV !== "production") FieldRootContext.displayName = "FieldRootContext";
function useFieldRootContext(optional = true) {
  const context = React.useContext(FieldRootContext);
  if (context.setValidityData === NOOP && !optional) {
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>." : formatErrorMessage(28));
  }
  return context;
}
const FormContext = /* @__PURE__ */ React.createContext({
  elementRef: {
    current: null
  },
  formRef: {
    current: {
      fields: /* @__PURE__ */ new Map()
    }
  },
  errors: {},
  clearErrors: NOOP,
  validationMode: "onSubmit",
  submitCountRef: {
    current: 0
  }
});
if (process.env.NODE_ENV !== "production") FormContext.displayName = "FormContext";
function useFormContext() {
  return React.useContext(FormContext);
}
const LabelableContext = /* @__PURE__ */ React.createContext({
  controlId: void 0,
  registerControlId: NOOP,
  resetControlId: NOOP,
  labelId: void 0,
  setLabelId: NOOP,
  messageIds: [],
  setMessageIds: NOOP,
  getDescriptionProps: (externalProps) => externalProps
});
if (process.env.NODE_ENV !== "production") LabelableContext.displayName = "LabelableContext";
function useLabelableContext() {
  return React.useContext(LabelableContext);
}
function useLabelableId(params = {}) {
  const {
    id,
    enabled = true
  } = params;
  const {
    controlId,
    registerControlId,
    resetControlId
  } = useLabelableContext();
  const defaultId = useBaseUiId();
  const controlSourceRef = useRefWithInit(() => /* @__PURE__ */ Symbol());
  const hasRegisteredRef = React.useRef(false);
  const hadExplicitIdRef = React.useRef(false);
  const unregisterControlId = useStableCallback(() => {
    if (!hasRegisteredRef.current || registerControlId === NOOP) {
      return;
    }
    hasRegisteredRef.current = false;
    registerControlId(controlSourceRef.current, void 0);
  });
  useIsoLayoutEffect(() => {
    if (!enabled || registerControlId === NOOP) {
      unregisterControlId();
      return void 0;
    }
    let nextId;
    if (id !== void 0) {
      hadExplicitIdRef.current = true;
      nextId = id;
    } else if (hadExplicitIdRef.current) {
      nextId = defaultId;
    } else {
      resetControlId();
      return void 0;
    }
    if (nextId === void 0) {
      unregisterControlId();
      return void 0;
    }
    hasRegisteredRef.current = true;
    registerControlId(controlSourceRef.current, nextId);
    return void 0;
  }, [id, enabled, registerControlId, resetControlId, defaultId, controlSourceRef, unregisterControlId]);
  useIsoLayoutEffect(() => {
    return unregisterControlId;
  }, [unregisterControlId]);
  return (enabled ? controlId : void 0) ?? id ?? defaultId;
}
function useControlled({
  controlled,
  default: defaultProp,
  name,
  state = "value"
}) {
  const {
    current: isControlled
  } = React.useRef(controlled !== void 0);
  const [valueState, setValue] = React.useState(defaultProp);
  const value = isControlled && controlled !== void 0 ? controlled : valueState;
  if (process.env.NODE_ENV !== "production") {
    React.useEffect(() => {
      if (isControlled !== (controlled !== void 0)) {
        error([`A component is changing the ${isControlled ? "" : "un"}controlled ${state} state of ${name} to be ${isControlled ? "un" : ""}controlled.`, "Elements should not switch from uncontrolled to controlled (or vice versa).", `Decide between using a controlled or uncontrolled ${name} element for the lifetime of the component.`, "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.", "More info: https://fb.me/react-controlled-components"].join("\n"));
      }
    }, [state, name, controlled]);
    const {
      current: defaultValue
    } = React.useRef(defaultProp);
    React.useEffect(() => {
      if (!isControlled && serializeToDevModeString(defaultValue) !== serializeToDevModeString(defaultProp)) {
        error([`A component is changing the default ${state} state of an uncontrolled ${name} after being initialized. To suppress this warning opt to use a controlled ${name}.`].join("\n"));
      }
    }, [defaultProp]);
  }
  const setValueIfUncontrolled = React.useCallback((newValue) => {
    if (!isControlled) {
      setValue(newValue);
    }
  }, []);
  return [value, setValueIfUncontrolled];
}
function serializeToDevModeString(input) {
  let nextId = 0;
  const seen = /* @__PURE__ */ new WeakMap();
  try {
    const result = JSON.stringify(input, function replacer(key, value) {
      if (key === "_owner" && this != null && typeof this === "object" && "$$typeof" in this) {
        return void 0;
      }
      if (typeof value === "bigint") {
        return `__bigint__:${value}`;
      }
      if (value !== null && typeof value === "object") {
        const id = seen.get(value);
        if (id !== void 0) {
          return `__object__:${id}`;
        }
        seen.set(value, nextId);
        nextId += 1;
      }
      return value;
    });
    return result ?? `__top__:${typeof input}`;
  } catch {
    return "__unserializable__";
  }
}
function useRegisterFieldControl(controlRef, id, value, getFormValueOverride, enabled = true, name) {
  const {
    registerFieldControl
  } = useFieldRootContext();
  const sourceRef = useRefWithInit(() => /* @__PURE__ */ Symbol());
  useIsoLayoutEffect(() => {
    const source = sourceRef.current;
    if (!enabled) {
      registerFieldControl(source, void 0);
      return;
    }
    const registration = {
      controlRef,
      getValue: getFormValueOverride,
      id,
      name,
      value
    };
    registerFieldControl(source, registration);
  }, [controlRef, enabled, getFormValueOverride, id, name, registerFieldControl, sourceRef, value]);
  useIsoLayoutEffect(() => {
    const source = sourceRef.current;
    return () => {
      registerFieldControl(source, void 0);
    };
  }, [registerFieldControl, sourceRef]);
}
const FieldControl = /* @__PURE__ */ React.forwardRef(function FieldControl2(componentProps, forwardedRef) {
  const {
    render,
    className,
    id: idProp,
    name: nameProp,
    value: valueProp,
    disabled: disabledProp = false,
    onValueChange,
    defaultValue,
    autoFocus = false,
    style,
    ...elementProps
  } = componentProps;
  const {
    state: fieldState,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setDirty,
    validityData,
    setFocused,
    setFilled,
    validationMode,
    validation
  } = useFieldRootContext();
  const {
    clearErrors,
    elementRef: formElementRef,
    submitCountRef
  } = useFormContext();
  const disabled = fieldDisabled || disabledProp;
  const name = fieldName ?? nameProp;
  const state = {
    ...fieldState,
    disabled
  };
  const {
    labelId
  } = useLabelableContext();
  const id = useLabelableId({
    id: idProp
  });
  const [valueUnwrapped] = useControlled({
    controlled: valueProp,
    default: defaultValue,
    name: "FieldControl",
    state: "value"
  });
  const isControlled = valueProp !== void 0;
  const value = isControlled ? valueUnwrapped : void 0;
  const serializedValue = value == null ? void 0 : String(value);
  const getValueFromInput = useStableCallback(() => validation.inputRef.current?.value);
  useRegisterFieldControl(validation.inputRef, id, serializedValue, getValueFromInput, !disabled, nameProp);
  useIsoLayoutEffect(() => {
    const currentValue = serializedValue ?? validation.inputRef.current?.value;
    if (currentValue !== void 0) {
      setFilled(currentValue !== "");
    }
  }, [serializedValue, validation.inputRef, setFilled]);
  useValueChanged(serializedValue, () => {
    if (serializedValue === void 0) {
      return;
    }
    clearErrors(name);
    setDirty(serializedValue !== (validityData.initialValue ?? ""));
    validation.change(serializedValue);
  });
  const inputRef = React.useRef(null);
  const enterValidationTimeout = useTimeout();
  useIsoLayoutEffect(() => {
    if (autoFocus && inputRef.current === activeElement(ownerDocument(inputRef.current))) {
      setFocused(true);
    }
  }, [autoFocus, setFocused]);
  const element = useRenderElement("input", componentProps, {
    ref: [forwardedRef, inputRef],
    state,
    props: [{
      id,
      disabled,
      name,
      ref: validation.inputRef,
      "aria-labelledby": labelId,
      autoFocus,
      ...isControlled ? {
        value
      } : {
        defaultValue
      },
      onChange(event) {
        const inputValue = event.currentTarget.value;
        const details = createChangeEventDetails(none, event.nativeEvent);
        onValueChange?.(inputValue, details);
        if (isControlled) {
          return;
        }
        setDirty(inputValue !== (validityData.initialValue ?? ""));
        setFilled(inputValue !== "");
        if (!event.nativeEvent.defaultPrevented && !details.isCanceled) {
          clearErrors(name);
          validation.change(inputValue);
        }
      },
      onFocus() {
        setFocused(true);
      },
      onBlur(event) {
        setTouched(true);
        setFocused(false);
        if (validationMode === "onBlur") {
          const inputValue = event.currentTarget.value;
          validation.commit(inputValue);
          if (isControlled) {
            queueMicrotask(() => {
              const nextValue = validation.inputRef.current?.value;
              if (nextValue !== void 0 && nextValue !== inputValue && nextValue !== (validityData.initialValue ?? "")) {
                validation.commit(nextValue);
              }
            });
          }
        }
      },
      onKeyDown(event) {
        if (event.currentTarget.tagName === "INPUT" && event.key === "Enter") {
          setTouched(true);
          const value2 = event.currentTarget.value;
          const form = event.currentTarget.form;
          if (form && form === formElementRef.current && !event.defaultPrevented) {
            const input = event.currentTarget;
            const submitCount = submitCountRef.current;
            enterValidationTimeout.start(0, () => {
              if (submitCountRef.current === submitCount) {
                validation.commit(input.value);
              }
            });
          } else {
            validation.commit(value2);
          }
        }
      }
    }, elementProps, (props) => validation.getValidationProps(disabled, props)],
    stateAttributesMapping: fieldValidityMapping
  });
  return element;
});
if (process.env.NODE_ENV !== "production") FieldControl.displayName = "FieldControl";
export {
  DEFAULT_VALIDITY_STATE as D,
  FieldControl as F,
  LabelableContext as L,
  useAnchorPositioning as a,
  usePositioner as b,
  useHoverFloatingInteraction as c,
  useFormContext as d,
  useFieldRootContext as e,
  useLabelableId as f,
  getDisabledMountTransitionStyles as g,
  useControlled as h,
  useRegisterFieldControl as i,
  useLabelableContext as j,
  fieldValidityMapping as k,
  useDirection as l,
  FieldRootContext as m,
  getDelay as n,
  useHoverInteractionSharedState as o,
  platform as p,
  rectToClientRect as r,
  safePolygon as s,
  useHoverReferenceInteraction as u
};
