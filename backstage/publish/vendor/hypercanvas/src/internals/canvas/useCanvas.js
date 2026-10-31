import { useState, useEffect, useMemo } from 'react'
import { getCanvasData } from '../../core/index.js'
import { storyboardWs } from '../storyboard-ws.js'

/**
 * Fetch fresh canvas data from the server's .canvas.json file.
 * Falls back to build-time data if the server is unavailable.
 */
async function fetchCanvasFromServer(name) {
  // Canvas server API is only available during local dev
  if (import.meta.env?.PROD) return null
  try {
    const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '')
    const res = await fetch(`${base}/_hypercanvas/canvas/read?name=${encodeURIComponent(name)}`)
    const contentType = res.headers.get('content-type') || ''
    if (res.ok && contentType.includes('application/json')) return res.json()
  } catch { /* fall back to build-time data */ }
  return null
}

function isAbsoluteUrl(value) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)
}

export function resolveCanvasModuleImport(modulePath, baseUrl = import.meta.env?.BASE_URL || '/') {
  if (!modulePath || isAbsoluteUrl(modulePath)) return modulePath
  if (!modulePath.startsWith('/')) return modulePath
  const base = String(baseUrl || '/').replace(/\/$/, '')
  return `${base}${modulePath}` || modulePath
}

/**
 * Hook to load canvas data by name.
 * Uses build-time data for static config (routes, JSX path), but fetches
 * fresh widget data from the server to pick up persisted edits.
 *
 * @param {string} canvasId - Canonical canvas ID as indexed by the data plugin
 * @returns {{ canvas: object|null, jsxExports: object|null, jsxError: boolean, loading: boolean }}
 */
export function useCanvas(canvasId) {
  const buildTimeCanvas = useMemo(() => getCanvasData(canvasId), [canvasId])
  const [canvas, setCanvas] = useState(buildTimeCanvas)
  const [canvasDataId, setCanvasDataId] = useState(canvasId)
  const [jsxExports, setJsxExports] = useState(null)
  const [jsxResolvedBinding, setJsxResolvedBinding] = useState(null)
  const [jsxError, setJsxError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch fresh data from server on mount
  useEffect(() => {
    let active = true
    setCanvasDataId(canvasId)
    if (!buildTimeCanvas) {
      setCanvas(null)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchCanvasFromServer(canvasId).then((fresh) => {
      if (!active) return
      if (fresh) {
        // Merge: use server data for widgets/sources, keep build-time for _route/_jsxModule
        setCanvas({ ...buildTimeCanvas, ...fresh })
      } else {
        setCanvas(buildTimeCanvas)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [canvasId, buildTimeCanvas])

  const jsxModule = canvas?._jsxModule
  const jsxImport = canvas?._jsxImport

  useEffect(() => {
    let active = true
    if (!jsxModule) {
      setJsxExports(null)
      setJsxError(false)
      setJsxResolvedBinding({ module: null, importer: null })
      return undefined
    }

    const loadPromise = jsxImport
      ? jsxImport()
      : import(/* @vite-ignore */ resolveCanvasModuleImport(jsxModule))

    loadPromise
      .then((mod) => {
        if (!active) return
        const exports = {}
        for (const [key, value] of Object.entries(mod)) {
          if (key !== 'default' && typeof value === 'function') {
            exports[key] = value
          }
        }
        setJsxExports(exports)
        setJsxError(false)
        setJsxResolvedBinding({ module: jsxModule, importer: jsxImport })
      })
      .catch((err) => {
        if (!active) return
        console.error(`[storyboard] Failed to load canvas JSX module: ${jsxModule}`, err)
        setJsxExports(null)
        setJsxError(true)
        setJsxResolvedBinding({ module: jsxModule, importer: jsxImport })
      })
    return () => { active = false }
  }, [jsxModule, jsxImport])

  // In dev, react to file mutations from the data plugin without reloading
  // the current page. This keeps canvas editing state and route stable.
  useEffect(() => {
    if (!buildTimeCanvas) return
    let active = true

    const handleCanvasFileChanged = (data) => {
      const eventId = data?.canvasId || data?.name
      if (!data || eventId !== canvasId) return
      // Use metadata from the HMR event directly if available (faster)
      if (data.metadata?.widgets) {
        setCanvas((prev) => ({ ...(prev || buildTimeCanvas), ...data.metadata }))
        return
      }
      // Fallback: re-fetch from server
      fetchCanvasFromServer(canvasId).then((fresh) => {
        if (active && fresh) {
          setCanvas((prev) => ({ ...(prev || buildTimeCanvas), ...fresh }))
        }
      })
    }

    storyboardWs.on('storyboard:canvas-file-changed', handleCanvasFileChanged)
    return () => {
      active = false
      storyboardWs.off('storyboard:canvas-file-changed', handleCanvasFileChanged)
    }
  }, [canvasId, buildTimeCanvas])

  return { canvas, jsxExports, jsxError, jsxResolvedBinding, loading: loading || canvasDataId !== canvasId }
}
