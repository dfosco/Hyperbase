import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { buildPrototypeIndex } from '../../../core/index.js'
import { useOverride } from '../../hooks/useOverride.js'
import WidgetWrapper from './WidgetWrapper.jsx'
import ResizeHandle from './ResizeHandle.jsx'
import { readProp, prototypeEmbedSchema } from './widgetProps.js'
import { getEmbedChromeVars } from './embedTheme.js'
import { useIframeDevLogs } from './iframeDevLogs.js'
import { findAllConnectedSplitTargets, getSplitPaneLabel, buildPaneForWidget, buildSplitLayout } from './expandUtils.js'
import { normalizeLegacyEmbedSrc } from './normalizeLegacyEmbedSrc.js'
import { isSameIframeDocument } from './iframeSrcCompare.js'
import { useCanvasBridge, hasConnectedKnobsWidget } from './canvasBridge.js'
import ExpandedPane from './ExpandedPane.jsx'
import { useFrameSnapshot } from './useFrameSnapshot.js'
import Dialog from '../../Dialog.jsx'
import { buildPrototypePickerEntries, embedRoutePath, resolveLivePrototypeRefreshTarget, resolvePrototypeFrameUrl, samePrototypeFrameLocation, stripEmbedRoute } from './prototypePickerEntries.js'
import { getConfig } from '../../../core/stores/configStore.js'
import { resolveFrameTheme } from './frameTheme.js'
import styles from './PrototypeEmbed.module.css'
import overlayStyles from './embedOverlay.module.css'

function CollageFrameIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M19.4 20H4.6C4.26863 20 4 19.7314 4 19.4V4.6C4 4.26863 4.26863 4 4.6 4H19.4C19.7314 4 20 4.26863 20 4.6V19.4C20 19.7314 19.7314 20 19.4 20Z" />
      <path d="M11 12V4" />
      <path d="M4 12H20" />
    </svg>
  )
}

/**
 * True for http(s) URLs whose host is a local dev server (localhost /
 * 127.0.0.1 / ::1) — e.g. another local Vite server running on its own port.
 * These are storyboard apps too, so they get the same embed treatment (theme
 * params + `_sb_embed` short-circuit + parent bridge) as internal prototypes.
 * Genuinely external URLs (a different host) are loaded verbatim instead.
 */
export function isLocalDevEmbedUrl(url) {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) return false
    const h = u.hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
  } catch {
    return false
  }
}

/** Origin (e.g. `http://localhost:5200`) of an absolute local embed URL, else ''. */
export function getAbsoluteEmbedOrigin(url) {
  if (!isLocalDevEmbedUrl(url)) return ''
  try { return new URL(url).origin } catch { return '' }
}

