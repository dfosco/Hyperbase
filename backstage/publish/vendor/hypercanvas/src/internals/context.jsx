import { useState, useEffect, useMemo, useRef, useCallback, useContext, Suspense, lazy, Component } from 'react'
import { createPortal } from 'react-dom'
import { describeRuntimeIncident } from './runtimeIncidentCopy.js'
import { useParams, useLocation } from 'react-router-dom'
// Named import seeds the core data index via init() AND provides canvas/story route data
import { canvases, stories } from 'virtual:storyboard-data-index'
import { loadFlow, flowExists, findRecord, deepMerge, resolveFlowName, resolveRecordName, getPrototypeMetadata } from '../core/data/loader.js'
import { setFlowClass, installBodyClassSync } from '../core/session/bodyClasses.js'
import { StoryboardContext } from './StoryboardContext.js'
import './LoadingSpinner.css'
import { getFlag, subscribeToStorage } from '../core/index.js'
import { storyboardWs } from './storyboard-ws.js'
import {
  clearPendingNotebookSwitch,
  finishPendingNotebookSwitch,
  hasPendingNotebookSwitch,
  NOTEBOOK_SWITCH_EVENT,
  coreRequestJson,
  confirmDesktopFrontendReady,
  getDesktopAppearance,
  getDesktopRuntimeSnapshot,
  reconcileDesktopRuntimeSnapshot,
  subscribeDesktopAppearance,
  requestDesktopRecoveryAction,
  subscribeDesktopRuntimeState,
} from '../core/notebook/browserBridge.js'
import { applyDesktopAppearance } from '../core/stores/themeStore.js'
import { createDocumentReloadPolicy } from './documentReloadPolicy.js'
import styles from './FlowError.module.css'
import loadingStyles from './LoadingState.module.css'
import ContentFrame from './ContentFrame/ContentFrame.jsx'
import { Button } from '../core/lib/components/ui/button/index.js'
import { SidebarNoticeContext } from './NotebookShell/SidebarNoticeContext.js'
import sidebarStyles from './NotebookShell/NotebookShell.module.css'

export { StoryboardContext }

const CanvasPageLazy = lazy(() => import('./canvas/CanvasPage.jsx'))
const StoryPageLazy = lazy(() => import('./story/StoryPage.jsx'))
const CommandPaletteLazy = lazy(() => import('./CommandPalette/CommandPalette.jsx'))
const NOTEBOOK_SWITCH_TIMEOUT_MS = 90_000
const CORE_RECOVERY_ESCALATION_MS = 2_001
const RELOAD_PENDING_EVENT = 'storyboard:reload-pending'
const RELOAD_PENDING_STORAGE_KEY = '__hypercanvas_reload_pending__'
const frontendReadyAcksInFlight = new Map()
const frontendReadyAckedResults = new Map()

function recordStartupDiagnostic(stage, outcome, fields = {}) {
  try {
    window.__hypercanvasStartupDiagnostics?.record({ stage, outcome, ...fields })
  } catch {
    // Diagnostics must never alter startup or readiness behavior.
  }
}

function confirmFrontendReadyOnce(expectedSequence) {
  const previousResult = frontendReadyAckedResults.get(expectedSequence)
  if (previousResult) return Promise.resolve(previousResult)
  const existing = frontendReadyAcksInFlight.get(expectedSequence)
  if (existing) return existing

  const request = Promise.resolve()
    .then(() => confirmDesktopFrontendReady({ expectedSequence }))
    .then(result => {
      if (result?.accepted) {
        for (const sequence of frontendReadyAckedResults.keys()) {
          if (sequence < expectedSequence) frontendReadyAckedResults.delete(sequence)
        }
        frontendReadyAckedResults.set(expectedSequence, result)
      }
      return result
    })
    .finally(() => {
      if (frontendReadyAcksInFlight.get(expectedSequence) === request) {
        frontendReadyAcksInFlight.delete(expectedSequence)
      }
    })
  frontendReadyAcksInFlight.set(expectedSequence, request)
  return request
}

