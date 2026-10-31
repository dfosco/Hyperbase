import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { readProp } from './widgetProps.js'
import { schemas } from './widgetProps.js'
import { getTerminalConfig, getTerminalDimensions } from '../../../core/index.js'
import { useOverride } from '../../hooks/useOverride.js'
import { getSplitPaneLabel, findAllConnectedSplitTargets, buildPaneForWidget, buildSplitLayout } from './expandUtils.js'
import ExpandedPane from './ExpandedPane.jsx'
import FrozenTerminalOverlay from './FrozenTerminalOverlay.jsx'
import Icon from '../../Icon.jsx'
import styles from './TerminalWidget.module.css'
import overlayStyles from './embedOverlay.module.css'
import { writePreservingScroll } from './terminalScroll.js'
import { installMobileBeforeInputBridge, isTouchKeyboardDevice } from './terminalMobileInput.js'
import { storyboardWs } from '../../storyboard-ws.js'
import { shouldGateAgentInput } from './agentBootstrapGate.js'

const terminalSchema = schemas['terminal']
const CONTEXT_RECHECK_DELAYS = [1000, 2000, 4000, 8000, 10000]

let ghosttyPromise = null
function loadGhostty() {
  if (!ghosttyPromise) {
    ghosttyPromise = import(/* @vite-ignore */ 'ghostty-web')
      .then(async (mod) => {
        if (mod.init) await mod.init()
        return mod
      })
      .catch((err) => {
        ghosttyPromise = null
        console.warn('[TerminalWidget] ghostty-web not available:', err.message)
        return null
      })
  }
  return ghosttyPromise
}

// Global registry so split-screen can look up any terminal's ghostty + WS by widget ID
const terminalRegistry = new Map()
if (typeof window !== 'undefined') window.__storyboardTerminalRegistry = terminalRegistry

function getWsUrl(sessionId, prettyName, startupCommand, agentId, dimensions, viewId, retained = false, refresh = false) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const baseClean = base.endsWith('/') ? base : base + '/'
  const canvasId = window.__storyboardCanvasBridgeState?.canvasId || 'unknown'
  let url = `${protocol}//${location.host}${baseClean}_hypercanvas/terminal/${sessionId}?canvas=${encodeURIComponent(canvasId)}`
  if (retained) url += '&retained=1'
  if (refresh) url += '&refresh=1'
  if (viewId) url += `&viewId=${encodeURIComponent(viewId)}`
  if (prettyName) url += `&name=${encodeURIComponent(prettyName)}`
  if (agentId) url += `&agentId=${encodeURIComponent(agentId)}`
  if (startupCommand) url += `&startupCommand=${encodeURIComponent(startupCommand)}`
  if (dimensions) url += `&cols=${dimensions.cols}&rows=${dimensions.rows}`
  return url
}

function calcDimensions(widthPx, heightPx, fontSize = 13) {
  // Cell dimensions scale proportionally with font size.
  // Base measurements at 13px: ~7.8px wide, ~17px tall.
  const scale = fontSize / 13
  const cellWidth = 7.8 * scale
  const cellHeight = 17 * scale
  // .terminal has 16px padding + 1px border on each side (box-sizing: border-box)
  const hPad = 34 // (16+1) * 2
  const vPad = 34
  const cols = Math.max(10, Math.floor((widthPx - hPad) / cellWidth))
  const rows = Math.max(4, Math.floor((heightPx - vPad) / cellHeight))
  return { cols, rows }
}

/**
 * Fit a terminal (by widget ID) to a container element using real cell metrics.
 * Works for both the primary and secondary terminal in split-screen.
 */
function fitTerminalToElement(widgetId, containerEl) {
  const entry = terminalRegistry.get(widgetId)
  if (!entry || !containerEl) return
  const { term, ws } = entry
  const cw = term.renderer?.charWidth
  const ch = term.renderer?.charHeight
  if (!cw || !ch) return
  const w = containerEl.clientWidth
  const h = containerEl.clientHeight
  // Skip if container hasn't laid out yet (flex: 1 may not have resolved)
  if (w < 50 || h < 50) return
  const cols = Math.max(10, Math.floor(w / cw))
  const rows = Math.max(4, Math.floor(h / ch))
  term.resize?.(cols, rows)
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols, rows }))
  }
}

const DEFAULT_THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#e6edf3',
  selectionBackground: '#264f78',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39d2c0',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
}

