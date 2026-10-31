// @vitest-environment node
// Offline browser CSS proof. CanvasPage's interaction wiring is tested separately.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const directory = path.dirname(fileURLToPath(import.meta.url))

// Keep the actual selectors and declarations, removing only CSS Modules' global
// wrapper. Balance parentheses so selectors containing :has(...) stay intact.
function ordinarySelectors(css) {
  let result = ''
  let offset = 0
  for (;;) {
    const start = css.indexOf(':global(', offset)
    if (start < 0) return result + css.slice(offset)
    result += css.slice(offset, start)
    const content = start + ':global('.length
    let end = content
    let depth = 1
    for (; end < css.length && depth; end++) {
      if (css[end] === '(') depth++
      if (css[end] === ')') depth--
    }
    if (depth) throw new Error('Unclosed :global() in CanvasPage styles')
    result += css.slice(content, end - 1)
    offset = end
  }
}

const css = [
  readFileSync(path.resolve(directory, '../../canvas/style.css'), 'utf8'),
  ordinarySelectors(readFileSync(path.join(directory, 'CanvasPage.module.css'), 'utf8')),
  ordinarySelectors(readFileSync(path.join(directory, 'widgets/WidgetChrome.module.css'), 'utf8')),
].join('\n')

let browser
beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })

async function fixture(reducedMotion, run) {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 700 }, reducedMotion, offline: true,
  })
  try {
    const page = await context.newPage()
    // No server, navigation, external assets, or active Notebook state.
    await page.route('**/*', (route) => route.abort())
    await page.setContent(`<!doctype html><html><body>
      <main class="canvasZoom">
        <article id="first" class="tc-drag" style="transform:translate3d(40px,60px,0)">
          <div class="tc-draggable-inner" data-widget-raised>First selected widget</div>
        </article>
        <article id="second" class="tc-drag" style="transform:translate3d(200px,60px,0)">
          <div class="tc-draggable-inner" data-widget-raised>Second selected widget</div>
        </article>
        <article id="outside" class="tc-drag" style="transform:translate3d(380px,60px,0)">
          <div class="tc-draggable-inner">Unselected widget</div>
        </article>
      </main>
    </body></html>`)
    await page.addStyleTag({ content: css })
    await run(page)
  } finally {
    await context.close()
  }
}

describe('selection placement motion in offline Chromium', () => {
  it('renders intermediate transform positions with widget content visible, then settles at the destination', async () => {
    await fixture('no-preference', async (page) => {
      const result = await page.evaluate(() => {
        const article = document.getElementById('first')
        const content = article.firstElementChild
        const position = () => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(article).transform)
          return { x: matrix.m41, y: matrix.m42 }
        }
        const visible = () => content.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const start = position()
        article.classList.add('tc-on-translation')
        getComputedStyle(article).transitionProperty
        article.style.transform = 'translate3d(320px,220px,0)'
        getComputedStyle(article).transform
        const animation = article.getAnimations().find((entry) => entry.transitionProperty === 'transform')
        if (!animation) throw new Error('Actual canvas CSS did not create a transform transition')
        const timing = animation.effect.getTiming()
        animation.pause()
        animation.currentTime = timing.delay + Number(timing.duration) / 2
        const halfway = position()
        const halfwayVisible = visible()
        animation.finish()
        return {
          start, halfway, end: position(), duration: timing.duration,
          halfwayVisible, endVisible: visible(), text: content.textContent,
        }
      })
      expect(result.start).toEqual({ x: 40, y: 60 })
      expect(result.duration).toBeGreaterThan(0)
      expect(result.halfway.x).toBeGreaterThan(40)
      expect(result.halfway.x).toBeLessThan(320)
      expect(result.halfway.y).toBeGreaterThan(60)
      expect(result.halfway.y).toBeLessThan(220)
      expect(result.end).toEqual({ x: 320, y: 220 })
      expect(result.halfwayVisible).toBe(true)
      expect(result.endVisible).toBe(true)
      expect(result.text).toBe('First selected widget')
    })
  })

  it('moves selected articles immediately during group dragging and leaves unselected geometry unchanged', async () => {
    await fixture('no-preference', async (page) => {
      const result = await page.evaluate(() => {
        const articles = [...document.querySelectorAll('article')]
        const position = (article) => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(article).transform)
          return { x: matrix.m41, y: matrix.m42 }
        }
        for (const article of articles) article.classList.add('tc-on-translation')
        const before = articles.map(position)
        document.querySelector('.canvasZoom').setAttribute('data-selection-dragging', '')
        articles[0].style.transform = 'translate3d(90px,100px,0)'
        articles[1].style.transform = 'translate3d(250px,100px,0)'
        const firstMove = articles.map(position)
        articles[0].style.transform = 'translate3d(140px,140px,0)'
        articles[1].style.transform = 'translate3d(300px,140px,0)'
        return {
          before, firstMove, secondMove: articles.map(position),
          transitions: articles.map((article) => getComputedStyle(article).transitionProperty),
          animations: articles.map((article) => article.getAnimations().length),
          visible: articles.map((article) => article.firstElementChild.checkVisibility()),
        }
      })
      expect(result.firstMove).toEqual([{ x: 90, y: 100 }, { x: 250, y: 100 }, result.before[2]])
      expect(result.secondMove).toEqual([{ x: 140, y: 140 }, { x: 300, y: 140 }, result.before[2]])
      expect(result.transitions).toEqual(['none', 'none', 'transform'])
      expect(result.animations).toEqual([0, 0, 0])
      expect(result.visible).toEqual([true, true, true])
    })
  })

  it('suppresses individual status outlines inside the shared selection', async () => {
    await fixture('no-preference', async (page) => {
      const outlines = await page.evaluate(() => {
        return ['done', 'working'].map((status) => {
          const container = document.createElement('div')
          container.className = 'chromeContainer'
          container.dataset.agentStatus = status
          const member = document.createElement('div')
          member.className = 'widgetSlot widgetSlotSelected widgetSlotMultiSelected'
          container.append(member)
          document.body.append(container)
          const style = getComputedStyle(member)
          return { outline: style.outlineStyle, animation: style.animationName }
        })
      })
      expect(outlines).toEqual([{ outline: 'none', animation: 'none' }, { outline: 'none', animation: 'none' }])
    })
  })

  it('disables transform transitions when reduced motion is requested', async () => {
    await fixture('reduce', async (page) => {
      const result = await page.evaluate(() => {
        const article = document.getElementById('first')
        getComputedStyle(article).transform
        article.classList.add('tc-on-translation')
        getComputedStyle(article).transitionProperty
        article.style.transform = 'translate3d(320px,220px,0)'
        const style = getComputedStyle(article)
        const matrix = new DOMMatrixReadOnly(style.transform)
        return {
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
          transition: style.transitionProperty, x: matrix.m41, y: matrix.m42,
          animations: article.getAnimations().length,
          visible: article.firstElementChild.checkVisibility(),
        }
      })
      expect(result).toEqual({ reduced: true, transition: 'none', x: 320, y: 220, animations: 0, visible: true })
    })
  })
})