function documentTargetId() {
  if (typeof window === 'undefined') return 'storyboard-server-render'
  if (!window.__HYPERCANVAS_DOCUMENT_TARGET_ID__) {
    window.__HYPERCANVAS_DOCUMENT_TARGET_ID__ = globalThis.crypto?.randomUUID?.()
      || `document-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  return window.__HYPERCANVAS_DOCUMENT_TARGET_ID__
}

function documentRole(pathname, isCanvas) {
  if (isCanvas) return 'canvas-host'
  if (/(?:^|\/)prototypes\.html(?:\/|$)/.test(pathname)) return 'prototype-content'
  if (/(?:^|\/)stories\.html(?:\/|$)/.test(pathname)) return 'story-content'
  return 'workspace-host'
}

function readPendingReload() {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_PENDING_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function reloadDocumentLabel() {
  const root = document.documentElement
  return root.hasAttribute('data-hc-desktop-shell') || root.hasAttribute('data-mygo-titlebar')
    ? 'Reload app'
    : 'Reload page'
}

function renderReloadAction(className) {
  return (
    <button className={className} type="button" onClick={() => window.location.reload()}>
      {reloadDocumentLabel()}
    </button>
  )
}

/**
 * Error boundary for top-level sections (canvas, story).
 * Prevents a crash in one section from taking down the entire provider tree.
 */
class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(
      `[storyboard] ${this.props.section || 'Section'} crashed:`,
      error,
      info?.componentStack,
    )
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error)
      return (
        <main className={styles.container} data-hc-full-error>
          <div className={styles.banner}>
            <strong>{this.props.section || 'Section'} error</strong>
            {message}
          </div>
          {renderReloadAction(styles.homeLink)}
        </main>
      )
    }
    return this.props.children
  }
}

// Canvas route resolution and group lookup happen live below
// (see matchCanvasRoute / getCanvasGroupMap) so that HMR rename/duplicate
// take effect without a page reload.

// Build a map from group name → array of { name, route, title } for page selector.
// Read live from `canvases` (HMR mutates it in place) so rename/duplicate are
// reflected immediately. Sorted by pageOrder from .meta.json when available.
function getCanvasGroupMap() {
  const map = new Map()
  for (const [name, data] of Object.entries(canvases || {})) {
    const route = (data?._route || `/canvas/${name}`).replace(/\/+$/, '')
    const group = data?._group
    if (!group) continue
    if (!map.has(group)) map.set(group, [])
    map.get(group).push({
      name,
      route,
      title: data?.title || name.split('/').pop(),
      isPrivate: !!data?._isPrivate,
      _canvasMeta: data?._canvasMeta || null,
    })
  }
  for (const [, pages] of map) {
    const pageOrder = pages[0]?._canvasMeta?.pageOrder
    if (Array.isArray(pageOrder)) {
      const orderMap = new Map()
      pageOrder.forEach((entry, idx) => {
        if (typeof entry === 'string' && !entry.startsWith('sep-')) orderMap.set(entry, idx)
      })
      pages.sort((a, b) => {
        const ai = orderMap.has(a.name) ? orderMap.get(a.name) : Infinity
        const bi = orderMap.has(b.name) ? orderMap.get(b.name) : Infinity
        return ai - bi
      })
    }
  }
  return map
}

function matchCanvasRoute(pathname) {
  const normalized = stripBasePath(pathname)
  // Iterate `canvases` live so HMR rename/duplicate are reflected without
  // a page reload (virtual-module HMR mutates the object in place).
  for (const [name, data] of Object.entries(canvases || {})) {
    const route = (data?._route || `/canvas/${name}`).replace(/\/+$/, '')
    if (route === normalized) return name
  }
  return null
}

/**
 * Live-lookup a story route against the current `stories` object.
 *
 * Unlike the canvas route map (built once at module scope), this iterates
 * the `stories` object on every call so it always reflects HMR mutations
 * (the virtual-module HMR handler mutates `stories` in place).
 *
 * Also strips encoded query strings (%3F / %3f) that can leak into the
 * pathname when an iframe src is percent-encoded incorrectly.
 */
function matchStoryRoute(pathname) {
  let normalized = stripBasePath(pathname)
  // Strip encoded query strings that leaked into the path (%3F / %3f = ?)
  const encodedIdx = normalized.search(/%3f/i)
  if (encodedIdx !== -1) normalized = normalized.substring(0, encodedIdx)
  const literalIdx = normalized.indexOf('?')
  if (literalIdx !== -1) normalized = normalized.substring(0, literalIdx)

  for (const [name, data] of Object.entries(stories || {})) {
    if (data?._route && data._route.replace(/\/+$/, '') === normalized) {
      return name
    }
  }
  return null
}

/**
 * Strip the app's sub-path prefix (e.g. /storyboard) from the pathname.
 * React Router's basename strips the branch prefix but not the app name prefix
 * when the app runs under a nested base path.
 *
 * Two prefixing scenarios are handled:
 *   1. Branch deploys — BASE_URL is `/branch--xxx/{devDomain}/`, so we strip
 *      whatever app sub-path remains after the branch prefix.
 *   2. Local dev via Caddy proxy — BASE_URL is `/` (Caddy strips `/{devDomain}/`
 *      before forwarding to the dev server), but window.location.pathname is
 *      still `/{devDomain}/...`. React Router's basename `/` doesn't strip it,
 *      so we rely on the injected `__SB_DEV_DOMAIN__` global instead.
 */
function stripBasePath(pathname) {
  let p = pathname.replace(/\/+$/, '') || '/'
  // BASE_URL includes branch prefix + app path (e.g. /branch--name/storyboard/)
  // React Router strips the branch prefix but may leave the app sub-path
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/+$/, '')
  if (base && base !== '/') {
    // Extract just the last segment(s) after the branch prefix
    const withoutBranch = base.replace(/^\/branch--[^/]+/, '')
    const subPath = withoutBranch.replace(/\/+$/, '')
    if (subPath && p.startsWith(subPath)) {
      p = p.slice(subPath.length) || '/'
    }
  }
  // Local dev via Caddy proxy: window.location.pathname includes the
  // /{devDomain}/ prefix that Caddy strips before reaching the dev server.
  // BASE_URL is `/` in this scenario, so the block above is a no-op.
  if (typeof window !== 'undefined' && window.__SB_LOCAL_DEV__ && window.__SB_DEV_DOMAIN__) {
    const devDomain = String(window.__SB_DEV_DOMAIN__).replace(/^\/+|\/+$/g, '')
    if (devDomain) {
      const devPrefix = '/' + devDomain
      if (p === devPrefix || p.startsWith(devPrefix + '/')) {
        p = p.slice(devPrefix.length) || '/'
      }
    }
  }
  return p
}

function isCanvasPath(pathname) {
  const normalized = stripBasePath(pathname)
  return normalized === '/canvas' || normalized.startsWith('/canvas/')
}

function isStoryPath(pathname) {
  const normalized = stripBasePath(pathname)
  return normalized === '/components' || normalized.startsWith('/components/')
}

/**
 * Derives the top-level prototype name from a pathname.
 * "/Dashboard" → "Dashboard", "/Dashboard/sub" → "Dashboard"
 * "/posts/123" → "posts", "/" → null
 */
function getPrototypeName(pathname) {
  const path = stripBasePath(pathname).replace(/\/+$/, '') || '/'
  if (path === '/') return null
  const segments = path.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (!firstSegment) return null

  let decodedSegment = firstSegment
  try {
    decodedSegment = decodeURIComponent(firstSegment)
  } catch {
    // Keep malformed legacy path segments usable as their original text.
  }

  // New-format artifact routes include the physical folder suffix, while all
  // prototype data and metadata are keyed by the artifact's logical name.
  return decodedSegment.endsWith('.prototype')
    ? decodedSegment.slice(0, -'.prototype'.length)
    : decodedSegment
}

/**
 * Derives a flow name from a pathname.
 * "/Overview" → "Overview", "/" → "index", "/nested/Page" → "Page"
 */
function getPageFlowName(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'index'
  const last = path.split('/').pop()
  return last || 'index'
}

/**
 * Provides loaded flow data to the component tree.
 * Reads the flow name from the ?flow= URL param (with ?scene= as alias),
 * a matching flow file for the current page, or defaults to "default".
 *
 * Derives the prototype scope from the route and uses it to resolve
 * scoped flow and record names (e.g. "Dashboard/default" for /Dashboard).
 *
 * Optionally merges record data when `recordName` and `recordParam` are provided.
 * The matched record entry is injected under the "record" key in flow data.
 */
export default function StoryboardProvider({ flowName, sceneName, recordName, recordParam, children, isolated = false, initialRouteReadyMarker }) {
  const sidebarNoticeSlot = useContext(SidebarNoticeContext)
  const [showReloadNotice, setShowReloadNotice] = useState(() => getFlag('document-reload-notice'))
  useEffect(() => subscribeToStorage(() => setShowReloadNotice(getFlag('document-reload-notice'))), [])
  const [reloadNoticeDismissed, setReloadNoticeDismissed] = useState(false)
  // Desktop runtime incidents (Core restarts, recovery episodes) surface in
  // the sidebar notice slot with per-incident dismissal, next to the reload
  // notice.
  const [runtimeIncident, setRuntimeIncident] = useState(null)
  const [dismissedRuntimeIncidentId, setDismissedRuntimeIncidentId] = useState(null)
  const runtimeIncidentKeyRef = useRef('')
  const publishRuntimeIncident = useCallback((snapshot) => {
    const phase = typeof snapshot?.phase === 'string' ? snapshot.phase : null
    const incident = snapshot?.incident ?? null
    const key = phase
      ? `${phase}:${incident?.incidentId || ''}:${incident?.code || ''}:${incident?.title || ''}:${incident?.description || ''}`
      : ''
    if (key === runtimeIncidentKeyRef.current) return
    runtimeIncidentKeyRef.current = key
    setRuntimeIncident(phase ? { phase, incident, actions: Array.isArray(snapshot?.actions) ? snapshot.actions : [] } : null)
  }, [])
  const runtimeIncidentCopy = runtimeIncident ? describeRuntimeIncident(runtimeIncident.incident, runtimeIncident.phase) : null
  const basePath = import.meta.env?.BASE_URL || '/'
  const isStaticPublication = globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ === true
  const runtimeNoticeVisible = Boolean(
    !isolated && !isStaticPublication && sidebarNoticeSlot && runtimeIncident
    && ['recovering', 'exhausted', 'manual'].includes(runtimeIncident.phase)
    && runtimeIncident.incident.incidentId !== dismissedRuntimeIncidentId,
  )
  // A visible runtime warning that already offers Reload takes precedence over
  // the pending-document notice; pendingReload itself is left untouched.
  const runtimeReloadNoticeVisible = runtimeNoticeVisible && runtimeIncident.actions.includes('reload-page')
  // Once the shell's notice slot exists, the sidebar owns runtime incident
  // rendering (app styles + dismissal). Tell the startup helper to stop
  // overlaying the page and clear anything it already injected.
  useEffect(() => {
    if (isolated || isStaticPublication || !sidebarNoticeSlot) return undefined
    window.__HYPERCANVAS_SIDEBAR_RUNTIME_NOTICE__ = true
    document.getElementById('hypercanvas-startup-notice')?.remove()
    return undefined
  }, [isolated, isStaticPublication, sidebarNoticeSlot])
  const location = useLocation()
  const isCanvas = Boolean(matchCanvasRoute(location.pathname))
  // A socket close is not proof that Core stopped. Show a spinner immediately
  // while automatic reconnect runs, and offer Refresh only for a long episode.
  const [coreRecoveryActive, setCoreRecoveryActive] = useState(false)
  const [coreRecoveryEscalated, setCoreRecoveryEscalated] = useState(false)
  const coreConnectedRef = useRef(false)
  const coreRecoveryActiveRef = useRef(false)
  const coreRecoveryTimer = useRef(null)
  const [notebookSwitching, setNotebookSwitching] = useState(() => hasPendingNotebookSwitch())
  const switchPendingOnMount = useRef(hasPendingNotebookSwitch())
  const [pendingReload, setPendingReload] = useState(() => isStaticPublication ? null : readPendingReload())
  const setPendingReloadNotice = useCallback((next) => {
    setPendingReload(current => current?.kind === 'recovery' && next?.kind !== 'recovery' ? current : next)
  }, [])
  const documentReloadPolicyRef = useRef(null)
  const desktopRuntimeSnapshotRef = useRef(null)

  useEffect(() => {
    if (isStaticPublication) return undefined
    let active = true
    let appearanceSequence = -1
    const receive = incoming => {
      if (!active || !incoming || !Number.isSafeInteger(incoming.sequence)
        || incoming.sequence <= appearanceSequence) return
      if (!['system', 'light', 'dark'].includes(incoming.mode)) return
      // The startup client can have observed a newer event while this RPC
      // was in flight. A late React mount must not restore an older mode.
      if (incoming.sequence < (window.__HYPERCANVAS_DESKTOP_APPEARANCE__?.sequence ?? -1)) return
      appearanceSequence = incoming.sequence
      applyDesktopAppearance(incoming.mode)
    }
    let unsubscribe = () => {}
    try {
      unsubscribe = subscribeDesktopAppearance(receive)
      getDesktopAppearance().then(receive).catch(error => {
        if (document.documentElement.hasAttribute('data-mygo-titlebar')) {
          console.warn('Could not read the Hypercanvas desktop appearance preference.', error)
        }
      })
    } catch (error) {
      if (document.documentElement.hasAttribute('data-mygo-titlebar')) {
        console.warn('Could not subscribe to the Hypercanvas desktop appearance preference.', error)
      }
    }
    return () => {
      active = false
      unsubscribe()
    }
  }, [isStaticPublication])

  useEffect(() => {
    const finishRecovery = () => {
      if (coreRecoveryTimer.current !== null) {
        clearTimeout(coreRecoveryTimer.current)
        coreRecoveryTimer.current = null
      }
      coreRecoveryActiveRef.current = false
      setCoreRecoveryActive(false)
      setCoreRecoveryEscalated(false)
    }

    const onConnection = (event) => {
      const state = event?.detail?.state
      if (state === 'connected') {
        coreConnectedRef.current = true
        finishRecovery()
        return
      }

      if (state === 'disconnected' || state === 'connecting') {
        coreConnectedRef.current = false
        // Keep one timer across retries so they cannot postpone the Refresh
        // affordance. A connected event ends the episode and resets the timer.
        if (!coreRecoveryActiveRef.current) {
          coreRecoveryActiveRef.current = true
          setCoreRecoveryActive(true)
          setCoreRecoveryEscalated(false)
          coreRecoveryTimer.current = setTimeout(() => {
            coreRecoveryTimer.current = null
            if (!coreConnectedRef.current) {
              setCoreRecoveryEscalated(true)
            }
          }, CORE_RECOVERY_ESCALATION_MS)
        }
      }
    }

    window.addEventListener('storyboard:core-connection', onConnection)
    // The recovery surface observes this channel even on authoring routes that
    // do not otherwise subscribe to server events. Static publications and
    // isolated frames have no Core recovery surface and must stay socket-free.
    if (!isolated && !isStaticPublication) void storyboardWs.connect().catch(() => {})
    onConnection({ detail: { state: storyboardWs.connectionState() } })
    return () => {
      window.removeEventListener('storyboard:core-connection', onConnection)
      if (coreRecoveryTimer.current !== null) clearTimeout(coreRecoveryTimer.current)
      coreRecoveryTimer.current = null
      coreRecoveryActiveRef.current = false
    }
  }, [isolated, isStaticPublication])

  useEffect(() => {
    const onNotebookSwitch = event => {
      const state = event?.detail?.state
      if (state === 'started') setNotebookSwitching(true)
      if (state === 'ready' || state === 'failed') {
        switchPendingOnMount.current = false
        clearPendingNotebookSwitch()
        setNotebookSwitching(false)
      }
    }
    window.addEventListener(NOTEBOOK_SWITCH_EVENT, onNotebookSwitch)
    return () => window.removeEventListener(NOTEBOOK_SWITCH_EVENT, onNotebookSwitch)
  }, [])

  useEffect(() => {
    if (isStaticPublication || !notebookSwitching || !switchPendingOnMount.current) return undefined
    let active = true
    let checking = false
    const deadline = Date.now() + NOTEBOOK_SWITCH_TIMEOUT_MS
    const checkReady = async () => {
      if (!active || checking || storyboardWs.connectionState() !== 'connected') return
      checking = true
      try {
        const status = await coreRequestJson('/_hypercanvas/notebook-runtime/status', { cache: 'no-store' })
        const runtimeStatus = status && typeof status === 'object'
          ? status
          : null
        if (!active || !runtimeStatus?.active || runtimeStatus.restarting) return
        switchPendingOnMount.current = false
        finishPendingNotebookSwitch('ready')
        setNotebookSwitching(false)
      } catch { /* Core may still be restarting; keep the transition visible. */ }
      finally { checking = false }
    }
    void checkReady()
    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        switchPendingOnMount.current = false
        finishPendingNotebookSwitch('failed')
        setNotebookSwitching(false)
        return
      }
      void checkReady()
    }, 500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [notebookSwitching, isStaticPublication])
  // The workspace owns its Core connection. Feature event subscriptions are
  // optional and may not mount on a prototype-only page.
  useEffect(() => {
    if (isolated || isStaticPublication) return undefined
    return storyboardWs.start()
  }, [isolated, isStaticPublication])

  // A connected Core socket is the frontend's mount/health acknowledgement.
  // Runtime status events only refresh the expected sequence; they never
  // trigger a navigation or acknowledge a speculative document render.
  useEffect(() => {
    if (isolated || isStaticPublication) {
      recordStartupDiagnostic('provider-effect', 'skipped', {
        code: isolated ? 'isolated-context' : 'static-publication',
      })
      return undefined
    }
    recordStartupDiagnostic('provider-effect', 'entered')
    let active = true
    let diagnosticsOpen = true
    const recordReadinessDiagnostic = (stage, outcome, fields) => {
      if (diagnosticsOpen) recordStartupDiagnostic(stage, outcome, fields)
    }
    const initialConnectionState = storyboardWs.connectionState()
    let connected = initialConnectionState === 'connected'
    if (initialConnectionState === 'connected' || initialConnectionState === 'connecting'
      || initialConnectionState === 'disconnected') {
      recordReadinessDiagnostic('websocket', initialConnectionState)
    }
    let subscribed = false
    let currentSnapshot = null
    const attemptedSequences = new Set()
    let unsubscribe = () => {}
    let legacyRouteRecorded = false
    const routeCommitted = () => {
      const initialLoad = window.__hypercanvasInitialLoad
      const required = document.documentElement.hasAttribute('data-hc-route-commit-required')
      if (typeof initialLoad?.routeReadiness !== 'function') {
        if (required) return false
        if (!legacyRouteRecorded) {
          legacyRouteRecorded = true
          recordReadinessDiagnostic('provider-effect', 'skipped', { code: 'legacy-route-readiness' })
        }
        return true
      }
      try {
        const route = initialLoad.routeReadiness()
        if (!route || typeof route.required !== 'boolean' || typeof route.committed !== 'boolean' || route.current !== true) return false
        if (!required && !route.required && !legacyRouteRecorded) {
          legacyRouteRecorded = true
          recordReadinessDiagnostic('provider-effect', 'skipped', { code: 'legacy-route-readiness' })
        }
        return !(required || route.required) || route.committed
      } catch { return false }
    }

    const reconcile = incoming => {
      if (!active) return
      try {
        currentSnapshot = reconcileDesktopRuntimeSnapshot(currentSnapshot, incoming)
        recordReadinessDiagnostic('runtime-snapshot', 'accepted', {
          ...(Number.isSafeInteger(currentSnapshot?.sequence) ? { runtimeSequence: currentSnapshot.sequence } : {}),
        })
      } catch {
        recordReadinessDiagnostic('runtime-snapshot', 'failed', { code: 'invalid-runtime-snapshot' })
        return
      }
      publishRuntimeIncident(currentSnapshot)
      if (!connected || !subscribed || !routeCommitted() || !['starting', 'recovering'].includes(currentSnapshot.phase)) return
      const expectedSequence = currentSnapshot.sequence
      if (!Number.isSafeInteger(expectedSequence) || attemptedSequences.has(expectedSequence)) return
      attemptedSequences.add(expectedSequence)
      recordReadinessDiagnostic('frontend-ready', 'invoked', { runtimeSequence: expectedSequence })
      void confirmFrontendReadyOnce(expectedSequence).then(result => {
        if (!active) return
        recordReadinessDiagnostic('frontend-ready', result?.accepted ? 'accepted' : 'rejected', {
          runtimeSequence: Number.isSafeInteger(result?.snapshot?.sequence)
            ? result.snapshot.sequence
            : expectedSequence,
          ...(!result?.accepted ? { code: 'confirm-rejected' } : { code: 'confirm-accepted' }),
          ...(!result?.accepted && typeof result?.reason === 'string' ? { message: result.reason } : {}),
        })
        if (result?.accepted) diagnosticsOpen = false
        // A stale-sequence rejection carries the latest Go snapshot too. It
        // may be the only transition this document receives during reconnect.
        // Reconcile it and acknowledge a newer waiting sequence once; the
        // attempted-sequence guard prevents retries of a rejected sequence.
        if (result?.snapshot) reconcile(result.snapshot)
      }).catch(error => {
        if (active) {
          recordReadinessDiagnostic('frontend-ready', 'failed', {
            runtimeSequence: expectedSequence,
            code: 'confirm-rpc-failed',
            ...(typeof error?.message === 'string' ? { message: error.message } : {}),
          })
        }
        // A missing desktop bridge is normal in browser-only mode.
      })
    }

    const onRuntimeState = incoming => reconcile(incoming)
    recordReadinessDiagnostic('runtime-subscription', 'started')
    try {
      unsubscribe = subscribeDesktopRuntimeState(onRuntimeState)
      subscribed = true
      recordReadinessDiagnostic('runtime-subscription', 'accepted')
    } catch (error) {
      recordReadinessDiagnostic('runtime-subscription', 'failed', {
        code: 'bridge-subscribe-failed',
        ...(typeof error?.message === 'string' ? { message: error.message } : {}),
      })
      /* Without the real MyGo subscription, do not fabricate readiness. */
    }

    let snapshotReadPending = false
    const readSnapshot = () => {
      if (!active || !subscribed || snapshotReadPending) return
      snapshotReadPending = true
      recordReadinessDiagnostic('runtime-snapshot', 'started')
      try {
        Promise.resolve(getDesktopRuntimeSnapshot()).then(reconcile).catch(error => {
          if (active) recordReadinessDiagnostic('runtime-snapshot', 'failed', {
            code: 'runtime-read-failed',
            ...(typeof error?.message === 'string' ? { message: error.message } : {}),
          })
        }).finally(() => { snapshotReadPending = false })
      } catch (error) {
        snapshotReadPending = false
        recordReadinessDiagnostic('runtime-snapshot', 'failed', {
          code: 'runtime-read-failed',
          ...(typeof error?.message === 'string' ? { message: error.message } : {}),
        })
      }
    }
    const onConnection = event => {
      const state = event?.detail?.state
      if (state === 'connected' || state === 'connecting' || state === 'disconnected') {
        recordReadinessDiagnostic('websocket', state)
      }
      if (state === 'connected') {
        connected = true
        if (currentSnapshot) reconcile(currentSnapshot)
        // The socket can reconnect after a runtime event was missed. Re-read
        // Go's state instead of keeping the old document's cached sequence.
        readSnapshot()
      } else if (state === 'connecting' || state === 'disconnected') {
        connected = false
      }
    }
    const onInitialRouteReady = () => { if (currentSnapshot) reconcile(currentSnapshot) }
    const onReadinessPageHide = () => { active = false }
    window.addEventListener('hypercanvas:initial-route-ready', onInitialRouteReady)
    window.addEventListener('pagehide', onReadinessPageHide)
    window.addEventListener('storyboard:core-connection', onConnection)
    if (subscribed) {
      // Subscribe first, then read so a concurrent transition cannot be lost.
      readSnapshot()
    }

    return () => {
      recordReadinessDiagnostic('frontend-ready', 'cleanup')
      active = false
      unsubscribe()
      window.removeEventListener('storyboard:core-connection', onConnection)
      window.removeEventListener('hypercanvas:initial-route-ready', onInitialRouteReady)
      window.removeEventListener('pagehide', onReadinessPageHide)
    }
  }, [isolated, isStaticPublication])

  // All page roles register with one server policy. The configuration
  // preference remains a separate opt-in; routine document updates are held.
  useEffect(() => {
    if (isStaticPublication || !import.meta.hot) return undefined
    const policy = createDocumentReloadPolicy({
      hot: import.meta.hot,
      role: documentRole(window.location.pathname || location.pathname, isCanvas),
      targetId: documentTargetId(),
      configurationAutoReload: () => getFlag('configuration-auto-reload'),
      authorizeAction: requestDesktopRecoveryAction,
      getCurrentSnapshot: async () => {
        const snapshot = await getDesktopRuntimeSnapshot()
        desktopRuntimeSnapshotRef.current = reconcileDesktopRuntimeSnapshot(desktopRuntimeSnapshotRef.current, snapshot)
        return desktopRuntimeSnapshotRef.current
      },
      // No document-wide clean-state producer exists yet. Unknown is a
      // blocker; a recovery action must not discard edits by assumption.
      isUnsavedStateKnownClean: () => false,
      isTargetLive: () => document.documentElement?.isConnected === true,
      getCurrentUrl: () => window.location.href,
      navigate: () => {
        try { window.sessionStorage.removeItem(RELOAD_PENDING_STORAGE_KEY) } catch { /* storage can be unavailable */ }
        window.location.reload()
      },
      setPending: setPendingReloadNotice,
    })
    documentReloadPolicyRef.current = policy
    const unsubscribeStorage = subscribeToStorage(() => policy.refresh())
    return () => {
      unsubscribeStorage()
      policy.dispose()
      if (documentReloadPolicyRef.current === policy) documentReloadPolicyRef.current = null
    }
  }, [isCanvas, isStaticPublication, location.pathname, setPendingReloadNotice])

  // Runtime snapshots are status only. They update the state used by an
  // explicit recovery action but never trigger document navigation themselves.
  useEffect(() => {
    if (isStaticPublication) return undefined
    let active = true
    let unsubscribe = () => {}
    const receive = incoming => {
      if (!active) return
      try {
        desktopRuntimeSnapshotRef.current = reconcileDesktopRuntimeSnapshot(desktopRuntimeSnapshotRef.current, incoming)
      } catch { /* malformed runtime state cannot authorize a reload */ }
    }
    try { unsubscribe = subscribeDesktopRuntimeState(receive) } catch { /* ordinary browsers have no MyGo bridge */ }
    try { getDesktopRuntimeSnapshot().then(receive).catch(() => {}) } catch { /* ordinary browsers have no MyGo bridge */ }
    return () => {
      active = false
      unsubscribe()
    }
  }, [isStaticPublication])

  useEffect(() => {
    if (isStaticPublication) return undefined
    const onPendingReload = (event) => {
      const detail = event.detail
      if (detail && typeof detail === 'object') {
        setReloadNoticeDismissed(false)
        setPendingReloadNotice(detail)
      }
    }
    const onHotPendingReload = (detail) => {
      window.dispatchEvent(new CustomEvent(RELOAD_PENDING_EVENT, { detail }))
    }
    window.addEventListener(RELOAD_PENDING_EVENT, onPendingReload)
    if (import.meta.hot) import.meta.hot.on(RELOAD_PENDING_EVENT, onHotPendingReload)
    return () => {
      window.removeEventListener(RELOAD_PENDING_EVENT, onPendingReload)
      if (typeof import.meta.hot?.off === 'function') import.meta.hot.off(RELOAD_PENDING_EVENT, onHotPendingReload)
    }
  }, [isStaticPublication, setPendingReloadNotice])

  const reloadPendingDocument = () => {
    if (pendingReload?.kind === 'recovery') {
      const policy = documentReloadPolicyRef.current
      const expectedSnapshot = desktopRuntimeSnapshotRef.current
      if (!policy || !expectedSnapshot) {
        setPendingReload({ ...pendingReload, reason: 'runtime-state-unavailable' })
        return
      }
      void policy.authorizeReload({ expectedSnapshot })
      return
    }
    try { window.sessionStorage.removeItem(RELOAD_PENDING_STORAGE_KEY) } catch { /* storage can be unavailable */ }
    window.location.reload()
  }

  return (
    <>
      <StoryboardProviderInner
        isolated={isolated}
        flowName={flowName}
        sceneName={sceneName}
        recordName={recordName}
        recordParam={recordParam}
        initialRouteReadyMarker={initialRouteReadyMarker}
      >
        {children}
      </StoryboardProviderInner>
      {!isolated && <Suspense fallback={null}>
        <CommandPaletteLazy basePath={basePath} />
      </Suspense>}
      {!isolated && !isStaticPublication && notebookSwitching && (
        <div className={loadingStyles.notebookSwitchOverlay} role="status" aria-label="Switching Notebook">
          <span className="main-loading-spinner" aria-hidden="true" />
        </div>
      )}
      {pendingReload && !isolated && !isStaticPublication && sidebarNoticeSlot && showReloadNotice && !reloadNoticeDismissed && !runtimeReloadNoticeVisible && createPortal(
        <aside
          role="status"
          aria-live="polite"
          aria-label="Pending document reload"
          className={sidebarStyles.reloadNotice}
        >
          <span>
            {pendingReload.kind === 'recovery'
              ? 'An automatic dependency recovery is waiting. Reload this document to retry.'
              : 'A document update is ready. Reload to apply it.'}
          </span>
          <span className={sidebarStyles.reloadNoticeActions}>
            <Button type="button" variant="outline" size="sm" onClick={reloadPendingDocument}>Reload now</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReloadNoticeDismissed(true)}>Dismiss</Button>
          </span>
        </aside>,
        sidebarNoticeSlot,
      )}
      {runtimeNoticeVisible && createPortal(
        <aside
          className={`${sidebarStyles.reloadNotice} ${runtimeIncident.phase === 'recovering' ? sidebarStyles.reloadNoticeWarning : sidebarStyles.reloadNoticeError}`}
          role={runtimeIncident.phase === 'recovering' ? 'status' : 'alert'}
          aria-live="polite"
          aria-label="Runtime incident"
        >
          <strong>{runtimeIncidentCopy.title}</strong>
          <span>{runtimeIncidentCopy.body}</span>
          <span className={sidebarStyles.reloadNoticeActions}>
            {runtimeIncident.actions.includes('reload-page') && (
              <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setDismissedRuntimeIncidentId(runtimeIncident.incident.incidentId)}>Dismiss</Button>
          </span>
        </aside>,
        sidebarNoticeSlot,
      )}
      {!isolated && !isStaticPublication && !notebookSwitching && coreRecoveryActive && (
        <aside
          className={loadingStyles.coreRecoveryOverlay}
          role="status"
          aria-live="polite"
          aria-label="Reconnecting to Core"
        >
          <span className="main-loading-spinner" aria-hidden="true" />
          {coreRecoveryEscalated && (
            <div className={loadingStyles.coreRecoveryActions}>
              <p>Still reconnecting to Core</p>
              <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </div>
          )}
        </aside>
      )}
    </>
  )
}

function StoryboardProviderInner({ flowName, sceneName, recordName, recordParam, children, isolated = false, initialRouteReadyMarker }) {
  const location = useLocation()
  const params = useParams()

  // Re-evaluate story route detection when the data index changes via HMR.
  // The virtual-module HMR handler mutates `stories` in place and dispatches
  // this event; bumping the key forces useMemo deps to re-fire.
  const [storyIndexKey, setStoryIndexKey] = useState(0)
  useEffect(() => {
    const handler = () => setStoryIndexKey((k) => k + 1)
    document.addEventListener('storyboard:story-index-changed', handler)
    return () => document.removeEventListener('storyboard:story-index-changed', handler)
  }, [])

  // Same pattern for canvases: HMR mutates the in-memory `canvases` object
  // when files are added/renamed/removed. Re-run canvas route matching and
  // sibling-page derivation when that happens so the SPA reflects the new
  // state without requiring a hard reload (which would 404 on old URLs).
  const [canvasIndexKey, setCanvasIndexKey] = useState(0)
  useEffect(() => {
    const handler = () => setCanvasIndexKey((k) => k + 1)
    document.addEventListener('storyboard:canvas-index-changed', handler)
    return () => document.removeEventListener('storyboard:canvas-index-changed', handler)
  }, [])

  // Story route detection — matches current URL against registered story routes
  // storyIndexKey forces re-evaluation when HMR mutates the stories object in place
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const storyName = useMemo(() => matchStoryRoute(location.pathname), [location.pathname, storyIndexKey])
  const isMissingStoryRoute = useMemo(
    () => isStoryPath(location.pathname) && !storyName,
    [location.pathname, storyName],
  )

  // Canvas route detection — matches current URL against registered canvas routes.
  // canvasIndexKey forces re-evaluation when HMR mutates the canvases object in place
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canvasId = useMemo(() => matchCanvasRoute(location.pathname), [location.pathname, canvasIndexKey])
  const isMissingCanvasRoute = useMemo(
    () => isCanvasPath(location.pathname) && !canvasId && !storyName,
    [location.pathname, canvasId, storyName],
  )

  const searchParams = new URLSearchParams(location.search)
  const sceneParam = searchParams.get('flow') || searchParams.get('scene')
  const prototypeName = getPrototypeName(location.pathname)
  const pageFlow = getPageFlowName(location.pathname)

  // Resolve flow name with prototype scoping (skip for canvas/story pages)
  const activeFlowName = useMemo(() => {
    if (canvasId || isMissingCanvasRoute || storyName || isMissingStoryRoute) return null
    const requested = sceneParam || flowName || sceneName
    if (requested) {
      // Allow fully-scoped flow names from URLs/widgets without re-prefixing
      // (e.g. "Proto/flow" should not become "Proto/Proto/flow").
      if (requested.includes('/')) return requested
      return resolveFlowName(prototypeName, requested)
    }
    // 1. Page-specific flow (e.g., Example/Forms)
    const scopedPageFlow = resolveFlowName(prototypeName, pageFlow)
    if (flowExists(scopedPageFlow)) return scopedPageFlow
    // 2. Prototype flow — named after the prototype folder (e.g., Example/example)
    if (prototypeName) {
      const protoFlow = resolveFlowName(prototypeName, prototypeName)
      if (flowExists(protoFlow)) return protoFlow
    }
    // 3. Prototype-scoped default (e.g. Example/default)
    if (prototypeName) {
      const scopedDefault = resolveFlowName(prototypeName, 'default')
      if (flowExists(scopedDefault)) return scopedDefault
    }
    // 4. Global default — or null if no flow exists at all
    if (flowExists('default')) return 'default'
    return null
  }, [canvasId, isMissingCanvasRoute, storyName, isMissingStoryRoute, sceneParam, flowName, sceneName, prototypeName, pageFlow])

  // Auto-install body class sync (sb-key--value classes on <body>)
  useEffect(() => installBodyClassSync(), [])

  // Keep the HTML title empty. The native MyGo window also blocks title
  // updates before page load, so neither startup nor route changes can put
  // text beside the macOS traffic lights.
  useEffect(() => {
    document.title = ''
  }, [canvasId, prototypeName])

  // Skip flow loading for canvas/story pages and flow-less pages
  const { data, error, flowTokens } = useMemo(() => {
    if (canvasId || isMissingCanvasRoute || storyName || isMissingStoryRoute) return { data: null, error: null, flowTokens: null }
    if (!activeFlowName) return { data: {}, error: null, flowTokens: null }
    try {
      let flowData = loadFlow(activeFlowName)

      // Extract tokens before passing data to consumers (reserved metadata key)
      const extractedTokens = flowData?.tokens || null
      if (flowData?.tokens) {
        flowData = { ...flowData }
        delete flowData.tokens
      }

      // Merge record data if configured (with scoped resolution)
      if (recordName && recordParam && params[recordParam]) {
        const resolvedRecord = resolveRecordName(prototypeName, recordName)
        const entry = findRecord(resolvedRecord, params[recordParam])
        if (entry) {
          flowData = deepMerge(flowData, { record: entry })
        }
      }

      setFlowClass(activeFlowName)
      return { data: flowData, error: null, flowTokens: extractedTokens }
    } catch (err) {
      return { data: null, error: err.message, flowTokens: null }
    }
  }, [canvasId, isMissingCanvasRoute, storyName, isMissingStoryRoute, activeFlowName, recordName, recordParam, params, prototypeName])

  // Resolve prototype-level tokens from .prototype.json metadata
  const protoTokens = useMemo(() => {
    if (!prototypeName) return null
    const meta = getPrototypeMetadata(prototypeName)
    return meta?.tokens || null
  }, [prototypeName])

  // Merge prototype + flow tokens (flow wins). Stable reference when tokens don't change.
  const mergedTokens = useMemo(() => {
    if (!protoTokens && !flowTokens) return null
    return { ...(protoTokens || {}), ...(flowTokens || {}) }
  }, [protoTokens, flowTokens])

  // Track which URL params were set by tokens (vs. user-explicit params)
  const managedParamsRef = useRef({})

  // Apply merged tokens to URL search params via replaceState.
  // Only sets params not already present (user-explicit wins on first load).
  // Cleans up stale managed params when flow/prototype tokens change.
  useEffect(() => {
    const url = new URL(window.location.href)
    const managed = managedParamsRef.current
    const nextManaged = {}
    let changed = false

    // Remove stale managed params no longer in merged tokens
    for (const key of Object.keys(managed)) {
      if (!mergedTokens || !(key in mergedTokens)) {
        url.searchParams.delete(key)
        changed = true
      }
    }

    // Apply current tokens
    if (mergedTokens) {
      const reserved = new Set(['flow', 'scene'])
      for (const [key, value] of Object.entries(mergedTokens)) {
        if (value == null || typeof value === 'object' || reserved.has(key)) continue
        const strValue = String(value)
        if (!url.searchParams.has(key) || (key in managed && managed[key] !== strValue)) {
          url.searchParams.set(key, strValue)
          nextManaged[key] = strValue
          changed = true
        } else if (key in managed) {
          nextManaged[key] = strValue
        }
      }
    }

    managedParamsRef.current = nextManaged

    if (changed) {
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [mergedTokens])

  // Canvas pages get their own rendering path — no flow data needed
  if (canvasId) {
    const canvasData = canvases?.[canvasId]
    const group = canvasData?._group
    // Include the current canvas as a sibling even if it's the only page in its group,
    // so the PageSelector can render and allow adding new pages.
    // canvasIndexKey ensures siblingPages are re-derived on HMR
    // eslint-disable-next-line no-unused-vars
    const _hmrTick = canvasIndexKey
    const siblingPages = group
      ? getCanvasGroupMap().get(group) || []
      : [{ name: canvasId, route: canvasData?._route || `/canvas/${canvasId}`, title: canvasData?.title || canvasId.split('/').pop(), isPrivate: !!canvasData?._isPrivate }]
    const canvasMeta = canvasData?._canvasMeta || null
    const canvasValue = {
      data: null,
      error: null,
      loading: false,
      flowName: null,
      sceneName: null,
      prototypeName: null,
    }
    return (
      <StoryboardContext.Provider value={canvasValue}>
        <SectionErrorBoundary section="Canvas">
          <Suspense fallback={
            <div className={loadingStyles.canvasLoading} role="status" aria-label="Loading canvas">
              <span className="main-loading-spinner" aria-hidden="true" />
            </div>
          }>
            <CanvasPageLazy canvasId={canvasId} siblingPages={siblingPages} canvasMeta={canvasMeta} />
            {initialRouteReadyMarker}
          </Suspense>
        </SectionErrorBoundary>
      </StoryboardContext.Provider>
    )
  }

  // Story pages get their own rendering path — no flow data needed
  if (storyName) {
    const storyValue = {
      data: null,
      error: null,
      loading: false,
      flowName: null,
      sceneName: null,
      prototypeName: null,
    }
    return (
      <StoryboardContext.Provider value={storyValue}>
        <SectionErrorBoundary section="Story">
          <Suspense fallback={null}>
            {isolated ? <StoryPageLazy name={storyName} /> : <ContentFrame kind="story" />}
            {initialRouteReadyMarker}
          </Suspense>
        </SectionErrorBoundary>
      </StoryboardContext.Provider>
    )
  }

  if (isMissingCanvasRoute) {
    const currentUrl = `${location.pathname}${location.search}`
    const truncatedUrl = currentUrl.length > 60
      ? currentUrl.slice(0, 60) + '…'
      : currentUrl

    return (
      <main className={styles.container} data-hc-full-error>
        <div className={styles.banner}>
          <strong>Canvas not found</strong>
          No canvas matches this route.
        </div>
        <p className={styles.meta}>
          Tried to open{' '}
          <a href={currentUrl} title={currentUrl}>{truncatedUrl}</a>
        </p>
        {renderReloadAction(styles.homeLink)}
      </main>
    )
  }

  if (isMissingStoryRoute) {
    const currentUrl = `${location.pathname}${location.search}`
    const truncatedUrl = currentUrl.length > 60
      ? currentUrl.slice(0, 60) + '…'
      : currentUrl

    return (
      <main className={styles.container} data-hc-full-error>
        <div className={styles.banner}>
          <strong>Story not found</strong>
          No story matches this route.
        </div>
        <p className={styles.meta}>
          Tried to open{' '}
          <a href={currentUrl} title={currentUrl}>{truncatedUrl}</a>
        </p>
        {renderReloadAction(styles.homeLink)}
      </main>
    )
  }

  const value = {
    data,
    error,
    loading: false,
    flowName: activeFlowName,
    sceneName: activeFlowName, // backward compat
    prototypeName,
  }

  if (error) {
    const currentUrl = `${location.pathname}${location.search}`
    const truncatedUrl = currentUrl.length > 60
      ? currentUrl.slice(0, 60) + '…'
      : currentUrl

    return (
      <div className={styles.container} data-hc-full-error>
        <div className={styles.banner}>
          <strong>Error loading flow</strong>
          {error}
        </div>
        <p className={styles.meta}>
          Tried to load{' '}
          <a href={currentUrl} title={currentUrl}>{truncatedUrl}</a>
        </p>
        {renderReloadAction(styles.homeLink)}
      </div>
    )
  }

  return (
    <StoryboardContext.Provider value={value}>
      {children}
    </StoryboardContext.Provider>
  )
}
