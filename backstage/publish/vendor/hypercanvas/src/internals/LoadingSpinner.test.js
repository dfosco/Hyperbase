import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8')

describe('canonical app loading spinner', () => {
  it('uses CSS motion for startup operation Braille and pauses it with the client lifecycle', () => {
    const splashHtml = read('packages/mygo/frontend/index.html')
    const startupClient = read('packages/mygo/frontend/startup-failure-client.js')

    expect(splashHtml).toContain('animation: hc-startup-braille-frames 1600ms steps(10, end) infinite')
    expect(splashHtml).toContain('#startup-operation-list[data-braille-paused="true"] .hc-startup-braille-strip { animation-play-state: paused; }')
    expect(splashHtml).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hc-startup-braille-strip \{ animation: none/)
    expect(startupClient).toContain('list.dataset.braillePaused = String(disposed || doc.hidden)')
    expect(startupClient).toContain("doc.addEventListener('visibilitychange', syncBraille)")
    expect(startupClient).toContain("win.addEventListener('pagehide', cleanup, { once: true })")
  })

  it('centers the lazy canvas fallback inside the existing content height and debug inset', () => {
    const styles = read('packages/storyboard/src/internals/LoadingState.module.css')
    const loading = styles.match(/\.canvasLoading \{([^}]+)\}/)[1]
    expect(loading).toContain('display: grid')
    expect(loading).toContain('place-items: center')
    expect(loading).toContain('--sb-window-content-height')
    expect(loading).toContain('--sb-window-content-top')
    expect(loading).toContain('--hc-lifecycle-debug-inset')
    expect(loading).not.toContain('position: fixed')
  })

  it('uses the splash spinner source for all app-level loading surfaces', () => {
    const canonical = read('packages/storyboard/src/internals/LoadingSpinner.css')
    const splash = read('packages/mygo/frontend/loading-spinner.css')
    const splashHtml = read('packages/mygo/frontend/index.html')
    const context = read('packages/storyboard/src/internals/context.jsx')
    const viewfinder = read('packages/storyboard/src/internals/Viewfinder.jsx')
    const canvas = read('packages/storyboard/src/internals/canvas/CanvasPage.jsx')
    const syncScript = read('scripts/sync-mygo-loading-spinner.mjs')
    const mygoEntrypoint = read('scripts/package-hypercanvas-mygo-channel.mjs')

    expect(splash).toBe(canonical)
    expect(splashHtml).toContain('<link rel="stylesheet" href="./loading-spinner.css">')
    expect(splashHtml).toContain('id="startup-operation-list"')
    expect(canonical).toMatch(/width:\s*24px[\s\S]*height:\s*24px[\s\S]*border:\s*2px[\s\S]*animation:\s*hc-main-loading-spin 0\.7s linear infinite/)
    expect(canonical).not.toMatch(/\.main-loading-spinner--canvas\s*\{[^}]*\b(?:width|height|border-width)\s*:/)
    expect(canonical).toContain('@media (prefers-reduced-motion: reduce)')
    expect(canonical).toContain('animation-duration: 2s;')

    expect(syncScript).toContain('packages/storyboard/src/internals/LoadingSpinner.css')
    expect(syncScript).toContain('packages/mygo/frontend/loading-spinner.css')
    expect(mygoEntrypoint).toContain("scripts/sync-mygo-loading-spinner.mjs")
    expect(context).toContain("import './LoadingSpinner.css'")
    expect(viewfinder).toContain("import './LoadingSpinner.css'")
    expect(canvas).toContain("import '../LoadingSpinner.css'")
    expect(context).toContain('className="main-loading-spinner"')
    expect(viewfinder).toContain('className="main-loading-spinner"')
    expect(canvas).toContain('className="main-loading-spinner main-loading-spinner--canvas"')
  })
})
