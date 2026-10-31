/** Small browser-side event channel for Hypercanvas server events. */
import { coreApiPath } from '../core/notebook/browserBridge.js'

let socket = null
let connecting = null
let cancelConnecting = null
const listeners = new Map()
const connectionOwners = new Set()
function isStaticNotebookPublication() {
  return globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ === true
}
let connectionState = isStaticNotebookPublication() ? 'disconnected' : 'connecting'
let reconnectTimer = null
let reconnectAttempt = 0

const initialReconnectDelay = 500
const maximumReconnectDelay = 8_000

function wantsConnection() {
  return connectionOwners.size > 0 || listeners.size > 0
}

function cancelReconnect() {
  if (reconnectTimer === null) return
  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function scheduleReconnect() {
  if (isStaticNotebookPublication()) {
    setConnectionState('disconnected')
    return
  }
  if (!wantsConnection() || reconnectTimer !== null) return
  const delay = Math.min(initialReconnectDelay * (2 ** reconnectAttempt), maximumReconnectDelay)
  reconnectAttempt += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (wantsConnection()) void connect().catch(() => {})
  }, delay)
}

function setConnectionState(state) {
  if (connectionState === state) return
  connectionState = state
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state } }))
  }
}

async function socketUrl() {
  try {
    const response = await fetch(coreApiPath('/_hypercanvas/ws-url'))
    const payload = await response.json()
    if (payload.url) return payload.url
  } catch { /* fall back to the same-origin proxy during startup */ }
  const base = new URL(coreApiPath('/_hypercanvas/ws'), window.location.href)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  return base.toString()
}

function emit(message) {
  if (!message?.event) return
  for (const listener of listeners.get(message.event) || []) listener(message.data)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(message.event, { detail: message.data }))
}

function connect() {
  if (isStaticNotebookPublication()) {
    setConnectionState('disconnected')
    return Promise.resolve(null)
  }
  if (import.meta.env.MODE === 'test' && globalThis.__HYPERCANVAS_WS_TEST_MODE__ !== true) {
    return Promise.reject(new Error('WebSocket disabled in tests'))
  }
  if (typeof WebSocket === 'undefined') return Promise.reject(new Error('WebSocket unavailable'))
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket)
  if (connecting) return connecting
  setConnectionState('connecting')
  let resolveConnection
  let rejectConnection
  const pending = new Promise((resolve, reject) => {
    resolveConnection = resolve
    rejectConnection = reject
  })
  connecting = pending
  cancelConnecting = () => rejectConnection(new Error('Hypercanvas WebSocket connection cancelled'))
  void socketUrl().then((url) => {
      if (connecting !== pending) return
      const next = new WebSocket(url)
      socket = next
      next.addEventListener('open', () => {
        if (socket !== next) {
          next.close()
          return
        }
        if (connecting === pending) connecting = null
        cancelConnecting = null
        cancelReconnect()
        reconnectAttempt = 0
        setConnectionState('connected')
        resolveConnection(next)
      }, { once: true })
      next.addEventListener('message', (event) => {
        if (socket !== next) return
        try { emit(JSON.parse(event.data)) } catch { /* ignore malformed server events */ }
      })
      next.addEventListener('close', () => {
        const wasCurrent = socket === next
        const wasConnecting = connecting === pending
        if (wasCurrent) socket = null
        if (wasConnecting) {
          connecting = null
          cancelConnecting = null
          // A close before `open` must settle the pending connection promise.
          rejectConnection(new Error('Hypercanvas WebSocket closed before connecting'))
        }
        if (wasCurrent || wasConnecting) {
          setConnectionState('disconnected')
          scheduleReconnect()
        }
      })
      next.addEventListener('error', () => {
        if (socket !== next) return
        setConnectionState('disconnected')
        if (connecting === pending) {
          connecting = null
          cancelConnecting = null
          rejectConnection(new Error('Hypercanvas WebSocket unavailable'))
          scheduleReconnect()
        }
      })
    }).catch((error) => {
      if (connecting !== pending) return
      connecting = null
      cancelConnecting = null
      if (socket?.readyState !== WebSocket.OPEN) socket = null
      setConnectionState('disconnected')
      scheduleReconnect()
      rejectConnection(error)
    })
  return pending
}

export const storyboardWs = {
  connectionState() { return connectionState },
  connect() { return connect() },
  start() {
    const owner = Symbol('storyboard-ws-owner')
    connectionOwners.add(owner)
    cancelReconnect()
    void connect().catch(() => {})
    let stopped = false
    return () => {
      if (stopped) return
      stopped = true
      connectionOwners.delete(owner)
      if (wantsConnection()) return
      cancelReconnect()
      reconnectAttempt = 0
      const current = socket
      socket = null
      cancelConnecting?.()
      cancelConnecting = null
      connecting = null
      if (current && (typeof WebSocket === 'undefined' || current.readyState !== WebSocket.CLOSED)) current.close()
    }
  },
  on(event, listener) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(listener)
    if ((import.meta.env.MODE === 'test' || typeof WebSocket === 'undefined') && import.meta.hot) import.meta.hot.on(event, listener)
    if (!isStaticNotebookPublication()) void connect().catch(() => {})
  },
  off(event, listener) {
    const set = listeners.get(event)
    if (!set) return
    set.delete(listener)
    if ((import.meta.env.MODE === 'test' || typeof WebSocket === 'undefined') && import.meta.hot?.off) import.meta.hot.off(event, listener)
    if (set.size === 0) listeners.delete(event)
  },
  send(event, data) {
    if (isStaticNotebookPublication()) return
    void connect().then((next) => next.send(JSON.stringify({ event, data }))).catch(() => {})
  },
}
