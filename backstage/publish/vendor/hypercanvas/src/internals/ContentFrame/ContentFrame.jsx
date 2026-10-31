import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { contentFrameUrl, contentNavigationTarget, contentRouteLocation, preserveHostUIState, statefullyPrototypeFrameUrl, statefullyPrototypePublicRoute } from '../canvas/isolation/contentRouting.js'
import { computeEmbedNavigationSrc } from '../../core/embedNavigation.js'
import { bindPrototypeShortcutBridge } from './prototypeShortcutBridge.js'
import styles from './ContentFrame.module.css'

/** Public routes keep the app shell while authored content owns its document. */
export default function ContentFrame({ kind = 'prototype', externalUrl, title, statefullyPrototypeId }) {
  const { pathname } = useLocation()
  // A scope owns its child document, navigation handshake and shortcut listeners.
  // External URLs keep their existing direct-src refresh behavior.
  const scope = externalUrl ? 'external' : `${kind}:${statefullyPrototypeId || pathname.split('/').filter(Boolean)[0] || ''}`
  return <ContentDocumentFrame key={scope} kind={kind} externalUrl={externalUrl} title={title} statefullyPrototypeId={statefullyPrototypeId} />
}

function ContentDocumentFrame({ kind, externalUrl, title, statefullyPrototypeId }) {
  const location = useLocation()
  const navigate = useNavigate()
  const frame = useRef(null)
  const base = import.meta.env.BASE_URL || '/'
  const frameUrl = statefullyPrototypeId
    ? statefullyPrototypeFrameUrl(location, base, statefullyPrototypeId)
    : contentFrameUrl(location, base, { componentView: kind === 'story' })
  const [initialSrc] = useState(() => frameUrl)
  const childReady = useRef(false)
  const shortcutCleanup = useRef(null)
  const route = contentRouteLocation(location)
  const pendingNavigation = useRef(null)
  const blockedNavigation = useRef(null)
  const bypassBlockerFor = useRef(null)
  const blocker = useBlocker(({ nextLocation, historyAction }) => {
    if (externalUrl) return false
    const next = contentRouteLocation(nextLocation)
    if (bypassBlockerFor.current === next) {
      bypassBlockerFor.current = null
      return false
    }
    const currentPrototype = location.pathname.split('/').filter(Boolean)[0]
    const nextPrototype = nextLocation.pathname.split('/').filter(Boolean)[0]
    const shouldBlock = Boolean(childReady.current && currentPrototype && currentPrototype === nextPrototype && route !== next)
    if (shouldBlock) blockedNavigation.current = { target: next, historyAction }
    return shouldBlock
  })
  const blockerRef = useRef(blocker)
  useEffect(() => { blockerRef.current = blocker }, [blocker])

  useEffect(() => {
    if (externalUrl) return undefined
    const onNavigate = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return
      const data = event.data
      if (data?.type === 'storyboard:embed:ready') {
        childReady.current = true
        return
      }
      if (data?.type === 'storyboard:embed:navigate-cancelled') {
        if (pendingNavigation.current?.id === data.id && blockerRef.current.state === 'blocked') {
          pendingNavigation.current = null
          blockedNavigation.current = null
          blockerRef.current.reset()
        }
        return
      }
      if (data?.type !== 'storyboard:embed:navigate') return
      const target = contentNavigationTarget(data.src, window.location.origin, base)
      if (!target || target === route) return
      const pending = pendingNavigation.current
      if (data.id && data.id !== pending?.id) return
      if (pending?.target === target && data.id === pending.id && blockerRef.current.state === 'blocked') {
        pendingNavigation.current = null
        blockedNavigation.current = null
        blockerRef.current.proceed()
        return
      }
      if (pending && !data.id) {
        // The legacy history wrapper reports synchronously before the bridge
        // sends its correlated acknowledgement. Keep the blocker pending for
        // that acknowledgement when both reports describe the same target.
        if (pending.target === target) return
        pendingNavigation.current = null
        blockedNavigation.current = null
        if (blockerRef.current.state === 'blocked') blockerRef.current.reset()
      }
      // The child has already committed this navigation after its own route
      // blockers settled, so the host must not ask it to leave a second time.
      bypassBlockerFor.current = target
      navigate(preserveHostUIState(target, window.location.search), { replace: data.replace === true })
    }
    window.addEventListener('message', onNavigate)
    return () => {
      window.removeEventListener('message', onNavigate)
    }
  }, [base, externalUrl, location.search, navigate, route])

  useEffect(() => {
    if (externalUrl) return
    if (blocker.state !== 'blocked') return
    const target = contentRouteLocation(blocker.location)
    if (pendingNavigation.current?.target === target) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    pendingNavigation.current = { id, target }
    const historyAction = blockedNavigation.current?.target === target
      ? blockedNavigation.current.historyAction : undefined
    frame.current?.contentWindow?.postMessage({
      type: 'storyboard:embed:navigate-request', id, target,
      // A host POP has already moved browser history. Mirror it in the child
      // with replace so the child does not create a competing history entry.
      replace: historyAction === 'POP' || historyAction === 'REPLACE',
    }, window.location.origin)
  }, [blocker, externalUrl])

  const synchronizeRoute = useCallback(() => {
    if (externalUrl) return false
    const child = frame.current?.contentWindow
    if (!child) return false
    try {
      // Child navigation has already changed its document URL; mirroring the
      // public route must not reload it and discard the component's state.
      if (child.location.href === 'about:blank') return false
      const current = statefullyPrototypeId
        ? statefullyPrototypePublicRoute(child.location, base, statefullyPrototypeId)
        : computeEmbedNavigationSrc(child.location.pathname, child.location.hash, base, child.location.search)
      if (current !== route) {
        childReady.current = false
        shortcutCleanup.current?.()
        shortcutCleanup.current = null
        child.location.replace(frameUrl)
        return false
      }
      return true
    } catch {
      shortcutCleanup.current?.()
      shortcutCleanup.current = null
      frame.current.src = frameUrl
      return false
    }
  }, [base, externalUrl, frameUrl, route, statefullyPrototypeId])

  useEffect(() => { synchronizeRoute() }, [synchronizeRoute])

  const onFrameLoad = () => {
    childReady.current = false
    shortcutCleanup.current?.()
    shortcutCleanup.current = null
    if (externalUrl || !synchronizeRoute()) return
    shortcutCleanup.current = bindPrototypeShortcutBridge(frame.current, window, kind)
    frame.current?.contentWindow?.postMessage({ type: 'storyboard:embed:hello' }, window.location.origin)
  }

  useEffect(() => () => {
    shortcutCleanup.current?.()
    shortcutCleanup.current = null
  }, [])

  return <iframe ref={frame} src={externalUrl || initialSrc} className={styles.frame}
    onLoad={onFrameLoad} data-hypercanvas-content={kind}
    title={title || (kind === 'story' ? 'Component preview' : 'Prototype preview')} />
}