function resolveCanvasThemeFromStorage() {
  if (typeof localStorage === 'undefined') return 'light'
  let sync = { prototype: true, toolbar: true, codeBoxes: true, canvas: false }
  try {
    const rawSync = localStorage.getItem('sb-theme-sync')
    if (rawSync) sync = { ...sync, ...JSON.parse(rawSync) }
  } catch { /* */ }
  if (!sync.canvas) return 'light'
  const attrTheme = document.documentElement.getAttribute('data-sb-canvas-theme')
  if (attrTheme) return attrTheme
  const stored = localStorage.getItem('sb-color-scheme') || 'system'
  if (stored !== 'system') return stored
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const HEADER_HEIGHT = 37
const EMPTY_THEME_REGISTRY = Object.freeze({})
function requestFrameTheme(iframe, frameUrl, theme) {
  try {
    const url = new URL(frameUrl, window.location.href)
    // An explicit theme is authoritative. The host's inherited preference
    // must not overwrite it on load or during later shared theme changes.
    if (url.searchParams.has('theme')) return
    iframe?.contentWindow?.postMessage({ type: 'storyboard:embed:sync-theme', theme }, url.origin)
  } catch { /* external and malformed URLs have no theme bridge */ }
}

function readUrlTheme(src, themeRegistry) {
  try {
    const value = new URL(src, window.location.href).searchParams.get('theme')
    return value === 'system' || (value && Object.hasOwn(themeRegistry, value)) ? value : null
  } catch { return null }
}

function writeUrlTheme(src, value) {
  const url = new URL(src, window.location.href)
  if (value === 'inherit') url.searchParams.delete('theme')
  else url.searchParams.set('theme', String(value))
  return /^[a-z][a-z\d+.-]*:/i.test(src)
    ? url.href
    : `${url.pathname}${url.search}${url.hash}`
}

function readLiveRefreshTarget(iframe, basePath, authoredSrc) {
  try {
    if (!iframe?.isConnected) return null
    const childWindow = iframe.contentWindow
    const childDocument = iframe.contentDocument
    if (!childWindow || !childDocument) return null
    const url = childWindow.location.href
    const resolved = resolveLivePrototypeRefreshTarget(url, {
      expectedOrigin: window.location.origin,
      basePath,
      development: import.meta.env.DEV,
      authoredSrc,
    })
    if (!resolved) return null
    return { iframe, childDocument, url, authoredSrc, ...resolved }
  } catch {
    return null
  }
}

export default forwardRef(function PrototypeEmbed({ id: widgetId, props, onUpdate, resizable }, ref) {
  const rawStoredSrc = readProp(props, 'src', prototypeEmbedSchema)
  const src = normalizeLegacyEmbedSrc(rawStoredSrc)
  const width = readProp(props, 'width', prototypeEmbedSchema) || 800
  const height = readProp(props, 'height', prototypeEmbedSchema) || 600
  const zoom = readProp(props, 'zoom', prototypeEmbedSchema) || 100
  const label = readProp(props, 'label', prototypeEmbedSchema) || src
  const themeRegistry = getConfig('theming')?.themes || EMPTY_THEME_REGISTRY

  // Self-healing write-back: if normalization changed the src, persist the
  // clean form so the canvas JSONL stops carrying the broken URL. Without
  // this, every render keeps recovering at runtime but the file stays
  // poisoned and any consumer on an older library still sees the bug.
  useEffect(() => {
    if (!onUpdate) return
    if (typeof rawStoredSrc !== 'string' || rawStoredSrc === src) return
    onUpdate({ src })
  }, [rawStoredSrc, src, onUpdate])

  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const baseSegment = basePath.replace(/^\//, '')
  // Two URLs are derived from `src`:
  //   - rawSrc — the iframe URL. In DEV this routes through the isolated
  //     prototypes.html entry so a broken prototype's transform/HMR errors
  //     stay inside the iframe (see .agents/plans/vite-isolation.md):
  //     /MyProto/SignupForm becomes prototypes.html/MyProto/SignupForm.
  //     Routing happens in the *pathname* (createBrowserRouter), not in the
  //     hash, so the hash and search stay free for storyboard URL state
  //     (`?flow=...` and `#key=value` overrides). In PROD it loads the
  //     prototype path directly through the canvas SPA (prototypes.html is
  //     a build-time isolation artifact that must not leak into deployed URLs).
  //   - externalSrc — the URL used by "Open in new tab". Always direct
  //     (`${basePath}/<protoPath>`), never prototypes.html, even in dev —
  //     opening prototypes.html/... in a fresh tab is a leaky surprise
  //     for users navigating from the canvas.
  // External http(s) URLs are left alone in both cases. basePath already
  // carries the /branch--xxx/ prefix on branch deploys, so both work for
  // main and branch deploys alike.
  const { rawSrc, externalSrc } = useMemo(() => {
    if (!src) return { rawSrc: '', externalSrc: '' }
    if (/^https?:\/\//.test(src)) return { rawSrc: src, externalSrc: src }
    const cleaned = src.replace(/^\/branch--[^/]+/, '')
    let normalized
    if (baseSegment && cleaned.startsWith(basePath)) normalized = cleaned
    else if (baseSegment && cleaned.startsWith(baseSegment)) normalized = `/${cleaned}`
    else normalized = `${basePath}${cleaned}`
    // Strip basePath so we can split path/query/hash cleanly and
    // re-anchor for whichever mode we're in. Any pre-existing #hash on
    // the original src is preserved.
    const withoutBase = baseSegment && normalized.startsWith(basePath)
      ? normalized.slice(basePath.length) || '/'
      : normalized
    const hashIdx = withoutBase.indexOf('#')
    const innerHash = hashIdx >= 0 ? withoutBase.slice(hashIdx + 1) : ''
    const pathAndQuery = hashIdx >= 0 ? withoutBase.slice(0, hashIdx) : withoutBase
    const routePath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
    const suffix = innerHash ? `#${innerHash}` : ''
    // Direct path through the canvas SPA — used in prod for the iframe and
    // always for "Open in new tab".
    const directUrl = `${basePath}${routePath}${suffix}`
    // Vite file previews are documents, not authored prototype routes.
    if (import.meta.env.PROD || routePath.startsWith('/@fs/') || routePath.startsWith('/notebook-assets/')) {
      return { rawSrc: directUrl, externalSrc: directUrl }
    }
    // Dev iframe: prototypes.html with the route as a sub-path. The library
    // middleware (`data-plugin.js`) serves the same HTML shell for
    // `/prototypes.html/*` so a hard reload / open-in-new-tab works. The
    // prototype name (first path segment) narrows getRoutesForProto so a
    // broken sibling prototype can't poison the lazy() chain. Hash and
    // search stay attached so storyboard URL state (`#key=value` overrides,
    // `?flow=name`) survives the redirect through the isolation entry.
    const iframeUrl = `${basePath}/prototypes.html${routePath}${suffix}`
    return { rawSrc: iframeUrl, externalSrc: directUrl }
  }, [src, basePath, baseSegment])

  const scale = zoom / 100

  const [editing, setEditing] = useState(false)
  const [interactive, setInteractive] = useState(false)
  // Track which src URL has fired its onLoad callback so we can overlay a
  // spinner while a new iframe is fetching. Stored as the URL itself (not
  // a boolean) so changing src naturally invalidates the loaded state
  // without an effect.
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [refreshPrompt, setRefreshPrompt] = useState(null)
  const refreshSnapshotAfterLoadRef = useRef(null)
  const [siteReloadToken, setSiteReloadToken] = useState(0)
  const [expandOverride, setExpandOverride, clearExpandOverride] = useOverride(`_prototype_expanded_${widgetId}`)
  const expandMode = expandOverride === 'immersive' ? 'immersive' : expandOverride === 'split' ? 'split' : expandOverride === 'single' ? 'single' : null
  const setExpandMode = useCallback((mode) => {
    if (mode) setExpandOverride(mode)
    else clearExpandOverride()
  }, [setExpandOverride, clearExpandOverride])
  const [immersiveClosing, setImmersiveClosing] = useState(false)
  const expanded = expandMode !== null
  const [canvasTheme, setCanvasTheme] = useState(() => resolveCanvasThemeFromStorage())
  const urlTheme = readUrlTheme(src, themeRegistry)
  const frameTheme = urlTheme === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : resolveFrameTheme(urlTheme || props?.frameThemeOverride, canvasTheme, themeRegistry)
  const embedRef = useRef(null)
  const iframeRef = useRef(null)
  const inlineContainerRef = useRef(null)
  const modalContainerRef = useRef(null)

  const { widgets: bridgeWidgets, connectors: bridgeConnectors } = useCanvasBridge()
  // True when a Knobs widget is connected (either direction) to this
  // PrototypeEmbed. We flip a `sb_knobs=1` URL param on the iframe src
  // so the embedded prototype's installKnobsHighlight activates the
  // in-page outline + label badge for `[data-knob-id]` elements.
  const hasKnobsTarget = useMemo(
    () => hasConnectedKnobsWidget(widgetId, bridgeWidgets, bridgeConnectors),
    [widgetId, bridgeWidgets, bridgeConnectors],
  )

  const iframeSrc = useMemo(() => {
    if (!rawSrc) return ''
    // Genuinely external http(s) URLs (a different host) are loaded verbatim.
    // Local dev URLs — e.g. another Vite server on localhost
    // port — fall through so they receive the same embed params as internal
    // prototypes (theme + `_sb_embed` short-circuit + parent bridge).
    if (/^https?:\/\//.test(rawSrc) && !isLocalDevEmbedUrl(rawSrc)) return rawSrc
    const hashIdx = rawSrc.indexOf('#')
    const base = hashIdx >= 0 ? rawSrc.slice(0, hashIdx) : rawSrc
    const hash = hashIdx >= 0 ? rawSrc.slice(hashIdx) : ''
    const queryStart = base.indexOf('?')
    const path = queryStart >= 0 ? base.slice(0, queryStart) : base
    const existingQuery = queryStart >= 0 ? base.slice(queryStart + 1) : ''
    const generatedParams = new Map([
      ['_sb_embed', ''],
      ['_sb_hide_branch_bar', ''],
      ['_sb_theme_target', 'prototype'],
      ...(hasKnobsTarget ? [['sb_knobs', '1']] : []),
    ])
    const generatedParamKeys = new Set([
      '_sb_embed', '_sb_hide_branch_bar', '_sb_theme_target', '_sb_canvas_theme', 'sb_knobs',
    ])
    const retainedParams = existingQuery
      ? existingQuery.split('&').filter((part) => {
        const rawKey = part.split('=', 1)[0]
        try {
          const key = decodeURIComponent(rawKey.replace(/\+/g, ' '))
          return !generatedParamKeys.has(key)
        } catch {
          return true
        }
      })
      : []
    const additions = [...generatedParams].map(([key, value]) => (
      value ? `${key}=${encodeURIComponent(value)}` : key
    ))
    const query = [...retainedParams, ...additions].join('&')
    return `${path}${query ? `?${query}` : ''}${hash}`
  }, [rawSrc, hasKnobsTarget])

  const effectiveSrc = iframeSrc
  const [mountedFrameSrc, setMountedFrameSrc] = useState(() => effectiveSrc)

  // ── Persistent snapshot: read the durable preview for this Frame target
  // and schedule a Core capture when it is missing or stale. The iframe is
  // not mounted until the user explicitly admits it, so a canvas of dormant
  // Frames renders saved posters instead of live documents.
  const [admitted, setAdmitted] = useState(false)
  useEffect(() => {
    if (!admitted || !effectiveSrc) return
    let liveUrl
    try { liveUrl = iframeRef.current?.contentWindow?.location?.href } catch { /* unreadable external target */ }
    if (liveUrl && samePrototypeFrameLocation(liveUrl, effectiveSrc, window.location.href)) {
      const frame = window.requestAnimationFrame(() => {
        setLoadedSrc(current => current === effectiveSrc ? current : effectiveSrc)
      })
      return () => window.cancelAnimationFrame(frame)
    }
    if (mountedFrameSrc !== effectiveSrc) {
      const frame = window.requestAnimationFrame(() => setMountedFrameSrc(effectiveSrc))
      return () => window.cancelAnimationFrame(frame)
    }
  }, [admitted, effectiveSrc, mountedFrameSrc, setLoadedSrc])

  // A live connector can add or remove the knobs widget without replacing
  // this document. Mirror only its generated highlight flag into the
  // same-origin child URL so the existing highlight subscriber reacts and a
  // later refresh keeps the current connector state.
  useEffect(() => {
    if (!admitted || !effectiveSrc) return
    try {
      const child = iframeRef.current?.contentWindow
      const live = child && new URL(child.location.href)
      const desired = new URL(effectiveSrc, window.location.href).searchParams.get('sb_knobs') === '1'
      if (!live || live.origin !== window.location.origin) return
      const current = live.searchParams.get('sb_knobs') === '1'
      if (current === desired) return
      if (desired) live.searchParams.set('sb_knobs', '1')
      else live.searchParams.delete('sb_knobs')
      child.history.replaceState(child.history.state, '', `${live.pathname}${live.search}${live.hash}`)
    } catch { /* a cross-origin iframe cannot receive same-origin URL state */ }
  }, [admitted, effectiveSrc])

  const snapshotTarget = useMemo(() => {
    if (!src) return null
    let captureUrl = ''
    try {
      const parsed = new URL(effectiveSrc, window.location.origin)
      parsed.searchParams.delete('sb_knobs')
      captureUrl = parsed.href
    } catch { captureUrl = '' }
    return { kind: 'prototype', src, zoom, width, height, captureUrl }
  }, [effectiveSrc, height, src, width, zoom])
  const { snapshot: frameSnapshot, reload: reloadFrameSnapshot } = useFrameSnapshot({
    target: snapshotTarget,
    theme: frameTheme,
    widgetId,
  })

  const requestFrameRefresh = useCallback(() => {
    const iframe = iframeRef.current
    const target = readLiveRefreshTarget(iframe, import.meta.env.BASE_URL || '/', src)
    if (!target) {
      setRefreshPrompt({ kind: 'refused' })
      return
    }
    setRefreshPrompt(null)
    refreshSnapshotAfterLoadRef.current = { src: target.src }
    setLoadedSrc(null)
    if (target.src !== src && onUpdate) {
      const originalSrc = readProp(props, 'originalSrc', prototypeEmbedSchema)
      onUpdate({ src: target.src, originalSrc: originalSrc || src })
    }
    // This path is constrained to a readable same-origin internal route (or
    // an explicitly authored same-origin HTML preview). Its URL already
    // carries supported app state, so refreshing needs no discard prompt.
    if (iframe) {
      const frameLocation = iframe.contentWindow?.location
      if (typeof frameLocation?.reload === 'function') frameLocation.reload()
      else iframe.src = target.frameUrl
    }
  }, [onUpdate, props, setLoadedSrc, setRefreshPrompt, src])

  const cancelFrameRefresh = useCallback(() => {
    setRefreshPrompt(null)
  }, [setRefreshPrompt])

  const posterUrl = String(frameTheme).startsWith('dark')
    ? (frameSnapshot?.dark?.dataUrl || frameSnapshot?.light?.dataUrl || '')
    : (frameSnapshot?.light?.dataUrl || frameSnapshot?.dark?.dataUrl || '')

  useEffect(() => {
    if (!isLocalDevEmbedUrl(src)) return undefined
    const localOrigin = getAbsoluteEmbedOrigin(src)
    const started = event => {
      const siteOrigin = event.detail?.developmentBaseUrl
        ? getAbsoluteEmbedOrigin(event.detail.developmentBaseUrl)
        : ''
      if (siteOrigin && siteOrigin !== localOrigin) return
      setLoadedSrc(null)
      setSiteReloadToken(token => token + 1)
    }
    document.addEventListener('storyboard:site-started', started)
    return () => document.removeEventListener('storyboard:site-started', started)
  }, [src])

  const prototypeIndex = useMemo(() => {
    try { return buildPrototypeIndex() }
    catch { return { folders: [], prototypes: [], globalFlows: [], sorted: { title: { prototypes: [], folders: [] } } } }
  }, [])

  // Flat prototype list for the site-frame-style picker card: every prototype
  // (folders flattened) with its display title and directory slug. Flows stay
  // out of the list — picking a prototype points the Frame at its
  // representative route (the default flow when one exists).
  const pickerPrototypes = useMemo(() => buildPrototypePickerEntries(prototypeIndex), [prototypeIndex])

  const selectedDirName = useMemo(() => {
    if (!src) return ''
    const srcPath = embedRoutePath(src)
    if (!srcPath) return ''
    for (const proto of pickerPrototypes) {
      const paths = proto.routes.map(route => embedRoutePath(route))
      if (paths.includes(srcPath) || srcPath === `/${proto.dirName}`) return proto.dirName
    }
    return ''
  }, [src, pickerPrototypes])

  const prototypeTitle = useMemo(() => {
    if (!src) return label || 'Prototype'
    const srcPath = embedRoutePath(src)
    for (const proto of pickerPrototypes) {
      for (const flow of proto.flows) {
        if (stripEmbedRoute(flow.route) === src || embedRoutePath(flow.route) === srcPath) {
          // If the flow name matches the prototype title, just show the title
          if (flow.name === proto.title) return proto.title
          return `${proto.title} · ${flow.name}`
        }
      }
      if (srcPath && proto.routes.some(route => embedRoutePath(route) === srcPath)) return proto.title
    }
    return label || 'Prototype'
  }, [src, label, pickerPrototypes])

  useIframeDevLogs({
    widget: 'PrototypeEmbed',
    loaded: Boolean(effectiveSrc && interactive),
    src: effectiveSrc,
  })

  // Exit interactive mode when clicking outside the embed
  useEffect(() => {
    if (!interactive || expanded) return
    function handlePointerDown(e) {
      if (embedRef.current && !embedRef.current.contains(e.target)) {
        const chromeEl = e.target.closest(`[data-widget-id="${widgetId}"]`)
        if (chromeEl) return
        setInteractive(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [interactive, expanded, widgetId])

  useEffect(() => {
    function readToolbarTheme() {
      setCanvasTheme(resolveCanvasThemeFromStorage())
    }
    readToolbarTheme()
    document.addEventListener('storyboard:theme:changed', readToolbarTheme)
    return () => document.removeEventListener('storyboard:theme:changed', readToolbarTheme)
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !effectiveSrc) return
    requestFrameTheme(iframe, effectiveSrc, frameTheme)
  }, [effectiveSrc, frameTheme])

  // ── Fullscreen (immersive) mode — triggers expand with 'immersive' variant
  const expandModeRef = useRef(expandMode)
  useEffect(() => { expandModeRef.current = expandMode }, [expandMode])

  useEffect(() => {
    function handleEnter(e) {
      if (e.detail?.widgetId === widgetId) {
        setImmersiveClosing(false)
        setAdmitted(true)
        setExpandMode('immersive')
      }
    }
    function handleExit(e) {
      if (e.detail?.widgetId === widgetId) {
        if (expandModeRef.current === 'immersive') {
          // Trigger animated close instead of immediate unmount
          setImmersiveClosing(true)
        } else {
          setExpandMode(null)
        }
      }
    }
    document.addEventListener('storyboard:canvas:widget-fullscreen', handleEnter)
    document.addEventListener('storyboard:canvas:widget-fullscreen-exit', handleExit)
    return () => {
      document.removeEventListener('storyboard:canvas:widget-fullscreen', handleEnter)
      document.removeEventListener('storyboard:canvas:widget-fullscreen-exit', handleExit)
    }
  }, [widgetId, setExpandMode])

  // Reparent iframe between inline and modal
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    if (expanded && modalContainerRef.current) {
      iframe._savedClassName = iframe.className
      iframe._savedStyle = iframe.getAttribute('style') || ''
      iframe.className = styles.expandIframe
      iframe.removeAttribute('style')
      const target = modalContainerRef.current
      try {
        if (target.moveBefore) target.moveBefore(iframe, target.firstChild)
        else target.prepend(iframe)
      } catch {
        target.prepend(iframe)
      }
    } else if (!expanded && inlineContainerRef.current) {
      if (iframe._savedClassName !== undefined) {
        iframe.className = iframe._savedClassName
        iframe.setAttribute('style', iframe._savedStyle)
        delete iframe._savedClassName
        delete iframe._savedStyle
      }
      const target = inlineContainerRef.current
      try {
        if (target.moveBefore) target.moveBefore(iframe, null)
        else target.appendChild(iframe)
      } catch {
        target.appendChild(iframe)
      }
    }
  }, [expanded])

  // Listen for navigation events from the embedded prototype iframe
  useEffect(() => {
    function handleMessage(e) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type !== 'storyboard:embed:navigate') return
      // Defensive: older consumer embeds reported `/prototypes.html#/route`
      // here (loader path + hash). Normalize to the inner route so we never
      // persist the broken form.
      const innerSrc = normalizeLegacyEmbedSrc(e.data.src)
      // The iframe only reports a path-relative route. When this embed points
      // at an absolute origin (e.g. a cross-port local dev server), keep
      // navigation pinned to that origin so the persisted src doesn't collapse
      // onto the canvas's own port.
      const embedOrigin = getAbsoluteEmbedOrigin(src)
      const newSrc = embedOrigin && typeof innerSrc === 'string' && innerSrc.startsWith('/')
        ? embedOrigin + innerSrc
        : innerSrc
      if (newSrc && newSrc !== src) {
        const originalSrc = readProp(props, 'originalSrc', prototypeEmbedSchema)
        const nextHasUrlTheme = Boolean(readUrlTheme(newSrc, themeRegistry))
        onUpdate?.({
          src: newSrc,
          originalSrc: originalSrc || src,
          ...(nextHasUrlTheme && props?.frameThemeOverride != null ? { frameThemeOverride: null } : {}),
        })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [src, props, onUpdate, themeRegistry])

  const chromeVars = useMemo(() => getEmbedChromeVars(frameTheme), [frameTheme])

  const handleIframeLoad = useCallback((event) => {
    const iframe = event.currentTarget
    iframe.blur()
    setLoadedSrc(effectiveSrc)
    document.dispatchEvent(new CustomEvent('storyboard:canvas:iframe-ready', {
      detail: { widgetId },
    }))
    requestFrameTheme(iframe, effectiveSrc, frameTheme)

    const pending = refreshSnapshotAfterLoadRef.current
    if (!pending || iframeRef.current !== iframe || src !== pending.src) return
    const loaded = readLiveRefreshTarget(iframe, import.meta.env.BASE_URL || '/', src)
    if (loaded?.src !== pending.src) {
      refreshSnapshotAfterLoadRef.current = null
      return
    }
    refreshSnapshotAfterLoadRef.current = null
    // Capture only after the confirmed live target has loaded and the
    // persisted widget route agrees with it. Never recapture the old route.
    void reloadFrameSnapshot({ capture: true, force: true })
  }, [effectiveSrc, frameTheme, reloadFrameSnapshot, setLoadedSrc, src, widgetId])

  const enterInteractive = useCallback(() => {
    setAdmitted(true)
    setInteractive(true)
  }, [setAdmitted, setInteractive])

  useImperativeHandle(ref, () => ({
    getIframeWindow() {
      try {
        return iframeRef.current?.contentWindow ?? null
      } catch {
        return null
      }
    },
    handleAction(actionId, opts) {
      if (actionId === 'edit') {
        setEditing(true)
      } else if (actionId === 'expand' || actionId === 'expand-single') {
        // Expansion mounts the iframe (admit) so expanded panes attach it.
        setAdmitted(true)
        if (opts?.altKey) {
          setExpandMode('immersive')
        } else {
          setExpandMode('single')
        }
      } else if (actionId === 'split-screen') {
        setAdmitted(true)
        setExpandMode('split')
      } else if (actionId === 'open-external') {
        if (externalSrc) {
          let target = externalSrc
          try { target = resolvePrototypeFrameUrl(iframeRef.current?.contentWindow?.location?.href, externalSrc) || externalSrc } catch { /* cross-origin frames use their configured URL */ }
          window.open(target, '_blank', 'noopener,noreferrer')
        }
      } else if (actionId === 'refresh-frame') {
        requestFrameRefresh()
      } else if (actionId === 'set-frame-theme') {
        if (src) {
          const value = opts?.value ?? 'inherit'
          const iframe = iframeRef.current
          if (admitted && iframe?.contentWindow) {
            try {
              const url = new URL(effectiveSrc, window.location.href)
              iframe.contentWindow.postMessage({
                type: 'storyboard:embed:set-theme',
                theme: value,
                inheritedTheme: resolveFrameTheme(null, canvasTheme, themeRegistry),
              }, url.origin)
              onUpdate?.({ frameThemeOverride: null })
            } catch { /* persist the requested theme when a target has no theme bridge */
              onUpdate?.({ src: writeUrlTheme(src, value), frameThemeOverride: null })
            }
          } else {
            onUpdate?.({ src: writeUrlTheme(src, value), frameThemeOverride: null })
          }
        }
      } else if (actionId === 'zoom-in') {
        const step = zoom < 75 ? 5 : 25
        onUpdate?.({ zoom: Math.min(200, zoom + step) })
      } else if (actionId === 'zoom-out') {
        const step = zoom <= 75 ? 5 : 25
        onUpdate?.({ zoom: Math.max(25, zoom - step) })
      }
    },
  }), [admitted, canvasTheme, effectiveSrc, externalSrc, zoom, onUpdate, themeRegistry, setExpandMode, requestFrameRefresh, src])

  function handlePickPrototype(proto) {
    if (!proto) return
    onUpdate?.({ src: proto.route })
    setEditing(false)
    // The user just configured this Frame deliberately — load the live
    // document immediately instead of parking it dormant behind a spinner.
    setAdmitted(true)
    setInteractive(true)
  }

  function handleCancelEdit() {
    setEditing(false)
  }

  const handleResize = useCallback((w, h) => {
    onUpdate?.({ width: w, height: h })
  }, [onUpdate])

  const prototypeChooser = (
    <div
      className={`${styles.pickerArea}${iframeSrc && editing ? ` ${styles.pickerOverlay}` : ''}`}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className={styles.picker} role="group" aria-label="Choose a Prototype" onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit() }}>
        <div className={styles.pickerHeading}>
          Choose a Prototype
          {editing && src ? <button type="button" className={styles.pickerClose} onClick={handleCancelEdit} aria-label="Close">✕</button> : null}
        </div>
        {pickerPrototypes.length === 0 ? <div className={styles.pickerMessage}>No prototypes yet</div> : null}
        {pickerPrototypes.map(proto => {
          const isSelected = proto.dirName === selectedDirName
          return (
            <button
              key={proto.dirName}
              type="button"
              aria-label={`Use ${proto.title}`}
              aria-pressed={isSelected}
              className={`${styles.pickerItem}${isSelected ? ` ${styles.pickerItemSelected}` : ''}`}
              onClick={e => { e.stopPropagation(); handlePickPrototype(proto) }}
            >
              <span className={styles.pickerItemTitle}>{proto.title}</span>
              {proto.dirName !== proto.title ? <small className={styles.pickerItemName}>{proto.dirName}</small> : null}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
    <WidgetWrapper>
      <div
        ref={embedRef}
        className="hc-relative hc-overflow-hidden hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)] hc-flex hc-flex-col"
        style={{
          width,
          height,
          ...chromeVars,
        }}
      >
        <div
          className="hc-flex-shrink-0 hc-flex hc-items-center hc-gap-1.5 hc-px-3 hc-py-2 hc-text-xs hc-font-medium hc-whitespace-nowrap hc-overflow-hidden hc-text-ellipsis hc-select-none hc-border-b hc-border-border-muted hc-bg-background-muted hc-text-foreground-muted"
        >
          <span className="hc-inline-flex hc-flex-shrink-0"><CollageFrameIcon size={16} /></span>
          <span className="hc-overflow-hidden hc-text-ellipsis">{prototypeTitle}</span>
        </div>
        {!iframeSrc ? prototypeChooser : (
          <>
            <div
              ref={inlineContainerRef}
              className={styles.iframeContainer}
              style={expanded ? { visibility: 'hidden' } : undefined}
            >
              {admitted ? <iframe
                  key={siteReloadToken}
                  ref={iframeRef}
                  src={mountedFrameSrc || effectiveSrc}
                  className={styles.iframe}
                  style={{
                    width: width / scale,
                    height: (height - HEADER_HEIGHT) / scale,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                    // Match the placeholder's themed background so any
                    // brief gap during navigation (refresh or src change)
                    // never flashes the browser's default white.
                    background: 'var(--hc-color-background)',
                  }}
                  title={`${prototypeTitle} prototype`}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                onLoad={handleIframeLoad}
                /> : null}
              {isSameIframeDocument(loadedSrc, effectiveSrc) ? null : (
                <div className={styles.placeholder} aria-hidden="true">
                  {posterUrl
                    ? <img className={styles.snapshotPoster} src={posterUrl} alt="" draggable="false" />
                    : <div className={styles.spinner} />}
                  {!posterUrl && frameSnapshot?.status === 'error' ? <span className={styles.placeholderLabel}>Preview unavailable</span> : null}
                </div>
              )}
          </div>
            {!interactive && !expanded && (
              <div
                className={overlayStyles.interactOverlay}
                data-canvas-interact-gate="true"
                onClick={(e) => {
                  if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
                  enterInteractive()
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    enterInteractive()
                  }
                }}
                aria-label="Click to interact with prototype"
              >
                <span className={overlayStyles.interactHint}>Click to interact</span>
              </div>
            )}
          </>
        )}
        {iframeSrc && editing ? prototypeChooser : null}
      </div>
      {resizable && <ResizeHandle targetRef={embedRef} onResize={handleResize} />}
    </WidgetWrapper>
    {refreshPrompt ? (
      <Dialog
        title="Frame not refreshed"
        onClose={cancelFrameRefresh}
        width="small"
      >
        <p className={styles.refreshMessage}>
          The current frame URL cannot be safely refreshed. Navigate within the frame and try again.
        </p>
        <div className={styles.refreshActions}>
          <button type="button" className={styles.refreshCancel} onClick={cancelFrameRefresh} autoFocus>Close</button>
        </div>
      </Dialog>
    ) : null}
    {expanded && (
      <PrototypeExpandPane
        widgetId={widgetId}
        modalContainerRef={modalContainerRef}
        frameTheme={frameTheme}
        splitMode={expandMode === 'split'}
        immersive={expandMode === 'immersive'}
        closing={immersiveClosing}
        onClose={() => {
          // Reparent iframe back to inline BEFORE unmounting the portal
          const iframe = iframeRef.current
          if (iframe && inlineContainerRef.current) {
            if (iframe._savedClassName !== undefined) {
              iframe.className = iframe._savedClassName
              iframe.setAttribute('style', iframe._savedStyle)
              delete iframe._savedClassName
              delete iframe._savedStyle
            }
            const target = inlineContainerRef.current
            try {
              if (target.moveBefore) target.moveBefore(iframe, null)
              else target.appendChild(iframe)
            } catch { target.appendChild(iframe) }
          }
          setImmersiveClosing(false)
          setExpandMode(null)
          // Notify CanvasPage to clear fullscreen ref and restore chrome state
          document.dispatchEvent(new CustomEvent('storyboard:canvas:immersive-closed', {
            detail: { widgetId }
          }))
        }}
      />
    )}
    </>
  )
})

/**
 * Builds pane configs and renders ExpandedPane for an expanded prototype widget.
 * The primary pane is an external pane that receives the iframe via reparenting.
 */
function PrototypeExpandPane({ widgetId, modalContainerRef, frameTheme, splitMode, immersive, closing, onClose }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode],
  )
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: 'prototype', position: { x: 0, y: 0 }, props: {} }
  }, [widgetId])

  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label: getSplitPaneLabel(primaryWidget),
        widgetType: 'prototype',
        kind: 'external',
        attach: (container) => {
          modalContainerRef.current = container
          return () => { modalContainerRef.current = null }
        },
      }
    }
    return buildPaneForWidget(widget, 'splitbar', frameTheme)
  }, [widgetId, primaryWidget, modalContainerRef, frameTheme])

  const layout = useMemo(
    () => buildSplitLayout(primaryWidget, connectedWidgets, buildPaneFn),
    [primaryWidget, connectedWidgets, buildPaneFn],
  )

  const variant = immersive ? 'immersive' : (layout.flat().length <= 1 ? 'modal' : 'full')

  return (
    <ExpandedPane
      initialLayout={layout}
      variant={variant}
      closing={immersive ? closing : false}
      onClose={onClose}
    />
  )
}
