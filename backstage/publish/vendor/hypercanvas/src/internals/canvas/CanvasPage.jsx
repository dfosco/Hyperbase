import { applyHideUIFromUrl } from '../../core/session/chromeVisibility.js'
import { createElement, memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '../../canvas/index.js'
import '../../canvas/style.css'
import '../LoadingSpinner.css'
import { useCanvas } from './useCanvas.js'
import { shouldPreventCanvasTextSelection } from './textSelection.js'
import { getCanvasThemeVars, getCanvasPrimerAttrs } from './canvasTheme.js'
import { getWidgetComponent } from './widgets/index.js'
import { schemas, getDefaults } from './widgets/widgetProps.js'
import { getFrameActionUpdates } from './widgets/frameActionUpdates.js'
import { resolveFrameTheme } from './widgets/frameTheme.js'
import { getFeatures, getMultiSelectionFeatures, isResizable, isExpandable, getAnchorState, canAcceptConnection, isSplitScreenCapable, getChromeOptions, getInteractionOptions, isMovable, getDeleteConfirm, isEditableInProduction } from './widgets/widgetConfig.js'
import { createPasteContext, resolvePaste } from './widgets/pasteRules.js'
import { resolveArtifactRendering } from '../artifactRendering.js'
import { coreRequestJson } from '../../core/notebook/browserBridge.js'
import { resolveAgentScreenshotPaste, getActiveAgentPasteTarget, imageFileToPngDataUrl } from './widgets/agentScreenshotPaste.js'
import { getPasteRules, getConfig } from '../../core/index.js'
import { isTerminalResizable, getTerminalDimensions } from '../../core/index.js'
import { getFlag } from '../../core/index.js'
import { getCanvasZoom } from '../../core/index.js'
import { isCanvasProductionEnabled } from '../../core/index.js'
import { applyEvent as applyCanvasEvent } from '../../core/canvas/materializer.js'
import {
  getCanvasInteraction,
  subscribeToCanvasInteraction,
  getCanvasInteractionSnapshot,
} from '../../core/index.js'
import { trackRecent as trackRecentArtifact } from '../../core/index.js'
import { registerSmoothCorners } from '../../core/utils/smoothCorners.js'
import { registerHotPoolDevLogs } from './hotPoolDevLogs.js'
import { isGitHubEmbedUrl } from './widgets/githubUrl.js'
import { showToast } from '../showToast.js'
import { copyCanvasText, copySelectedCanvasWidgets } from './clipboard.js'
import { parseSiteUrl, resolveSiteUrl, siteRouteForUrl } from '../../core/site/contract.js'

import WidgetChrome from './widgets/WidgetChrome.jsx'
import ComponentWidget from './widgets/ComponentWidget.jsx'
import useUndoRedo from './useUndoRedo.js'
import useMarqueeSelect from './useMarqueeSelect.js'
import { setDynamicActions, clearDynamicActions } from '../../core/index.js'
import { planCanvasRows } from './canvasRowPlanner.js'
import MarqueeOverlay from './MarqueeOverlay.jsx'
import FilePickerController from './widgets/FileWidget/FilePickerController.jsx'
import DeleteConfirmController from './widgets/FileWidget/DeleteConfirmController.jsx'
import {
  addWidget as addWidgetApi,
  checkGitHubCliAvailable,
  duplicateImage,
  fetchGitHubEmbed,
  getCanvas as getCanvasApi,
  patchWidget as patchWidgetApi,
  removeWidget as removeWidgetApi,
  redoEvent as redoEventApi,
  undoEvent as undoEventApi,
  updateCanvas,
  uploadImage,
  uploadAgentScreenshot,
  addConnector as addConnectorApi,
  removeConnector as removeConnectorApi,
  batchOperations,
  updateCanvasLayout,
  getSquadUiState,
  promoteSquadLeader,
  nudgeSquadMember,
  setSquadBroadcast,
} from './canvasApi.js'
import ChromeSlot from '../../core/ui/ChromeSlot.jsx'
import { stories as storyIndex } from 'virtual:storyboard-data-index'
import styles from './CanvasPage.module.css'
import ConnectorLayer from './ConnectorLayer.jsx'
import { isSquadBroadcastOn, squadFeatures, squadConnectors } from './squadControls.js'
import { findBestAnchors } from './connectorGeometry.js'
import { storyboardWs } from '../storyboard-ws.js'
import { canvasViewportStorageKey, parseCanvasViewportState, createCanvasViewportSession } from './viewportState.js'
import { isAutoPlaceEnabled, getAutoPlacePreview } from './autoPlace.js'
import { getSelectionBounds, arrangeSelectionGrid } from './selectionGeometry.js'
import { planDuplicatePlacement } from './duplicatePlacement.js'
import { getCanvasAutoPlace } from '../../core/stores/canvasConfig.js'
import { useVisualConnectors } from './useVisualConnectors.js'
import { acquireIframePointerLock } from './iframePointerLock.js'
import { acquireDragCursor } from '../../canvas/dragCursor.js'

/** Canvas zoom limits — read from storyboard.config.json via canvasConfig. */
/**
 * Persist a drag's widget moves and source positions, then record every event
 * that actually landed as ONE undo entry. Receipts are recorded in `finally`
 * so a failure in a later step never orphans moves an earlier step applied.
 */
async function persistMovesAsOneHistoryEntry({ canvasId, widgetMoveOps, sourcesChanged, nextSources, undoRedo, label }) {
  const eventIds = []
  try {
    if (widgetMoveOps.length) {
      const response = await batchOperations(canvasId, widgetMoveOps)
      eventIds.push(...(response?.results || []).flatMap((result) => result?.eventIds || [result?.eventId]).filter(Boolean))
    }
    if (sourcesChanged) {
      const response = await updateCanvas(canvasId, { sources: nextSources })
      eventIds.push(...(response?.eventIds || [response?.eventId]).filter(Boolean))
      if (!response?.success) throw new Error(response?.error || 'Failed to save moved sources')
    }
  } catch (err) {
    console.error(`[canvas] Failed to save ${label}:`, err)
  } finally {
    if (eventIds.length) undoRedo.trackBatch(eventIds)
  }
}

function zoomLimits() {
  const z = getCanvasZoom()
  return { ZOOM_MIN: z.min, ZOOM_MAX: z.max, ZOOM_STEP: z.step }
}

/**
 * Compute the .canvasZoom wrapper's layout width/height for a given scale,
 * honoring `canvas.surface.{width,height}`.
 *
 * Default ("auto"): `max(10000, 100 / scale) <axis-unit>` — keeps the
 * surface huge so users can pan into an infinite-feeling canvas; layout
 * shrinks with zoom-in but the 10000-unit floor keeps scroll available.
 *
 * Viewport: the surface clamps to 100<axis-unit> at scale = 1, then grows
 * proportionally with scale on zoom-in (`100 * scale <axis-unit>`) so the
 * scroller still produces horizontal/vertical scroll above 100% zoom.
 * At scale < 1 the layout stays at 100<axis-unit> (zoom-out doesn't add
 * extra empty space).
 */
function getZoomLayoutDim(scale, surfaceAxis, axisUnit) {
  if (surfaceAxis === 'viewport') {
    return `${Math.max(100, 100 * scale)}${axisUnit}`
  }
  return `${Math.max(10000, 100 / scale)}${axisUnit}`
}

function getZoomLayoutWidth(scale, surface) {
  return getZoomLayoutDim(scale, surface?.width, 'vw')
}

function getZoomLayoutHeight(scale, surface) {
  if (surface?.height === 'viewport') return `${Math.max(100, 100 * scale)}%`
  return getZoomLayoutDim(scale, surface?.height, 'vh')
}

const CANVAS_BRIDGE_STATE_KEY = '__storyboardCanvasBridgeState'
const CANVAS_WIDGET_REFS_KEY = '__storyboardCanvasWidgetRefs'
const canvasWidgetActionHandlers = new Map()
const GH_INSTALL_URL = 'https://github.com/cli/cli'
const GROUP_DRAG_DELAY_MS = 150
const GROUP_DRAG_DISTANCE_PX = 8

function isLocalSiteUrl(url) {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === '::1') return true
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 169 && octets[1] === 254)
}

function isSiteLoopbackUrl(url) {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

registerSmoothCorners()
registerHotPoolDevLogs()

function setCanvasWidgetRef(widgetId, ref) {
  if (!widgetId || typeof window === 'undefined') return
  if (!window[CANVAS_WIDGET_REFS_KEY]) window[CANVAS_WIDGET_REFS_KEY] = new Map()
  if (ref) window[CANVAS_WIDGET_REFS_KEY].set(widgetId, ref)
  else window[CANVAS_WIDGET_REFS_KEY].delete(widgetId)
}

// Build a reverse map from story route paths → { storyId, route }
const storyRouteIndex = new Map()
for (const [storyId, data] of Object.entries(storyIndex || {})) {
  if (data?._route) {
    storyRouteIndex.set(data._route.replace(/\/+$/, ''), storyId)
  }
}

function getToolbarColorMode(theme) {
  return String(theme || 'light').startsWith('dark') ? 'dark' : 'light'
}

/**
 * Compute CSS overrides to apply to the canvas scroll container based on the
 * configured scroll axis lock.
 *   "both"       — no override (default behavior)
 *   "vertical"   — disable horizontal scroll (canvas behaves like a webpage)
 *   "horizontal" — disable vertical scroll
 *   "none"       — disable both axes
 */
function scrollAxisStyle(axis) {
  if (axis === 'vertical')   return { overflowX: 'hidden' }
  if (axis === 'horizontal') return { overflowY: 'hidden' }
  if (axis === 'none')       return { overflowX: 'hidden', overflowY: 'hidden' }
  return null
}

function resolveCanvasThemeFromStorage() {
  if (typeof localStorage === 'undefined') return 'light'
  let sync = { prototype: true, toolbar: true, codeBoxes: true, canvas: true }
  try {
    const rawSync = localStorage.getItem('sb-theme-sync')
    if (rawSync) sync = { ...sync, ...JSON.parse(rawSync) }
  } catch {
    // Ignore malformed sync settings
  }

  if (!sync.canvas) return 'light'

  const attrTheme = document.documentElement.getAttribute('data-sb-canvas-theme')
  if (attrTheme) return attrTheme

  const stored = localStorage.getItem('sb-color-scheme') || 'system'
  if (stored !== 'system') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Get the copyable URL for a widget based on its type.
 * Returns the most relevant URL/path for the widget content.
 */
// eslint-disable-next-line no-unused-vars
function getWidgetCopyableUrl(widget) {
  const { type, props = {} } = widget
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  switch (type) {
    case 'prototype':
      // Prototype src is a path like "/MyPrototype" - make it a full URL
      return props.src ? `${window.location.origin}${base.replace(/\/$/, '')}${props.src}` : ''
    case 'figma-embed':
      return props.url || ''
    case 'link-preview':
      return props.url || ''
    case 'image':
      // Return the served image URL
      return props.src ? `${window.location.origin}${base.replace(/\/$/, '')}/_hypercanvas/canvas/images/${props.src}` : ''
    case 'sticky-note':
      // Sticky notes have text content, not a URL
      return props.text || ''
    case 'markdown':
      // Markdown has content, not a URL
      return props.content || ''
    default:
      return ''
  }
}

/**
 * Debounce helper — returns a function that delays invocation.
 * Exposes `.cancel()` to abort pending calls (used by undo/redo).
 */
function debounce(fn, ms) {
  let timer
  let pendingArgs = null
  const invoke = () => {
    if (!pendingArgs) return undefined
    const args = pendingArgs
    pendingArgs = null
    return fn(...args)
  }
  const debounced = (...args) => {
    pendingArgs = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      invoke()
    }, ms)
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
    pendingArgs = null
  }
  debounced.flush = () => {
    if (!timer) return undefined
    clearTimeout(timer)
    timer = null
    return invoke()
  }
  return debounced
}

/** Per-canvas viewport state persistence (zoom + scroll position). */
function getViewportStorageKey(canvasId, notebookId) {
  return canvasViewportStorageKey(canvasId, notebookId)
}

function loadViewportState(canvasId, notebookId) {
  try {
    const raw = localStorage.getItem(getViewportStorageKey(canvasId, notebookId))
    if (!raw) { if (getFlag('dev-logs')) console.log('[viewport] no saved state for', canvasId); return null }
    const { ZOOM_MIN, ZOOM_MAX } = zoomLimits()
    const state = parseCanvasViewportState(raw, { zoomMin: ZOOM_MIN, zoomMax: ZOOM_MAX })
    if (getFlag('dev-logs')) console.log('[viewport] loaded state for', canvasId, state ? '— zoom:' : '— invalid state', state?.zoom, 'scroll:', state?.scrollLeft, state?.scrollTop)
    if (!state) localStorage.removeItem(getViewportStorageKey(canvasId, notebookId))
    return state
  } catch { return null }
}

function saveViewportState(canvasId, state, notebookId) {
  if (!state) return
  try {
    localStorage.setItem(getViewportStorageKey(canvasId, notebookId), JSON.stringify({
      ...state,
      timestamp: Date.now(),
    }))
  } catch { /* quota exceeded — non-critical */ }
}

/**
 * Get viewport-center coordinates in canvas space for placing a new widget.
 * Converts the visible center of the scroll container to unscaled canvas coordinates.
 */
function getViewportCenter(scrollEl, scale) {
  if (!scrollEl) {
    return { x: 0, y: 0 }
  }
  const cx = scrollEl.scrollLeft + scrollEl.clientWidth / 2
  const cy = scrollEl.scrollTop + scrollEl.clientHeight / 2
  return {
    x: Math.round(cx / scale),
    y: Math.round(cy / scale),
  }
}

/** Fallback sizes for widget types without explicit width/height defaults. */
const WIDGET_FALLBACK_SIZES = {
  'site-frame': { width: 800, height: 600 },
  'sticky-note':  { width: 270, height: 170 },
  'markdown':     { width: 530, height: 240 },
  'prototype':    { width: 800, height: 600 },
  'link-preview': { width: 320, height: 120 },
  'figma-embed':  { width: 800, height: 450 },
  'component':    { width: 200, height: 150 },
  'image':        { width: 400, height: 300 },
}

/**
 * Offset a position so the widget's center (not its top-left corner)
 * lands on the given point.
 */
function centerPositionForWidget(pos, type, props) {
  const fallback = WIDGET_FALLBACK_SIZES[type] || { width: 200, height: 150 }
  const w = props?.width ?? fallback.width
  const h = props?.height ?? fallback.height
  return {
    x: Math.round(pos.x - w / 2),
    y: Math.round(pos.y - h / 2),
  }
}

/**
 * Merge newly created widgets into the local list without duplicating ids.
 *
 * The add call's own response and the server's canvas push (HMR) both carry
 * the same widget, and whichever arrives second must not append it again —
 * duplicated ids break React's keyed list (duplicate-key errors, doubled
 * iframes) and corrupt selection/drag state.
 */
function appendLocalWidgets(prev, widgets) {
  const incoming = Array.isArray(widgets) ? widgets : [widgets]
  const base = prev || []
  const known = new Set(base.map(widget => widget?.id))
  const fresh = incoming.filter(widget => widget?.id && !known.has(widget.id))
  return fresh.length > 0 ? [...base, ...fresh] : prev
}

/**
 * Identify widgets that can act as agents — PromptWidget instances and
 * Terminal widgets whose id starts with `agent-`. Used to derive the
 * "done agents" list surfaced by the collab bar.
 */
function isAgentWidget(widget) {
  if (!widget) return false
  if (widget.type === 'prompt') return true
  if (widget.type === 'agent') return true
  if (widget.type === 'terminal' && typeof widget.id === 'string' && widget.id.startsWith('agent-')) return true
  return false
}

function roundPosition(value) {
  return Math.round(value)
}

/** Padding (canvas-space pixels) around bounding box for zoom-to-fit. */
const FIT_PADDING = 48

/**
 * Compute the axis-aligned bounding box that contains every widget and source.
 * Returns { minX, minY, maxX, maxY } in canvas-space coordinates, or null if empty.
 */
function computeCanvasBounds(widgets, componentEntries) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let hasItems = false

  // JSON widgets
  for (const w of (widgets ?? [])) {
    const x = w?.position?.x ?? 0
    const y = w?.position?.y ?? 0
    const fallback = WIDGET_FALLBACK_SIZES[w.type] || { width: 200, height: 150 }
    const width = w.props?.width ?? fallback.width
    const height = w.props?.height ?? fallback.height
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
    hasItems = true
  }

  // Component widgets (from jsxExports or sources fallback)
  for (const entry of componentEntries) {
    const x = entry.sourceData?.position?.x ?? 0
    const y = entry.sourceData?.position?.y ?? 0
    const fallback = WIDGET_FALLBACK_SIZES['component']
    const width = entry.sourceData?.width ?? fallback.width
    const height = entry.sourceData?.height ?? fallback.height
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
    hasItems = true
  }

  return hasItems ? { minX, minY, maxX, maxY } : null
}

/** Renders a single JSON-defined widget by type lookup. */
function WidgetRenderer({ widget, onUpdate, widgetRef, onRefreshGitHub, canRefreshGitHub, multiSelected, selected, onSelect }) {
  const Component = getWidgetComponent(widget.type)
  if (!Component) {
    console.warn(`[canvas] Unknown widget type: ${widget.type}`)
    return null
  }
  const resizable = (widget.type === 'terminal' || widget.type === 'agent')
    ? isTerminalResizable(widget.props?.agentId) && !!onUpdate
    : isResizable(widget.type) && !!onUpdate
  // Standard contract: every custom widget component receives these props.
  // selected / onSelect are especially important for chrome-disabled custom
  // widgets that own their visible UI and need to render their own select
  // affordance.
  const elementProps = {
    id: widget.id,
    props: widget.props,
    onUpdate,
    resizable,
    onRefreshGitHub,
    canRefreshGitHub,
    multiSelected,
    selected,
    onSelect,
  }
  if (Component.$$typeof === Symbol.for('react.forward_ref')) {
    elementProps.ref = widgetRef
  }
  return createElement(Component, elementProps)
}

/**
 * Wrapper for each JSON widget that holds its own ref for imperative actions.
 * This allows WidgetChrome to dispatch actions to the widget via ref.
 *
 * Memoized to prevent re-renders during zoom and unrelated state changes.
 */