export default forwardRef(function TerminalWidget({ id, props, onUpdate, multiSelected }, ref) {
  const cfg = getTerminalConfig()
  const fontSize = cfg.fontSize ?? 13
  const agentId = props?.agentId || null
  // Config dimensions are authoritative — always use them as the base
  const dims = getTerminalDimensions(agentId, {
    width: readProp(props, 'width', terminalSchema),
    height: readProp(props, 'height', terminalSchema),
  })
  const width = dims.width
  const height = dims.height
  const currentDimensionsRef = useRef({ width, height, fontSize })
  useEffect(() => { currentDimensionsRef.current = { width, height, fontSize } }, [width, height, fontSize])
  const alias = props?.alias || null
  const prettyName = props?.prettyName || null
  const startupCommand = props?.startupCommand || null
  const isAgent = Boolean(agentId) || id.startsWith('agent-')

  // Inline alias editing (double-click Easter egg)
  const [editingAlias, setEditingAlias] = useState(false)
  const [aliasInput, setAliasInput] = useState('')
  const aliasInputRef = useRef(null)

  const handleAliasDoubleClick = useCallback((e) => {
    if (!isAgent) return
    e.stopPropagation()
    setAliasInput(alias || '')
    setEditingAlias(true)
  }, [isAgent, alias])

  const commitAlias = useCallback(() => {
    setEditingAlias(false)
    const trimmed = aliasInput.trim()
    const newAlias = trimmed || ''
    if (newAlias !== (alias || '')) {
      onUpdate?.({ alias: newAlias })
    }
  }, [aliasInput, alias, onUpdate])

  const handleAliasKeyDown = useCallback((e) => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.preventDefault(); commitAlias() }
    if (e.key === 'Escape') { e.preventDefault(); setEditingAlias(false) }
  }, [commitAlias])

  useEffect(() => {
    if (editingAlias && aliasInputRef.current) {
      aliasInputRef.current.focus()
      aliasInputRef.current.select()
    }
  }, [editingAlias])

  // Snapped dimensions computed from ghostty's actual cell metrics (set after open)
  const [snappedHeight, setSnappedHeight] = useState(null)
  const [snappedWidth, setSnappedWidth] = useState(null)

  const containerRef = useRef(null)
  const termRef = useRef(null)
  const terminalRef = useRef(null)
  const wsRef = useRef(null)
  const refreshAttachmentRef = useRef(null)
  const refreshExistingRef = useRef(false)

  const [viewId] = useState(() => globalThis.crypto?.randomUUID?.() || `terminal-view-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const [connectionProgress, setConnectionProgress] = useState('Connecting terminal…')
  const [ready, setReady] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [connectAttempt, setConnectAttempt] = useState(0)
  // A terminal process outlives its browser attachment. Keep a bounded retry
  // budget for transport disconnects so a live PTY does not appear to sleep.
  const reconnectRetriesRef = useRef(0)
  const retryTimerRef = useRef(null)
  const stableConnectionTimerRef = useRef(null)
  const attachmentReadyRef = useRef(false)
  const terminalFailureRef = useRef(false)
  const MAX_RECONNECT_RETRIES = 5
  const [interactive, setInteractive] = useState(false)
  const [expandedOverride, setExpandedOverride, clearExpandedOverride] = useOverride(`_terminal_expanded_${id}`)
  const expandMode = expandedOverride === 'single' || expandedOverride === 'split' ? expandedOverride : expandedOverride === 'true' ? 'split' : null
  const expanded = expandMode !== null
  const setExpanded = useCallback((mode) => {
    if (mode) setExpandedOverride(mode)
    else clearExpandedOverride()
  }, [setExpandedOverride, clearExpandedOverride])
  const [contextState, setContextState] = useState(null)
  const contextStateRef = useRef(null)
  const contextStateVersionRef = useRef(0)
  const [contextCheckFailure, setContextCheckFailure] = useState(null)
  // An agent may still be warming up while Ghostty is already connected.
  // Never open its editor before bootstrap acknowledgement by default.
  const [bypassedContextLaunch, setBypassedContextLaunch] = useState(null)
  const [attentionContextLaunch, setAttentionContextLaunch] = useState(null)
  const contextLaunchKey = contextState?.launchId || '__awaiting-bootstrap__'
  const contextCheckMessage = contextState?.phase === 'starting' && contextCheckFailure?.launchId === contextLaunchKey ? contextCheckFailure.message : null
  const contextNeedsAttention = Boolean(isAgent && contextState?.phase === 'starting' && attentionContextLaunch === contextLaunchKey)
  const bootstrapPending = shouldGateAgentInput(isAgent, contextState, bypassedContextLaunch === contextLaunchKey || contextNeedsAttention)
  // A PTY can also receive input through expanded panes or mobile bridges,
  // which do not necessarily pass through the inline overlay's DOM boundary.
  const bootstrapPendingRef = useRef(bootstrapPending)
  useEffect(() => { bootstrapPendingRef.current = bootstrapPending }, [bootstrapPending])
  const releasedContextLaunchRef = useRef(null)
  const applyContextState = useCallback((state) => {
    // Protocol callbacks can deliver input before React commits the next render.
    contextStateRef.current = state
    contextStateVersionRef.current++
    bootstrapPendingRef.current = shouldGateAgentInput(isAgent, state, releasedContextLaunchRef.current === (state?.launchId || '__awaiting-bootstrap__'))
    setContextState(state)
  }, [isAgent])
  // A context notification can be lost while the terminal stream stays open.
  // Reconcile only the pending launch, for a bounded startup window. Ready
  // widgets do not poll, and HTTP responses never overrule newer live frames.
  useEffect(() => {
    const launchId = contextState?.launchId
    if (!isAgent || contextState?.phase !== 'starting' || !launchId) return
    let cancelled = false
    let timer = null
    let deadline = null
    let controller = null
    let attempt = 0
    let lastFailure = null
    const current = () => !cancelled && contextStateRef.current?.launchId === launchId && contextStateRef.current?.phase === 'starting'
    const schedule = () => {
      if (!current() || attempt >= CONTEXT_RECHECK_DELAYS.length) return
      timer = setTimeout(check, CONTEXT_RECHECK_DELAYS[attempt++])
    }
    const check = async () => {
      if (!current()) return
      const version = contextStateVersionRef.current
      controller = new AbortController()
      deadline = setTimeout(() => controller?.abort(), 3000)
      try {
        const base = import.meta.env?.BASE_URL || '/'
        const response = await fetch(`${base.endsWith('/') ? base : base + '/'}_hypercanvas/canvas/terminal/context`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgetId: id, action: 'state' }), signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok) {
          if (response.status < 500 && ![408, 425, 429].includes(response.status)) attempt = CONTEXT_RECHECK_DELAYS.length
          throw new Error(result.error || 'Context state is unavailable')
        }
        if (!current() || contextStateVersionRef.current !== version) return
        if (result.state?.launchId !== launchId) return
        lastFailure = null
        applyContextState(result.state)
      } catch (error) {
        lastFailure = error.name === 'AbortError' ? 'Context verification timed out.' : error.message
      } finally {
        if (deadline) clearTimeout(deadline)
        controller = null
        if (current()) {
          if (attempt < CONTEXT_RECHECK_DELAYS.length) schedule()
          else setContextCheckFailure({ launchId, message: lastFailure
            ? `Could not verify startup context: ${lastFailure}`
            : 'The server has not confirmed startup context readiness.' })
        }
      }
    }
    schedule()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (deadline) clearTimeout(deadline)
      controller?.abort()
    }
  }, [id, isAgent, contextState?.launchId, contextState?.phase, applyContextState])
  const menuListeners = useRef(new Set())
  const [waking, setWaking] = useState(false)
  const [resourceLimited, setResourceLimited] = useState(null)
  const [showDragHint, setShowDragHint] = useState(false)
  // Set when the browser refuses to grant a WebGL context (hard limit ~8–16
  // contexts depending on browser) or when an existing context is lost.
  // Flips the widget back to the frozen overlay so it degrades gracefully
  // instead of rendering as a broken/blank canvas.
  const [webglUnavailable, setWebglUnavailable] = useState(false)
  const expandContainerRef = useRef(null)
  const dragHintTimer = useRef(null)

  // Request activation when user clicks a frozen terminal (only shown if a
  // real WebGL context loss / open failure has occurred).
  const handleFrozenActivate = useCallback(() => {
    // Clear the browser-WebGL-exhaustion flag and retry — the user may have
    // closed other widgets/tabs since the original failure.
    setWebglUnavailable(false)
    reconnectRetriesRef.current = 0
    terminalFailureRef.current = false
    setConnectAttempt((n) => n + 1)
  }, [])

  const retryContext = useCallback(async () => {
    const base = import.meta.env?.BASE_URL || '/'
    try {
      const response = await fetch(`${base.endsWith('/') ? base : base + '/'}_hypercanvas/canvas/terminal/context`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetId: id, action: 'retry' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Context retry failed')
      applyContextState(result.state || null)
    } catch (error) { applyContextState({ ...contextStateRef.current, delivery: 'error', message: error.message }) }
  }, [id, applyContextState])

  const menuState = useMemo(() => {
    if (!contextState) return { 'code-context': <div className={styles.contextActions}>Waiting for canvas context…</div> }
    const status = contextState.targetStatus && contextState.targetStatus !== 'available'
      ? contextState.targetStatus : contextState.delivery
    const selectedSite = contextState.targetStatus === 'selection-required' ? null : contextState.target?.siteId || ''
    const options = [{ siteId: '', title: 'Notebook' }, ...(contextState.candidates || [])]
    return { 'code-context': (
      <div className={styles.contextActions} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        {options.map(candidate => (
          <button
            key={candidate.siteId}
            type="button"
            role="menuitemradio"
            aria-checked={candidate.siteId === selectedSite}
            disabled={Boolean(candidate.error)}
            className={styles.contextOption}
            onClick={() => onUpdate?.({ codingTargetSiteId: candidate.siteId })}
          >
            <span className={styles.contextCheck}>{candidate.siteId === selectedSite && <Icon name="primer/check" size={12} />}</span>
            <span>
              <span>{candidate.title || candidate.siteId}</span>
              {(candidate.root || candidate.error) && <span className={styles.contextPath}>{candidate.siteId === contextState.target?.siteId ? contextState.target.root : candidate.root || candidate.error}</span>}
            </span>
          </button>
        ))}
        {status && !['acknowledged', 'available'].includes(status) && <span className={styles.contextStatus} title={contextState.message || undefined} role="status">Context: {status}{contextState.phase === 'stopped' ? ' · agent stopped' : ''}</span>}
        {contextState.delivery === 'error' && <button className={styles.contextRetry} type="button" onClick={retryContext}>Refresh context file</button>}
      </div>
    ) }
  }, [contextState, onUpdate, retryContext])

  useEffect(() => {
    for (const listener of menuListeners.current) listener()
  }, [menuState])

  useImperativeHandle(ref, () => ({
    getMenuState() { return menuState },
    subscribeMenuState(listener) {
      menuListeners.current.add(listener)
      return () => menuListeners.current.delete(listener)
    },

    handleAction(actionId) {
      if (actionId === 'refresh-terminal') { refreshAttachmentRef.current?.(); return true }
      if (actionId === 'expand') { setExpanded('single'); return true }
      if (actionId === 'expand-single') { setExpanded('single'); return true }
      if (actionId === 'split-screen') { setExpanded('split'); return true }
      if (actionId === 'toggle-private') {
        const isPrivate = !!props?.private
        onUpdate?.({ private: !isPrivate })
        return true
      }
      return false
    },
  }), [setExpanded, props, onUpdate, menuState])

  // Context is supplied in native launch arguments, never injected into the
  // PTY. A consent/auth prompt must not be hidden indefinitely behind its ACK.
  // Release input after a bounded wait, while keeping readiness unverified.
  useEffect(() => {
    if (!bootstrapPending) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInteractive(false)
    const focused = document.activeElement
    if (terminalRef.current?.contains(focused) && typeof focused?.blur === 'function') focused.blur()
    const timer = setTimeout(() => {
      releasedContextLaunchRef.current = contextLaunchKey
      bootstrapPendingRef.current = false
      setAttentionContextLaunch(contextLaunchKey)
    }, 30000)
    return () => clearTimeout(timer)
  }, [bootstrapPending, contextLaunchKey])

  // Exit interactive on click outside
  useEffect(() => {
    if (!interactive) return
    function handlePointerDown(e) {
      if (terminalRef.current && !terminalRef.current.contains(e.target)) {
        const chromeEl = e.target.closest(`[data-widget-id="${id}"]`)
        if (chromeEl) return
        setInteractive(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [interactive, id])

  // Exit interactive when terminal becomes part of a multi-selection
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (multiSelected && interactive) setInteractive(false)
  }, [multiSelected])

  // Keep the canvas-owned screenshot paste gate in sync with the terminal's
  // actual interactive state. Selection alone must never bypass the overlay,
  // and a disconnected PTY must never be sent input.
  useEffect(() => {
    const entry = terminalRegistry.get(id)
    if (!entry) return
    entry.canPasteScreenshot = Boolean(isAgent && ready && revealed && interactive && !bootstrapPending && !multiSelected && !sessionEnded && !webglUnavailable)
    return () => {
      if (terminalRegistry.get(id) === entry) entry.canPasteScreenshot = false
    }
  }, [id, isAgent, ready, revealed, interactive, bootstrapPending, multiSelected, sessionEnded, webglUnavailable])

  // Persist agent status (done/error/cancelled) so chrome can paint the
  // ready indicator and CanvasPage can derive the "agents ready" list.
  // Only agent-* terminals receive these events.
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => {
    if (!isAgent) return
    const handler = (data) => {
      if (data?.widgetId !== id) return
      if (data.status === 'done' || data.status === 'completed') {
        onUpdateRef.current?.({ status: 'done' })
      } else if (data.status === 'error') {
        onUpdateRef.current?.({ status: 'error', errorMessage: data.message || 'Unknown error' })
      } else if (data.status === 'cancelled') {
        onUpdateRef.current?.({ status: 'idle', errorMessage: '' })
      } else if (data.status === 'working') {
        onUpdateRef.current?.({ status: 'working' })
      } else if (data.status === 'running' || data.status === 'pending') {
        onUpdateRef.current?.({ status: 'running' })
      }
    }
    storyboardWs.on('storyboard:agent-status', handler)
    return () => storyboardWs.off('storyboard:agent-status', handler)
  }, [id, isAgent])

  // Connect terminal + WebSocket. Skip when the browser has already failed
  // to allocate a WebGL context for this widget (frozen overlay is showing).
  useEffect(() => {
    if (webglUnavailable) return
    if (!containerRef.current) return

    let disposed = false
    let term = null
    let ws = null
    let removeMobileInputBridge = null
    let attachmentTimer = null
    let hasAttached = false
    refreshExistingRef.current = false
    let restoreFocus = null
    const currentDimensions = () => {
      const dimensions = currentDimensionsRef.current
      return calcDimensions(dimensions.width, dimensions.height, dimensions.fontSize)
    }

    async function setup() {
      try {
        const ghostty = await loadGhostty()
        if (disposed) return
        if (!ghostty) {
          setError('ghostty-web not installed — add it to your dependencies to enable terminal widgets')
          return
        }

        const cfg = getTerminalConfig()

        // Wait for web fonts to load before initializing ghostty's glyph atlas.
        // Without this, ghostty rasterizes glyphs against fallback font metrics,
        // then when the real font swaps in, glyphs render misaligned against the
        // cell grid (visible as broken box-drawing characters and overstrike on
        // letters). Especially visible on consumer installs where fonts come
        // over the network instead of from cache.
        if (typeof document !== 'undefined' && document.fonts?.ready) {
          try { await document.fonts.ready } catch { /* font load failures are non-fatal */ }
          if (disposed) return
        }

        const dims = currentDimensions()

        term = new ghostty.Terminal({
          fontSize: cfg.fontSize ?? 13,
          fontFamily: cfg.fontFamily ?? "'Ghostty', 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
          // Keep a real local history for normal-screen output. Full-screen
          // TUIs such as Codex use the alternate screen and cannot expose
          // scrollback by design, but this preserves all preceding shell and
          // post-exit output instead of dropping it at the viewport boundary.
          scrollback: cfg.scrollback ?? 10000,
          cursorBlink: true,
          cursorStyle: 'bar',
          cols: dims.cols,
          rows: dims.rows,
          theme: { ...DEFAULT_THEME, ...cfg.theme },
        })

        // Suppress ghostty's automatic focus-stealing on the canvas surface.
        //
        // ghostty-web calls `element.focus()` (without `preventScroll`) at the
        // end of `open()` and again on every canvas mousedown — the browser
        // then scrolls the freshly-focused contenteditable into view, yanking
        // the canvas viewport whenever the user clicks near a terminal or
        // when the page loads with multiple terminals on screen.
        //
        // The fix: monkey-patch the container's `focus` so every ghostty-
        // initiated call passes `{ preventScroll: true }`. The user's
        // intentional focus paths (the click-to-interact overlay, the
        // explicit handleClick in this widget) already pass that flag, so
        // they behave identically. Restored on dispose.
        const containerEl = containerRef.current
        const originalFocus = containerEl?.focus
        restoreFocus = () => { if (containerEl && originalFocus) containerEl.focus = originalFocus }
        if (containerEl && originalFocus) {
          containerEl.focus = function patchedTerminalFocus(opts) {
            return originalFocus.call(this, { ...(opts || {}), preventScroll: true })
          }
        }

        // Capture the current focus + scroll so the `open()` self-focus
        // below doesn't visibly move anything even if preventScroll wasn't
        // enough (some browsers still scroll programmatically-focused
        // contenteditables).
        const prevActive = document.activeElement
        const scrollEl = containerEl?.closest('[class*="canvasScroll"]')
        const prevScrollTop = scrollEl?.scrollTop ?? 0
        const prevScrollLeft = scrollEl?.scrollLeft ?? 0

        try {
          term.open(containerRef.current)
        } catch (openErr) {
          // Most commonly the browser refusing to allocate yet another
          // WebGL context (hard cap ~8–16). Degrade to the frozen overlay
          // instead of leaving a blank canvas behind.
          console.warn('[TerminalWidget] ghostty.open failed — falling back to frozen overlay:', openErr)
          try { term.dispose?.() } catch { /* empty */ }
          term = null
          termRef.current = null
          if (!disposed) setWebglUnavailable(true)
          return
        }

        // Hand focus back to whatever element owned it before open().
        // Without this, page load with N terminal widgets ends with the
        // last-initialized one holding focus, which the user perceives
        // as random viewport jumps and as Cmd+Z being swallowed by xterm.
        if (containerEl && document.activeElement === containerEl) {
          if (prevActive && prevActive !== document.body && typeof prevActive.focus === 'function') {
            try { prevActive.focus({ preventScroll: true }) } catch { /* best effort */ }
          } else {
            try { containerEl.blur() } catch { /* best effort */ }
          }
        }
        if (scrollEl && (scrollEl.scrollTop !== prevScrollTop || scrollEl.scrollLeft !== prevScrollLeft)) {
          scrollEl.scrollTop = prevScrollTop
          scrollEl.scrollLeft = prevScrollLeft
        }

        // If ghostty silently failed to obtain a WebGL renderer, treat
        // the same as a browser-cap miss and show the frozen overlay.
        if (!term.renderer) {
          console.warn('[TerminalWidget] ghostty has no renderer (likely WebGL exhausted) — frozen fallback')
          try { term.dispose?.() } catch { /* empty */ }
          term = null
          termRef.current = null
          if (!disposed) setWebglUnavailable(true)
          return
        }

        // Listen for the browser killing this WebGL context later (it
        // does this LRU-style when other tabs/widgets need a slot).
        const canvas = containerRef.current?.querySelector('canvas')
        if (canvas) {
          const onLost = (e) => {
            e.preventDefault?.()
            console.warn('[TerminalWidget] WebGL context lost — frozen fallback')
            if (!disposed) setWebglUnavailable(true)
          }
          canvas.addEventListener('webglcontextlost', onLost, { once: true })
        }

        termRef.current = term

        // Expose ghostty's actual computed cell metrics as CSS variables
        // Set on .terminal (terminalRef) so they cascade into .xtermContainer
        const cw = term.renderer?.charWidth
        const ch = term.renderer?.charHeight
        const wrap = terminalRef.current
        if (wrap && cw) wrap.style.setProperty('--term-char-width', `${cw}px`)
        if (wrap && ch) wrap.style.setProperty('--term-char-height', `${ch}px`)
        if (wrap) {
          wrap.style.setProperty('--term-cols', dims.cols)
          wrap.style.setProperty('--term-rows', dims.rows)
          wrap.style.setProperty('--term-font-size', `${cfg.fontSize ?? 13}px`)
          const theme = { ...DEFAULT_THEME, ...cfg.theme }
          wrap.style.setProperty('--term-bg', theme.background)
        }

        // Snap container to exact cell grid using real metrics
        // .terminal has 16px padding + 1px border on each side = 34px chrome per axis
        if (!disposed) {
          const pad = 34
          if (ch) setSnappedHeight(Math.round(dims.rows * ch) + pad)
          if (cw) setSnappedWidth(Math.round(dims.cols * cw) + pad)
        }

        // SGR mouse wheel for terminal scroll in alternate screen
        term.attachCustomWheelEventHandler((e) => {
          if (!(term.wasmTerm?.isAlternateScreen?.() ?? false)) return false
          const sock = wsRef.current
          if (!attachmentReadyRef.current || bootstrapPendingRef.current || !sock || sock.readyState !== WebSocket.OPEN) return true
          const btn = e.deltaY < 0 ? 64 : 65
          const lines = Math.max(1, Math.min(5, Math.ceil(Math.abs(e.deltaY) / 33)))
          for (let i = 0; i < lines; i++) {
            sock.send(`\x1b[<${btn};1;1M`)
            sock.send(`\x1b[<${btn};1;1m`)
          }
          return true
        })

        // Ghostty receives desktop input through `keydown`. Mobile virtual
        // keyboards normally emit only `beforeinput`; Ghostty prevents that
        // event to protect its canvas, leaving the PTY with no input at all.
        // Bridge only coarse touch devices so physical keyboards retain
        // Ghostty's native key encoder and cannot be double-sent.
        removeMobileInputBridge = installMobileBeforeInputBridge(containerEl, {
          isTouchDevice: isTouchKeyboardDevice,
          send: (data) => {
            if (attachmentReadyRef.current && !bootstrapPendingRef.current && ws?.readyState === WebSocket.OPEN) ws.send(data)
          },
        })

        // Registry also exposes a gated paste API to the canvas. Send a
        // bracketed paste directly to the PTY: it inserts at the agent's
        // current input cursor without submitting the prompt.
        const registerTerminal = () => terminalRegistry.set(id, {
          term, ws, isAgent, canPasteScreenshot: false,
          pasteText: (text) => {
            if (!attachmentReadyRef.current || bootstrapPendingRef.current || ws?.readyState !== WebSocket.OPEN) return false
            ws.send('\x1b[200~' + text + '\x1b[201~')
            return true
          },
        })

        const clearAttachmentTimer = () => {
          if (attachmentTimer) clearTimeout(attachmentTimer)
          attachmentTimer = null
        }
        const scheduleReconnect = (message) => {
          if (disposed || terminalFailureRef.current || retryTimerRef.current) return false
          if (reconnectRetriesRef.current >= MAX_RECONNECT_RETRIES) return false
          reconnectRetriesRef.current++
          const delay = Math.min(500 * Math.pow(2, reconnectRetriesRef.current - 1), 5000)
          setSessionEnded(false)
          setError(null)
          setConnectionProgress(message || 'Reconnecting terminal…')
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            if (!disposed) connect()
          }, delay)
          return true
        }
        const connect = () => {
          attachmentReadyRef.current = false
          setReady(false)
          const socket = new WebSocket(getWsUrl(id, prettyName, refreshExistingRef.current ? null : startupCommand, agentId, currentDimensions(), viewId, hasAttached, refreshExistingRef.current))
          ws = socket
          wsRef.current = socket
          const entry = terminalRegistry.get(id)
          if (entry?.term === term) entry.ws = socket
          let attachmentBusyMessage = null
          let retryableFailureMessage = null
          const current = () => !disposed && ws === socket
          // An upgrade alone does not confirm the PTY exists. Bound both the
          // opening and session-info wait so a dropped handshake can recover.
          clearAttachmentTimer()
          attachmentTimer = setTimeout(() => {
            if (!current() || attachmentReadyRef.current) return
            socket.close()
          }, 15000)
          socket.onopen = () => {
            if (!current()) return
            setSessionEnded(false)
            setError(null)
            setConnectionProgress('Waiting for terminal process…')
          }

          socket.onmessage = (e) => {
            if (!current()) return
            const data = typeof e.data === 'string' ? e.data : null
            if (data && data.startsWith('{')) {
              try {
                const msg = JSON.parse(data)
                if (msg.type === 'resource-limited') {
                  clearAttachmentTimer()
                  attachmentReadyRef.current = false
                  setReady(false)
                  terminalFailureRef.current = true
                  setResourceLimited(msg)
                  setSessionEnded(true)
                  return
                }
                if (msg.type === 'error') {
                  clearAttachmentTimer()
                  attachmentReadyRef.current = false
                  setReady(false)
                  if (msg.retryable === true) {
                    retryableFailureMessage = msg.message || 'Runtime temporarily unavailable. Reconnecting…'
                    terminalFailureRef.current = false
                    setConnectionProgress(retryableFailureMessage)
                    return
                  }
                  terminalFailureRef.current = true
                  setError(msg.message || 'Failed to start terminal session')
                  setSessionEnded(true)
                  return
                }
                if (msg.type === 'context-state') { applyContextState(msg.state || null); return }
                if (msg.type === 'terminal-restore') {
                  if (msg.cols > 0 && msg.rows > 0) term.resize(msg.cols, msg.rows)
                  // hardReset: false marks history-only replays (captured
                  // scrollback) — they must flow into the buffer without
                  // wiping it; state restores keep the full reset.
                  term.write(`${msg.hardReset === false ? '' : '\x1bc'}${msg.data || ''}`)
                  return
                }
                if (msg.type === 'session-info') {
                  clearAttachmentTimer()
                  applyContextState(msg.contextState || null)
                  attachmentReadyRef.current = true
                  hasAttached = true
                  registerTerminal()
                  terminalFailureRef.current = false
                  setReady(true)
                  setSessionEnded(false)
                  setError(null)
                  if (stableConnectionTimerRef.current) clearTimeout(stableConnectionTimerRef.current)
                  stableConnectionTimerRef.current = setTimeout(() => {
                    stableConnectionTimerRef.current = null
                    reconnectRetriesRef.current = 0
                  }, 10000)
                  // The socket can open before the server finishes creating the
                  // PTY and installs its message listener. Resize only after the
                  // explicit readiness frame, confirming the dimensions sent
                  // with attachment even when an older server ignores them.
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'resize', ...currentDimensions() }))
                  }
                  return
                }
                if (msg.type === 'session-ended') {
                  terminalFailureRef.current = true
                  attachmentReadyRef.current = false
                  setSessionEnded(true)
                  setReady(false)
                  return
                }
                if (msg.type === 'attachment-busy') {
                  attachmentBusyMessage = msg.message || 'Terminal is in use in another view.'
                  return
                }
                if (msg.type === 'detached') {
                  attachmentReadyRef.current = false
                  setReady(false)
                  terminalFailureRef.current = true
                  setError(msg.message || 'Terminal is attached in another view. Reconnect explicitly.')
                  setSessionEnded(true)
                  return
                }
                if (msg.type === 'conflict') return
              } catch { /* not JSON */ }
            }
            writePreservingScroll(term, typeof e.data === 'string' ? e.data : new Uint8Array(e.data))
          }

          // Retry attachment loss, never explicit provider failures or takeover.
          socket.onclose = (event) => {
            if (!current()) return
            clearAttachmentTimer()
            attachmentReadyRef.current = false
            if (event.code === 4001 && !attachmentBusyMessage) terminalFailureRef.current = true
            setReady(false)
            if (stableConnectionTimerRef.current) {
              clearTimeout(stableConnectionTimerRef.current)
              stableConnectionTimerRef.current = null
            }
            if (scheduleReconnect(attachmentBusyMessage ? 'Waiting for the other terminal view…' : retryableFailureMessage)) return
            if (!terminalFailureRef.current) setError(attachmentBusyMessage || (retryableFailureMessage ? `${retryableFailureMessage} Automatic recovery attempts exhausted.` : 'Connection lost after automatic recovery attempts. Check the runtime and retry.'))
            setSessionEnded(true)
          }
          socket.onerror = () => {
            if (!current()) return
            attachmentReadyRef.current = false
            setReady(false)
            // close follows error and owns the single reconnect timer.
          }
        }
        // Refresh repairs this view only. The server must reject refresh=1
        // when the native session is gone rather than launching a replacement.
        refreshAttachmentRef.current = () => {
          if (disposed) return
          refreshExistingRef.current = true
          attachmentReadyRef.current = false
          terminalFailureRef.current = false
          reconnectRetriesRef.current = 0
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
          retryTimerRef.current = null
          if (stableConnectionTimerRef.current) clearTimeout(stableConnectionTimerRef.current)
          stableConnectionTimerRef.current = null
          clearAttachmentTimer()
          setError(null)
          setResourceLimited(null)
          setSessionEnded(false)
          setConnectionProgress('Refreshing terminal…')
          // Invalidate callbacks before closing; close must not schedule a
          // second connection alongside this explicit attachment refresh.
          const previous = ws
          ws = null
          if (previous?.readyState <= WebSocket.OPEN) previous.close(1000, 'Refreshing terminal view')
          connect()
        }
        connect()

        term.onData((data) => {
          if (attachmentReadyRef.current && !bootstrapPendingRef.current && ws?.readyState === WebSocket.OPEN) ws.send(data)
        })


      } catch (err) {
        if (!disposed) setError(err.message || 'Failed to load terminal')
      }
    }

    setup()

    return () => {
      disposed = true
      refreshAttachmentRef.current = null
      attachmentReadyRef.current = false
      if (attachmentTimer) clearTimeout(attachmentTimer)
      restoreFocus?.()
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current)
        stableConnectionTimerRef.current = null
      }
      if (terminalRegistry.get(id)?.term === term) terminalRegistry.delete(id)
      if (ws && ws.readyState <= WebSocket.OPEN) ws.close()
      removeMobileInputBridge?.()
      if (term) term.dispose()
      termRef.current = null
      wsRef.current = null
      setReady(false)
      setRevealed(false)
    }
  }, [id, agentId, startupCommand, prettyName, connectAttempt, webglUnavailable, applyContextState, viewId, isAgent])

  // Resize terminal on dimension changes
  useEffect(() => {
    if (!termRef.current) return
    const timer = setTimeout(() => {
      const dims = calcDimensions(width, height, fontSize)
      termRef.current?.resize?.(dims.cols, dims.rows)
      // Update CSS variables after resize
      const wrap = terminalRef.current
      const cw = termRef.current?.renderer?.charWidth
      const ch = termRef.current?.renderer?.charHeight
      if (wrap && cw) wrap.style.setProperty('--term-char-width', `${cw}px`)
      if (wrap && ch) wrap.style.setProperty('--term-char-height', `${ch}px`)
      if (wrap) {
        wrap.style.setProperty('--term-cols', dims.cols)
        wrap.style.setProperty('--term-rows', dims.rows)
      }
      // Re-snap to cell grid
      const pad = 34
      if (ch) setSnappedHeight(Math.round(dims.rows * ch) + pad)
      if (cw) setSnappedWidth(Math.round(dims.cols * cw) + pad)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [width, height])

  // Reveal mask — hide terminal for 750ms after ready to mask startup flash
  useEffect(() => {
    if (!ready) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevealed(false)
      return
    }
    const timer = setTimeout(() => {
      setRevealed(true)
    }, 750)
    return () => clearTimeout(timer)
  }, [ready])

  // Restore ordinary typing once the primary agent acknowledges the
  // initial context. Connector changes after startup cannot re-lock input.
  useEffect(() => {
    if (!revealed || bootstrapPending || sessionEnded) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInteractive(true)
  }, [revealed, bootstrapPending, sessionEnded])

  const typeLabel = isAgent ? 'Agent' : 'Terminal'
  const showLeaderCrown = isAgent && props?.role === 'leader'
  const attachedState = bootstrapPending ? 'preparing'
    : contextNeedsAttention || contextState?.phase === 'blocked' || contextState?.delivery === 'error' ? 'attention'
      : isAgent && contextState?.phase !== 'ready' ? 'attached' : 'connected'
  const terminalState = resourceLimited
    ? 'resource-limited'
    : error
      ? 'error'
      : sessionEnded
        ? 'ended'
        : ready
          ? attachedState
          : 'connecting'

  // Reparent terminal DOM between inline and expand container
  useEffect(() => {
    const xtermEl = containerRef.current
    if (!xtermEl) return
    if (expanded && expandContainerRef.current) {
      expandContainerRef.current.appendChild(xtermEl)
    } else if (!expanded && terminalRef.current) {
      terminalRef.current.appendChild(xtermEl)
    }
  }, [expanded])

  // Restore size on collapse
  useEffect(() => {
    if (expanded || !termRef.current) return
    const timer = setTimeout(() => {
      const dims = calcDimensions(width, height, fontSize)
      termRef.current?.resize?.(dims.cols, dims.rows)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [expanded, width, height])

  // Focus terminal on expand
  useEffect(() => {
    if (expanded && expandContainerRef.current) {
      fitTerminalToElement(id, expandContainerRef.current)
    }
  }, [expanded])

  const handleClick = useCallback(() => {
    if (sessionEnded || multiSelected || bootstrapPending) return
    if (revealed) {
      setInteractive(true)
      const scrollEl = terminalRef.current?.closest('[class*="canvasScroll"]')
      const scrollTop = scrollEl?.scrollTop
      const scrollLeft = scrollEl?.scrollLeft
      termRef.current?.focus({ preventScroll: true })
      if (scrollEl && (scrollEl.scrollTop !== scrollTop || scrollEl.scrollLeft !== scrollLeft)) {
        scrollEl.scrollTop = scrollTop
        scrollEl.scrollLeft = scrollLeft
      }
    }
  }, [sessionEnded, multiSelected, revealed, bootstrapPending])

  const handleTerminalPointerDown = useCallback((e) => {
    if (!interactive || bootstrapPending) return
    if (e.target.closest('.tc-drag-handle')) return
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    function onMove(me) {
      if (!moved && (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5)) {
        moved = true
        setShowDragHint(true)
        clearTimeout(dragHintTimer.current)
        dragHintTimer.current = setTimeout(() => setShowDragHint(false), 2000)
      }
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [interactive, bootstrapPending])

  const handleStartSession = useCallback(() => {
    setWaking(true)
    setTimeout(() => {
      setWaking(false)
      setSessionEnded(false)
      setResourceLimited(null)
      setError(null)
      reconnectRetriesRef.current = 0
      terminalFailureRef.current = false
      setConnectAttempt(c => c + 1)
    }, 1500)
  }, [])

  const handleCleanupAndRetry = useCallback(async () => {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
    const baseClean = base.endsWith('/') ? base : base + '/'
    try {
      const res = await fetch(`${baseClean}_hypercanvas/terminal/sessions/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses: ['archived', 'background'] }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.removed > 0) {
          handleStartSession()
          return
        }
        // Nothing was removed — update counts from server
        setResourceLimited(prev => prev ? {
          ...prev,
          cleanupResult: 'nothing-to-clean',
          counts: data.remaining || prev.counts,
        } : prev)
        return
      }
    } catch { /* ignore fetch errors */ }
    setResourceLimited(prev => prev ? { ...prev, cleanupResult: 'failed' } : prev)
  }, [handleStartSession])



  return (
    <>
    <div
      className={styles.container}
      data-terminal-agent={agentId || undefined}
      data-terminal-state={terminalState}
      data-terminal-context={contextState?.delivery || undefined}
      data-terminal-context-phase={contextState?.phase || undefined}
    >
      <div className={`tc-drag-handle ${styles.titleBar}`}>
        <span>
          <span className={styles.typeLabel}>{typeLabel}</span>
          <span className={styles.nameSeparator}> · </span>
          <span>{prettyName || '…'}</span>
          {editingAlias ? (
            <>
              <span className={styles.nameSeparator}> · </span>
              <input
                ref={aliasInputRef}
                className={styles.aliasInput}
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onBlur={commitAlias}
                onKeyDown={handleAliasKeyDown}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="alias"
                aria-label="Edit alias"
              />
            </>
          ) : alias ? (
            <>
              <span className={styles.nameSeparator}> · </span>
              <span onDoubleClick={handleAliasDoubleClick}>{alias}</span>
              {showLeaderCrown && <span className={styles.leaderCrown} aria-label="Squad leader"><Icon name="iconoir/crown" size={12} color="#AE843B" /></span>}
            </>
          ) : (
            <span onDoubleClick={handleAliasDoubleClick}></span>
          )}
        </span>
      </div>
      <div
        ref={terminalRef}
        className={styles.terminal}
        style={{
          ...(typeof (!webglUnavailable ? (snappedWidth ?? width) : width) === 'number'
            ? { width: `${!webglUnavailable ? (snappedWidth ?? width) : width}px` }
            : undefined),
          ...(typeof (!webglUnavailable ? (snappedHeight ?? height) : height) === 'number'
            ? { height: `${!webglUnavailable ? (snappedHeight ?? height) : height}px` }
            : undefined),
        }}
        onClick={handleClick}
        onPointerDown={handleTerminalPointerDown}
        onKeyDown={interactive && !bootstrapPending ? (e) => e.stopPropagation() : undefined}
        onKeyDownCapture={bootstrapPending ? (e) => {
          if (e.target.closest?.('button')) return
          e.preventDefault()
          e.stopPropagation()
        } : undefined}
        onPasteCapture={bootstrapPending ? (e) => { e.preventDefault(); e.stopPropagation() } : undefined}
      >
        {/* ── Frozen state: real WebGL context loss / open failure ── */}
        {webglUnavailable && (
          <FrozenTerminalOverlay
            widgetId={id}
            onActivate={handleFrozenActivate}
          />
        )}

        {/* ── Live state: ghostty WebGL terminal ── */}
        {!webglUnavailable && (
          <>
            {showDragHint && (
              <div className={styles.dragHint}>
                <span className={styles.dragHintArrow}>←</span> Drag here to move widget
              </div>
            )}
            {error && !resourceLimited && (
              <div className={styles.error} role="alert">
                <span>⚠ {error}</span>
                <button type="button" className={styles.resourceBtnSecondary} onClick={() => {
                  if (refreshExistingRef.current) refreshAttachmentRef.current?.()
                  else handleStartSession()
                }}>
                  Retry
                </button>
              </div>
            )}
            <div ref={containerRef} className={styles.xtermContainer} style={{ opacity: revealed ? 1 : 0 }} />

            {/* Live agent bootstrap: prevent unfinished user prompts from
                being mixed with native startup context or onboarding output. */}
            {revealed && bootstrapPending && !sessionEnded && !error && (
              <div
                className={overlayStyles.interactOverlay}
                role="status"
                style={{ backgroundColor: 'rgba(13, 17, 23, 0.74)', flexDirection: 'column', gap: '10px' }}
              >
                <span className={overlayStyles.interactHint} style={{ opacity: 1 }}>Preparing agent context…</span>
                <button
                  type="button"
                  className={styles.resourceBtnSecondary}
                  onClick={(e) => {
                    e.stopPropagation()
                    bootstrapPendingRef.current = false
                    releasedContextLaunchRef.current = contextLaunchKey
                    setBypassedContextLaunch(contextLaunchKey)
                    setInteractive(true)
                    termRef.current?.focus({ preventScroll: true })
                  }}
                >
                  Interact anyway
                </button>
              </div>
            )}

            {revealed && !sessionEnded && !error && (contextNeedsAttention || contextCheckMessage || contextState?.delivery === 'error') && (
              <div className={styles.startupAttention} role="status">
                {contextNeedsAttention
                  ? `Startup context has not been acknowledged. ${contextCheckMessage ? contextCheckMessage + ' ' : ''}Check the provider output; input is available.`
                  : contextCheckMessage
                    ? contextCheckMessage
                  : contextState.message || 'Agent context could not be prepared. Check the provider output.'}
              </div>
            )}

            {/* Live but not interactive */}
            {revealed && !bootstrapPending && !interactive && !sessionEnded && (
              <div
                className={overlayStyles.interactOverlay}
                style={{ backgroundColor: 'transparent' }}
                onWheel={(e) => {
                  if (multiSelected) return
                  e.preventDefault()
                  e.stopPropagation()
                  setInteractive(true)
                  termRef.current?.focus({ preventScroll: true })
                  const lines = Math.max(1, Math.min(8, Math.ceil(Math.abs(e.deltaY) / 24)))
                  const direction = e.deltaY < 0 ? -lines : lines
                  termRef.current?.scrollLines?.(direction)
                }}
                onClick={(e) => {
                  if (multiSelected || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
                  setInteractive(true)
                  termRef.current?.focus({ preventScroll: true })
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (!multiSelected && e.key === 'Enter') { setInteractive(true); termRef.current?.focus({ preventScroll: true }) } }}
                aria-label="Click to interact"
              >
                {!multiSelected && <span className={overlayStyles.interactHint}>Click to interact</span>}
              </div>
            )}

            {/* Session ended — resource limited */}
            {sessionEnded && resourceLimited && (
              <div
                className={overlayStyles.interactOverlay}
                style={{ backgroundColor: 'var(--term-bg, #0d1117)', flexDirection: 'column', gap: '8px', padding: '24px' }}
              >
                <span className={styles.resourceIcon}>⚠</span>
                <span className={styles.resourceTitle}>No terminal devices available</span>
                <span className={styles.resourceMessage}>
                  Too many terminal sessions are open.
                  {resourceLimited.counts && (
                    <span className={styles.resourceCounts}>
                      {resourceLimited.counts.live} live · {resourceLimited.counts.background} background · {resourceLimited.counts.archived} archived
                    </span>
                  )}
                </span>
                <div className={styles.resourceActions}>
                  {!resourceLimited.cleanupResult && (resourceLimited.counts?.background > 0 || resourceLimited.counts?.archived > 0) && (
                    <button className={styles.resourceBtn} onClick={handleCleanupAndRetry}>
                      Close background sessions
                    </button>
                  )}
                  {resourceLimited.cleanupResult === 'nothing-to-clean' && (
                    <span className={styles.resourceMuted}>
                      All background sessions already cleaned. Close some live terminals to free resources.
                    </span>
                  )}
                  {resourceLimited.cleanupResult === 'failed' && (
                    <span className={styles.resourceMuted}>
                      Cleanup failed — could not reach dev server.
                    </span>
                  )}
                  <button className={styles.resourceBtnSecondary} onClick={handleStartSession}>
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Session ended — normal */}
            {sessionEnded && !resourceLimited && !error && (
              <div
                className={overlayStyles.interactOverlay}
                style={{ backgroundColor: 'var(--term-bg, #0d1117)', flexDirection: 'column', gap: 0 }}
                onClick={handleStartSession}
                role="button"
                tabIndex={0}
                aria-label="Start terminal session"
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartSession() }}
              >
                {!waking && (
                  <>
                    <div className={styles.buddyZzz}>
                      <span className={styles.z1}>z</span>
                      <span className={styles.z2}>z</span>
                      <span className={styles.z3}>z</span>
                    </div>
                    <span className={styles.sessionEndedBadge}>Session ended</span>
                    <span className={styles.sessionEndedAction}>Click to start</span>
                  </>
                )}
                {waking && (
                  <span className={overlayStyles.interactHint} style={{ opacity: 1 }}>
                    Waking up...
                  </span>
                )}
              </div>
            )}

            {/* Connecting / reveal mask */}
            {!revealed && !error && !sessionEnded && (
              <div className={styles.loading} role="status" style={{ flexDirection: 'column', gap: '12px' }}>
                <div className={styles.spinner} />
                <span>{connectionProgress}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    {expanded && (
      <TerminalExpandPane
        widgetId={id}
        expandContainerRef={expandContainerRef}
        prettyName={prettyName}
        isAgent={isAgent}
        splitMode={expandMode === 'split'}
        onClose={() => setExpanded(null)}
      />
    )}
    </>
  )
})

/**
 * Builds pane configs and renders ExpandedPane for an expanded terminal widget.
 * Primary pane is an external pane that receives the xterm container + handles fit.
 */
function TerminalExpandPane({ widgetId, expandContainerRef, prettyName, isAgent, splitMode, onClose }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode],
  )

  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState
    return bridge?.widgets?.find((w) => w.id === widgetId) || {
      id: widgetId,
      type: isAgent ? 'agent' : 'terminal',
      position: { x: 0, y: 0 },
      props: { prettyName },
    }
  }, [widgetId, isAgent, prettyName])

  // Custom pane builder for the primary widget (external pane with terminal fit)
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label: getSplitPaneLabel(primaryWidget),
        widgetType: isAgent ? 'agent' : 'terminal',
        widgetProps: primaryWidget.props,
        kind: 'external',
        attach: (container) => {
          expandContainerRef.current = container
          const t1 = setTimeout(() => fitTerminalToElement(widgetId, container), 150)
          const t2 = setTimeout(() => fitTerminalToElement(widgetId, container), 400)
          return () => {
            clearTimeout(t1)
            clearTimeout(t2)
            expandContainerRef.current = null
          }
        },
        onResize: () => {
          if (expandContainerRef.current) {
            fitTerminalToElement(widgetId, expandContainerRef.current)
          }
        },
      }
    }
    return buildPaneForWidget(widget)
  }, [widgetId, primaryWidget, isAgent, expandContainerRef])

  const layout = useMemo(
    () => buildSplitLayout(primaryWidget, connectedWidgets, buildPaneFn),
    [primaryWidget, connectedWidgets, buildPaneFn],
  )

  return (
    <ExpandedPane
      initialLayout={layout}
      variant="full"
      onClose={onClose}
    />
  )
}
