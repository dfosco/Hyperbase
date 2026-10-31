// @vitest-environment node
// Exercise the real viewport session against Chromium's native scroll clamping.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const sourcePath = fileURLToPath(new URL('./viewportState.js', import.meta.url))
const source = readFileSync(sourcePath, 'utf8')
const sourceDataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

let browser
beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })

async function withViewport(run) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, offline: true })
  try {
    const page = await context.newPage()
    await page.route('**/*', (route) => route.abort())
    await page.setContent(`<!doctype html><html><body>
      <div id="viewport"><div id="surface"></div></div>
    </body></html>`)
    await page.addStyleTag({ content: `
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
      #viewport { width: 800px; height: 600px; overflow: auto; }
      #surface { width: 4000px; height: 4000px; }
    ` })
    await page.evaluate(async (moduleUrl) => {
      window.viewportModule = await new Function('url', 'return import(url)')(moduleUrl)
    }, sourceDataUrl)
    await run(page)
  } finally {
    await context.close()
  }
}

describe('viewport restoration in offline Chromium', () => {
  it('recovers saved pan after real same-scroller extent loss and browser clamping', async () => {
    await withViewport(async (page) => {
      const result = await page.evaluate(async () => {
        const settleLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const viewport = document.getElementById('viewport')
        const surface = document.getElementById('surface')
        const desired = { zoom: 125, scrollLeft: 1400, scrollTop: 1900 }
        const session = window.viewportModule.createCanvasViewportSession(desired)
        const restore = () => session.restore(viewport, { zoom: 100, applyZoom: () => {} })
        const observer = new ResizeObserver(restore)
        observer.observe(surface)
        viewport.addEventListener('scroll', () => { window.__capturedState = session.capture(viewport, 125) })

        restore()
        const initial = { left: viewport.scrollLeft, top: viewport.scrollTop }
        surface.style.width = '1200px'
        surface.style.height = '1000px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        const nonzeroClamp = { left: viewport.scrollLeft, top: viewport.scrollTop }
        const preservedAtEdge = session.getState()

        surface.style.width = '4000px'
        surface.style.height = '4000px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        const recoveredFromEdge = { left: viewport.scrollLeft, top: viewport.scrollTop }

        surface.style.width = '800px'
        surface.style.height = '600px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        const clamped = { left: viewport.scrollLeft, top: viewport.scrollTop }
        const preserved = session.getState()

        surface.style.width = '4000px'
        surface.style.height = '4000px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        const recovered = { left: viewport.scrollLeft, top: viewport.scrollTop }
        observer.disconnect()
        return { initial, nonzeroClamp, preservedAtEdge, recoveredFromEdge, clamped, preserved, recovered, sameScroller: viewport.isConnected }
      })

      expect(result.initial).toEqual({ left: 1400, top: 1900 })
      expect(result.nonzeroClamp).toEqual({ left: 400, top: 400 })
      expect(result.preservedAtEdge).toMatchObject({ scrollLeft: 1400, scrollTop: 1900 })
      expect(result.recoveredFromEdge).toEqual({ left: 1400, top: 1900 })
      expect(result.clamped).toEqual({ left: 0, top: 0 })
      expect(result.preserved).toMatchObject({ scrollLeft: 1400, scrollTop: 1900 })
      expect(result.sameScroller).toBe(true)
      expect(result.recovered).toEqual({ left: 1400, top: 1900 })
    })
  })

  it('captures an intentional wheel pan within a temporarily smaller extent', async () => {
    await withViewport(async (page) => {
      await page.evaluate(async () => {
        const settleLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const viewport = document.getElementById('viewport')
        const surface = document.getElementById('surface')
        const session = window.viewportModule.createCanvasViewportSession({ zoom: 125, scrollLeft: 1400, scrollTop: 1900 })
        const restore = () => session.restore(viewport, { zoom: 100, applyZoom: () => {} })
        const observer = new ResizeObserver(restore)
        observer.observe(surface)
        viewport.addEventListener('scroll', () => { window.__capturedState = session.capture(viewport, 125) })
        restore()
        surface.style.width = '1200px'
        surface.style.height = '1000px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        window.__viewportObserver = observer
      })

      await page.mouse.move(400, 300)
      await page.mouse.wheel(-120, -90)
      await page.waitForFunction(() => {
        const state = window.__capturedState
        return state?.scrollLeft > 0 && state.scrollLeft < 400 && state.scrollTop > 0 && state.scrollTop < 400
      })

      const result = await page.evaluate(async () => {
        const settleLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const viewport = document.getElementById('viewport')
        const surface = document.getElementById('surface')
        const beforeRecovery = { left: viewport.scrollLeft, top: viewport.scrollTop }
        surface.style.width = '4000px'
        surface.style.height = '4000px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        window.__viewportObserver.disconnect()
        return {
          beforeRecovery,
          live: { left: viewport.scrollLeft, top: viewport.scrollTop },
          state: window.__capturedState,
        }
      })
      expect(result.live.left).toBeGreaterThan(0)
      expect(result.live.top).toBeGreaterThan(0)
      expect(result.live).toEqual(result.beforeRecovery)
      expect(result.state).toMatchObject({ scrollLeft: result.live.left, scrollTop: result.live.top })
    })
  })

  it('restores the pending pan when hydration replaces the scroller', async () => {
    await withViewport(async (page) => {
      const result = await page.evaluate(async () => {
        const settleLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        let viewport = document.getElementById('viewport')
        const surface = document.getElementById('surface')
        const session = window.viewportModule.createCanvasViewportSession({ zoom: 125, scrollLeft: 1400, scrollTop: 1900 })
        const restore = (element) => session.restore(element, { zoom: 100, applyZoom: () => {} })
        const observer = new ResizeObserver(() => restore(viewport))
        observer.observe(surface)
        viewport.addEventListener('scroll', () => session.capture(viewport, 125))
        restore(viewport)
        surface.style.width = '800px'
        surface.style.height = '600px'
        surface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()

        const oldViewport = viewport
        const replacement = oldViewport.cloneNode(true)
        oldViewport.replaceWith(replacement)
        viewport = replacement
        const replacementSurface = replacement.firstElementChild
        observer.observe(replacementSurface)
        replacementSurface.style.width = '4000px'
        replacementSurface.style.height = '4000px'
        replacementSurface.getBoundingClientRect()
        await settleLayout()
        await settleLayout()
        const recovered = { left: viewport.scrollLeft, top: viewport.scrollTop }
        observer.disconnect()
        return { recovered, oldDisconnected: !oldViewport.isConnected }
      })
      expect(result.oldDisconnected).toBe(true)
      expect(result.recovered).toEqual({ left: 1400, top: 1900 })
    })
  })
})