const ChromeWrappedWidget = memo(function ChromeWrappedWidget({
  widget,
  canvasId,
  selected,
  multiSelected,
  nudgeInRange,
  connectorCount,
  allWidgets,
  onSelect,
  onDeselect,
  onUpdate,
  onRemove,
  onCopy,
  onCopyWithConnectors,
  onRefreshGitHub,
  canRefreshGitHub,
  onConnectorDragStart,
  squadMemberships = [],
  onSquadAction,
  readOnly,
}) {
  const widgetRef = useRef(null)
  const setWidgetInstanceRef = useCallback((instance) => {
    widgetRef.current = instance
    setCanvasWidgetRef(widget.id, instance)
  }, [widget.id])

  useEffect(() => () => setCanvasWidgetRef(widget.id, null), [widget.id])

  const rawFeatures = getFeatures(widget.type, { isLocalDev: !readOnly })

  // Dynamically adjust features based on widget state
  const features = useMemo(() => {
    const isGitHub = !!widget.props?.github
    const isTerminalOrAgent = widget.type === 'terminal' || widget.type === 'agent' || widget.type === 'agent-chat'
    const adjusted = rawFeatures.map((f) => {
      // Toggle collapse label and hide when content is short (no github = no collapse)
      if (f.action === 'toggle-collapse') {
        if (widget.type === 'link-preview' && !isGitHub) return null
        return {
          ...f,
          label: widget.props?.collapsed ? 'Expand height' : 'Collapse height',
          icon: widget.props?.collapsed ? 'unfold' : 'fold',
        }
      }
      // Sticky note: text-scale toggle — reflect current state in the button
      if (f.action === 'toggle-text-scale') {
        const active = !!widget.props?.autoScaleText
        return {
          ...f,
          label: active ? 'Lock text size' : 'Scale text with size',
          active,
        }
      }
      // Hide refresh-github for non-GitHub link previews
      if (f.action === 'refresh-github' && !isGitHub) return null
      return f
    }).filter(Boolean)

    // Add dynamic "Split Screen" action when a connected split target exists.
    // Uses connectorCount/allWidgets props (reactive) instead of the global
    // bridge state which may be stale during React render.
    if (isExpandable(widget.type)) {
      const hasConnected = (connectorCount || []).some((c) => {
        const otherId = c.start?.widgetId === widget.id ? c.end?.widgetId : c.start?.widgetId
        const otherWidget = (allWidgets || []).find((w) => w.id === otherId)
        return otherWidget && isSplitScreenCapable(otherWidget.type)
      })
      if (hasConnected) {
        // Insert before the first menu-only feature
        const insertIdx = adjusted.findIndex((f) => f.menu)
        const splitFeature = {
          id: 'split-screen',
          type: 'action',
          action: 'split-screen',
          label: 'Split Screen',
          icon: 'columns',
          prod: true,
        }
        if (insertIdx >= 0) adjusted.splice(insertIdx, 0, splitFeature)
        else adjusted.push(splitFeature)
      }
    }

    if (isTerminalOrAgent && !readOnly) {
      const insertIdx = adjusted.findIndex((feature) => feature.menu)
      adjusted.splice(insertIdx >= 0 ? insertIdx : adjusted.length, 0,
        ...squadFeatures(widget, squadMemberships, allWidgets || []))
    }

    return adjusted
  }, [rawFeatures, widget, connectorCount, allWidgets, squadMemberships, readOnly])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleAction = useCallback(async (actionId, opts) => {
    if (actionId === 'delete') {
      const dc = getDeleteConfirm(widget.type)
      if (dc) {
        document.dispatchEvent(new CustomEvent('storyboard:canvas:request-delete-confirm', {
          detail: {
            title: dc.title,
            message: dc.message,
            confirmLabel: dc.confirmLabel,
            onConfirm: () => onRemove?.(widget.id),
          },
        }))
      } else {
        onRemove?.(widget.id)
      }
    } else if (actionId === 'copy') {
      if (opts?.altKey && onCopyWithConnectors) {
        onCopyWithConnectors(widget)
      } else {
        onCopy?.(widget)
      }
    } else if (actionId === 'copy-text') {
      const title = widget.props?.title || ''
      const body = widget.props?.text || widget.props?.content || widget.props?.github?.body || ''
      const text = title && body ? `# ${title}\n\n${body}` : title || body
      void copyCanvasText(text, 'widget text')
    } else if (actionId === 'open-external') {
      const url = widget.props?.url || widget.props?.src
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } else if (actionId === 'refresh-github') {
      const url = widget.props?.url
      if (url && onRefreshGitHub) return onRefreshGitHub(widget.id, url)
    } else if (actionId === 'toggle-collapse') {
      const wasCollapsed = !!widget.props?.collapsed
      onUpdate?.(widget.id, { collapsed: !wasCollapsed })
      // When collapsing, pan viewport to center the widget
      if (!wasCollapsed) {
        requestAnimationFrame(() => {
          const el = document.getElementById(widget.id)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
    } else if (actionId === 'toggle-text-scale') {
      // Sticky notes: flip the autoScaleText prop. When true, StickyNote
      // computes its font-size from the widget's area so text grows/shrinks
      // with resize. When false, font-size stays at the locked default.
      const wasOn = !!widget.props?.autoScaleText
      onUpdate?.(widget.id, { autoScaleText: !wasOn })
    } else if (actionId.startsWith('squad-broadcast:')) {
      const [, mode, squadId] = actionId.split(':')
      try {
        await setSquadBroadcast(canvasId, widget.id, mode === 'on', squadId)
        await onSquadAction?.()
      } catch (error) {
        showToast(error.message || 'Could not change broadcast mode')
      }
    } else if (actionId.startsWith('squad-promote:')) {
      const [, squadId, targetWidgetId] = actionId.split(':')
      promoteSquadLeader(squadId, widget.id, targetWidgetId)
        .then(() => Promise.all([onSquadAction?.(widget.id), onSquadAction?.(targetWidgetId)]))
        .catch((err) => console.error('[canvas] Failed to promote Squad leader:', err))
    } else if (actionId.startsWith('squad-nudge:')) {
      const [, squadId, targetWidgetId] = actionId.split(':')
      nudgeSquadMember(squadId, widget.id, targetWidgetId)
        .then(() => Promise.all([onSquadAction?.(widget.id), onSquadAction?.(targetWidgetId)]))
        .catch((err) => console.error('[canvas] Failed to nudge Squad member:', err))
    } else if (actionId === 'squad-refresh') {
      onSquadAction?.(widget.id)
    }
  }, [widget, onRemove, onCopy, onCopyWithConnectors, onRefreshGitHub, onUpdate, onSquadAction, canvasId])

  useEffect(() => {
    canvasWidgetActionHandlers.set(widget.id, handleAction)
    return () => {
      if (canvasWidgetActionHandlers.get(widget.id) === handleAction) canvasWidgetActionHandlers.delete(widget.id)
    }
  }, [widget.id, handleAction])

  const handleWidgetFieldUpdate = useCallback((updates, options) => {
    return onUpdate?.(widget.id, updates, options)
  }, [onUpdate, widget.id])

  // Per-widget chrome + interaction switches from the (consumer-merged)
  // widget definition. Defaults match historical behavior, so core widgets
  // (sticky-note, image, terminal, etc.) are unaffected.
  const chromeOpts = useMemo(() => getChromeOptions(widget.type), [widget.type])
  const interactionOpts = useMemo(() => getInteractionOptions(widget.type), [widget.type])
  const isSquadLeader = squadMemberships.some((squad) => squad.leaderId === widget.id && isSquadBroadcastOn(squad, widget.id))
  const renderedWidget = squadMemberships.length > 0
    ? { ...widget, props: { ...widget.props, role: isSquadLeader ? 'leader' : 'member' } }
    : widget

  return (
    <WidgetChrome
      widgetId={widget.id}
      widgetType={widget.type}
      features={features}
      selected={selected}
      multiSelected={multiSelected}
      nudgeInRange={nudgeInRange}
       widgetProps={renderedWidget.props}
      widgetRef={widgetRef}
      onSelect={onSelect}
      onDeselect={onDeselect}
      onAction={handleAction}
      onUpdate={onUpdate ? handleWidgetFieldUpdate : undefined}
      onConnectorDragStart={onConnectorDragStart}
      readOnly={readOnly}
      chromeEnabled={chromeOpts.enabled}
      movable={isMovable(widget.type)}
      selectable={interactionOpts.selectable}
    >
      <WidgetRenderer
        widget={renderedWidget}
        onUpdate={onUpdate ? handleWidgetFieldUpdate : undefined}
        widgetRef={setWidgetInstanceRef}
        onRefreshGitHub={onRefreshGitHub}
        canRefreshGitHub={canRefreshGitHub}
        multiSelected={multiSelected}
        selected={selected}
        onSelect={onSelect}
      />
    </WidgetChrome>
  )
}, function chromeWidgetAreEqual(prev, next) {
  return (
    prev.widget === next.widget &&
    prev.canvasId === next.canvasId &&
    prev.selected === next.selected &&
    prev.multiSelected === next.multiSelected &&
    prev.connectorCount === next.connectorCount &&
    prev.allWidgets === next.allWidgets &&
    prev.readOnly === next.readOnly &&
    prev.onSelect === next.onSelect &&
    prev.onDeselect === next.onDeselect &&
    prev.onUpdate === next.onUpdate &&
    prev.onRemove === next.onRemove &&
    prev.onCopy === next.onCopy &&
    prev.onConnectorDragStart === next.onConnectorDragStart &&
    prev.squadMemberships === next.squadMemberships &&
    prev.onSquadAction === next.onSquadAction
  )
})

/**
 * Editable page title — always visible, double-click to edit in dev mode.
 */
function CanvasTitleEditable({ canvasId, canvas, isLocalDev }) {
  const [editing, setEditing] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const inputRef = useRef(null)
  const displayTitle = canvas?.title || canvasId.split('/').pop()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleCommit = useCallback(async () => {
    const trimmed = titleValue.trim()
    setEditing(false)
    if (!trimmed || trimmed === displayTitle) return
    try {
      await updateCanvas(canvasId, { settings: { title: trimmed } })
      // Reload to pick up the updated metadata from the data plugin
      if (import.meta.hot) {
        const timer = setTimeout(() => { window.location.reload() }, 2000)
        import.meta.hot.on('vite:beforeFullReload', () => clearTimeout(timer))
      } else {
        setTimeout(() => { window.location.reload() }, 1000)
      }
    } catch (err) {
      console.error('Failed to update title:', err)
    }
  }, [titleValue, displayTitle, canvasId])

  const handleDblClick = useCallback(() => {
    if (!isLocalDev) return
    setTitleValue(displayTitle)
    setEditing(true)
  }, [isLocalDev, displayTitle])

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={styles.canvasTitleEditing}
        type="text"
        value={titleValue}
        onChange={(e) => setTitleValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleCommit() }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        onBlur={handleCommit}
      />
    )
  }

  return (
    <h1
      className={styles.canvasTitleStatic}
      onDoubleClick={handleDblClick}
      style={isLocalDev ? { cursor: 'default' } : undefined}
    >
      {displayTitle}
    </h1>
  )
}

/**
 * Generic canvas page component.
 * Reads canvas data from the index and renders all widgets on a draggable surface.
 *
 * @param {{ canvasId: string }} props - Canvas name as indexed by the data plugin
 */
export default function CanvasPage({ canvasId: canvasIdProp, name }) {
  const canvasId = canvasIdProp || name || ''
  const { canvas, jsxExports, jsxError, jsxResolvedBinding, loading } = useCanvas(canvasId)
  const isLocalDev = typeof window !== 'undefined' && window.__SB_LOCAL_DEV__ === true && !new URLSearchParams(window.location.search).has('prodMode')

  // Local mutable copy of widgets for instant UI updates
  const [localWidgets, setLocalWidgets] = useState(canvas?.widgets ?? null)
  const [localConnectors, setLocalConnectors] = useState(canvas?.connectors ?? [])
  // Track widget/connector IDs the user has just deleted locally so the HMR
  // reconcile in the canvas-changed handler doesn't re-add them. Each ID is
  // pruned once a server push confirms it's gone OR after a 5s safety timeout.
  const pendingWidgetDeletionsRef = useRef(new Set())
  const pendingConnectorDeletionsRef = useRef(new Set())
  const widgetRemovalRequestsRef = useRef(new Map())
  const markWidgetDeleted = useCallback((widgetId) => {
    if (!widgetId) return
    pendingWidgetDeletionsRef.current.add(widgetId)
    setTimeout(() => pendingWidgetDeletionsRef.current.delete(widgetId), 5000)
  }, [])
  const markConnectorDeleted = useCallback((connectorId) => {
    if (!connectorId) return
    pendingConnectorDeletionsRef.current.add(connectorId)
    setTimeout(() => pendingConnectorDeletionsRef.current.delete(connectorId), 5000)
  }, [])
  const [trackedCanvas, setTrackedCanvas] = useState(canvas)
  const [selectedWidgetIds, setSelectedWidgetIds] = useState(() => new Set())
  const viewportScope = canvas?._viewportScope ?? null
  const viewportSession = useMemo(() => createCanvasViewportSession(loadViewportState(canvasId, viewportScope)), [canvasId, viewportScope])
  const viewportSessionRef = useRef(viewportSession)
  const activeCanvasIdRef = useRef(canvasId)
  useEffect(() => {
    viewportSessionRef.current = viewportSession
    activeCanvasIdRef.current = canvasId
  }, [viewportSession, canvasId])
  const initialViewport = viewportSession.getState()
  const [zoom, setZoom] = useState(initialViewport?.zoom ?? 100)
  const zoomRef = useRef(initialViewport?.zoom ?? 100)
  const scrollRef = useRef(null)
  const zoomElRef = useRef(null)
  const zoomCommitTimer = useRef(null)
  const zoomEventTimer = useRef(null)
  const [localSources, setLocalSources] = useState(canvas?.sources ?? [])
  const [scrollAxis, setScrollAxis] = useState(canvas?.scroll?.axis || 'both')
  const [canvasTheme, setCanvasTheme] = useState(() => resolveCanvasThemeFromStorage())
  const [autoPlaceEnabled, setAutoPlaceEnabled] = useState(() => isAutoPlaceEnabled(canvas))
  const [nudgeTargetIds, setNudgeTargetIds] = useState(() => new Set())
  const nudgeDragActiveRef = useRef(false)
  const [showGhInstallBanner, setShowGhInstallBanner] = useState(false)
  const [squadUiStateByWidget, setSquadUiStateByWidget] = useState({})
  const agentWidgetIds = (localWidgets || []).filter((widget) => ['agent', 'agent-chat', 'terminal'].includes(widget.type)).map((widget) => widget.id)
  const agentWidgetIdsKey = agentWidgetIds.join(',')
  const squadTopologyKey = localConnectors.map((connector) => `${connector.start?.widgetId}:${connector.end?.widgetId}`).sort().join(',')
  const agentStatusKey = (localWidgets || []).filter((widget) => agentWidgetIds.includes(widget.id)).map((widget) => `${widget.id}:${widget.props?.status || ''}`).join(',')

  useEffect(() => {
    let cancelled = false
    const ids = agentWidgetIdsKey ? agentWidgetIdsKey.split(',') : []
    Promise.all(ids.map(async (widgetId) => {
      try { return [widgetId, await getSquadUiState(widgetId)] } catch { return [widgetId, []] }
    })).then((entries) => {
      if (!cancelled) setSquadUiStateByWidget(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [agentWidgetIdsKey, canvasId, squadTopologyKey, agentStatusKey])

  const refreshSquadUiState = useCallback(async (widgetId) => {
    const ids = widgetId ? [widgetId] : (agentWidgetIdsKey ? agentWidgetIdsKey.split(',') : [])
    try {
      const entries = await Promise.all(ids.map(async (id) => [id, await getSquadUiState(id)]))
      setSquadUiStateByWidget((current) => ({ ...current, ...Object.fromEntries(entries) }))
    } catch (error) {
      console.error('[canvas] Failed to refresh Squad state:', error)
    }
  }, [agentWidgetIdsKey])

  useEffect(() => {
    let refreshTimer
    const refreshVisibleSquads = () => {
      const widgetIds = agentWidgetIdsKey ? agentWidgetIdsKey.split(',') : []
      for (const widgetId of widgetIds) void refreshSquadUiState(widgetId)
    }
    const onSquadMessage = ({ event } = {}) => {
      if (event?.type !== 'squad:changed') return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshVisibleSquads, 100)
    }
    const onPaseoEvent = ({ agentId, kind, payload } = {}) => {
      if (!agentId || (kind === 'stream' && payload?.type !== 'permission_requested')) return
      for (const [widgetId, squads] of Object.entries(squadUiStateByWidget)) {
        if (squads.some((squad) => squad.agentBindings?.[widgetId]?.agentId === agentId)) {
          void refreshSquadUiState(widgetId)
        }
      }
    }
    window.addEventListener('focus', refreshVisibleSquads)
    storyboardWs.on('storyboard:message', onSquadMessage)
    storyboardWs.on('storyboard:paseo-agent-event', onPaseoEvent)
    return () => {
      window.removeEventListener('focus', refreshVisibleSquads)
      clearTimeout(refreshTimer)
      storyboardWs.off('storyboard:message', onSquadMessage)
      storyboardWs.off('storyboard:paseo-agent-event', onPaseoEvent)
    }
  }, [agentWidgetIdsKey, refreshSquadUiState, squadUiStateByWidget])

  // Scroll lock: prevents focus-triggered scroll jumps when adding terminal/agent widgets.
  // The lock captures the current scroll position and forces it back on every scroll event
  // until unlocked by the widget's ready signal or a safety timeout.
  // Visual UI (outline + banner) only appears after 1.5s if still locked.

  // Canvas interaction overrides for zoom gestures; scroll axis is stored per canvas.
  // Advanced opt-in surface — see core/stores/canvasInteractionStore.js.
  // Subscribed via useSyncExternalStore so React re-renders when overrides
  // change at runtime. A ref mirror lets the wheel/touch handlers (which
  // attach with `[]` deps to avoid re-binding) read the latest values.
  const interaction = useSyncExternalStore(
    subscribeToCanvasInteraction,
    () => getCanvasInteractionSnapshot(),
    () => getCanvasInteractionSnapshot(),
  )
  void interaction // referenced so React subscribes; values read via the ref + getter below
  const interactionRef = useRef(getCanvasInteraction())
  // eslint-disable-next-line react-hooks/refs
  interactionRef.current = getCanvasInteraction()

  // Refs for snap settings (used by drop handler inside effect closure)
  const autoPlaceEnabledRef = useRef(autoPlaceEnabled)

  // Track this canvas as a recent visit so it appears in the workspace
  // Recent tab and the command palette regardless of how the user arrived
  // (card click, command palette, direct URL, link from another canvas, …).
  useEffect(() => {
    if (!canvasId) return
    const label = canvas?.title || name || canvasId.split('/').pop() || canvasId
    trackRecentArtifact('canvas', canvasId, label)
  }, [canvasId, canvas, name])

  // Centralized list of component export names.
  // When jsxExports is available, use it (discovers new exports not yet in sources).
  // When jsxExports is null (module import failed), fall back to sources so iframes
  // still render — the error is contained inside each iframe.
  const componentEntries = useMemo(() => {
    const sourceMap = Object.fromEntries(
      (localSources || []).filter((s) => s?.export).map((s) => [s.export, s]),
    )
    if (jsxExports) {
      return Object.keys(jsxExports).map((exportName) => ({
        exportName,
        Component: jsxExports[exportName],
        sourceData: sourceMap[exportName] || {},
      }))
    }
    // Fallback: use sources when module import failed (iframe isolation still works)
    if (jsxError && canvas?._jsxModule) {
      return (localSources || [])
        .filter((s) => s?.export)
        .map((s) => ({
          exportName: s.export,
          Component: null,
          sourceData: s,
        }))
    }
    return []
  }, [jsxExports, jsxError, localSources, canvas?._jsxModule])

  // Undo/redo history — tracks both widgets and sources as a combined snapshot
  const undoRedo = useUndoRedo(canvasId)
  const layoutBindingRef = useRef(null)
  layoutBindingRef.current = {
    canvasId,
    module: canvas?._jsxModule ?? null,
    importer: canvas?._jsxImport ?? null,
    exports: jsxExports,
    resolvedBinding: jsxResolvedBinding,
    jsxError,
  }

  const commitCanvasLayout = useCallback(async (enableVertical, standalone = false) => {
    if (!isLocalDev || loading || !canvasId) return false
    const binding = layoutBindingRef.current
    if (binding.jsxError || (binding.module && (!binding.exports
      || binding.resolvedBinding?.module !== binding.module
      || binding.resolvedBinding?.importer !== binding.importer))) {
      showToast('Canvas component exports could not be resolved. Layout was not changed.')
      return false
    }
    const exportNames = binding.module
      ? Object.entries(binding.exports || {}).filter(([, Component]) => typeof Component === 'function').map(([name]) => name)
      : []
    if (binding.module && exportNames.length !== Object.keys(binding.exports || {}).length) {
      showToast('Canvas component discovery is ambiguous. Layout was not changed.')
      return false
    }

    dirtyRef.current = true
    try {
      const latest = await getCanvasApi(canvasId)
      if (!latest?.documentRevision || !Array.isArray(latest.widgets)) throw new Error('The current canvas revision is unavailable')
      const geometryFromElement = (elementId) => {
        const element = document.getElementById(elementId)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        const scale = zoomRef.current / 100
        if (!(rect.width > 0 && rect.height > 0 && scale > 0)) return null
        return { width: rect.width / scale, height: rect.height / scale }
      }
      const widgets = latest.widgets.map((widget) => {
        const measured = geometryFromElement(widget.id)
        const fallback = WIDGET_FALLBACK_SIZES[widget.type] || { width: 200, height: 150 }
        return {
          id: widget.id,
          position: widget.position || { x: 0, y: 0 },
          width: widget.props?.width ?? measured?.width ?? fallback.width,
          height: widget.props?.height ?? measured?.height ?? fallback.height,
        }
      })
      const storedSources = Array.isArray(latest.sources) ? latest.sources : []
      const discoveredSources = exportNames.map((exportName) => {
        const stored = storedSources.find((source) => source?.export === exportName)
        const measured = geometryFromElement(`jsx-${exportName}`)
        return {
          export: exportName,
          position: stored?.position || { x: 0, y: 0 },
          width: stored?.width ?? measured?.width ?? WIDGET_FALLBACK_SIZES.component.width,
          height: stored?.height ?? measured?.height ?? WIDGET_FALLBACK_SIZES.component.height,
        }
      })
      const sourceByExport = new Map(discoveredSources.map((source) => [source.export, source]))
      for (const stored of storedSources) {
        if (!stored?.export || sourceByExport.has(stored.export)) continue
        // Unlocking must keep stored-only source geometry. Do not manufacture
        // replacement geometry for a source the current module did not expose.
        if (!(Number.isFinite(stored.width) && stored.width > 0
          && Number.isFinite(stored.height) && stored.height > 0
          && Number.isFinite(stored.position?.x) && Number.isFinite(stored.position?.y))) {
          throw new Error(`Stored canvas source has incomplete geometry: ${stored.export}`)
        }
        sourceByExport.set(stored.export, {
          export: stored.export,
          position: stored.position,
          width: stored.width,
          height: stored.height,
        })
      }
      const completeSources = [...sourceByExport.values()]
      const scrollRect = scrollRef.current?.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const sidebarWidth = Math.max(0, viewportWidth - (scrollRect?.width || viewportWidth))
      const currentBinding = binding
      const sourceDiscovery = {
        complete: true,
        binding: currentBinding,
        sources: completeSources,
      }
      const layout = standalone || enableVertical
        ? planCanvasRows({
          widgets,
          storedSources,
          sourceDiscovery,
          currentBinding,
          viewportWidth,
          sidebarWidth,
          zoom: zoomRef.current / 100,
        })
        : { widgets: widgets.map(({ id, position, width, height }) => ({ id, position, width, height })), sources: completeSources }
      const currentBindingNow = layoutBindingRef.current
      if (currentBindingNow.canvasId !== binding.canvasId || currentBindingNow.module !== binding.module
        || currentBindingNow.importer !== binding.importer || currentBindingNow.exports !== binding.exports
        || currentBindingNow.resolvedBinding !== binding.resolvedBinding
        || currentBindingNow.jsxError) {
        throw new Error('Canvas module/importer binding changed during layout planning')
      }
      // Standalone reflow only changes geometry. Read the axis from the same
      // revision used for planning so an intervening toggle cannot be lost.
      const axis = standalone ? (latest.scroll?.axis || 'both') : enableVertical ? 'vertical' : 'both'
      const { status, data } = await updateCanvasLayout(canvasId, latest.documentRevision, {
        scroll: { axis },
        widgets: layout.widgets,
        sources: layout.sources,
      }, { canvasId, jsxReference: typeof canvas?.jsx === 'string' ? canvas.jsx : null })
      if (status !== 200 || !data?.eventId) throw new Error(data?.error || `Layout save failed (HTTP ${status})`)
      const event = {
        event: 'canvas_layout_updated',
        scroll: { axis },
        widgets: layout.widgets,
        sources: layout.sources,
      }
      const before = { widgets: latest.widgets, connectors: latest.connectors || [], sources: latest.sources || [], scroll: latest.scroll || { axis: 'both' } }
      const after = applyCanvasEvent(before, event)
      setLocalWidgets(after.widgets || [])
      setLocalSources(after.sources || [])
      setScrollAxis(after.scroll?.axis || axis)
      undoRedo.track(data.eventId)
      return true
    } catch (error) {
      console.error('[canvas] Layout transaction failed:', error)
      showToast(error?.message || 'Canvas layout could not be saved.')
      return false
    } finally {
      dirtyRef.current = false
    }
  }, [canvas?.jsx, canvasId, isLocalDev, loading, undoRedo])

  const stateRef = useRef({ widgets: localWidgets, sources: localSources, connectors: localConnectors, scroll: { axis: scrollAxis } })
  const dropPlacementsRef = useRef(null)
  useEffect(() => {
    stateRef.current = { widgets: localWidgets, sources: localSources, connectors: localConnectors, scroll: { axis: scrollAxis } }
  }, [localWidgets, localSources, localConnectors, scrollAxis])

  // Dirty flag — true while optimistic edits haven't been persisted yet.
  // Prevents HMR echoes from overwriting in-flight local state.
  const dirtyRef = useRef(false)

  // Counter of in-flight writes. dirtyRef is only cleared when this reaches 0,
  // preventing early clears when multiple writes are queued in sequence.
  const inflightWritesRef = useRef(0)

  // Grace period timer — after all writes complete, dirtyRef stays true for a
  // brief window to absorb delayed file-watcher HMR events that arrive after
  // the server's immediate push. Defense-in-depth for the write guard.
  const dirtyGraceTimerRef = useRef(null)

  // Serialized write queue — ensures JSONL events land in the right order
  const writeQueueRef = useRef(Promise.resolve())
  function queueWrite(fn) {
    clearTimeout(dirtyGraceTimerRef.current)
    inflightWritesRef.current += 1
    const write = writeQueueRef.current.then(fn)
    writeQueueRef.current = write
      .catch((err) => console.error('[canvas] Write queue error:', err))
      .finally(() => {
        inflightWritesRef.current -= 1
        if (inflightWritesRef.current < 0) {
          console.warn('[canvas] Write queue counter underflow — resetting')
          inflightWritesRef.current = 0
        }
        if (inflightWritesRef.current === 0) {
          // Grace period — absorb delayed watcher HMR events before clearing
          dirtyGraceTimerRef.current = setTimeout(() => {
            if (inflightWritesRef.current === 0) {
              dirtyRef.current = false
            }
          }, 600)
        }
      })
    return write
  }

  // Ref for selectedWidgetIds to avoid stale closures in callbacks
  const selectedIdsRef = useRef(selectedWidgetIds)
  useEffect(() => {
    selectedIdsRef.current = selectedWidgetIds
  }, [selectedWidgetIds])

  const isMultiSelected = selectedWidgetIds.size > 1

  // Measure in canvas units (offset sizes do not include the zoom transform).
  // ResizeObserver keeps the shared outline aligned with dynamic widget content.
  const [selectionMeasureVersion, setSelectionMeasureVersion] = useState(0)
  useEffect(() => {
    if (selectedWidgetIds.size < 2 || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setSelectionMeasureVersion((version) => version + 1))
    for (const id of selectedWidgetIds) {
      const wrapper = document.getElementById(id)
      const element = wrapper?.querySelector('[data-widget-id]') || wrapper
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [selectedWidgetIds, loading])
  const selectedGeometry = useMemo(() => {
    void selectionMeasureVersion // Recompute geometry after observed content resize.
    const items = [
      ...(localWidgets || []).map((widget) => ({ ...widget, width: widget.props?.width, height: widget.props?.height })),
      ...componentEntries.map(({ exportName, sourceData }) => ({ ...sourceData, id: `jsx-${exportName}`, type: 'component' })),
    ]
    return items.filter((item) => selectedWidgetIds.has(item.id)).map((item) => {
      const fallback = WIDGET_FALLBACK_SIZES[item.type] || { width: 200, height: 150 }
      const wrapper = document.getElementById(item.id)
      const element = wrapper?.querySelector('[data-widget-id]') || wrapper
      const pad = canvas?.gridSize ?? 18
      const position = { x: Math.max(pad, item.position?.x ?? 0), y: Math.max(pad, item.position?.y ?? 0) }
      return { id: item.id, position, width: element?.offsetWidth || item.width || fallback.width, height: element?.offsetHeight || item.height || fallback.height }
    })
  }, [localWidgets, componentEntries, selectedWidgetIds, selectionMeasureVersion, canvas?.gridSize])
  const selectionBounds = getSelectionBounds(selectedGeometry)
  const selectedActionWidgets = useMemo(() => [
    ...(localWidgets || []).filter((widget) => selectedWidgetIds.has(widget.id)).map((widget) => ({ ...widget, widgetRef: { current: window[CANVAS_WIDGET_REFS_KEY]?.get(widget.id) } })),
    ...componentEntries.filter(({ exportName }) => selectedWidgetIds.has(`jsx-${exportName}`)).map(({ exportName, sourceData }) => ({ id: `jsx-${exportName}`, type: 'component', props: sourceData })),
  ], [localWidgets, componentEntries, selectedWidgetIds])
  const selectionActions = isMultiSelected ? getMultiSelectionFeatures(selectedActionWidgets, { isLocalDev }) : []
  const groupDragCleanupRef = useRef(null)
  const [groupDragging, setGroupDragging] = useState(false)
  useEffect(() => () => groupDragCleanupRef.current?.(), [])

  /**
   * Selection handler — shift+click toggles in/out of multi-select set,
   * plain click single-selects (clears others).
   * Suppressed immediately after a multi-drag to prevent the post-drag
   * click from collapsing the selection.
   *
   * Side effect: selecting a widget that is currently in `done` agent
   * status flips it back to `running` (re-engaged by the user). The flip
   * goes through handleWidgetUpdate so it lands in the undo history —
   * Cmd+Z restores `done`.
   */
  const handleWidgetSelect = useCallback((widgetId, shiftKey) => {
    if (justDraggedRef.current) return
    if (shiftKey) {
      setSelectedWidgetIds(prev => {
        const next = new Set(prev)
        if (next.has(widgetId)) {
          next.delete(widgetId)
        } else {
          next.add(widgetId)
        }
        return next
      })
    } else {
      setSelectedWidgetIds(new Set([widgetId]))
    }
    // Re-engage a "done" agent on user-initiated selection.
    const widgets = stateRef.current.widgets ?? []
    const target = widgets.find((w) => w?.id === widgetId)
    if (target?.props?.status === 'done' && isAgentWidget(target)) {
      handleWidgetUpdateRef.current?.(widgetId, { status: 'running' })
    }
  }, [])

  // Legacy member-drag callback compatibility. The shared selection handle
  // below owns live group dragging; individual group-member handles are gated.
  const peerArticlesRef = useRef(new Map())
  // Flag to suppress the click-based selection reset that fires after a drag
  const justDraggedRef = useRef(false)

  const previewAutoPlaceDrop = useCallback((dragId, position) => {
    if (!autoPlaceEnabledRef.current || canvas?.layout === 'flow') return null
    const { widgets = [], sources = [] } = stateRef.current
    const selected = selectedIdsRef.current
    const isGroupDrop = selected.size > 1 && selected.has(dragId)
    const movingIds = isGroupDrop ? selected : new Set([dragId])
    const moving = []
    const stationary = []
    // Auto place expects stationary rectangles with top-level x/y coordinates.
    for (const widget of widgets) {
      const fallback = WIDGET_FALLBACK_SIZES[widget.type] || { width: 200, height: 150 }
      const item = { id: widget.id, position: widget.position || { x: 0, y: 0 }, width: widget.props?.width ?? fallback.width, height: widget.props?.height ?? fallback.height }
      const wrapper = document.getElementById(item.id)
      const element = wrapper?.querySelector('[data-widget-id]') || wrapper
      item.width = element?.offsetWidth || item.width
      item.height = element?.offsetHeight || item.height
      if (movingIds.has(item.id)) moving.push(item)
      else stationary.push({ ...item, ...item.position })
    }
    for (const source of sources) {
      if (!source?.export) continue
      const item = { id: `jsx-${source.export}`, position: source.position || { x: 0, y: 0 }, width: source.width ?? WIDGET_FALLBACK_SIZES.component.width, height: source.height ?? WIDGET_FALLBACK_SIZES.component.height }
      const wrapper = document.getElementById(item.id)
      const element = wrapper?.querySelector('[data-widget-id]') || wrapper
      item.width = element?.offsetWidth || item.width
      item.height = element?.offsetHeight || item.height
      if (movingIds.has(item.id)) moving.push(item)
      else stationary.push({ ...item, ...item.position })
    }
    if (!moving.some((item) => item.id === dragId)) return null
    const configuredAutoPlace = getCanvasAutoPlace(canvasId)
    return getAutoPlacePreview({
      moving, stationary, primaryId: dragId, primaryPosition: position,
      zoom: zoomRef.current,
      nudgeOffsets: configuredAutoPlace,
      boundaryPad: canvas?.gridSize ?? 18,
      preserveMovingOffsets: isGroupDrop,
      movingPriority: true,
    })
  }, [canvasId, canvas?.layout, canvas?.gridSize])

  const handleItemDragStart = useCallback((dragId) => {
    nudgeDragActiveRef.current = true
    dropPlacementsRef.current = null
    setNudgeTargetIds(new Set())
    setWidgetDragging(true)
    const ids = selectedIdsRef.current
    peerArticlesRef.current.clear()
    if (ids.size <= 1 || !ids.has(dragId)) return

    // Suppress selection changes for the duration of the drag
    justDraggedRef.current = true // eslint-disable-line react-hooks/immutability

    // Collect peer article elements for transition on drag end
    for (const id of ids) {
      if (id === dragId) continue
      const widgetEl = document.getElementById(id)
      const article = widgetEl?.closest('article')
      if (!article) continue
      peerArticlesRef.current.set(id, article)
    }
  }, [])

  const handleItemDrag = useCallback((dragId, position) => {
    if (!nudgeDragActiveRef.current) return
    const preview = previewAutoPlaceDrop(dragId, position)
    const ids = preview?.inRangeIds || new Set()
    setNudgeTargetIds((previous) => previous.size === ids.size && [...ids].every((id) => previous.has(id)) ? previous : ids)
    // Single-widget dragging previews the nearby unselected drop targets.
  }, [previewAutoPlaceDrop])

  useEffect(() => {
    const endPreview = () => {
      nudgeDragActiveRef.current = false
      setNudgeTargetIds((previous) => previous.size ? new Set() : previous)
      setWidgetDragging(false)
    }
    document.addEventListener('pointerup', endPreview)
    document.addEventListener('pointercancel', endPreview)
    window.addEventListener('blur', endPreview)
    return () => {
      document.removeEventListener('pointerup', endPreview)
      document.removeEventListener('pointercancel', endPreview)
      window.removeEventListener('blur', endPreview)
    }
  }, [])

  /** Add transition class to peer articles so they animate to new positions. */
  const transitionPeers = useCallback(() => {
    for (const [, article] of peerArticlesRef.current) {
      article.classList.add('tc-on-translation')
    }
    // Remove class after animation completes
    const articles = [...peerArticlesRef.current.values()]
    setTimeout(() => {
      for (const article of articles) {
        article.classList.remove('tc-on-translation')
      }
    }, 150 + 50 + 200)
    peerArticlesRef.current.clear()
  }, [])

  const transitionPositionIds = useCallback((ids) => {
    const articles = [...ids].map((id) => document.getElementById(id)?.closest('article')).filter(Boolean)
    for (const article of articles) article.classList.add('tc-on-translation')
    setTimeout(() => {
      for (const article of articles) article.classList.remove('tc-on-translation')
    }, 150 + 50 + 200)
  }, [])

  const clearDragPreview = useCallback(() => {
    nudgeDragActiveRef.current = false
    setNudgeTargetIds((previous) => previous.size ? new Set() : previous)
    peerArticlesRef.current.clear()
  }, [])

  if (canvas !== trackedCanvas) {
    const isCanvasSwitch = trackedCanvas && canvas && trackedCanvas._route !== canvas._route
    if (getFlag('dev-logs')) console.log('[viewport] canvas changed —', isCanvasSwitch ? 'new canvas, resetting viewport' : 'same canvas, updating widgets only')
    setTrackedCanvas(canvas)

    // Skip replacing local state with server data when optimistic edits are
    // pending — the local state is more recent. The next save will persist it
    // and the subsequent server push (after dirty clears) will reconcile.
    // EXCEPTION: if the server push contains widgets/connectors we don't know
    // about locally, merge those in. Otherwise a stale local list would
    // overwrite freshly-created widgets (e.g. those just added via batch API
    // by an agent) on the next debounced save.
    if (!dirtyRef.current || isCanvasSwitch) {
      setLocalWidgets(canvas?.widgets ?? null)
      setLocalConnectors(canvas?.connectors ?? [])
      setLocalSources(canvas?.sources ?? [])
      setScrollAxis(canvas?.scroll?.axis || 'both')
    } else {
      const serverWidgets = canvas?.widgets ?? []
      const serverConnectors = canvas?.connectors ?? []
      setLocalWidgets((prev) => {
        if (!prev) return serverWidgets
        const localIds = new Set(prev.map((w) => w.id))
        const pending = pendingWidgetDeletionsRef.current
        const additions = serverWidgets.filter((w) => !localIds.has(w.id) && !pending.has(w.id))
        return additions.length > 0 ? [...prev, ...additions] : prev
      })
      setLocalConnectors((prev) => {
        if (!prev || prev.length === 0) return serverConnectors.filter((c) => !pendingConnectorDeletionsRef.current.has(c.id))
        const localIds = new Set(prev.map((c) => c.id))
        const pending = pendingConnectorDeletionsRef.current
        const additions = serverConnectors.filter((c) => !localIds.has(c.id) && !pending.has(c.id))
        return additions.length > 0 ? [...prev, ...additions] : prev
      })
    }

    setAutoPlaceEnabled(isAutoPlaceEnabled(canvas))
    if (isCanvasSwitch) {
      undoRedo.reset()
    }

  }

  // Per-widget debounced PATCH. Each widget gets its own pending props
  // accumulator + timer so concurrent edits to different widgets don't stomp
  // on one another. Successful patches return event ids — we push them onto
  // the undo stack via undoRedo.trackMany so the toolbar Undo button targets
  // exactly the right granular events.
  const widgetPatchDebouncersRef = useRef(new Map())
  const activeSelectionHistoryBatchRef = useRef(null)
  const selectionActionQueueRef = useRef(Promise.resolve())
  const flushAllPendingWidgetPatches = useCallback(() => {
    for (const entry of widgetPatchDebouncersRef.current.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer)
        entry.timer = null
        entry.flushNow()
      }
    }
  }, [])
  const cancelAllPendingWidgetPatches = useCallback(() => {
    for (const entry of widgetPatchDebouncersRef.current.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer)
        entry.timer = null
        entry.pendingProps = {}
      }
    }
  }, [])
  // patchWidgetDebounced(canvasId, widgetId, propsDelta) — coalesces multiple
  // PATCHes per widget within DEBOUNCE_MS into a single request.
  const patchWidgetDebounced = useCallback((targetCanvasId, widgetId, propsDelta, { immediate = false } = {}) => {
    if (!widgetId || !propsDelta) return
    const map = widgetPatchDebouncersRef.current
    let entry = map.get(widgetId)
    if (!entry) {
      entry = {
        pendingProps: {},
        historyBatchToken: null,
        timer: null,
        flushNow: () => {
          const props = entry.pendingProps
          const historyBatchToken = entry.historyBatchToken
          entry.pendingProps = {}
          entry.historyBatchToken = null
          if (Object.keys(props).length === 0) return
          dirtyRef.current = true
          return queueWrite(async () => {
            const res = await patchWidgetApi(targetCanvasId, widgetId, { props })
            if (Array.isArray(res?.eventIds)) {
              if (historyBatchToken) undoRedo.trackMany(res.eventIds, historyBatchToken)
              else undoRedo.trackMany(res.eventIds)
            }
          })
        },
      }
      map.set(widgetId, entry)
    }
    const activeBatch = activeSelectionHistoryBatchRef.current
    const historyBatchToken = activeBatch?.widgetIds.has(widgetId) ? activeBatch.token : null
    if (Object.keys(entry.pendingProps).length && entry.historyBatchToken !== historyBatchToken) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = null
      entry.flushNow()
    }
    entry.historyBatchToken = historyBatchToken
    Object.assign(entry.pendingProps, propsDelta)
    if (entry.timer) clearTimeout(entry.timer)
    if (immediate) {
      entry.timer = null
      return entry.flushNow()
    }
    entry.timer = setTimeout(() => {
      entry.timer = null
      entry.flushNow()
    }, 500)
  }, [undoRedo])

  const handleWidgetUpdate = useCallback((widgetId, updates, { immediate = false } = {}) => {
    const safeUpdates = { ...updates }
    // Guard against NaN values corrupting widget state
    if (typeof safeUpdates.width === 'number' && Number.isNaN(safeUpdates.width)) delete safeUpdates.width
    if (typeof safeUpdates.height === 'number' && Number.isNaN(safeUpdates.height)) delete safeUpdates.height
    const applyUpdates = () => setLocalWidgets((prev) => {
      if (!prev) return prev
      const next = prev.map((w) =>
        w.id === widgetId ? { ...w, props: { ...w.props, ...safeUpdates } } : w
      )
      return next
    })
    dirtyRef.current = true
    if (immediate) {
      // Discrete operations such as file rename must persist their reference
      // before the UI reports completion and the user can reload or leave.
      return patchWidgetDebounced(canvasId, widgetId, safeUpdates, { immediate: true }).then(applyUpdates)
    }
    applyUpdates()
    patchWidgetDebounced(canvasId, widgetId, safeUpdates)
  }, [canvasId, patchWidgetDebounced])

  // Stable ref so handleWidgetSelect can flip a "done" agent back to
  // "running" without re-creating itself on every widget update.
  const handleWidgetUpdateRef = useRef(handleWidgetUpdate)
  useEffect(() => { handleWidgetUpdateRef.current = handleWidgetUpdate }, [handleWidgetUpdate])

  const handleWidgetRemove = useCallback((widgetId) => {
    const activeBatch = activeSelectionHistoryBatchRef.current
    const historyBatchToken = activeBatch?.widgetIds.has(widgetId) ? activeBatch.token : undefined
    const requestKey = `${canvasId}:${widgetId}`
    const pending = widgetRemovalRequestsRef.current.get(requestKey)
    if (pending) return pending

    // Flush this widget's edits ahead of deletion so they cannot land after
    // it, and remain saved if its session cannot be closed.
    const debouncer = widgetPatchDebouncersRef.current.get(widgetId)
    if (debouncer?.timer) {
      clearTimeout(debouncer.timer)
      debouncer.timer = null
      debouncer.flushNow()
    }

    dirtyRef.current = true
    const removal = queueWrite(async () => {
      try {
        const res = await removeWidgetApi(canvasId, widgetId)
        if (!res?.success) throw new Error(res?.error || 'The widget could not be removed.')

        // Session shutdown is part of deletion. Keep the widget and its
        // connections visible until the server confirms that it succeeded.
        markWidgetDeleted(widgetId)
        setLocalWidgets((prev) => prev ? prev.filter((w) => w.id !== widgetId) : prev)
        // widget_removed also removes these connectors in the materializer;
        // separate connector requests would now target missing connectors.
        for (const connector of stateRef.current.connectors ?? []) {
          if (connector.start.widgetId === widgetId || connector.end.widgetId === widgetId) {
            markConnectorDeleted(connector.id)
          }
        }
        setLocalConnectors((prev) => prev.filter(
          (connector) => connector.start.widgetId !== widgetId && connector.end.widgetId !== widgetId,
        ))
        setSelectedWidgetIds((prev) => {
          const next = new Set(prev)
          next.delete(widgetId)
          return next
        })
        if (res.eventIds?.length) {
          if (historyBatchToken) undoRedo.trackMany(res.eventIds, historyBatchToken)
          else undoRedo.trackMany(res.eventIds)
        } else if (res.eventId) {
          if (historyBatchToken) undoRedo.track(res.eventId, historyBatchToken)
          else undoRedo.track(res.eventId)
        }
        return true
      } catch (err) {
        console.error('[canvas] Failed to remove widget:', err)
        showToast(`Could not remove widget: ${err?.message || 'Please try again.'}`)
        return false
      } finally {
        widgetRemovalRequestsRef.current.delete(requestKey)
      }
    })
    widgetRemovalRequestsRef.current.set(requestKey, removal)
    return removal
  }, [canvasId, undoRedo, markWidgetDeleted, markConnectorDeleted])

  const handleConnectorAdd = useCallback(async ({ startWidgetId, startAnchor, endWidgetId, endAnchor }) => {
    try {
      const result = await addConnectorApi(canvasId, { startWidgetId, startAnchor, endWidgetId, endAnchor })
      if (result.success && result.connector) {
        setLocalConnectors((prev) => [...prev, result.connector])
        if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
      }
    } catch (err) {
      console.error('[canvas] Failed to add connector:', err)
    }
  }, [canvasId, undoRedo])

  /**
   * Alt+Click handler: create a connector from the selected widget to the clicked widget.
   * Automatically finds the shortest anchor pair between the two widgets.
   */
  const handleAltClickConnect = useCallback((targetWidgetId) => {
    const selectedArr = Array.from(selectedIdsRef.current)
    if (selectedArr.length !== 1) return
    const sourceId = selectedArr[0]
    if (sourceId === targetWidgetId) return

    const widgets = stateRef.current.widgets ?? []
    const sources = stateRef.current.sources ?? []
    const resolveWidget = (id) => widgets.find((widget) => widget.id === id)
      || (id.startsWith('jsx-') && (() => {
        const source = sources.find((entry) => `jsx-${entry.export}` === id)
        return source ? { id, type: 'component', position: source.position, props: source } : null
      })())
    const sourceWidget = resolveWidget(sourceId)
    const targetWidget = resolveWidget(targetWidgetId)
    if (!sourceWidget || !targetWidget) return

    // Check if connection already exists
    const connectors = stateRef.current.connectors ?? []
    const alreadyConnected = connectors.some((c) =>
      (c.start?.widgetId === sourceId && c.end?.widgetId === targetWidgetId) ||
      (c.start?.widgetId === targetWidgetId && c.end?.widgetId === sourceId)
    )
    if (alreadyConnected) return

    const { startAnchor, endAnchor } = findBestAnchors(sourceWidget, targetWidget)
    handleConnectorAdd({
      startWidgetId: sourceId,
      startAnchor,
      endWidgetId: targetWidgetId,
      endAnchor,
    })
  }, [handleConnectorAdd])

  // Frame gates stop click bubbling and select their widget before the
  // wrapper's legacy Alt-click handler can run. Handle the modifier in capture
  // phase so an existing source selection survives and the gate does not
  // switch into interactive mode for this connector gesture.
  const handleFrameAltClickCapture = useCallback((event, targetWidgetId, widgetType) => {
    if (!['component', 'prototype', 'site-frame'].includes(widgetType) || !event.altKey) return
    const selected = selectedIdsRef.current
    if (selected.size !== 1 || selected.has(targetWidgetId)) return
    const target = event.target instanceof Element ? event.target : null
    if (!target?.closest('.tc-drag-surface')) return
    if (target.closest('.tc-drag-handle, button, input, textarea, select, option, a, [contenteditable]:not([contenteditable="false"]), [data-no-drag]')) return
    event.preventDefault()
    event.stopPropagation()
    handleAltClickConnect(targetWidgetId)
  }, [handleAltClickConnect])

  const handleFrameClickCapture = useCallback((event, targetWidgetId, widgetType) => {
    const target = event.target instanceof Element ? event.target : null
    if (justDraggedRef.current && target?.closest('[data-canvas-interact-gate]')) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    handleFrameAltClickCapture(event, targetWidgetId, widgetType)
  }, [handleFrameAltClickCapture])

  const handleConnectorRemove = useCallback((connectorId) => {
    markConnectorDeleted(connectorId)
    setLocalConnectors((prev) => prev.filter((c) => c.id !== connectorId))
    dirtyRef.current = true
    return queueWrite(async () => {
      try {
        const res = await removeConnectorApi(canvasId, connectorId)
        if (res?.eventId) undoRedo.track(res.eventId)
      } catch (err) {
        console.error('[canvas] Failed to remove connector:', err)
      }
    })
  }, [canvasId, undoRedo, markConnectorDeleted])

  // Connector drag state
  const [connectorDrag, setConnectorDrag] = useState(null)
  const [widgetDragging, setWidgetDragging] = useState(false)
  const visualConnectors = useVisualConnectors({
    canvasId,
    connectors: localConnectors ?? [],
    widgets: localWidgets ?? [],
    enabled: autoPlaceEnabled && canvas?.layout !== 'flow',
    paused: widgetDragging,
  })

  const handleConnectorDragStart = useCallback((widgetId, anchor, e) => {
    e.stopPropagation()
    e.preventDefault()
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const scale = zoomRef.current / 100
    const rect = scrollEl.getBoundingClientRect()

    const widgets = stateRef.current.widgets ?? []
    const startWidget = widgets.find((w) => w.id === widgetId)
    if (!startWidget) return

    // Don't start drag from a disabled/unavailable anchor
    const srcAnchorState = getAnchorState(startWidget.type, anchor)
    if (srcAnchorState !== 'available') return

    const computeAnchorPt = (widget, anch) => {
      let ww, wh
      const el = document.getElementById(widget.id)
      if (el) {
        const inner = el.querySelector('[data-widget-id]') || el.firstElementChild
        if (inner) { ww = inner.offsetWidth; wh = inner.offsetHeight }
      }
      if (!ww) ww = widget.props?.width ?? widget.bounds?.width ?? 270
      if (!wh) wh = widget.props?.height ?? widget.bounds?.height ?? 170
      const px = widget.position?.x ?? 0
      const py = widget.position?.y ?? 0
      switch (anch) {
        case 'top':    return { x: px + ww / 2, y: py }
        case 'bottom': return { x: px + ww / 2, y: py + wh }
        case 'left':   return { x: px, y: py + wh / 2 }
        case 'right':  return { x: px + ww, y: py + wh / 2 }
        default:       return { x: px + ww / 2, y: py + wh / 2 }
      }
    }

    const startPt = computeAnchorPt(startWidget, anchor)

    const toCanvasPoint = (clientX, clientY) => ({
      x: (scrollEl.scrollLeft + clientX - rect.left) / scale,
      y: (scrollEl.scrollTop + clientY - rect.top) / scale,
    })

    // Find nearest anchor on any other widget within a rectangular snap zone.
    // Each anchor has a 30px-wide strip (15px each side) extending from the widget edge.
    const SNAP_EXTEND = 15
    const SNAP_DEPTH = 40
    const SNAP_CROSS = 20 // perpendicular expansion so you can approach from any direction
    const sourceType = startWidget.type
    const findNearestAnchor = (canvasPt) => {
      const currentWidgets = stateRef.current.widgets ?? []
      let best = null
      let bestDist = Infinity
      for (const w of currentWidgets) {
        if (w.id === widgetId) continue
        if (!canAcceptConnection(w.type, sourceType)) continue

        let ww, wh
        const el = document.getElementById(w.id)
        if (el) {
          const inner = el.querySelector('[data-widget-id]') || el.firstElementChild
          if (inner) { ww = inner.offsetWidth; wh = inner.offsetHeight }
        }
        if (!ww) ww = w.props?.width ?? w.bounds?.width ?? 270
        if (!wh) wh = w.props?.height ?? w.bounds?.height ?? 170
        const wx = w.position?.x ?? 0
        const wy = w.position?.y ?? 0

        // If the cursor is inside the widget's bounds (but not in any specific
        // edge anchor zone), treat all available anchors as candidates and pick
        // the nearest one. This way, dropping anywhere inside a widget always
        // produces a connection.
        const insideBounds =
          canvasPt.x >= wx && canvasPt.x <= wx + ww &&
          canvasPt.y >= wy && canvasPt.y <= wy + wh

        for (const anch of ['top', 'bottom', 'left', 'right']) {
          const anchorState = getAnchorState(w.type, anch)
          if (anchorState !== 'available') continue

          // Build a rectangular hit zone for this anchor
          let inZone = false
          if (anch === 'top') {
            inZone = canvasPt.x >= wx - SNAP_CROSS && canvasPt.x <= wx + ww + SNAP_CROSS &&
                     canvasPt.y >= wy - SNAP_DEPTH && canvasPt.y <= wy + SNAP_EXTEND
          } else if (anch === 'bottom') {
            inZone = canvasPt.x >= wx - SNAP_CROSS && canvasPt.x <= wx + ww + SNAP_CROSS &&
                     canvasPt.y >= wy + wh - SNAP_EXTEND && canvasPt.y <= wy + wh + SNAP_DEPTH
          } else if (anch === 'left') {
            inZone = canvasPt.x >= wx - SNAP_DEPTH && canvasPt.x <= wx + SNAP_EXTEND &&
                     canvasPt.y >= wy - SNAP_CROSS && canvasPt.y <= wy + wh + SNAP_CROSS
          } else if (anch === 'right') {
            inZone = canvasPt.x >= wx + ww - SNAP_EXTEND && canvasPt.x <= wx + ww + SNAP_DEPTH &&
                     canvasPt.y >= wy - SNAP_CROSS && canvasPt.y <= wy + wh + SNAP_CROSS
          }
          if (!inZone && !insideBounds) continue

          const pt = computeAnchorPt(w, anch)
          const dist = Math.hypot(pt.x - canvasPt.x, pt.y - canvasPt.y)
          if (dist < bestDist) {
            bestDist = dist
            best = { widgetId: w.id, anchor: anch, pt }
          }
        }
      }
      return best
    }

    const cursorPt = toCanvasPoint(e.clientX, e.clientY)
    const snap = findNearestAnchor(cursorPt)
    setConnectorDrag({
      startWidgetId: widgetId,
      startAnchor: anchor,
      startPt,
      endPt: snap ? snap.pt : cursorPt,
      endAnchor: snap ? snap.anchor : anchor,
      snapTarget: snap,
    })

    const handlePointerMove = (moveE) => {
      const pt = toCanvasPoint(moveE.clientX, moveE.clientY)
      const nearSnap = findNearestAnchor(pt)
      setConnectorDrag((prev) => prev ? {
        ...prev,
        endPt: nearSnap ? nearSnap.pt : pt,
        endAnchor: nearSnap ? nearSnap.anchor : prev.startAnchor,
        snapTarget: nearSnap,
      } : null)
    }

    const handlePointerUp = (upE) => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)

      const pt = toCanvasPoint(upE.clientX, upE.clientY)
      const nearSnap = findNearestAnchor(pt)

      if (nearSnap) {
        handleConnectorAdd({
          startWidgetId: widgetId,
          startAnchor: anchor,
          endWidgetId: nearSnap.widgetId,
          endAnchor: nearSnap.anchor,
        })
      }
      setConnectorDrag(null)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }, [handleConnectorAdd])

  // Endpoint drag removed — dragging from a filled anchor now always
  // creates a new connection via handleConnectorDragStart instead of
  // repositioning the existing one.

  // Creation can move nearby existing widgets/sources on the server. Replay
  // those exact events before merging returned widgets, rather than waiting
  // for a watcher echo that may be suppressed by an optimistic write.
  const reconcileCreation = useCallback((results) => {
    let next = stateRef.current
    for (const result of results) {
      for (const event of result?.placementEvents || []) next = applyCanvasEvent(next, event)
      if (result?.widget) {
        const exists = (next.widgets || []).some((widget) => widget.id === result.widget.id)
        next = { ...next, widgets: exists
          ? next.widgets.map((widget) => widget.id === result.widget.id ? result.widget : widget)
          : [...(next.widgets || []), result.widget] }
      }
    }
    if (next !== stateRef.current) {
      stateRef.current = next
      setLocalWidgets(next.widgets)
      setLocalSources(next.sources)
    }
  }, [])
  const createWidget = useCallback(async (id, request) => {
    // `resolve` lets the server move a new widget out of overlaps; only do that
    // when Auto place is on, otherwise the widget lands exactly where requested.
    const result = await addWidgetApi(id, { resolve: autoPlaceEnabledRef.current && canvas?.layout !== 'flow', ...request })
    if (result.success) reconcileCreation([result])
    return result
  }, [reconcileCreation, canvas?.layout])
  const createWidgetBatch = useCallback(async (id, operations) => {
    const result = await batchOperations(id, operations.map((operation) => operation.op === 'create-widget' ? { resolve: autoPlaceEnabledRef.current && canvas?.layout !== 'flow', ...operation } : operation))
    if (result.success) reconcileCreation(result.results || [])
    return result
  }, [reconcileCreation, canvas?.layout])

  // Source persistence is also used by duplication when an adjacent JSX frame
  // must move. Its event IDs belong to the same user-visible history action.
  const debouncedSourceSave = useRef(
    debounce((canvasId, sources, onResult) => {
      return queueWrite(async () => {
        try {
          const res = await updateCanvas(canvasId, { sources })
          if (typeof onResult === 'function') onResult(res)
        } catch (err) {
          console.error('[canvas] Failed to save sources:', err)
        }
      })
    }, 2000)
  ).current


  const duplicateWidgets = useCallback((requestedWidgets, withConnectors = false) => {
    if (!requestedWidgets.length) return Promise.resolve()
    flushAllPendingWidgetPatches()
    dirtyRef.current = true
    return queueWrite(async () => {
      const eventIds = []
      try {
        // Prepare assets before planning, so asynchronous work cannot leave the
        // layout based on a stale snapshot of other creations.
        const imageOverrides = new Map()
        for (const widget of requestedWidgets) {
          if (widget.type === 'image' && widget.props?.src) {
            try {
              const duplicate = await duplicateImage(widget.props.src)
              if (duplicate.success) imageOverrides.set(widget.id, duplicate.filename)
            } catch { /* preserve the original asset when duplication is unavailable */ }
          }
        }
        const current = stateRef.current
        const ids = new Set(requestedWidgets.map(widget => widget.id))
        const widgets = (current.widgets || []).filter(widget => ids.has(widget.id))
        if (!widgets.length) return
        const rectangle = (widget) => {
          const fallback = WIDGET_FALLBACK_SIZES[widget.type] || { width: 200, height: 150 }
          const wrapper = document.getElementById(widget.id)
          const element = wrapper?.querySelector('[data-widget-id]') || wrapper
          return { id: widget.id, position: widget.position || { x: 0, y: 0 },
            width: element?.offsetWidth || widget.props?.width || fallback.width,
            height: element?.offsetHeight || widget.props?.height || fallback.height }
        }
        const stationary = [
          ...(current.widgets || []).map(rectangle),
          ...(current.sources || []).filter(source => source.export).map(source => rectangle({
            id: `jsx-${source.export}`, type: 'component', position: source.position,
            props: { width: source.width, height: source.height },
          })),
        ]
        const el = scrollRef.current
        const scale = zoomRef.current / 100
        const viewport = el?.clientWidth && el?.clientHeight ? {
          left: el.scrollLeft / scale, top: el.scrollTop / scale,
          right: (el.scrollLeft + el.clientWidth) / scale,
          bottom: (el.scrollTop + el.clientHeight) / scale,
        } : undefined
        const plan = planDuplicatePlacement({
          moving: widgets.map(rectangle), stationary,
          autoPlaceEnabled: autoPlaceEnabledRef.current && canvas?.layout !== 'flow',
          nudgeOffsets: getCanvasAutoPlace(canvasId), viewport, boundaryPad: canvas?.gridSize ?? 18,
        })
        const ops = []
        for (const widget of current.widgets || []) {
          const position = plan.stationaryPlacements.get(widget.id)
          if (position) ops.push({ op: 'move-widget', widgetId: widget.id, position })
        }
        for (const widget of widgets) {
          const props = { ...widget.props }
          if (widget.type === 'terminal' || widget.type === 'agent') delete props.prettyName
          if (imageOverrides.has(widget.id)) props.src = imageOverrides.get(widget.id)
          // Duplication has already planned its complete group geometry. Keep
          // exact placement in both modes, including the historical overlap.
          ops.push({ op: 'create-widget', ref: `clone-${widget.id}`, type: widget.type,
            props, position: plan.positions.get(widget.id), near: false, resolve: false })
        }
        const relevantConnectors = withConnectors ? (current.connectors || []).filter(connector =>
          ids.has(connector.start?.widgetId) || ids.has(connector.end?.widgetId)) : []
        for (const connector of relevantConnectors) ops.push({
          op: 'create-connector',
          startWidgetId: ids.has(connector.start.widgetId) ? `$clone-${connector.start.widgetId}` : connector.start.widgetId,
          startAnchor: connector.start.anchor,
          endWidgetId: ids.has(connector.end.widgetId) ? `$clone-${connector.end.widgetId}` : connector.end.widgetId,
          endAnchor: connector.end.anchor, connectorType: connector.connectorType || 'default',
        })
        const response = await createWidgetBatch(canvasId, ops)
        for (const result of response.results || []) eventIds.push(...(result.eventIds || [result.eventId]).filter(Boolean))
        if (!response.success) throw new Error(response.error || 'Duplicate batch failed')
        let next = stateRef.current
        const movedWidgets = (next.widgets || []).map(widget => plan.stationaryPlacements.has(widget.id)
          ? { ...widget, position: plan.stationaryPlacements.get(widget.id) } : widget)
        const movedSources = (next.sources || []).map(source => plan.stationaryPlacements.has(`jsx-${source.export}`)
          ? { ...source, position: plan.stationaryPlacements.get(`jsx-${source.export}`) } : source)
        const sourcesChanged = movedSources.some((source, index) => source !== next.sources?.[index])
        const created = (response.results || []).filter(result => result.op === 'create-widget' && result.widget).map(result => result.widget)
        const connectors = []
        for (const result of response.results || []) {
          if (result.op !== 'create-connector' || !result.connectorId) continue
          const operation = ops[result.index]
          const resolve = value => value.startsWith('$') ? response.refs?.[value.slice(1)] ?? value : value
          connectors.push({ id: result.connectorId, type: 'connector', connectorType: operation.connectorType,
            start: { widgetId: resolve(operation.startWidgetId), anchor: operation.startAnchor },
            end: { widgetId: resolve(operation.endWidgetId), anchor: operation.endAnchor }, meta: {} })
        }
        next = { ...next, widgets: movedWidgets, sources: movedSources, connectors: [...(next.connectors || []), ...connectors] }
        stateRef.current = next
        setLocalWidgets(next.widgets)
        setLocalSources(next.sources)
        setLocalConnectors(next.connectors)
        if (created.length) setSelectedWidgetIds(new Set(created.map(widget => widget.id)))
        if (sourcesChanged) {
          debouncedSourceSave.cancel()
          const result = await updateCanvas(canvasId, { sources: movedSources })
          eventIds.push(...(result.eventIds || [result.eventId]).filter(Boolean))
          if (!result.success) throw new Error(result.error || 'Failed to persist displaced sources')
        }
      } catch (error) {
        console.error('[canvas] Failed to duplicate widgets:', error)
      } finally {
        // Clone events, connector copies and stationary displacements are one
        // user command, including any successful portion of a failed request.
        if (eventIds.length) {
          undoRedo.trackBatch(eventIds)
        }
      }
    })
  }, [canvasId, canvas?.layout, canvas?.gridSize, undoRedo, flushAllPendingWidgetPatches, createWidgetBatch, debouncedSourceSave])

  const handleWidgetCopy = useCallback(widget => duplicateWidgets([widget]), [duplicateWidgets])
  const handleWidgetCopyWithConnectors = useCallback(widget => widget ? duplicateWidgets([widget], true) : undefined, [duplicateWidgets])
  const handleDuplicateSelected = useCallback(() => duplicateWidgets((localWidgets || []).filter(widget => selectedWidgetIds.has(widget.id))), [duplicateWidgets, localWidgets, selectedWidgetIds])
  const handleDuplicateWithConnectors = useCallback(() => duplicateWidgets((localWidgets || []).filter(widget => selectedWidgetIds.has(widget.id)), true), [duplicateWidgets, localWidgets, selectedWidgetIds])

  // Select all widgets (Cmd+A)
  const handleSelectAll = useCallback(() => {
    const allIds = (localWidgets ?? []).map((w) => w.id)
    if (allIds.length > 0) setSelectedWidgetIds(new Set(allIds))
  }, [localWidgets])

  const showMissingGhBanner = useCallback(() => {
    setShowGhInstallBanner(true)
  }, [])

  const buildGitHubPreviewUpdates = useCallback(async (url) => {
    try {
      const availability = await checkGitHubCliAvailable()
      if (!availability?.available) {
        showMissingGhBanner()
        return null
      }

      const result = await fetchGitHubEmbed(url)
      if (result?.code === 'gh_unavailable') {
        showMissingGhBanner()
        return null
      }
      if (!result?.success || !result?.snapshot) return null

      const snapshot = result.snapshot
      return {
        title: snapshot.title || '',
        width: 580,
        height: 400,
        github: {
          kind: snapshot.kind || 'issue',
          parentKind: snapshot.parentKind || snapshot.kind || 'issue',
          context: snapshot.context || '',
          body: snapshot.body || '',
          bodyHtml: snapshot.bodyHtml || '',
          authors: Array.isArray(snapshot.authors)
            ? snapshot.authors.filter((author) => typeof author === 'string' && author.trim())
            : [],
          createdAt: snapshot.createdAt ?? null,
          updatedAt: snapshot.updatedAt ?? null,
          // PR-specific metadata (state, branches, diff stats)
          state: snapshot.state ?? null,
          merged: typeof snapshot.merged === 'boolean' ? snapshot.merged : null,
          draft: typeof snapshot.draft === 'boolean' ? snapshot.draft : null,
          baseRef: typeof snapshot.baseRef === 'string' ? snapshot.baseRef : null,
          headRef: typeof snapshot.headRef === 'string' ? snapshot.headRef : null,
          additions: typeof snapshot.additions === 'number' ? snapshot.additions : null,
          deletions: typeof snapshot.deletions === 'number' ? snapshot.deletions : null,
          changedFiles: typeof snapshot.changedFiles === 'number' ? snapshot.changedFiles : null,
          fetchedAt: new Date().toISOString(),
        },
      }
    } catch (err) {
      console.error('[canvas] Failed to fetch GitHub embed metadata:', err)
      return null
    }
  }, [showMissingGhBanner])

  const handleRefreshGitHubWidget = useCallback(async (widgetId, url) => {
    if (!widgetId || !url) return { updated: false }
    const updates = await buildGitHubPreviewUpdates(url)
    if (!updates) return { updated: false }
    handleWidgetUpdate(widgetId, updates)
    return { updated: true }
  }, [buildGitHubPreviewUpdates, handleWidgetUpdate])


  // Register after the referenced callbacks have initialized. Hook dependency
  // arrays are evaluated during render, before React runs the effect callback.
  useEffect(() => {
    if (!isLocalDev || !canvasId) return undefined
    const group = `canvas-layout:${canvasId}`
    const toggleId = `canvas-layout/toggle-vertical:${canvasId}`
    const reflowId = `canvas-layout/reflow:${canvasId}`
    setDynamicActions(group, [
      { id: toggleId, label: 'Toggle Vertical Canvas Layout', type: 'toggle', hideFromCommandMenu: true },
      { id: reflowId, label: 'Reflow Canvas Vertically', hideFromCommandMenu: true },
    ], {
      [toggleId]: {
        execute: () => {
          flushAllPendingWidgetPatches()
          debouncedSourceSave.flush?.()
          queueWrite(() => commitCanvasLayout(scrollAxis !== 'vertical'))
        },
        getState: () => scrollAxis === 'vertical',
      },
      [reflowId]: () => {
        flushAllPendingWidgetPatches()
        debouncedSourceSave.flush?.()
        queueWrite(() => commitCanvasLayout(true, true))
      },
    })
    return () => clearDynamicActions(group)
  }, [canvasId, commitCanvasLayout, debouncedSourceSave, flushAllPendingWidgetPatches, isLocalDev, scrollAxis])

  const handleSourceUpdate = useCallback((exportName, updates) => {
    const safeUpdates = { ...updates }
    // Compute next outside the updater so the debounced save isn't scheduled
    // twice under React StrictMode in dev.
    const currentSources = Array.isArray(stateRef.current.sources) ? stateRef.current.sources : []
    const nextSources = currentSources.some((s) => s?.export === exportName)
      ? currentSources.map((s) => (s?.export === exportName ? { ...s, ...safeUpdates } : s))
      : [...currentSources, { export: exportName, ...safeUpdates }]
    dirtyRef.current = true
    stateRef.current = { ...stateRef.current, sources: nextSources }
    setLocalSources(nextSources)
    const widgetId = `jsx-${exportName}`
    const activeBatch = activeSelectionHistoryBatchRef.current
    const historyBatchToken = activeBatch?.widgetIds.has(widgetId) ? activeBatch.token : undefined
    debouncedSourceSave(canvasId, nextSources, (result) => {
      const eventIds = result?.eventIds || [result?.eventId]
      if (historyBatchToken) undoRedo.trackMany(eventIds, historyBatchToken)
      else undoRedo.trackMany(eventIds)
    })
  }, [canvasId, debouncedSourceSave, undoRedo])

  // One explicit position mutation for both group dragging and manual grid.
  // Live dragging updates React positions; persistence uses the original snapshot
  // so each changed member is written once, after pointer release.
  const applySelectionPositions = useCallback((placements, baseline = stateRef.current, persist = true, historyBatchToken) => {
    const widgets = stateRef.current.widgets || []
    const sources = stateRef.current.sources || []
    const nextWidgets = widgets.map((widget) => placements.has(widget.id) ? { ...widget, position: placements.get(widget.id) } : widget)
    const nextSources = sources.map((source) => placements.has(`jsx-${source.export}`) ? { ...source, position: placements.get(`jsx-${source.export}`) } : source)
    const widgetOps = (baseline.widgets || []).flatMap((widget) => {
      const position = placements.get(widget.id)
      return position && (position.x !== widget.position?.x || position.y !== widget.position?.y)
        ? [{ op: 'move-widget', widgetId: widget.id, position }] : []
    })
    const sourcesChanged = (baseline.sources || []).some((source) => {
      const position = placements.get(`jsx-${source.export}`)
      return position && (position.x !== source.position?.x || position.y !== source.position?.y)
    })
    if (widgetOps.length || sourcesChanged) dirtyRef.current = true
    stateRef.current = { ...stateRef.current, widgets: nextWidgets, sources: nextSources }
    setLocalWidgets(nextWidgets)
    setLocalSources(nextSources)
    if (!persist || (!widgetOps.length && !sourcesChanged)) return
    flushAllPendingWidgetPatches()
    if (sourcesChanged) debouncedSourceSave.cancel()
    return queueWrite(async () => {
      try {
        const eventIds = []
        if (widgetOps.length) {
          const response = await batchOperations(canvasId, widgetOps)
          eventIds.push(...(response?.results || []).flatMap((result) => result.eventIds || [result.eventId]).filter(Boolean))
        }
        if (sourcesChanged) {
          const response = await updateCanvas(canvasId, { sources: nextSources })
          eventIds.push(...(response?.eventIds || [response?.eventId]).filter(Boolean))
        }
        if (eventIds.length) undoRedo.trackBatch(eventIds, historyBatchToken)
      } catch (error) {
        console.error('[canvas] Failed to save selection positions:', error)
      }
    })
  }, [canvasId, undoRedo, flushAllPendingWidgetPatches, debouncedSourceSave])

  const handleArrangeSelection = useCallback(() => {
    if (!isLocalDev || selectedGeometry.length < 2) return
    applySelectionPositions(arrangeSelectionGrid(selectedGeometry, { boundaryPad: canvas?.gridSize ?? 18 }))
  }, [isLocalDev, selectedGeometry, canvas?.gridSize, applySelectionPositions])

  const handleGroupDragStart = useCallback((event) => {
    if (!isLocalDev || event.button !== 0 || selectedGeometry.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    groupDragCleanupRef.current?.()
    const baseline = stateRef.current
    const wasDirty = dirtyRef.current
    const selectionAtStart = new Set(selectedIdsRef.current)
    const items = selectedGeometry
    const bounds = getSelectionBounds(items)
    const startX = event.clientX
    const startY = event.clientY
    const startScrollX = scrollRef.current?.scrollLeft || 0
    const startScrollY = scrollRef.current?.scrollTop || 0
    const scale = zoomRef.current / 100
    const boundaryPad = canvas?.gridSize ?? 18
    const handle = event.currentTarget
    const pointerId = event.pointerId
    const releaseIframePointerLock = acquireIframePointerLock(document)
    const releaseDragCursor = acquireDragCursor(document)
    // Keep movement events on the shared surface across iframe widgets.
    if (pointerId != null) handle.setPointerCapture?.(pointerId)
    const isOwnPointer = (pointer) => pointerId == null || pointer.pointerId == null || pointer.pointerId === pointerId
    let placements = null
    justDraggedRef.current = true
    setGroupDragging(true)
    setWidgetDragging(true)
    const move = (pointer) => {
      if (!isOwnPointer(pointer)) return
      // Clamp the whole delta, rather than each widget, to preserve offsets.
      const dx = Math.max(boundaryPad - bounds.x, roundPosition((pointer.clientX - startX + (scrollRef.current?.scrollLeft || 0) - startScrollX) / scale))
      const dy = Math.max(boundaryPad - bounds.y, roundPosition((pointer.clientY - startY + (scrollRef.current?.scrollTop || 0) - startScrollY) / scale))
      placements = new Map(items.map((item) => [item.id, { x: item.position.x + dx, y: item.position.y + dy }]))
      applySelectionPositions(placements, baseline, false)
    }
    const cleanup = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      handle.removeEventListener('lostpointercapture', cancel)
      if (pointerId != null && handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture?.(pointerId)
      releaseIframePointerLock()
      releaseDragCursor()
      groupDragCleanupRef.current = null
    }
    const finish = (pointer) => {
      if (!isOwnPointer(pointer)) return
      move(pointer)
      cleanup()
      setWidgetDragging(false)
      setGroupDragging(false)
      if (placements) {
        const primary = items[0]
        const primaryPosition = placements.get(primary.id)
        const preview = previewAutoPlaceDrop(primary.id, primaryPosition)
        const finalPlacements = preview?.placements || placements
        const selectedIds = new Set(items.map((item) => item.id))
        const movedStationaryIds = [...finalPlacements.keys()].filter((id) => !selectedIds.has(id))
        if (movedStationaryIds.length) transitionPositionIds(movedStationaryIds)
        applySelectionPositions(finalPlacements, baseline)
        const changed = [...finalPlacements].some(([id, position]) => {
          const original = id.startsWith('jsx-')
            ? baseline.sources?.find((source) => `jsx-${source.export}` === id)?.position
            : baseline.widgets?.find((widget) => widget.id === id)?.position
          return position.x !== original?.x || position.y !== original?.y
        })
        if (!changed) dirtyRef.current = wasDirty
      }
      selectedIdsRef.current = selectionAtStart
      setSelectedWidgetIds(selectionAtStart)
      requestAnimationFrame(() => { justDraggedRef.current = false })
    }
    const cancel = (pointer) => {
      if (!isOwnPointer(pointer)) return
      cleanup()
      stateRef.current = baseline
      setLocalWidgets(baseline.widgets)
      setLocalSources(baseline.sources)
      dirtyRef.current = wasDirty
      setWidgetDragging(false)
      setGroupDragging(false)
      selectedIdsRef.current = selectionAtStart
      setSelectedWidgetIds(selectionAtStart)
      requestAnimationFrame(() => { justDraggedRef.current = false })
    }
    groupDragCleanupRef.current = cleanup
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    handle.addEventListener('lostpointercapture', cancel)
    if (event.initialPointer) move(event.initialPointer)
  }, [isLocalDev, selectedGeometry, canvas?.gridSize, applySelectionPositions, previewAutoPlaceDrop, transitionPositionIds])

  // Multi-selection members use the shared group gesture from their normal
  // content surface. Match Draggable's hold and travel thresholds, while
  // leaving clicks, toolbar actions, editable controls, and widget inputs to
  // their existing handlers.
  const handleGroupMemberPointerDown = useCallback((event) => {
    if (!isLocalDev || event.button !== 0 || selectedGeometry.length < 2) return
    const target = event.target instanceof Element ? event.target : null
    if (!target?.closest('.tc-drag-surface')) return
    if (target.closest('.tc-drag-handle, button, input, textarea, select, option, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [data-no-drag]')) return
    // StickyNote's inactive markdown preview uses role=button for its
    // double-click-to-edit affordance. It is still a draggable widget body;
    // the active editor is a textarea and remains excluded above.
    if (target.closest('[role="button"]')
      && !target.closest('[data-canvas-group-drag-preview]')
      && !target.closest('[data-canvas-interact-gate]')) return
    if (target.closest('[data-widget-interacting="true"]')) return

    const dragElement = event.currentTarget
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    let active = true
    let started = false
    let delayMet = false
    let distanceMet = false
    const cleanup = () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
      document.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', onEnd)
    }
    const start = (initialPointer = null) => {
      if (!active || started) return
      started = true
      cleanup()
      handleGroupDragStart({
        button: event.button,
        clientX: startX,
        clientY: startY,
        pointerId,
        initialPointer,
        currentTarget: dragElement,
        preventDefault() {},
        stopPropagation() {},
      })
    }
    const tryStart = (initialPointer) => { if (delayMet && distanceMet) start(initialPointer) }
    const onMove = (pointer) => {
      if (!active || pointerId != null && pointer.pointerId !== pointerId) return
      if (Math.hypot(pointer.clientX - startX, pointer.clientY - startY) >= GROUP_DRAG_DISTANCE_PX) {
        distanceMet = true
        tryStart(pointer)
      }
    }
    const onEnd = (pointer) => {
      if (pointerId != null && pointer.pointerId != null && pointer.pointerId !== pointerId) return
      active = false
      cleanup()
    }
    const timer = window.setTimeout(() => {
      delayMet = true
      tryStart()
    }, GROUP_DRAG_DELAY_MS)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', onEnd)
  }, [isLocalDev, selectedGeometry.length, handleGroupDragStart])

  const handleGroupKeyDown = useCallback((event) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta || !selectionBounds || !isLocalDev) return
    event.preventDefault()
    event.stopPropagation()
    const step = event.shiftKey ? 10 : 1
    const boundaryPad = canvas?.gridSize ?? 18
    const dx = Math.max(boundaryPad - selectionBounds.x, delta[0] * step)
    const dy = Math.max(boundaryPad - selectionBounds.y, delta[1] * step)
    applySelectionPositions(new Map(selectedGeometry.map((item) => [item.id, { x: item.position.x + dx, y: item.position.y + dy }])))
  }, [isLocalDev, selectionBounds, selectedGeometry, canvas?.gridSize, applySelectionPositions])

  const applySelectionProps = useCallback((updatesById, historyBatchToken) => {
    const widgets = stateRef.current.widgets || []
    const sources = stateRef.current.sources || []
    const selectedIds = selectedIdsRef.current
    const widgetOps = []
    let nextWidgets = widgets
    let nextSources = sources
    let sourcesChanged = false

    for (const [id, updates] of updatesById) {
      if (!selectedIds.has(id)) continue
      if (id.startsWith('jsx-')) {
        const exportName = id.slice(4)
        const existingIndex = nextSources.findIndex(source => source?.export === exportName)
        if (existingIndex < 0) {
          nextSources = [...nextSources, { export: exportName, ...updates }]
          sourcesChanged = true
        } else {
          const current = nextSources[existingIndex]
          if (Object.entries(updates).some(([key, value]) => current?.[key] !== value)) {
            nextSources = nextSources.map((source, index) => index === existingIndex ? { ...source, ...updates } : source)
            sourcesChanged = true
          }
        }
        continue
      }

      const current = widgets.find(widget => widget.id === id)
      if (!current || !Object.entries(updates).some(([key, value]) => current.props?.[key] !== value)) continue
      widgetOps.push({ op: 'update-widget', widgetId: id, props: updates })
      nextWidgets = nextWidgets.map(widget => widget.id === id ? { ...widget, props: { ...widget.props, ...updates } } : widget)
    }

    if (!widgetOps.length && !sourcesChanged) return
    dirtyRef.current = true
    stateRef.current = { ...stateRef.current, widgets: nextWidgets, sources: nextSources }
    setLocalWidgets(nextWidgets)
    setLocalSources(nextSources)
    flushAllPendingWidgetPatches()
    if (sourcesChanged) debouncedSourceSave.cancel()
    return queueWrite(async () => {
      try {
        const eventIds = []
        if (widgetOps.length) {
          const response = await batchOperations(canvasId, widgetOps)
          eventIds.push(...(response?.results || []).flatMap(result => result.eventIds || [result.eventId]).filter(Boolean))
        }
        if (sourcesChanged) {
          const response = await updateCanvas(canvasId, { sources: nextSources })
          eventIds.push(...(response?.eventIds || [response?.eventId]).filter(Boolean))
        }
        if (eventIds.length) undoRedo.trackBatch(eventIds, historyBatchToken)
      } catch (error) {
        console.error('[canvas] Failed to save selection action:', error)
      }
    })
  }, [canvasId, undoRedo, flushAllPendingWidgetPatches, debouncedSourceSave])

  const handleGroupPropChange = useCallback((prop, value, widgetIds) => {
    applySelectionProps(new Map(widgetIds.map(id => [id, { [prop]: value }])))
  }, [applySelectionProps])
  const handleGroupAction = useCallback((feature, widgetIds, ...args) => {
    const immediateTargets = widgetIds.filter(id => selectedIdsRef.current.has(id))
    if (!immediateTargets.length) return Promise.resolve()
    if (feature.action === 'arrange-grid') {
      handleArrangeSelection()
      return writeQueueRef.current
    }
    if (feature.action === 'copy') {
      const widgets = (stateRef.current.widgets || []).filter(widget => immediateTargets.includes(widget.id))
      return duplicateWidgets(widgets, !!args[0]?.altKey)
    }

    const runAction = async () => {
      const targets = immediateTargets

      // Finish preceding edits before opening a selection action history entry.
      // The serialized action queue below keeps concurrent selection commands
      // from overwriting this history token while widget-owned work is pending.
      flushAllPendingWidgetPatches()
      debouncedSourceSave.flush()
      await writeQueueRef.current

      if (feature.action === 'delete') {
        const selectedWidgets = (stateRef.current.widgets || []).filter(widget => targets.includes(widget.id))
        const confirmations = selectedWidgets.map(widget => getDeleteConfirm(widget.type)).filter(Boolean)
        if (confirmations.length) {
          const uniqueMessages = [...new Set(confirmations.map(confirmation => confirmation.message).filter(Boolean))]
          const confirmed = await new Promise(resolve => {
            document.dispatchEvent(new CustomEvent('storyboard:canvas:request-delete-confirm', {
              detail: {
                title: targets.length > 1 ? 'Delete selected widgets?' : confirmations[0].title,
                message: targets.length > 1
                  ? [...uniqueMessages, `This will remove ${targets.length} selected widgets from the canvas.`].join(' ')
                  : confirmations[0].message,
                confirmLabel: targets.length > 1 ? 'Delete widgets' : confirmations[0].confirmLabel,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
              },
            }))
          })
          if (!confirmed) return
        }
      }

      const historyBatch = undoRedo.beginBatch()
      activeSelectionHistoryBatchRef.current = { token: historyBatch, widgetIds: new Set(targets) }
      try {
        if (['set-frame-theme', 'set-frame-device', 'set-frame-clip-height'].includes(feature.action)) {
          const updatesById = new Map()
          const options = args[0] || {}
          const themeRegistry = getConfig('theming')?.themes || {}
          for (const id of targets) {
            const source = id.startsWith('jsx-')
              ? (stateRef.current.sources || []).find(entry => `jsx-${entry?.export}` === id)
              : null
            const widget = source ? null : (stateRef.current.widgets || []).find(entry => entry.id === id)
            const type = source ? 'component' : widget?.type
            const currentProps = source || widget?.props || {}
            const updates = getFrameActionUpdates(type, feature.action, options, currentProps, themeRegistry)
            if (updates) updatesById.set(id, updates)
          }
          await applySelectionProps(updatesById, historyBatch)
          return
        }

        for (const id of targets) {
          if (feature.action === 'delete') {
            await handleWidgetRemove(id)
            continue
          }
          // Match single-widget chrome dispatch: widget-owned actions get first
          // refusal, then the same CanvasPage fallback.
          const instance = window[CANVAS_WIDGET_REFS_KEY]?.get(id)
          if (instance?.handleAction && await instance.handleAction(feature.action, ...args) !== false) continue
          const action = canvasWidgetActionHandlers.get(id)
          if (action) await action(feature.action, ...args)
        }
      } finally {
        flushAllPendingWidgetPatches()
        debouncedSourceSave.flush()
        await writeQueueRef.current
        activeSelectionHistoryBatchRef.current = null
        undoRedo.endBatch(historyBatch)
      }
    }

    const queued = selectionActionQueueRef.current.then(runAction, runAction)
    selectionActionQueueRef.current = queued.catch(error => {
      console.error('[canvas] Multi-selection action failed:', error)
    })
    return queued
  }, [handleArrangeSelection, duplicateWidgets, flushAllPendingWidgetPatches, undoRedo, debouncedSourceSave, handleWidgetRemove, applySelectionProps])

  const resolveDropPosition = useCallback((dragId, position) => {
    const preview = previewAutoPlaceDrop(dragId, position)
    dropPlacementsRef.current = preview?.placements || null
    return preview?.placements.get(dragId) || position
  }, [previewAutoPlaceDrop])

  const handleItemDragEnd = useCallback((dragId, position) => {
    nudgeDragActiveRef.current = false
    setNudgeTargetIds((previous) => previous.size ? new Set() : previous)
    setWidgetDragging(false)
    if (!dragId || !position) {
      clearDragPreview()
      return
    }
    const rounded = { x: Math.max(0, roundPosition(position.x)), y: Math.max(0, roundPosition(position.y)) }
    const dropPlacements = dropPlacementsRef.current
    dropPlacementsRef.current = null

    const ids = selectedIdsRef.current
    if (dropPlacements) {
      if (ids.size > 1 && ids.has(dragId)) {
        transitionPeers()
        justDraggedRef.current = true
        requestAnimationFrame(() => { justDraggedRef.current = false })
      }
      const selected = new Set(ids)
      const displacedIds = [...dropPlacements.keys()].filter((id) => !selected.has(id) && id !== dragId)
      if (displacedIds.length) transitionPositionIds(displacedIds)
      flushAllPendingWidgetPatches()
      const widgetMoveOps = []
      const nextWidgets = (stateRef.current.widgets ?? []).map((widget) => {
        const nextPosition = dropPlacements.get(widget.id) || (widget.id === dragId ? rounded : null)
        if (!nextPosition || (nextPosition.x === widget.position?.x && nextPosition.y === widget.position?.y)) return widget
        widgetMoveOps.push({ op: 'move-widget', widgetId: widget.id, position: nextPosition })
        return { ...widget, position: nextPosition }
      })
      let sourcesChanged = false
      const nextSources = (stateRef.current.sources ?? []).map((source) => {
        const id = `jsx-${source.export}`
        const nextPosition = dropPlacements.get(id) || (id === dragId ? rounded : null)
        if (!nextPosition || (nextPosition.x === source.position?.x && nextPosition.y === source.position?.y)) return source
        sourcesChanged = true
        return { ...source, position: nextPosition }
      })
      if (sourcesChanged) {
        debouncedSourceSave.cancel()
      }
      if (widgetMoveOps.length || sourcesChanged) {
        dirtyRef.current = true
        stateRef.current = { ...stateRef.current, widgets: nextWidgets, sources: nextSources }
        setLocalWidgets(nextWidgets)
        setLocalSources(nextSources)
        queueWrite(() => persistMovesAsOneHistoryEntry({ canvasId, widgetMoveOps, sourcesChanged, nextSources, undoRedo, label: 'auto-place moves' }))
      }
      return
    }
    // Multi-select move: apply same delta to all selected widgets
    // Checked BEFORE the jsx- early return so mixed selections work
    if (ids.size > 1 && ids.has(dragId)) {
      transitionPeers()
      // Suppress the click-based selection reset that fires after pointerup
      justDraggedRef.current = true // eslint-disable-line react-hooks/immutability
      requestAnimationFrame(() => { justDraggedRef.current = false })

      // Compute delta from the dragged widget's old position
      const isJsx = dragId.startsWith('jsx-')
      let oldPos = { x: 0, y: 0 }
      if (isJsx) {
        const sourceExport = dragId.replace(/^jsx-/, '')
        const source = (stateRef.current.sources ?? []).find(s => s?.export === sourceExport)
        oldPos = source?.position || { x: 0, y: 0 }
      } else {
        const draggedWidget = (stateRef.current.widgets ?? []).find(w => w.id === dragId)
        oldPos = draggedWidget?.position || { x: 0, y: 0 }
      }
      const dx = rounded.x - oldPos.x
      const dy = rounded.y - oldPos.y

      cancelAllPendingWidgetPatches()

      // Compute the new widgets array and batch ops up-front (outside the
      // setState updater). Doing this work inside `setLocalWidgets((prev) => …)`
      // double-fires queueWrite under React StrictMode in dev because the
      // updater is invoked twice — observed as duplicate widget_moved events
      // in the JSONL with prevPosition == position on the second batch.
      const currentWidgets = stateRef.current.widgets ?? []
      const widgetMoveOps = []
      const nextWidgets = currentWidgets.map((w) => {
        if (w.id === dragId) {
          widgetMoveOps.push({ op: 'move-widget', widgetId: w.id, position: rounded })
          return { ...w, position: rounded }
        }
        if (ids.has(w.id)) {
          const newPos = {
            x: Math.max(0, roundPosition((w.position?.x ?? 0) + dx)),
            y: Math.max(0, roundPosition((w.position?.y ?? 0) + dy)),
          }
          widgetMoveOps.push({ op: 'move-widget', widgetId: w.id, position: newPos })
          return { ...w, position: newPos }
        }
        return w
      })
      // Update JSX source positions — still a single source_updated event;
      // gather its event with the widget move events so one group drag is one
      // user-visible history action across both kinds of canvas item.
      const currentSources = Array.isArray(stateRef.current.sources) ? stateRef.current.sources : []
      let sourcesChanged = false
      const nextSources = currentSources.map((s) => {
        if (!s?.export) return s
        const sid = `jsx-${s.export}`
        if (sid === dragId) {
          sourcesChanged = true
          return { ...s, position: rounded }
        }
        if (ids.has(sid)) {
          sourcesChanged = true
          return {
            ...s,
            position: {
              x: Math.max(0, roundPosition((s.position?.x ?? 0) + dx)),
              y: Math.max(0, roundPosition((s.position?.y ?? 0) + dy)),
            },
          }
        }
        return s
      })
      if (widgetMoveOps.length || sourcesChanged) {
        dirtyRef.current = true
        stateRef.current = { ...stateRef.current, widgets: nextWidgets, sources: nextSources }
        setLocalWidgets(nextWidgets)
        setLocalSources(nextSources)
        if (sourcesChanged) debouncedSourceSave.cancel()
        queueWrite(() => persistMovesAsOneHistoryEntry({ canvasId, widgetMoveOps, sourcesChanged, nextSources, undoRedo, label: 'multi-move' }))
      }
      return
    }

    if (dragId.startsWith('jsx-')) {
      const sourceExport = dragId.replace(/^jsx-/, '')
      // Compute next outside the updater so the queueWrite doesn't double-fire
      // under React StrictMode (see multi-move branch above for the same fix).
      const currentSources = Array.isArray(stateRef.current.sources) ? stateRef.current.sources : []
      const nextSources = currentSources.some((s) => s?.export === sourceExport)
        ? currentSources.map((s) => (s?.export === sourceExport ? { ...s, position: rounded } : s))
        : [...currentSources, { export: sourceExport, position: rounded }]
      dirtyRef.current = true
      setLocalSources(nextSources)
      queueWrite(() =>
        updateCanvas(canvasId, { sources: nextSources })
          .catch((err) => console.error('[canvas] Failed to save source position:', err))
      )
      return
    }

    // Single-widget move — granular PATCH /widget so the move is its own
    // undoable event.
    cancelAllPendingWidgetPatches()
    setLocalWidgets((prev) => {
      if (!prev) return prev
      const next = prev.map((w) =>
        w.id === dragId ? { ...w, position: rounded } : w
      )
      dirtyRef.current = true
      return next
    })
    queueWrite(async () => {
      try {
        const res = await patchWidgetApi(canvasId, dragId, { position: rounded })
        if (Array.isArray(res?.eventIds)) undoRedo.trackMany(res.eventIds)
      } catch (err) {
        console.error('[canvas] Failed to save widget position:', err)
      }
    })
  }, [canvasId, undoRedo, cancelAllPendingWidgetPatches, flushAllPendingWidgetPatches, debouncedSourceSave, transitionPeers, transitionPositionIds, clearDragPreview])

  // Keep zoomRef in sync when React state is set (e.g. by toolbar or zoom-to-fit)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Navigation must cancel the old canvas's delayed wheel commit before it
  // can overwrite the next canvas's restored zoom.
  useEffect(() => () => {
    clearTimeout(zoomCommitTimer.current)
    clearTimeout(zoomEventTimer.current)
    zoomCommitTimer.current = null
    zoomEventTimer.current = null
    if (zoomElRef.current) delete zoomElRef.current.dataset.zooming
  }, [viewportSession])

  // A session survives hydration/scroller replacement; a new Notebook/canvas
  // receives its own session. Never consume a saved pan before layout can hold it.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || loading) return
    const applyInitialZoom = (value) => {
      zoomRef.current = value
      const scale = value / 100
      if (zoomElRef.current) {
        zoomElRef.current.style.transform = `scale(${scale})`
        zoomElRef.current.style.width = getZoomLayoutWidth(scale, interactionRef.current?.surface)
        zoomElRef.current.style.height = getZoomLayoutHeight(scale, interactionRef.current?.surface)
      }
      setZoom(value)
    }
    const restore = () => {
      viewportSession.restore(el, {
        zoom: zoomRef.current,
        applyZoom: applyInitialZoom,
        initialize: () => {
          const bounds = computeCanvasBounds(stateRef.current.widgets, componentEntries)
          let initialZoom = 100
          if (bounds) {
            const fitScale = Math.min(el.clientWidth / (bounds.maxX - bounds.minX + FIT_PADDING * 2), el.clientHeight / (bounds.maxY - bounds.minY + FIT_PADDING * 2))
            const { ZOOM_MIN, ZOOM_MAX } = zoomLimits()
            initialZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.floor(fitScale * 100)))
          }
          applyInitialZoom(initialZoom)
          el.scrollLeft = bounds ? Math.max(0, (bounds.minX - FIT_PADDING) * initialZoom / 100) : 0
          el.scrollTop = bounds ? Math.max(0, (bounds.minY - FIT_PADDING) * initialZoom / 100) : 0
          return initialZoom
        },
      })
    }
    restore()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(restore) : null
    observer?.observe(el)
    if (zoomElRef.current) observer?.observe(zoomElRef.current)
    const frame = requestAnimationFrame(restore)
    return () => { observer?.disconnect(); cancelAnimationFrame(frame) }
  }, [canvasId, viewportSession, loading, componentEntries])

  // Center on a specific widget if `?widget=<id>` is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const targetId = params.get('widget')
    if (!targetId || loading) return

    const el = scrollRef.current
    if (!el) return

    let x, y, w, h

    // Check JSON widgets first
    const widgets = localWidgets ?? []
    const widget = widgets.find((wgt) => wgt.id === targetId)
    if (widget) {
      const fallback = WIDGET_FALLBACK_SIZES[widget.type] || { width: 200, height: 150 }
      x = widget.position?.x ?? 0
      y = widget.position?.y ?? 0
      w = widget.props?.width ?? fallback.width
      h = widget.props?.height ?? fallback.height
    }

    // Check JSX sources (jsx-ExportName)
    if (!widget && targetId.startsWith('jsx-')) {
      const exportName = targetId.slice(4)
      const entry = componentEntries.find((e) => e.exportName === exportName)
      if (entry) {
        const fallback = WIDGET_FALLBACK_SIZES['component']
        x = entry.sourceData?.position?.x ?? 0
        y = entry.sourceData?.position?.y ?? 0
        w = entry.sourceData?.width ?? fallback.width
        h = entry.sourceData?.height ?? fallback.height
      }
    }

    if (x == null) return

    const scale = zoomRef.current / 100
    el.scrollLeft = Math.max(0, (x + w / 2) * scale - el.clientWidth / 2)
    el.scrollTop = Math.max(0, (y + h / 2) * scale - el.clientHeight / 2)
    // An explicit widget link supersedes an older pan still waiting for layout.
    const state = viewportSession.capture(el, zoomRef.current, { overridePending: true })
    saveViewportState(canvasId, state, viewportScope)

    // Clean the URL param without triggering navigation
    const url = new URL(window.location.href)
    url.searchParams.delete('widget')
    window.history.replaceState({}, '', url.toString())
  }, [loading, localWidgets, componentEntries, viewportSession, viewportScope, canvasId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const state = viewportSession.capture(scrollRef.current, zoomRef.current)
      saveViewportState(canvasId, state, viewportScope)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [canvasId, viewportScope, viewportSession, zoom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let userScrollIntent = false
    let userScrollIntentTimer = null
    const markUserScrollIntent = () => {
      userScrollIntent = true
      window.clearTimeout(userScrollIntentTimer)
      userScrollIntentTimer = window.setTimeout(() => { userScrollIntent = false }, 500)
    }
    const saveNow = () => saveViewportState(canvasId, viewportSession.getState(), viewportScope)
    const debouncedScrollSave = debounce(saveNow, 150)
    function handleScroll() {
      // Capture while attached, before navigation can clear the old DOM scroll.
      const overridePending = userScrollIntent
      userScrollIntent = false
      window.clearTimeout(userScrollIntentTimer)
      userScrollIntentTimer = null
      viewportSession.capture(el, zoomRef.current, { overridePending })
      debouncedScrollSave()
    }
    function handleScrollKeydown(event) {
      const scrollKeys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End', ' ']
      const target = event.target
      if (!scrollKeys.includes(event.key) || (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, button, [contenteditable="true"]')))) return
      markUserScrollIntent()
    }
    function handleScrollbarPointerDown(event) {
      if (event.target !== el) return
      const bounds = el.getBoundingClientRect()
      if (event.clientX >= bounds.left + el.clientWidth || event.clientY >= bounds.top + el.clientHeight) {
        markUserScrollIntent()
      }
    }
    function handleBeforeUnload() {
      viewportSession.capture(el, zoomRef.current)
      debouncedScrollSave.cancel()
      saveNow()
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    el.addEventListener('wheel', markUserScrollIntent, { passive: true })
    el.addEventListener('keydown', handleScrollKeydown)
    el.addEventListener('touchstart', markUserScrollIntent, { passive: true })
    el.addEventListener('pointerdown', handleScrollbarPointerDown)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    return () => {
      debouncedScrollSave.cancel()
      window.clearTimeout(userScrollIntentTimer)
      el.removeEventListener('scroll', handleScroll)
      el.removeEventListener('wheel', markUserScrollIntent)
      el.removeEventListener('keydown', handleScrollKeydown)
      el.removeEventListener('touchstart', markUserScrollIntent)
      el.removeEventListener('pointerdown', handleScrollbarPointerDown)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
      // The saved live snapshot is authoritative after DOM replacement.
      saveNow()
    }
  }, [canvasId, viewportScope, viewportSession, loading])

  // Gather current viewport data from refs (safe for callbacks/timeouts)
  const getViewportData = useCallback(() => {
    const el = scrollRef.current
    if (!el) return null
    const scale = zoomRef.current / 100
    const scrollLeft = el.scrollLeft
    const scrollTop = el.scrollTop
    const cw = el.clientWidth
    const ch = el.clientHeight
    return {
      centerX: Math.round((scrollLeft + cw / 2) / scale),
      centerY: Math.round((scrollTop + ch / 2) / scale),
      zoom: zoomRef.current,
      topLeftX: Math.round(scrollLeft / scale),
      topLeftY: Math.round(scrollTop / scale),
      width: Math.round(cw / scale),
      height: Math.round(ch / scale),
    }
  }, [])

  // Debounced viewport-changed HMR event — sends position/zoom to Vite server
  // so the selected-widgets bridge can write it to disk for agents.
  useEffect(() => {
    if (!import.meta.hot) return
    const el = scrollRef.current
    if (!el) return

    const tabId = selectionTabIdRef.current

    function sendViewport() {
      const viewport = getViewportData()
      if (viewport) {
        import.meta.hot.send('storyboard:viewport-changed', { tabId, canvasId, viewport })
      }
    }

    const debouncedSend = debounce(sendViewport, 500)

    function handleScroll() { debouncedSend() }
    el.addEventListener('scroll', handleScroll, { passive: true })

    // Also send on zoom commits (zoom state changes trigger this effect)
    sendViewport()

    return () => {
      debouncedSend.cancel()
      el.removeEventListener('scroll', handleScroll)
    }
  }, [canvasId, zoom, loading, getViewportData])

  /**
   * Zoom to a new level, anchoring on an optional client-space point.
   * When a cursor position is provided (e.g. from a wheel event), the
   * canvas point under the cursor stays fixed. Otherwise falls back to
   * the viewport center.
   *
   * Performs an imperative DOM mutation instead of a React state update
   * to avoid triggering a full re-render of the widget tree on every
   * zoom tick. React state is committed after a debounce for toolbar
   * display updates.
   */
  function applyZoom(newZoom, clientX, clientY) {
    const el = scrollRef.current
    const zoomEl = zoomElRef.current
    const { ZOOM_MIN, ZOOM_MAX } = zoomLimits()
    const clampedZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom))

    if (!el || !zoomEl) {
      zoomRef.current = clampedZoom
      setZoom(clampedZoom)
      return
    }

    const oldScale = zoomRef.current / 100
    const newScale = clampedZoom / 100

    // Anchor point in scroll-container space.
    //
    // When a cursor position is supplied (wheel/pinch zoom), anchor there.
    // Otherwise (toolbar +/− and keyboard shortcuts) honor the configured
    // `canvas.zoom.origin`:
    //   - "center"   → viewport center (default; matches native canvas)
    //   - "top-left" → the scroll container's top-left, which keeps the
    //                  canvas's (0, 0) pinned to the viewport top-left
    //                  through any zoom — useful for landing canvases
    //                  with top-left-anchored content.
    const rect = el.getBoundingClientRect()
    const cursorProvided = clientX != null && clientY != null
    let anchorX
    let anchorY
    if (cursorProvided) {
      anchorX = clientX - rect.left
      anchorY = clientY - rect.top
    } else if (interactionRef.current?.zoomOrigin === 'top-left') {
      anchorX = 0
      anchorY = 0
    } else {
      anchorX = el.clientWidth / 2
      anchorY = el.clientHeight / 2
    }

    // Anchor → canvas coordinate
    const canvasX = (el.scrollLeft + anchorX) / oldScale
    const canvasY = (el.scrollTop + anchorY) / oldScale

    // Imperative DOM update — no React re-render
    zoomRef.current = clampedZoom
    zoomEl.style.transform = `scale(${newScale})`
    zoomEl.style.width = getZoomLayoutWidth(newScale, interactionRef.current?.surface)
    zoomEl.style.height = getZoomLayoutHeight(newScale, interactionRef.current?.surface)

    // Hint GPU compositing during active zoom
    zoomEl.dataset.zooming = ''

    // Scroll so the same canvas point stays under the anchor
    el.scrollLeft = canvasX * newScale - anchorX
    el.scrollTop = canvasY * newScale - anchorY

    viewportSessionRef.current.capture(el, clampedZoom, { overridePending: true })

    // Debounced commit: update React state for toolbar display + persistence
    clearTimeout(zoomCommitTimer.current)
    zoomCommitTimer.current = setTimeout(() => {
      // Remove GPU compositing hint
      delete zoomEl.dataset.zooming
      setZoom(clampedZoom)
    }, 150)

    // Throttled zoom-changed event for external consumers (toolbar)
    if (!zoomEventTimer.current) {
      zoomEventTimer.current = setTimeout(() => {
        zoomEventTimer.current = null
        const bridge = window[CANVAS_BRIDGE_STATE_KEY] || {}
        bridge.active = true
        bridge.canvasId = activeCanvasIdRef.current
        bridge.zoom = zoomRef.current
        window[CANVAS_BRIDGE_STATE_KEY] = bridge
        document.dispatchEvent(new CustomEvent('storyboard:canvas:zoom-changed', {
          detail: { zoom: zoomRef.current }
        }))
      }, 100)
    }
  }

  // Signal canvas mount/unmount to CoreUIBar
  useEffect(() => {
    const bridge = window[CANVAS_BRIDGE_STATE_KEY] || {}
    bridge.active = true
    bridge.canvasId = canvasId
    bridge.zoom = zoomRef.current
    window[CANVAS_BRIDGE_STATE_KEY] = bridge
    document.dispatchEvent(new CustomEvent('storyboard:canvas:mounted', {
      detail: { canvasId, zoom: zoomRef.current }
    }))

    // While the canvas is active, suppress the browser's visual-viewport
    // pinch zoom across the entire page. CSS `touch-action: pan-x pan-y`
    // on `<html>` is honored by Android Chrome and desktop touch
    // surfaces; iOS Safari needs the JS `gesturestart` preventDefault
    // already installed on document. Restore the previous value on
    // unmount so prototype routes are unaffected.
    const htmlEl = document.documentElement
    const prevTouchAction = htmlEl.style.touchAction
    htmlEl.style.touchAction = 'pan-x pan-y'

    function handleStatusRequest() {
      const state = window[CANVAS_BRIDGE_STATE_KEY] || { active: true, canvasId, zoom: zoomRef.current }
      document.dispatchEvent(new CustomEvent('storyboard:canvas:status', { detail: state }))
    }

    document.addEventListener('storyboard:canvas:status-request', handleStatusRequest)

    return () => {
      document.removeEventListener('storyboard:canvas:status-request', handleStatusRequest)
      htmlEl.style.touchAction = prevTouchAction
      window[CANVAS_BRIDGE_STATE_KEY] = { active: false, canvasId: '', zoom: 100 }
      document.dispatchEvent(new CustomEvent('storyboard:canvas:unmounted', { detail: { canvasId } }))
    }
  }, [canvasId])

  // --- Selected widgets bridge ---
  // Writes .selectedwidgets.json so Copilot knows which canvas/widgets are active.
  // Uses a stable tabId to survive WebSocket reconnects.
  const selectionTabIdRef = useRef(Math.random().toString(36).slice(2, 10))

  // Gather selected widget data from refs (safe for callbacks/timeouts)
  const getSelectedWidgetData = useCallback(() => {
    const ids = [...selectedIdsRef.current]
    const widgets = (stateRef.current.widgets || [])
      .filter(w => ids.includes(w.id))
      .map(w => ({ id: w.id, type: w.type, props: w.props }))

    // Include jsx-* component selections
    for (const id of ids) {
      if (id.startsWith('jsx-') && !widgets.some(w => w.id === id)) {
        widgets.push({ id, type: 'component', props: { exportName: id.slice(4) } })
      }
    }

    return { widgetIds: ids, widgets }
  }, [])

  // Send focus event on mount, tab focus, and visibility change
  useEffect(() => {
    if (!import.meta.hot) return

    const tabId = selectionTabIdRef.current

    function sendFocus() {
      const { widgetIds, widgets } = getSelectedWidgetData()
      const viewport = getViewportData()
      import.meta.hot.send('storyboard:canvas-focused', { tabId, canvasId, widgetIds, widgets, viewport })
    }

    sendFocus()

    function handleVisibility() {
      if (!document.hidden) sendFocus()
    }
    function handleFocus() { sendFocus() }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      import.meta.hot.send('storyboard:canvas-unfocused', { tabId })
    }
  }, [canvasId, getSelectedWidgetData])

  // Debounced selection change (500ms) — reads from refs at fire time
  useEffect(() => {
    if (!import.meta.hot) return

    const tabId = selectionTabIdRef.current
    const timer = setTimeout(() => {
      const { widgetIds, widgets } = getSelectedWidgetData()
      const viewport = getViewportData()
      import.meta.hot.send('storyboard:selection-changed', { tabId, canvasId, widgetIds: widgetIds, widgets, viewport })
    }, 500)

    return () => clearTimeout(timer)
  }, [selectedWidgetIds, canvasId, getSelectedWidgetData])

  // Add a widget by type — used by CanvasControls and CoreUIBar event
  const addWidget = useCallback(async (type, extraProps = {}, { near, direction } = {}) => {
    const defaultProps = schemas[type] ? getDefaults(schemas[type]) : {}
    // For terminal/agent, apply config-based dimension defaults over schema defaults
    if (type === 'terminal' || type === 'agent') {
      const dims = getTerminalDimensions(extraProps.agentId, { width: defaultProps.width ?? 800, height: defaultProps.height ?? 450 })
      defaultProps.width = dims.width
      defaultProps.height = dims.height
    }
    const mergedProps = { ...defaultProps, ...extraProps }
    const center = getViewportCenter(scrollRef.current, zoomRef.current / 100)
    const pos = near ? undefined : centerPositionForWidget(center, type, mergedProps)
    try {
      const result = await createWidget(canvasId, {
        type,
        props: mergedProps,
        position: pos,
        near,
        direction,
      })
      if (result.success && result.widget) {
        // Guard against duplicates: HMR may have already pushed the new widget
        // into localWidgets before the API response returns (race condition).
        setLocalWidgets((prev) => {
          const arr = prev || []
          if (arr.some((w) => w.id === result.widget.id)) return arr
          return [...arr, result.widget]
        })
        setSelectedWidgetIds(new Set([result.widget.id]))
        if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
      }
    } catch (err) {
      console.error('[canvas] Failed to add widget:', err)
    }
  }, [canvasId, undoRedo, createWidget])

  // Add a story widget by storyId — used by CanvasControls story picker
  const addStoryWidget = useCallback(async (storyId) => {
    const storyProps = { storyId, exportName: '', width: 600, height: 400 }
    const center = getViewportCenter(scrollRef.current, zoomRef.current / 100)
    const pos = centerPositionForWidget(center, 'story', storyProps)
    try {
      const result = await createWidget(canvasId, {
        type: 'story',
        props: storyProps,
        position: pos,
      })
      if (result.success && result.widget) {
        setLocalWidgets((prev) => {
          const arr = prev || []
          if (arr.some((w) => w.id === result.widget.id)) return arr
          return [...arr, result.widget]
        })
        setSelectedWidgetIds(new Set([result.widget.id]))
        if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
      }
    } catch (err) {
      console.error('[canvas] Failed to add story widget:', err)
    }
  }, [canvasId, undoRedo, createWidget])

  // Listen for CoreUIBar add-widget and update-widget events
  useEffect(() => {
    function handleAddWidget(e) {
      const { type, props, near, direction } = e.detail
      addWidget(type, props, { near, direction })
    }
    function handleAddStoryWidget(e) {
      addStoryWidget(e.detail.storyId)
    }
    function handleUpdateWidget(e) {
      const { widgetId, updates } = e.detail || {}
      if (widgetId && updates) handleWidgetUpdate(widgetId, updates)
    }
    document.addEventListener('storyboard:canvas:add-widget', handleAddWidget)
    document.addEventListener('storyboard:canvas:add-story-widget', handleAddStoryWidget)
    document.addEventListener('storyboard:canvas:update-widget', handleUpdateWidget)
    return () => {
      document.removeEventListener('storyboard:canvas:add-widget', handleAddWidget)
      document.removeEventListener('storyboard:canvas:add-story-widget', handleAddStoryWidget)
      document.removeEventListener('storyboard:canvas:update-widget', handleUpdateWidget)
    }
  }, [addWidget, addStoryWidget, handleWidgetUpdate])

  // Listen for zoom changes from CoreUIBar
  useEffect(() => {
    function handleZoom(e) {
      const { zoom: newZoom } = e.detail
      if (typeof newZoom === 'number') {
        applyZoom(newZoom)
      }
    }
    document.addEventListener('storyboard:canvas:set-zoom', handleZoom)
    return () => document.removeEventListener('storyboard:canvas:set-zoom', handleZoom)
  }, [])

  // Listen for Auto place toggle from CoreUIBar.
  useEffect(() => {
    function handleAutoPlaceToggle() {
      setNudgeTargetIds((previous) => previous.size ? new Set() : previous)
      setAutoPlaceEnabled((prev) => {
        const next = !prev
        updateCanvas(canvasId, { settings: { autoPlace: next } }).catch((err) =>
          console.error('[canvas] Failed to persist Auto place setting:', err)
        )
        return next
      })
    }
    document.addEventListener('storyboard:canvas:toggle-auto-place', handleAutoPlaceToggle)
    return () => document.removeEventListener('storyboard:canvas:toggle-auto-place', handleAutoPlaceToggle)
  }, [canvasId])

  // Broadcast Auto place state to toolbar.
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('storyboard:canvas:auto-place-state', {
      detail: { enabled: autoPlaceEnabled }
    }))
    autoPlaceEnabledRef.current = autoPlaceEnabled
  }, [autoPlaceEnabled])

  // Respond to toolbar state requests (handles mount-order race).
  useEffect(() => {
    function handleRequest() {
      document.dispatchEvent(new CustomEvent('storyboard:canvas:auto-place-state', {
        detail: { enabled: autoPlaceEnabledRef.current }
      }))
    }
    document.addEventListener('storyboard:canvas:auto-place-state-request', handleRequest)
    return () => document.removeEventListener('storyboard:canvas:auto-place-state-request', handleRequest)
  }, [])

  // Listen for zoom-to-fit from CoreUIBar
  useEffect(() => {
    function handleZoomToFit() {
      const el = scrollRef.current
      if (!el) return

      const bounds = computeCanvasBounds(localWidgets, componentEntries)
      if (!bounds) return

      const boxW = bounds.maxX - bounds.minX + FIT_PADDING * 2
      const boxH = bounds.maxY - bounds.minY + FIT_PADDING * 2

      const viewW = el.clientWidth
      const viewH = el.clientHeight

      // Find the zoom level that fits the bounding box in the viewport
      const fitScale = Math.min(viewW / boxW, viewH / boxH)
      const { ZOOM_MIN: zMin, ZOOM_MAX: zMax } = zoomLimits()
      const fitZoom = Math.min(zMax, Math.max(zMin, Math.floor(fitScale * 100)))
      const newScale = fitZoom / 100

      // Imperative DOM update — same path as applyZoom
      zoomRef.current = fitZoom
      const zoomEl = zoomElRef.current
      if (zoomEl) {
        zoomEl.style.transform = `scale(${newScale})`
        zoomEl.style.width = getZoomLayoutWidth(newScale, interactionRef.current?.surface)
        zoomEl.style.height = getZoomLayoutHeight(newScale, interactionRef.current?.surface)
      }
      setZoom(fitZoom)

      // Scroll so the bounding box top-left (with padding) is at viewport top-left
      el.scrollLeft = (bounds.minX - FIT_PADDING) * newScale
      el.scrollTop = (bounds.minY - FIT_PADDING) * newScale

      // Intentional framing supersedes a pending saved viewport.
      const state = viewportSession.capture(el, fitZoom, { overridePending: true })
      saveViewportState(canvasId, state, viewportScope)
    }
    document.addEventListener('storyboard:canvas:zoom-to-fit', handleZoomToFit)
    return () => document.removeEventListener('storyboard:canvas:zoom-to-fit', handleZoomToFit)
  }, [localWidgets, componentEntries, viewportSession, viewportScope, canvasId])

  // ── Prototype fullscreen (immersive mode) ──────────────────────────
  const fullscreenWidgetRef = useRef(null)

  useEffect(() => () => {
    if (document.documentElement.classList.contains('storyboard-canvas-immersive')) {
      document.documentElement.classList.remove('storyboard-canvas-immersive')
      applyHideUIFromUrl()
    }
  }, [])

  useEffect(() => {
    function handlePrototypeFullscreen() {
      // EXIT: if already in fullscreen, signal exit (triggers animated close)
      if (fullscreenWidgetRef.current) {
        document.dispatchEvent(new CustomEvent('storyboard:canvas:widget-fullscreen-exit', {
          detail: { widgetId: fullscreenWidgetRef.current }
        }))
        fullscreenWidgetRef.current = null
        // Chrome restoration happens after fade-out animation in PrototypeEmbed onClose
        return
      }

      // ENTER: find selected prototype widget
      const selected = selectedIdsRef.current
      if (!selected || selected.size === 0) return

      const widgets = localWidgets ?? []
      let targetWidget = null
      for (const id of selected) {
        const w = widgets.find((w) => w.id === id)
        if (w && w.type === 'prototype') {
          targetWidget = w
          break
        }
      }
      if (!targetWidget) return

      fullscreenWidgetRef.current = targetWidget.id

      // Temporary fullscreen presentation does not change the shareable URL.
      document.documentElement.classList.add('storyboard-canvas-immersive')

      // Hide toolbar
      document.documentElement.classList.add('storyboard-chrome-hidden')
      document.documentElement.classList.add('storyboard-chrome-completely-hidden')

      // Signal widget to enter fullscreen (renders fixed overlay with iframe)
      document.dispatchEvent(new CustomEvent('storyboard:canvas:widget-fullscreen', {
        detail: { widgetId: targetWidget.id }
      }))
    }

    function handleFullscreenExit() {
      // Only restore chrome if CanvasPage was the one that hid it (keyboard shortcut path)
      if (fullscreenWidgetRef.current) {
        document.documentElement.classList.remove('storyboard-canvas-immersive')
        applyHideUIFromUrl()
      }
      fullscreenWidgetRef.current = null
    }

    document.addEventListener('storyboard:canvas:prototype-fullscreen', handlePrototypeFullscreen)
    document.addEventListener('storyboard:canvas:widget-fullscreen-exit', handleFullscreenExit)
    document.addEventListener('storyboard:canvas:immersive-closed', handleFullscreenExit)
    return () => {
      document.removeEventListener('storyboard:canvas:prototype-fullscreen', handlePrototypeFullscreen)
      document.removeEventListener('storyboard:canvas:widget-fullscreen-exit', handleFullscreenExit)
      document.removeEventListener('storyboard:canvas:immersive-closed', handleFullscreenExit)
    }
  }, [localWidgets])

  // Canvas background should follow toolbar theme target.
  useEffect(() => {
    function readMode() {
      setCanvasTheme(resolveCanvasThemeFromStorage())
    }

    readMode()
    document.addEventListener('storyboard:theme:changed', readMode)
    return () => document.removeEventListener('storyboard:theme:changed', readMode)
  }, [])

  // Broadcast zoom level to CoreUIBar whenever it changes
  useEffect(() => {
    const bridge = window[CANVAS_BRIDGE_STATE_KEY] || {}
    bridge.active = true
    bridge.canvasId = canvasId
    bridge.zoom = zoom
    window[CANVAS_BRIDGE_STATE_KEY] = bridge
    document.dispatchEvent(new CustomEvent('storyboard:canvas:zoom-changed', {
      detail: { zoom }
    }))
  }, [canvasId, zoom])

  // Keep bridge in sync with widgets/connectors for expand features.
  // Child widgets now use props directly for split-screen gating, but
  // FigmaEmbed/PrototypeEmbed/etc. still read this bridge at expand time.
  useEffect(() => {
    const bridge = window[CANVAS_BRIDGE_STATE_KEY] || {}
    bridge.widgets = localWidgets
    bridge.connectors = localConnectors
    window[CANVAS_BRIDGE_STATE_KEY] = bridge
    // Notify subscribers (e.g. split-screen secondary panes) that the bridge
    // has fresh widget data so they can re-read live content.
    document.dispatchEvent(new CustomEvent('storyboard:canvas:bridge-updated'))
  }, [localWidgets, localConnectors])

  // ── Done agents: surface readiness in the collab bar ──
  // Derives the list of agent widgets currently in `done` state from
  // localWidgets, broadcasts changes for AgentsReadyTrigger, and centers the viewport on a target
  // agent when the trigger asks (without selecting it).
  const doneAgents = useMemo(() => {
    const widgets = localWidgets ?? []
    const out = []
    for (const w of widgets) {
      if (!isAgentWidget(w)) continue
      if (w?.props?.status === 'done') {
        out.push({ id: w.id, type: w.type, alias: w.props?.alias || null })
      }
    }
    return out
  }, [localWidgets])

  const workingAgents = useMemo(() => {
    const widgets = localWidgets ?? []
    const out = []
    for (const w of widgets) {
      if (!isAgentWidget(w)) continue
      if (w?.props?.status === 'working') {
        out.push({ id: w.id, type: w.type, alias: w.props?.alias || null })
      }
    }
    return out
  }, [localWidgets])

  // Broadcast doneAgents to the collab bar (snapshots on demand too).
  useEffect(() => {
    const detail = { canvasId, doneAgents, workingAgents }
    document.dispatchEvent(new CustomEvent('storyboard:done-agents-changed', { detail }))
    function handleRequest() {
      document.dispatchEvent(new CustomEvent('storyboard:done-agents-changed', { detail }))
    }
    document.addEventListener('storyboard:done-agents-request', handleRequest)
    return () => document.removeEventListener('storyboard:done-agents-request', handleRequest)
  }, [canvasId, doneAgents, workingAgents])

  // Persist agent status updates from the Hypercanvas server directly
  // on the matching widget. PromptWidget/TerminalWidget also subscribe
  // for their internal state, but routing through handleWidgetUpdate here
  // guarantees `props.status` lands in localWidgets — driving the
  // collab-bar count and the green chrome outline.
  useEffect(() => {
    function handler(data) {
      const widgetId = data?.widgetId
      if (!widgetId) return
      const widgets = stateRef.current.widgets ?? []
      const widget = widgets.find((w) => w?.id === widgetId)
      if (!widget) return
      let nextStatus = null
      if (data.status === 'done' || data.status === 'completed') nextStatus = 'done'
      else if (data.status === 'error') nextStatus = 'error'
      else if (data.status === 'cancelled') nextStatus = 'idle'
      else if (data.status === 'working') nextStatus = 'working'
      else if (data.status === 'running' || data.status === 'pending') nextStatus = 'running'
      if (!nextStatus) return
      if (widget.props?.status === nextStatus) return
      const updates = { status: nextStatus }
      if (nextStatus === 'error' && data.message) updates.errorMessage = data.message
      handleWidgetUpdateRef.current?.(widgetId, updates)
    }
    storyboardWs.on('storyboard:agent-status', handler)
    return () => storyboardWs.off('storyboard:agent-status', handler)
  }, [])

  // Pan/zoom the viewport to center a specific widget without selecting it.
  // Mirrors the `?widget=<id>` URL handling. Used by AgentsReadyTrigger.
  useEffect(() => {
    function handleCenterOnWidget(e) {
      const targetId = e?.detail?.widgetId
      if (!targetId) return
      const el = scrollRef.current
      if (!el) return
      const widgets = localWidgets ?? []
      const widget = widgets.find((wgt) => wgt.id === targetId)
      if (!widget) return
      const fallback = WIDGET_FALLBACK_SIZES[widget.type] || { width: 200, height: 150 }
      const x = widget.position?.x ?? 0
      const y = widget.position?.y ?? 0
      const w = widget.props?.width ?? fallback.width
      const h = widget.props?.height ?? fallback.height

      // Zoom in (to at least 100%) so the agent is comfortably visible.
      const { ZOOM_MIN, ZOOM_MAX } = zoomLimits()
      const targetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.max(zoomRef.current || 100, 100)))
      const newScale = targetZoom / 100
      if (targetZoom !== zoomRef.current) {
        zoomRef.current = targetZoom
        const zoomEl = zoomElRef.current
        if (zoomEl) {
          zoomEl.style.transform = `scale(${newScale})`
          zoomEl.style.width = getZoomLayoutWidth(newScale, interactionRef.current?.surface)
          zoomEl.style.height = getZoomLayoutHeight(newScale, interactionRef.current?.surface)
        }
        setZoom(targetZoom)
      }

      el.scrollTo({
        left: (x + w / 2) * newScale - el.clientWidth / 2,
        top: (y + h / 2) * newScale - el.clientHeight / 2,
        behavior: 'instant',
      })
    }
    document.addEventListener('storyboard:canvas:center-on-widget', handleCenterOnWidget)
    return () => document.removeEventListener('storyboard:canvas:center-on-widget', handleCenterOnWidget)
  }, [localWidgets])

  // Delete selected widget on Delete/Backspace key
  useEffect(() => {
    function handleSelectStart(e) {
      if (shouldPreventCanvasTextSelection(e.target)) {
        e.preventDefault()
      }
    }
    document.addEventListener('selectstart', handleSelectStart)
    return () => document.removeEventListener('selectstart', handleSelectStart)
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (selectedWidgetIds.size === 0) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedWidgetIds(new Set())
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const widgetIds = [...selectedWidgetIds]
        if (widgetIds.length === 1) {
          void handleWidgetRemove(widgetIds[0])
          return
        }
        // Keep the established keyboard deletion behavior while grouping all
        // member removals into one visible Undo entry.
        const runDelete = async () => {
          await writeQueueRef.current
          const historyBatch = undoRedo.beginBatch()
          activeSelectionHistoryBatchRef.current = { token: historyBatch, widgetIds: new Set(widgetIds) }
          try {
            await Promise.all(widgetIds.map(widgetId => handleWidgetRemove(widgetId)))
          } finally {
            flushAllPendingWidgetPatches()
            await writeQueueRef.current
            activeSelectionHistoryBatchRef.current = null
            undoRedo.endBatch(historyBatch)
          }
        }
        const queued = selectionActionQueueRef.current.then(runDelete, runDelete)
        selectionActionQueueRef.current = queued.catch(error => {
          console.error('[canvas] Multi-selection delete failed:', error)
        })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedWidgetIds, handleWidgetRemove, flushAllPendingWidgetPatches, undoRedo])

  // Native copy preserves the browser's user gesture and does not require
  // asynchronous clipboard permission. Editors and text selection keep their own copy.
  useEffect(() => {
    function handleCopy(event) {
      copySelectedCanvasWidgets(event, selectedIdsRef.current, canvasId)
    }
    document.addEventListener('copy', handleCopy, true)
    return () => document.removeEventListener('copy', handleCopy, true)
  }, [canvasId])

  // The canvas owns image pastes intended for an active, single-selected
  // agent. Capture before Ghostty's input handler so no binary image data is
  // sent to the terminal or accidentally turned into a canvas image widget.
  useEffect(() => {
    let mounted = true

    async function handleAgentScreenshotPaste(event) {
      if (event.defaultPrevented) return
      const match = resolveAgentScreenshotPaste(
        selectedIdsRef.current,
        stateRef.current.widgets,
        event.clipboardData,
      )
      if (!match) return

      const { widgetId, file } = match
      const owner = event.target?.closest?.('[data-widget-id]')
      // A focused editor or a different widget must retain its own paste.
      if (owner && owner.getAttribute('data-widget-id') !== widgetId) return
      const editable = event.target?.closest?.('input, textarea, [contenteditable="true"]')
      if (editable && (editable.tagName === 'INPUT' || owner?.getAttribute('data-widget-id') !== widgetId)) return

      event.preventDefault()
      event.stopPropagation()
      try {
        const dataUrl = await imageFileToPngDataUrl(file)
        const saved = await uploadAgentScreenshot(dataUrl)
        if (!saved?.success || !saved.filename) {
          throw new Error(saved?.error || 'Screenshot upload failed')
        }
        if (!mounted) return

        // Uploads are asynchronous: never redirect the shortcode to another
        // selection or through a newly reactivated interact gate.
        const selected = selectedIdsRef.current
        const terminal = selected?.size === 1 && selected.has(widgetId)
          ? getActiveAgentPasteTarget(widgetId)
          : null
        if (!terminal?.pasteText('[' + saved.filename + ']')) {
          showToast('Screenshot saved in assets/screenshots/' + saved.filename + '; agent is no longer interactive')
        }
      } catch (error) {
        if (!mounted) return
        console.error('[canvas] Agent screenshot paste failed:', error)
        showToast('Could not paste screenshot: ' + (error?.message || 'unknown error'))
      }
    }

    document.addEventListener('paste', handleAgentScreenshotPaste, true)
    return () => {
      mounted = false
      document.removeEventListener('paste', handleAgentScreenshotPaste, true)
    }
  }, [])

  // Ref to store processImageFile for use by drop effect
  const processImageFileRef = useRef(null)

  // Paste and drop handler — images become image widgets, same-origin URLs become prototypes,
  // other URLs become link previews, text becomes markdown
  useEffect(() => {
    const origin = window.location.origin
    const basePath = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '')
    const pasteCtx = createPasteContext(origin, basePath)

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    function getImageDimensions(dataUrl) {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({ width: 400, height: 300 })
        img.src = dataUrl
      })
    }

    /**
     * Process an image file (from paste or drop) and add it as a widget.
     * @param {File|Blob} file - Image file to process
     * @param {{ x: number, y: number }|null} position - Drop position, or null to use viewport center
     */
    async function processImageFile(file, position = null) {
      try {
        const dataUrl = await blobToDataUrl(file)
        const { width: natW, height: natH } = await getImageDimensions(dataUrl)

        // Display at 2x retina: halve natural dimensions, then cap at 600px
        const maxWidth = 600
        let displayW = Math.round(natW / 2)
        let displayH = Math.round(natH / 2)
        if (displayW > maxWidth) {
          displayH = Math.round(displayH * (maxWidth / displayW))
          displayW = maxWidth
        }

        const uploadResult = await uploadImage(dataUrl, canvasId)
        if (!uploadResult.success) {
          console.error('[canvas] Image upload failed:', uploadResult.error)
          return false
        }

        // Use provided position or fall back to viewport center
        let pos
        if (position) {
          pos = { x: position.x, y: position.y }
        } else {
          const center = getViewportCenter(scrollRef.current, zoomRef.current / 100)
          pos = centerPositionForWidget(center, 'image', { width: displayW, height: displayH })
        }

        const result = await createWidget(canvasId, {
          type: 'image',
          props: { src: uploadResult.filename, private: false, width: displayW, height: displayH },
          position: pos,
        })
        if (result.success && result.widget) {
          setLocalWidgets((prev) => appendLocalWidgets(prev, result.widget))
          setSelectedWidgetIds(new Set([result.widget.id]))
          void copyCanvasText(result.widget.id, 'image ID')
          if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
        }
        return true
      } catch (err) {
        console.error('[canvas] Failed to process image:', err)
        return false
      }
    }

    // Store in ref for use by drag/drop effect
    processImageFileRef.current = processImageFile

    async function handleImagePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return false

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue

        const blob = item.getAsFile()
        if (!blob) continue

        e.preventDefault()
        await processImageFile(blob, null)
        return true
      }
      return false
    }

    async function handlePaste(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return

      // Image paste takes priority
      const handledImage = await handleImagePaste(e)
      if (handledImage) return

      const originalSource = e.clipboardData?.getData('text/plain') ?? ''
      const text = originalSource.trim()
      if (!text) return

      // Detect canvasId::widgetId or canvasId::id1,id2,id3 format for widget duplication
      // Also supports legacy canvasId/widgetId for basenames without slashes,
      // but only when the second segment looks like a widget ID (type-hash).
      const widgetRefMatch = text.match(/^(.+)::([^:]+)$/) || (text.indexOf('::') === -1 && text.match(/^([^/]+)\/((?:sticky-note|markdown|prototype|link-preview|figma-embed|component|image)-[a-z0-9]+)$/))
      if (widgetRefMatch) {
        e.preventDefault()
        const [, sourceCanvas, sourceWidgetRef] = widgetRefMatch
        const sourceWidgetIds = sourceWidgetRef.split(',').filter(id => !id.startsWith('jsx-'))
        if (sourceWidgetIds.length === 0) return

        try {
          // Resolve source widgets in canvas order
          let sourceList
          if (sourceCanvas === canvasId) {
            sourceList = localWidgets ?? []
          } else {
            const canvasData = await getCanvasApi(sourceCanvas)
            sourceList = canvasData?.widgets ?? []
          }

          const sourceWidgets = sourceList.filter(w => sourceWidgetIds.includes(w.id))
          if (sourceWidgets.length === 0) return

          // Compute bounding box of source widgets for relative positioning
          const fallback = { width: 200, height: 150 }
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const w of sourceWidgets) {
            const wx = w.position?.x ?? 0
            const wy = w.position?.y ?? 0
            const ww = w.props?.width ?? WIDGET_FALLBACK_SIZES[w.type]?.width ?? fallback.width
            const wh = w.props?.height ?? WIDGET_FALLBACK_SIZES[w.type]?.height ?? fallback.height
            if (wx < minX) minX = wx
            if (wy < minY) minY = wy
            if (wx + ww > maxX) maxX = wx + ww
            if (wy + wh > maxY) maxY = wy + wh
          }
          const groupW = maxX - minX
          const groupH = maxY - minY

          // Center the group in the viewport
          const center = getViewportCenter(scrollRef.current, zoomRef.current / 100)
          const baseX = Math.round(center.x - groupW / 2)
          const baseY = Math.round(center.y - groupH / 2)

          // Paste all widgets, collecting new IDs for selection
          const newWidgets = []
          const eventIds = []
          for (const w of sourceWidgets) {
            const relX = (w.position?.x ?? 0) - minX
            const relY = (w.position?.y ?? 0) - minY
            const pasteProps = { ...w.props }
            if (w.type === 'terminal' || w.type === 'agent') delete pasteProps.prettyName
            // Image widgets: duplicate the asset so the paste owns its own copy
            if (w.type === 'image' && pasteProps.src) {
              try {
                const dupResult = await duplicateImage(pasteProps.src)
                if (dupResult.success) pasteProps.src = dupResult.filename
              } catch { /* use original src as fallback */ }
            }
            const result = await createWidget(canvasId, {
              type: w.type,
              props: pasteProps,
              position: { x: baseX + relX, y: baseY + relY },
            })
            if (result.success && result.widget) {
              newWidgets.push(result.widget)
              eventIds.push(...(result.eventIds || [result.eventId]).filter(Boolean))
            }
          }

          if (newWidgets.length > 0) {
            setLocalWidgets((prev) => appendLocalWidgets(prev, newWidgets))
            setSelectedWidgetIds(new Set(newWidgets.map(w => w.id)))
          }
          if (eventIds.length > 0) undoRedo.trackMany(eventIds)
        } catch (err) {
          console.error('[canvas] Failed to paste widget reference:', err)
        }
        // Always consume the ref — never fall through to markdown creation
        return
      }

      e.preventDefault()
      await pasteTextAsWidget(text, pasteCtx, originalSource)
    }

    // Shared helper: resolve pasted text into a widget and add it to the canvas.
    // Used by both native paste and the programmatic paste-url event.
    async function pasteTextAsWidget(text, pasteCtx, originalSource = text) {
      // Pre-check: does the pasted text look like a repo-relative file path?
      // If so, verify with the server and create a `file` widget instead of
      // running the URL-based paste rules. Path heuristic: no scheme, no
      // leading slash, no whitespace, contains a known text extension.
      if (
        /^[A-Za-z0-9._-][A-Za-z0-9./_-]*\.(md|markdown|mdx|jsx?|tsx?|json|css|scss|html?|ya?ml|svg|xml|toml|ini|env|sh|py|rb|go|rs|java|cpp|hpp|c|h|txt|log|config)$/i.test(text)
        && !text.startsWith('/')
        && !text.includes('://')
      ) {
        try {
          const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
          const res = await fetch(`${base}/_hypercanvas/file/exists?path=${encodeURIComponent(text)}`)
          const data = await res.json().catch(() => ({}))
          if (data?.exists) {
            const center = getViewportCenter(scrollRef.current, zoomRef.current / 100)
            const pos = centerPositionForWidget(center, 'file', { path: text })
            const result = await createWidget(canvasId, {
              type: 'file',
              props: { path: text },
              position: pos,
            })
            if (result.success && result.widget) {
              setLocalWidgets((prev) => appendLocalWidgets(prev, result.widget))
              setSelectedWidgetIds(new Set([result.widget.id]))
              if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
            }
            return
          }
        } catch {
          // Fall through to normal paste rules on error
        }
      }

      const resolved = resolvePaste(text, pasteCtx, getPasteRules())
      if (pasteCtx.isSameOrigin(text)) {
        let pages = []
        try { pages = (await coreRequestJson('/_hypercanvas/notebook/pages')).pages || [] }
        catch { /* Legacy projects still resolve stories through the live index. */ }
        const artifact = resolveArtifactRendering(text, pasteCtx, { pages, stories: storyIndex })
        if (artifact) {
          await addResolvedWidget(artifact)
          return
        }
      }
      const siteResolved = await resolvePastedSite(text, pasteCtx)
      if (siteResolved) {
        if (siteResolved.type === 'site-create') {
          document.dispatchEvent(new CustomEvent('storyboard:open-site-create', { detail: siteResolved.props }))
        } else await addResolvedWidget(siteResolved)
        return
      }
      // A locally hosted site that isn't served by this Storyboard instance
      // should use the standard prototype iframe widget, which provides the
      // full embed chrome and interactions (resize, copy, fullscreen, split).
      const parsedUrl = pasteCtx.parseUrl(text)
      if (parsedUrl && isLocalSiteUrl(parsedUrl) && !pasteCtx.isSameOrigin(text)) {
        await addResolvedWidget({
          type: 'prototype',
          props: { src: text, width: 800, height: 600 },
        })
        return
      }
      if (!resolved) return
      let { type } = resolved
      let props = resolved.props

      // URL rules retain first refusal. Only the catch-all Markdown route is
      // classified as code, so existing link/service routing stays unchanged.
      if (type === 'markdown') {
        const { classifyPastedText } = await import('./widgets/pasteClassification.js')
        const classification = classifyPastedText(originalSource)
        if (classification.kind === 'code') {
          const { formatPastedCodeMarkdown } = await import('./widgets/pastedCodeMarkdown.js')
          await addResolvedWidget({
            type: 'markdown',
            props: { ...props, content: formatPastedCodeMarkdown(classification) },
          })
          return
        }

        if (classification.kind === 'html' || classification.kind === 'jsx' || classification.kind === 'tsx') {
          let preview = null
          let provider = null
          try {
            provider = await import('../story/createStoryPreview.js')
            preview = await provider.createStoryPreview({
              source: classification.source,
              kind: classification.kind,
              language: classification.language,
              canvasName: canvasId,
            })
          } catch (error) {
            console.warn('[canvas] Pasted UI preview failed:', error)
          }

          if (preview?.status === 'ready') {
            const widget = await addResolvedWidget({
              type: 'story',
              props: {
                storyId: preview.storyId,
                exportName: preview.exportName || 'Default',
                width: 600,
                height: 400,
              },
            })
            if (widget) return
            try {
              await provider?.cleanupStoryPreview?.(preview)
            } catch (error) {
              console.warn('[canvas] Could not clean up failed pasted story:', error)
            }
          }

          const { formatPastedCodeMarkdown } = await import('./widgets/pastedCodeMarkdown.js')
          await addResolvedWidget({
            type: 'markdown',
            props: { ...props, content: formatPastedCodeMarkdown(classification) },
          })
          return
        }
      }

      // Component/story URLs → story widget (instead of prototype embed)
      if (type === 'prototype' && props?.src) {
        const srcPath = props.src.replace(/[?#].*$/, '').replace(/\/+$/, '')
        const storyId = storyRouteIndex.get(srcPath)
        if (storyId) {
          type = 'story'
          const parsed = pasteCtx.parseUrl(text)
          const searchParams = new URLSearchParams(parsed?.search || '')
          props = {
            storyId,
            exportName: searchParams.get('export') || '',
            width: 600,
            height: 400,
          }
        }
      }

      if (type === 'link-preview' && isGitHubEmbedUrl(props?.url || text)) {
        const githubUpdates = await buildGitHubPreviewUpdates(props?.url || text)
        if (githubUpdates) props = { ...props, ...githubUpdates }
      }

      await addResolvedWidget({ type, props })
    }

    async function resolvePastedSite(text, pasteCtx) {
      const parsed = pasteCtx.parseUrl(text)
      if (!parsed) return null
      try {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
        const response = await fetch(`${base}/_hypercanvas/site/list`)
        const data = await response.json()
        const sites = Array.isArray(data?.sites) ? data.sites : []
        // A Core viewer URL identifies a Site, but its route must come from
        // /sites/{id}/, never from the viewer's own path on the dev server.
        const viewerPath = pasteCtx.extractSrc(parsed.pathname)
        const viewerMatch = pasteCtx.isSameOrigin(parsed.href)
          ? viewerPath.match(/^\/sites\/([^/]+)(?:\/(.*))?$/)
          : null
        if (viewerMatch) {
          const site = sites.find(candidate => candidate.id === decodeURIComponent(viewerMatch[1]))
          if (site?.binding?.developmentBaseUrl) {
            const route = `${viewerMatch[2] || ''}${parsed.search}${parsed.hash}`
            return { type: 'site-frame', props: { siteId: site.id, route, title: site.title || site.id, width: 800, height: 600 } }
          }
          // A Core viewer URL cannot be registered as a new development
          // server when its Site no longer exists or is not bound.
          return null
        }
        if (isLocalSiteUrl(parsed)) {
          for (const candidate of sites) {
            const localUrl = candidate.binding?.developmentBaseUrl
            if (!localUrl || !candidate.id) continue
            const route = siteRouteForUrl(parsed.href, localUrl, candidate.id, { siteIdInUrl: false })
            if (route !== null) return { type: 'site-frame', props: { siteId: candidate.id, route, title: candidate.title || candidate.id, width: 800, height: 600 } }
          }
          if (!isSiteLoopbackUrl(parsed)) return null
          const unmatched = parseSiteUrl(parsed.href, { basePath: pasteCtx.basePath, siteIdInUrl: false })
          if (unmatched) return {
            type: 'site-create',
            props: {
              title: unmatched.siteId ? unmatched.siteId.split('-').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ') : '',
              developmentBaseUrl: unmatched.baseUrl,
              route: unmatched.route,
            },
          }
          return null
        }
        for (const candidate of sites) {
          const productionUrl = candidate.deployments?.[candidate.defaultDeployment]?.baseUrl
          if (!productionUrl || !candidate.id) continue
          const route = siteRouteForUrl(parsed.href, productionUrl, candidate.id, { basePath: pasteCtx.basePath })
          if (route !== null) {
            return {
              type: 'prototype',
              props: { src: resolveSiteUrl(productionUrl, candidate.id, route), label: candidate.title || candidate.id, width: 800, height: 600 },
            }
          }
        }
        return null
      } catch { return null }
    }

    async function addResolvedWidget({ type, props }) {
      const center = getViewportCenter(scrollRef.current, zoomRef.current / 100)
      const pos = centerPositionForWidget(center, type, props)
      try {
        const result = await createWidget(canvasId, {
          type,
          props,
          position: pos,
        })
        if (result.success && result.widget) {
          setLocalWidgets((prev) => appendLocalWidgets(prev, result.widget))
          setSelectedWidgetIds(new Set([result.widget.id]))
          if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
          return result.widget
        }
      } catch (err) {
        console.error('[canvas] Failed to add widget from paste:', err)
      }
      return null
    }

    // Listen for programmatic paste-url events from the command palette
    function handlePasteUrl(e) {
      const originalSource = e.detail?.url ?? ''
      const text = originalSource.trim()
      if (!text) return
      pasteTextAsWidget(text, pasteCtx, originalSource)
    }

    function handleSiteCreatedFromPaste(event) {
      const site = event.detail?.site
      if (!site?.id) return
      void addResolvedWidget({
        type: 'site-frame',
        props: { siteId: site.id, route: event.detail?.route || '', title: site.title || site.id, width: 800, height: 600 },
      })
    }

    document.addEventListener('paste', handlePaste)
    document.addEventListener('storyboard:canvas:paste-url', handlePasteUrl)
    document.addEventListener('storyboard:site-created-from-paste', handleSiteCreatedFromPaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('storyboard:canvas:paste-url', handlePasteUrl)
      document.removeEventListener('storyboard:site-created-from-paste', handleSiteCreatedFromPaste)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, undoRedo, localWidgets, createWidget])

  // --- Drag and drop handlers for images from Finder/file manager ---
  // Separate effect to ensure listeners attach after scroll container mounts (loading=false)
  useEffect(() => {
    if (loading) return // Don't attach until canvas is loaded and scroll container exists

    const scrollEl = scrollRef.current
    if (!scrollEl) return

    // Detect VSCode-style drags: dataTransfer carries text/uri-list URIs but
    // no actual File bytes. Without preventDefault, Chrome falls back to
    // navigating to the file:// URL and hits about:blank#blocked.
    function isUriListDrag(dt) {
      if (!dt?.types) return false
      return dt.types.includes('text/uri-list') || dt.types.includes('application/vnd.code.uri-list')
    }

    function handleDragOver(e) {
      const dt = e.dataTransfer
      const isUri = isUriListDrag(dt)
      const isFiles = dt?.types?.includes('Files')
      if (!isFiles && !isUri) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    // Bottom-center toast for failed drops — shared helper (also used by the
    // Notebook dialog) so rejection feedback looks identical everywhere.
    const showDropToast = showToast

    // Group rejection reasons into separate human-readable toasts (so we
    // don't conflate "outside repo" with "unsupported type" in one message).
    function reportRejections(rejections, { repoName } = {}) {
      if (rejections.length === 0) return
      const byReason = new Map()
      for (const r of rejections) {
        const key = r.reason || 'rejected'
        if (!byReason.has(key)) byReason.set(key, [])
        byReason.get(key).push(r)
      }
      for (const [key, items] of byReason) {
        if (key === 'outside_repo') {
          const repo = repoName || 'this'
          showDropToast(`Files outside the ${repo} repository can't be added to canvas`)
        } else if (key === 'unsupported') {
          const exts = [...new Set(items.map((it) => it.ext).filter(Boolean))]
          const list = exts.length ? exts.map((e) => `.${e}`).join(', ') : 'this'
          showDropToast(`Files of (${list}) type can't be added to canvas`)
        } else if (key === 'not_found') {
          showDropToast(`Dropped file could not be found on disk`)
        } else if (key === 'not_file') {
          showDropToast(`Dropped item is not a file`)
        } else if (key === 'invalid') {
          showDropToast(`Dropped file has an invalid path`)
        } else {
          showDropToast(`Dropped file rejected (${key})`)
        }
      }
    }

    // Read image natural dimensions from a URL (already-uploaded image),
    // mirroring the cap logic in processImageFile so VSCode-resolved images
    // size identically to Finder-dropped ones.
    function readDimensions(url) {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({ width: 400, height: 300 })
        img.src = url
      })
    }

    // Parse text/uri-list (RFC 2483): newline-separated, `#` comments ignored.
    // Filter to file:// URIs and decode to absolute filesystem paths.
    function parseUriList(text) {
      return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .filter((line) => line.startsWith('file://'))
        .map((line) => {
          try {
            return decodeURIComponent(new URL(line).pathname)
          } catch {
            return null
          }
        })
        .filter(Boolean)
    }

    async function handleDrop(e) {
      const dt = e.dataTransfer
      const hasFiles = dt?.types?.includes('Files') && dt.files?.length > 0
      const hasUriList = isUriListDrag(dt)
      if (!hasFiles && !hasUriList) return

      // Prevent browser default (opening file / navigating to file://) for any
      // drop we recognize, even if processing later fails.
      e.preventDefault()
      e.stopPropagation()

      // Convert drop coordinates to canvas coordinates (shared across branches)
      const rect = scrollEl.getBoundingClientRect()
      const scale = zoomRef.current / 100
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const canvasX = (scrollEl.scrollLeft + mouseX) / scale
      const canvasY = (scrollEl.scrollTop + mouseY) / scale
      const dropX = Math.round(canvasX)
      const dropY = Math.round(canvasY)

      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

      // ── Branch A: native File drop (Finder, browser file picker) ─────────
      if (hasFiles) {
        const all = Array.from(dt.files)
        const imageFiles = all.filter((f) => f.type.startsWith('image/'))
        const textFiles = all.filter((f) => !f.type.startsWith('image/'))
        if (imageFiles.length === 0 && textFiles.length === 0) return

        for (let i = 0; i < imageFiles.length; i++) {
          const offset = i * 24
          await processImageFileRef.current?.(imageFiles[i], { x: dropX + offset, y: dropY + offset })
        }

        // Process each text file: upload via /_hypercanvas/file/upload and
        // create a `file` widget pointing at the uploaded path.
        for (let i = 0; i < textFiles.length; i++) {
          const f = textFiles[i]
          const offset = (imageFiles.length + i) * 24
          try {
            const content = await f.text()
            const upRes = await fetch(`${base}/_hypercanvas/file/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: f.name, content, encoding: 'utf-8' }),
            })
            const upData = await upRes.json().catch(() => ({}))
            if (!upRes.ok || !upData?.success || !upData?.path) {
              console.error('[canvas] File upload failed:', upData?.error || upRes.statusText)
              continue
            }
            const result = await createWidget(canvasId, {
              type: 'file',
              props: { path: upData.path },
              position: { x: dropX + offset, y: dropY + offset },
            })
            if (result.success && result.widget) {
              setLocalWidgets((prev) => appendLocalWidgets(prev, result.widget))
              setSelectedWidgetIds(new Set([result.widget.id]))
              if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
            }
          } catch (err) {
            console.error('[canvas] Failed to drop text file:', err)
          }
        }
        return
      }

      // ── Branch B: URI-list drop (VSCode Explorer) ────────────────────────
      // VSCode does not include File bytes. We only get text/uri-list with
      // file:// URIs. The server's /resolve endpoint validates each path is
      // inside the repo, copies images into assets/canvas/images, and tells
      // us what kind of widget to create.
      const uriListText =
        dt.getData('application/vnd.code.uri-list') ||
        dt.getData('text/uri-list') ||
        ''
      const absPaths = parseUriList(uriListText)
      if (absPaths.length === 0) return

      let resolveData
      try {
        const resolveRes = await fetch(`${base}/_hypercanvas/file/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: absPaths }),
        })
        resolveData = await resolveRes.json().catch(() => ({}))
        if (!resolveRes.ok || !Array.isArray(resolveData?.results)) {
          console.error('[canvas] /file/resolve failed:', resolveData?.error || resolveRes.statusText)
          showDropToast('Could not resolve dropped files')
          return
        }
      } catch (err) {
        console.error('[canvas] /file/resolve request failed:', err)
        showDropToast('Could not resolve dropped files')
        return
      }

      const rejections = []
      for (let i = 0; i < resolveData.results.length; i++) {
        const r = resolveData.results[i]
        const offset = i * 24
        const pos = { x: dropX + offset, y: dropY + offset }
        if (!r.ok) {
          console.warn('[canvas] dropped file rejected:', r.reason, r.absPath)
          rejections.push(r)
          continue
        }
        if (r.kind === 'image') {
          const url = `${base}/_hypercanvas/canvas/images/${r.src}`
          const { width: natW, height: natH } = await readDimensions(url)
          const maxWidth = 600
          let displayW = Math.round(natW / 2)
          let displayH = Math.round(natH / 2)
          if (displayW > maxWidth) {
            displayH = Math.round(displayH * (maxWidth / displayW))
            displayW = maxWidth
          }
          const result = await createWidget(canvasId, {
            type: 'image',
            props: { src: r.src, private: false, width: displayW, height: displayH },
            position: pos,
          })
          if (result.success && result.widget) {
            setLocalWidgets((prev) => appendLocalWidgets(prev, result.widget))
            setSelectedWidgetIds(new Set([result.widget.id]))
            if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
          }
        } else if (r.kind === 'file') {
          const result = await createWidget(canvasId, {
            type: 'file',
            props: { path: r.path },
            position: pos,
          })
          if (result.success && result.widget) {
            setLocalWidgets((prev) => appendLocalWidgets(prev, result.widget))
            setSelectedWidgetIds(new Set([result.widget.id]))
            if (result.eventIds?.length) undoRedo.trackMany(result.eventIds)
        else if (result.eventId) undoRedo.track(result.eventId)
          }
        }
      }

      reportRejections(rejections, { repoName: resolveData.repoName })
    }

    scrollEl.addEventListener('dragover', handleDragOver)
    scrollEl.addEventListener('drop', handleDrop)

    return () => {
      scrollEl.removeEventListener('dragover', handleDragOver)
      scrollEl.removeEventListener('drop', handleDrop)
    }
  }, [loading, canvasId, createWidget, undoRedo])

  // --- Undo / Redo ---
  // Server-authoritative: POST /undo / POST /redo append an inverse event
  // to the JSONL. We apply the returned inverseEvent to local state
  // immediately — the HMR push that follows the server's append would
  // otherwise be ignored by the dirty-guard above (writes are in flight,
  // so HMR pushes only merge *new* widgets / connectors and skip updates
  // to existing ones). Applying optimistically guarantees the user sees
  // the change without waiting for the next non-dirty HMR push.
  //
  // 404 handling: if the server can't find the target event, it was almost
  // certainly compacted away (compaction collapses history into a single
  // canvas_created baseline). We clear the per-tab stack so the toolbar
  // button greys out instead of silently no-op'ing on every click.
  //
  // Ordering: popUndo / popRedo run *inside* queueWrite — after any
  // in-flight PATCH / batch writes have resolved and called track() with
  // their server-issued event ids. Popping synchronously here would race
  // against the trackMany() callbacks of recently-fired drags or edits
  // and pop the previous event id instead of the latest one (visible in
  // the JSONL as undo entries appearing in the wrong order, e.g. undoing
  // the second-to-last drag before the last one).
  const applyInverseEventLocally = useCallback((inverseEvent) => {
    if (!inverseEvent || typeof inverseEvent !== 'object') return
    const before = {
      widgets: stateRef.current.widgets ?? [],
      connectors: stateRef.current.connectors ?? [],
      sources: stateRef.current.sources ?? [],
      scroll: stateRef.current.scroll ?? { axis: 'both' },
    }
    const after = applyCanvasEvent(before, inverseEvent)
    stateRef.current = { ...stateRef.current, ...after }
    if (after.widgets !== before.widgets) setLocalWidgets(after.widgets)
    if (after.connectors !== before.connectors) setLocalConnectors(after.connectors)
    if (after.sources !== before.sources) setLocalSources(after.sources)
    if (after.scroll?.axis) setScrollAxis(after.scroll.axis)
  }, [])

  const handleUndo = useCallback(() => {
    flushAllPendingWidgetPatches()
    debouncedSourceSave.cancel()
    dirtyRef.current = true
    queueWrite(async () => {
      const entry = undoRedo.popUndo()
      if (!entry) return
      const ids = Array.isArray(entry) ? entry : [entry]
      const inverseIds = []
      try {
        // Reverse event order for one user action. JSX source state and all
        // widget coordinates are restored together, with one redo entry.
        for (const eventId of [...ids].reverse()) {
          const { status, data } = await undoEventApi(canvasId, eventId)
          if (status === 404) {
            console.warn('[canvas] Undo target was compacted away — resetting undo stack')
            undoRedo.reset()
            return
          }
          if (!data?.eventId) throw new Error(data?.error || 'Undo did not return an inverse event')
          inverseIds.push(data.eventId)
          if (data.inverseEvent) applyInverseEventLocally(data.inverseEvent)
        }
        undoRedo.pushRedo(Array.isArray(entry) ? inverseIds : inverseIds[0])
      } catch (err) {
        // Keep the action retryable when a request fails. Inverting a fixed
        // event again restores the same prior geometry.
        undoRedo.pushUndo(entry)
        console.error('[canvas] Failed to persist undo:', err)
      }
    })
  }, [canvasId, debouncedSourceSave, flushAllPendingWidgetPatches, undoRedo, applyInverseEventLocally])

  const handleRedo = useCallback(() => {
    flushAllPendingWidgetPatches()
    debouncedSourceSave.cancel()
    dirtyRef.current = true
    queueWrite(async () => {
      const entry = undoRedo.popRedo()
      if (!entry) return
      const ids = Array.isArray(entry) ? entry : [entry]
      const inverseIds = []
      try {
        for (const eventId of [...ids].reverse()) {
          const { status, data } = await redoEventApi(canvasId, eventId)
          if (status === 404) {
            console.warn('[canvas] Redo target was compacted away — resetting redo stack')
            undoRedo.reset()
            return
          }
          if (!data?.eventId) throw new Error(data?.error || 'Redo did not return an inverse event')
          inverseIds.push(data.eventId)
          if (data.inverseEvent) applyInverseEventLocally(data.inverseEvent)
        }
        undoRedo.pushUndo(Array.isArray(entry) ? inverseIds : inverseIds[0])
      } catch (err) {
        undoRedo.pushRedo(entry)
        console.error('[canvas] Failed to persist redo:', err)
      }
    })
  }, [canvasId, debouncedSourceSave, flushAllPendingWidgetPatches, undoRedo, applyInverseEventLocally])

  // Keyboard shortcuts — dev-only (Cmd+Z / Cmd+Shift+Z / Cmd+D / Cmd+A).
  // Listen in capture phase: xterm.js / ghostty-web call stopPropagation
  // on keydown so a bubble-phase document listener never sees keystrokes
  // from a focused terminal. Capture phase fires before any descendant
  // can stop the event, letting us route Cmd+Z to canvas-undo even when
  // a selected terminal/agent widget owns focus.
  useEffect(() => {
    if (!import.meta.hot) return
    function handleKeyDown(e) {
      const tag = e.target.tagName
      // Bail when focus is inside a real text/code editor so we don't
      // steal the editor's own undo/redo. xterm.js / ghostty-web use
      // a contenteditable wrapper for keystroke plumbing (not a real
      // editor) — Cmd+Z there must go to the canvas, otherwise undoing
      // a multi-move with a selected terminal/agent widget silently
      // no-ops because focus lives in the xterm container.
      const inTerminal = e.target.closest?.('[class*="xtermContainer"]') != null
      if (!inTerminal) {
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      } else {
        // Terminal: still respect real form inputs (e.g. a popover INPUT
        // inside the terminal widget chrome), just not the xterm wrapper itself.
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
      }
      // Don't intercept shortcuts when the command palette is open
      if (e.target.closest?.('[cmdk-root]')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        handleUndo()
      }
      if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        handleRedo()
      }
      if (mod && e.key.toLowerCase() === 'd' && e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        handleDuplicateWithConnectors()
      } else if (mod && e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        handleDuplicateSelected()
      }
      if (mod && e.key === 'a') {
        e.preventDefault()
        e.stopPropagation()
        handleSelectAll()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleUndo, handleRedo, handleDuplicateSelected, handleDuplicateWithConnectors, handleSelectAll])

  // Listen for undo/redo from CoreUIBar
  useEffect(() => {
    function handleUndoEvent() { handleUndo() }
    function handleRedoEvent() { handleRedo() }
    document.addEventListener('storyboard:canvas:undo', handleUndoEvent)
    document.addEventListener('storyboard:canvas:redo', handleRedoEvent)
    return () => {
      document.removeEventListener('storyboard:canvas:undo', handleUndoEvent)
      document.removeEventListener('storyboard:canvas:redo', handleRedoEvent)
    }
  }, [handleUndo, handleRedo])

  // Broadcast undo/redo availability to toolbar
  useEffect(() => {
    function publishUndoRedoState(requestId) {
      document.dispatchEvent(new CustomEvent('storyboard:canvas:undo-redo-state', {
        detail: { canvasId, canUndo: undoRedo.canUndo, canRedo: undoRedo.canRedo, ...(requestId ? { requestId } : {}) },
      }))
    }
    function handleUndoRedoStateRequest(e) {
      const requestCanvasId = e.detail?.canvasId
      if (requestCanvasId && requestCanvasId !== canvasId) return
      publishUndoRedoState(e.detail?.requestId)
    }

    document.addEventListener('storyboard:canvas:undo-redo-state-request', handleUndoRedoStateRequest)
    publishUndoRedoState()
    return () => document.removeEventListener('storyboard:canvas:undo-redo-state-request', handleUndoRedoStateRequest)
  }, [canvasId, undoRedo.canUndo, undoRedo.canRedo])

  // Cmd+scroll / trackpad pinch to smooth-zoom the canvas.
  // On macOS, pinch-to-zoom fires wheel events with ctrlKey: true and small
  // fractional deltaY values. We accumulate the delta to handle sub-pixel changes.
  // Skipped entirely when the consumer disables zoomGestures (e.g. landing page).
  //
  // Cmd/Ctrl+scroll anchors at the cursor. Alt explicitly anchors at the
  // viewport center, independently of the toolbar/keyboard origin setting.
  const zoomAccum = useRef(0)
  useEffect(() => {
    function handleWheel(e) {
      if (!e.metaKey && !e.ctrlKey) return
      if (!interactionRef.current.zoomGestures) return
      e.preventDefault()
      zoomAccum.current += -e.deltaY
      const step = Math.trunc(zoomAccum.current)
      if (step === 0) return
      zoomAccum.current -= step
      if (e.altKey) {
        const el = scrollRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        applyZoom(zoomRef.current + step, rect.left + el.clientWidth / 2, rect.top + el.clientHeight / 2)
      } else {
        applyZoom(zoomRef.current + step, e.clientX, e.clientY)
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [])

  // Receive cmd+wheel events forwarded from prototype/story iframes
  useEffect(() => {
    function handleMessage(e) {
      if (e.data?.type !== 'storyboard:embed:wheel') return
      if (!interactionRef.current.zoomGestures) return
      zoomAccum.current += -e.data.deltaY
      const step = Math.trunc(zoomAccum.current)
      if (step === 0) return
      zoomAccum.current -= step
      const el = scrollRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const frame = [...document.querySelectorAll('iframe')].find((frame) => frame.contentWindow === e.source)
      if (!e.data.altKey && frame && Number.isFinite(e.data.clientX) && Number.isFinite(e.data.clientY)) {
        const frameRect = frame.getBoundingClientRect()
        const scaleX = frame.clientWidth ? frameRect.width / frame.clientWidth : zoomRef.current / 100
        const scaleY = frame.clientHeight ? frameRect.height / frame.clientHeight : zoomRef.current / 100
        applyZoom(zoomRef.current + step, frameRect.left + e.data.clientX * scaleX, frameRect.top + e.data.clientY * scaleY)
      } else {
        applyZoom(zoomRef.current + step, rect.left + el.clientWidth / 2, rect.top + el.clientHeight / 2)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Touch pinch-to-zoom for mobile — two-finger pinch zooms the canvas.
  //
  // Bound to `document` (not the canvas scroller) so a pinch that starts
  // anywhere — toolbar buttons, side panels, the canvas surface — drives
  // our custom zoom instead of the browser's visual-viewport zoom (which
  // would scale the entire UI, controls and all). The `touch-action`
  // rules on `.canvasScroll` block the browser pinch on the surface
  // itself; the `gesturestart` preventDefault blocks Safari's older
  // gesture event family (iOS ignores `user-scalable=no` in newer
  // releases as an accessibility allowance, so we have to suppress
  // pinch ourselves at the JS level).
  const pinchState = useRef({ active: false, startDist: 0, startZoom: 0, centerX: 0, centerY: 0 })
  useEffect(() => {
    function getTouchDist(t1, t2) {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function handleTouchStart(e) {
      if (e.touches.length < 2) return
      if (!interactionRef.current.zoomGestures) return
      const dist = getTouchDist(e.touches[0], e.touches[1])
      pinchState.current = {
        active: true,
        startDist: dist,
        startZoom: zoomRef.current,
        centerX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        centerY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }

    function handleTouchMove(e) {
      if (!pinchState.current.active || e.touches.length < 2) return
      if (!interactionRef.current.zoomGestures) return
      e.preventDefault()
      const dist = getTouchDist(e.touches[0], e.touches[1])
      const ratio = dist / pinchState.current.startDist
      const newZoom = Math.round(pinchState.current.startZoom * ratio)
      // Touch pinch has no modifier-key equivalent; always honor the
      // configured zoomOrigin (centerpoint of the pinch is intuitive
      // visually but tends to drift the canvas across the screen).
      applyZoom(newZoom)
    }

    function handleTouchEnd() {
      if (!pinchState.current.active) return
      pinchState.current.active = false
      // Flush the throttled zoom-changed event so the toolbar's zoom
      // tool snaps to the final gesture value immediately — without
      // this the trailing throttle fire is what updates it, which can
      // leave the % display stale for ~100ms after fingers lift.
      if (zoomEventTimer.current) {
        clearTimeout(zoomEventTimer.current)
        zoomEventTimer.current = null
      }
      const bridge = window[CANVAS_BRIDGE_STATE_KEY] || {}
      bridge.active = true
      bridge.canvasId = canvasId
      bridge.zoom = zoomRef.current
      window[CANVAS_BRIDGE_STATE_KEY] = bridge
      document.dispatchEvent(new CustomEvent('storyboard:canvas:zoom-changed', {
        detail: { zoom: zoomRef.current }
      }))
    }

    // iOS Safari historically ignores `user-scalable=no` (added back as
    // an accessibility allowance). The `gesture*` event family fires
    // for two-finger pinches and is the only reliable signal to block
    // the visual-viewport zoom on iPad/iPhone.
    function handleGesture(e) {
      if (!interactionRef.current.zoomGestures) return
      e.preventDefault()
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchEnd)
    document.addEventListener('gesturestart', handleGesture, { passive: false })
    document.addEventListener('gesturechange', handleGesture, { passive: false })
    document.addEventListener('gestureend', handleGesture, { passive: false })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
      document.removeEventListener('gesturestart', handleGesture)
      document.removeEventListener('gesturechange', handleGesture)
      document.removeEventListener('gestureend', handleGesture)
    }
  }, [canvasId])

  // Space + drag to pan the canvas
  const [spaceHeld, setSpaceHeld] = useState(false)
  const isPanning = useRef(false)
  const [panningActive, setPanningActive] = useState(false)
  const panStart = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 })

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === ' ') {
        const tag = e.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
        e.preventDefault()
        if (!e.repeat) setSpaceHeld(true)
      }
    }
    function handleKeyUp(e) {
      if (e.key === ' ') {
        e.preventDefault()
        setSpaceHeld(false)
        isPanning.current = false
        setPanningActive(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handlePanStart = useCallback((e) => {
    if (!spaceHeld) return
    e.preventDefault()
    isPanning.current = true
    setPanningActive(true)
    const el = scrollRef.current
    const bounds = computeCanvasBounds(localWidgets, componentEntries)
    const scale = zoomRef.current / 100
    const panBounds = bounds && el && scale > 0
      ? {
          // Keep one viewport of blank workspace around the content so users
          // can still place new widgets near its edges. Empty canvases retain
          // the normal browser surface scroll range.
          minX: Math.max(0, bounds.minX * scale - el.clientWidth),
          minY: Math.max(0, bounds.minY * scale - el.clientHeight),
          maxX: Math.max(0, bounds.maxX * scale),
          maxY: Math.max(0, bounds.maxY * scale),
        }
      : null
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollX: el?.scrollLeft ?? 0,
      scrollY: el?.scrollTop ?? 0,
    }

    function handlePanMove(ev) {
      if (!isPanning.current || !el) return
      const nextX = panStart.current.scrollX - (ev.clientX - panStart.current.x)
      const nextY = panStart.current.scrollY - (ev.clientY - panStart.current.y)
      el.scrollLeft = panBounds ? Math.min(panBounds.maxX, Math.max(panBounds.minX, nextX)) : nextX
      el.scrollTop = panBounds ? Math.min(panBounds.maxY, Math.max(panBounds.minY, nextY)) : nextY
    }
    function handlePanEnd() {
      isPanning.current = false
      setPanningActive(false)
      document.removeEventListener('mousemove', handlePanMove)
      document.removeEventListener('mouseup', handlePanEnd)
    }
    document.addEventListener('mousemove', handlePanMove)
    document.addEventListener('mouseup', handlePanEnd)
  }, [componentEntries, localWidgets, spaceHeld])

  // Stable callback for deselecting all widgets
  const handleDeselectAll = useCallback(() => setSelectedWidgetIds(new Set()), [])

  // Marquee (lasso) multi-select on canvas background drag
  const { marqueeScreenRect, handleMarqueeMouseDown } = useMarqueeSelect({
    scrollRef,
    zoomRef: zoomRef,
    setSelectedWidgetIds,
    widgets: localWidgets,
    connectors: visualConnectors,
    componentEntries,
    fallbackSizes: WIDGET_FALLBACK_SIZES,
    spaceHeld,
    isLocalDev,
  })

  // Stable callback for widget removal + deselect
  const handleWidgetRemoveAndDeselect = useCallback((id) => {
    return handleWidgetRemove(id)
  }, [handleWidgetRemove])

  if (!canvas) {
    return (
      <div className={styles.empty}>
        <p>Canvas &ldquo;{canvasId}&rdquo; not found</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loading} role="status" aria-label="Loading canvas">
        <span className="main-loading-spinner main-loading-spinner--canvas" aria-hidden="true" />
      </div>
    )
  }

  // Drag is allowed in dev for every widget, and in production only when a
  // widget opts in via `interaction.movable: { enabled: true, prod: true }`,
  // or when `canvas.production.move` is set in `storyboard.config.json`.
  // The canvas-wide `locked` switch is what tiny-canvas reads to disable
  // neodrag; we keep it locked in prod unless at least one widget on this
  // canvas (or any component widget — they share the 'component' type config)
  // is movable-in-prod.
  const allowMoveInProd = isCanvasProductionEnabled('move')
  const allowResizeInProd = isCanvasProductionEnabled('resize')
  const allowMove = isLocalDev || allowMoveInProd
  const hasMovableInEnv = isLocalDev
    || (localWidgets ?? []).some((w) => isMovable(w.type))
    || (componentEntries.length > 0 && isMovable('component'))

  const canvasProps = {
    centered: canvas.centered ?? false,
    dotted: canvas.dotted ?? false,
    grid: canvas.grid ?? false,
    gridSize: canvas.gridSize ?? 18,
    colorMode: canvas.colorMode === 'auto'
      ? getToolbarColorMode(canvasTheme)
      : (canvas.colorMode ?? 'auto'),
    locked: !hasMovableInEnv,
    layout: canvas.layout === 'flow' ? 'flow' : 'absolute',
    className: typeof canvas.className === 'string' ? canvas.className : undefined,
  }
  const isFlowLayout = canvasProps.layout === 'flow'

  const canvasThemeVars = getCanvasThemeVars(canvasTheme)
  const canvasPrimerAttrs = getCanvasPrimerAttrs(canvasTheme)

  // Merge JSX-sourced widgets and JSON widgets
  const allChildren = []

  // 1. Component widgets (from jsxExports or sources fallback)
  const componentFeatures = getFeatures('component', { isLocalDev })
  for (const entry of componentEntries) {
    const { exportName, Component, sourceData } = entry
    const sourcePosition = sourceData.position || { x: 0, y: 0 }
    const componentTheme = resolveFrameTheme(sourceData.frameThemeOverride, canvasTheme, getConfig('theming')?.themes || {})
    const componentPrimerAttrs = sourceData.frameThemeOverride
      ? { ...getCanvasPrimerAttrs(componentTheme), 'data-sb-canvas-theme': componentTheme }
      : canvasPrimerAttrs
    const passComponentUpdateInProd = (allowResizeInProd && isResizable('component')) || allowMoveInProd
    const componentOnUpdate = (isLocalDev || passComponentUpdateInProd)
      ? (updates) => handleSourceUpdate(exportName, updates)
      : undefined
    allChildren.push(
      <div
        key={`jsx-${exportName}`}
        id={`jsx-${exportName}`}
        data-tc-x={sourcePosition.x}
        data-tc-y={sourcePosition.y}
        data-tc-class={typeof sourceData.className === 'string' ? sourceData.className : undefined}
        data-widget-raised={selectedWidgetIds.has(`jsx-${exportName}`) || undefined}
        {...((isLocalDev || isMovable('component')) ? { 'data-tc-handle': isMultiSelected && selectedWidgetIds.has(`jsx-${exportName}`) ? '[data-group-member-drag-disabled]' : '.tc-drag-handle, .tc-drag-surface' } : {})}
        {...(isMultiSelected && selectedWidgetIds.has(`jsx-${exportName}`) ? { onPointerDownCapture: handleGroupMemberPointerDown } : {})}
        {...componentPrimerAttrs}
        style={canvasThemeVars}
        onClickCapture={(e) => handleFrameClickCapture(e, `jsx-${exportName}`, 'component')}
        onClick={isLocalDev ? (e) => {
          e.stopPropagation()
          if (!e.target.closest('.tc-drag-handle')) {
            handleWidgetSelect(`jsx-${exportName}`, e.shiftKey)
          }
        } : undefined}
      >
        <WidgetChrome
          widgetId={`jsx-${exportName}`}
          widgetType="component"
          features={componentFeatures}
          widgetProps={sourceData}
          selected={selectedWidgetIds.has(`jsx-${exportName}`)}
          multiSelected={isMultiSelected && selectedWidgetIds.has(`jsx-${exportName}`)}
          nudgeInRange={autoPlaceEnabled && nudgeTargetIds.has(`jsx-${exportName}`) && !selectedWidgetIds.has(`jsx-${exportName}`)}
          onSelect={(shiftKey) => handleWidgetSelect(`jsx-${exportName}`, shiftKey)}
          onDeselect={handleDeselectAll}
          onUpdate={componentOnUpdate}
          readOnly={!isLocalDev}
        >
          <ComponentWidget
            component={Component}
            jsxModule={canvas?._jsxModule}
            exportName={exportName}
            canvasTheme={componentTheme}
            isLocalDev={isLocalDev}
            width={sourceData.width}
            height={sourceData.height}
            onUpdate={componentOnUpdate}
            resizable={isResizable('component') && !!componentOnUpdate}
          />
        </WidgetChrome>
      </div>
    )
  }

  // 2. JSON-defined mutable widgets (selectable, wrapped in WidgetChrome)
  // Stable DOM order — visual stacking is controlled by z-index on the
  // wrapper div (data-widget-raised), NOT by re-sorting the array.
  // Re-sorting caused iframe widgets (stories, embeds) to remount and
  // reload every time selection changed, because moving an iframe node
  // in the DOM destroys its browsing context.
  for (const widget of (localWidgets ?? [])) {
    // In production, render terminal widgets as read-only instead of hiding them
    const effectiveWidget = (!isLocalDev && (widget.type === 'terminal' || widget.type === 'agent'))
      ? { ...widget, type: 'terminal-read' }
      : widget
    // In prod, pass onUpdate only when the widget needs it — either it's
    // editable-in-prod (markdown/sticky), the global resize-in-prod flag is
    // on and the widget is resize-enabled, or the global move-in-prod flag
    // is on (so position-update calls survive).
    const passOnUpdateInProd = isEditableInProduction(effectiveWidget.type)
      || (allowResizeInProd && isResizable(effectiveWidget.type))
      || allowMoveInProd
    const widgetOnUpdate = (isLocalDev || passOnUpdateInProd) ? handleWidgetUpdate : undefined
    const frameThemeOverride = effectiveWidget.type === 'component' ? effectiveWidget.props?.frameThemeOverride : null
    const widgetTheme = frameThemeOverride
      ? resolveFrameTheme(frameThemeOverride, canvasTheme, getConfig('theming')?.themes || {})
      : canvasTheme
    const widgetPrimerAttrs = effectiveWidget.type === 'component' && frameThemeOverride
      ? { ...getCanvasPrimerAttrs(widgetTheme), 'data-sb-canvas-theme': widgetTheme }
      : canvasPrimerAttrs
    allChildren.push(
      <div
        key={effectiveWidget.id}
        id={effectiveWidget.id}
        data-tc-x={effectiveWidget?.position?.x ?? 0}
        data-tc-y={effectiveWidget?.position?.y ?? 0}
        data-tc-class={typeof effectiveWidget?.props?.className === 'string' ? effectiveWidget.props.className : undefined}
        data-widget-raised={selectedWidgetIds.has(widget.id) || undefined}
        {...((isLocalDev || isMovable(effectiveWidget.type)) ? { 'data-tc-handle': isMultiSelected && selectedWidgetIds.has(widget.id) ? '[data-group-member-drag-disabled]' : '.tc-drag-handle, .tc-drag-surface' } : {})}
        {...(isMultiSelected && selectedWidgetIds.has(widget.id) ? { onPointerDownCapture: handleGroupMemberPointerDown } : {})}
        {...widgetPrimerAttrs}
        style={canvasThemeVars}
        onClickCapture={(e) => handleFrameClickCapture(e, effectiveWidget.id, effectiveWidget.type)}
        onClick={isLocalDev ? (e) => {
          e.stopPropagation()
          if (!e.target.closest('.tc-drag-handle')) {
            // Alt+Click: create connector from selected widget to this one
            if (e.altKey && selectedWidgetIds.size === 1 && !selectedWidgetIds.has(effectiveWidget.id)) {
              handleAltClickConnect(effectiveWidget.id)
              return
            }
            handleWidgetSelect(effectiveWidget.id, e.shiftKey)
          }
        } : undefined}
      >
        <ChromeWrappedWidget
          widget={effectiveWidget}
          canvasId={canvasId}
          selected={selectedWidgetIds.has(widget.id)}
          multiSelected={isMultiSelected && selectedWidgetIds.has(widget.id)}
          nudgeInRange={autoPlaceEnabled && nudgeTargetIds.has(widget.id) && !selectedWidgetIds.has(widget.id)}
          connectorCount={localConnectors.filter((c) => c.start?.widgetId === widget.id || c.end?.widgetId === widget.id)}
          allWidgets={localWidgets}
          onSelect={(shiftKey) => handleWidgetSelect(widget.id, shiftKey)}
          onDeselect={handleDeselectAll}
          onUpdate={widgetOnUpdate}
          onCopy={isLocalDev ? handleWidgetCopy : undefined}
          onCopyWithConnectors={isLocalDev ? handleWidgetCopyWithConnectors : undefined}
          onRemove={isLocalDev ? handleWidgetRemoveAndDeselect : undefined}
          onRefreshGitHub={isLocalDev ? handleRefreshGitHubWidget : undefined}
          canRefreshGitHub={isLocalDev}
          onConnectorDragStart={isLocalDev ? handleConnectorDragStart : undefined}
          squadMemberships={squadUiStateByWidget[widget.id] || []}
          onSquadAction={refreshSquadUiState}
          readOnly={!isLocalDev}
        />
      </div>
    )
  }

  const scale = zoom / 100

  const filteredConnectors = visualConnectors

  return (
    <>
      <ChromeSlot id="canvas:title" surface="canvas" ctx={{ canvasId }}>
        <div className={styles.canvasTitle}>
          <ChromeSlot id="canvas:title-editable" surface="canvas" ctx={{ canvasId }}>
            <span style={{ display: 'contents' }}>
              <CanvasTitleEditable canvasId={canvasId} canvas={canvas} isLocalDev={isLocalDev} />
            </span>
          </ChromeSlot>
        </div>
      </ChromeSlot>
      <div
        ref={scrollRef}
        data-storyboard-canvas-scroll
        data-sb-surface="canvas"
        data-sb-canvas-theme={canvasTheme}
        data-layout={canvasProps.layout}
        {...canvasPrimerAttrs}
        className={styles.canvasScroll}
        style={{
          ...canvasThemeVars,
          ...(spaceHeld && !isFlowLayout ? { cursor: panningActive ? 'grabbing' : 'grab' } : {}),
          ...(isFlowLayout ? {} : scrollAxisStyle(scrollAxis)),
        }}
        onMouseDown={isFlowLayout ? undefined : (e) => { handlePanStart(e); handleMarqueeMouseDown(e); }}
      >
        <MarqueeOverlay rect={marqueeScreenRect} />
        <FilePickerController />
        <DeleteConfirmController />
        <div
          ref={zoomElRef}
          data-storyboard-canvas-zoom
          data-selection-dragging={groupDragging || undefined}
          data-sb-canvas-theme={canvasTheme}
          data-layout={canvasProps.layout}
          className={styles.canvasZoom}
          style={isFlowLayout
            ? {}
            : {
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
                width: getZoomLayoutWidth(scale, interactionRef.current?.surface),
                height: getZoomLayoutHeight(scale, interactionRef.current?.surface),
                ...(spaceHeld ? { pointerEvents: 'none' } : {}),
              }}
        >
          {!isFlowLayout && (
            <ConnectorLayer
              connectors={squadConnectors(filteredConnectors, squadUiStateByWidget)}
              widgets={localWidgets ?? []}
              selectedWidgetIds={selectedWidgetIds}
              onRemove={isLocalDev ? handleConnectorRemove : undefined}
              onEndpointDrag={undefined}
              dragPreview={connectorDrag}
              hidden={widgetDragging}
              autoPlace={autoPlaceEnabled}
            />
          )}
          {isLocalDev && !isFlowLayout && isMultiSelected && selectionBounds && (
            <section
              aria-label="Selected widgets"
              data-selection-outline
              data-autoplace={autoPlaceEnabled || undefined}
              className={styles.selectionOutline}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              style={{ left: selectionBounds.x, top: selectionBounds.y, width: selectionBounds.width, height: selectionBounds.height }}
            >
              <WidgetChrome
                widgetId="canvas-group-selection"
                selected
                features={[]}
                selectionActions={[{ feature: { id: 'arrange-grid', type: 'action', action: 'arrange-grid', label: 'Align to grid', icon: 'view-grid' }, widgetIds: selectedActionWidgets.map((widget) => widget.id) }, ...selectionActions]}
                selectionWidgets={selectedActionWidgets}
                onSelectionPropChange={handleGroupPropChange}
                onSelectionAction={handleGroupAction}
                onHandlePointerDown={handleGroupDragStart}
                onHandleKeyDown={handleGroupKeyDown}
                handleLabel="Move selected widgets"
              >
                <div style={{ width: selectionBounds.width, height: selectionBounds.height }} aria-hidden="true" />
              </WidgetChrome>
            </section>
          )}
          <Canvas {...canvasProps} onDragStart={allowMove ? handleItemDragStart : undefined} onDrag={allowMove ? handleItemDrag : undefined} onDragEnd={allowMove ? handleItemDragEnd : undefined} resolveDropPosition={allowMove ? resolveDropPosition : undefined}>
            {allChildren}
          </Canvas>
        </div>
      </div>
      {showGhInstallBanner && (
        <ChromeSlot id="canvas:gh-install-banner" surface="canvas">
          <aside className={styles.ghInstallBanner} role="status" aria-live="polite">
            <span className={styles.ghInstallBannerText}>
              GitHub embeds require local <code>gh</code> CLI access.
            </span>
            <a
              href={GH_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ghInstallBannerLink}
            >
              Install GitHub CLI
            </a>
            <button
              type="button"
              className={styles.ghInstallBannerDismiss}
              onClick={() => setShowGhInstallBanner(false)}
            >
              Dismiss
            </button>
          </aside>
        </ChromeSlot>
      )}
    </>
  )
}
