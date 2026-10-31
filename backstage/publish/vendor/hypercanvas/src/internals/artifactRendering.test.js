import { describe, expect, it, vi } from 'vitest'
import { copyArtifactRenderingUrl, prototypeRenderingUrl, resolveArtifactRendering } from './artifactRendering.js'
import { createPasteContext } from './canvas/widgets/pasteRules.js'

const pages = [
  { id: 'board', type: 'canvas', title: 'Board', route: '/canvas/board' },
  { id: 'site-page', siteId: 'shop', type: 'site', route: '/sites/shop', title: 'Shop' },
  { id: 'readme', type: 'doc', title: 'Research notes', route: '/docs/readme', path: 'Research/notes.doc.mdx' },
  { id: 'invalid', type: 'doc', route: '/docs/invalid', available: false },
]
const stories = { Button: { _route: '/components/Button', _exportNames: ['Primary', 'Secondary'] } }

describe.each(['', '/branch--component-preview'])('artifact rendering at base %s', base => {
  const ctx = createPasteContext('http://localhost:44191', base)
  const url = route => `${ctx.origin}${base}${route}`
  it('uses the catalog prototype route consistently across palette groups', () => {
    expect(prototypeRenderingUrl({ dirName: 'guide', route: '/guide.prototype', flows: [] }, base)).toBe(`${base}/guide.prototype`)
    expect(prototypeRenderingUrl({ dirName: 'legacy', flows: [] }, base)).toBe(`${base}/legacy`)
    expect(prototypeRenderingUrl({ dirName: 'remote', isExternal: true, externalUrl: 'https://site.example' }, base)).toBe('https://site.example')
  })
  it('selects story versus component set and retains variant selection', () => {
    expect(resolveArtifactRendering(url('/components/Button?export=Secondary'), ctx, { stories }))
      .toMatchObject({ type: 'story', props: { storyId: 'Button', exportName: 'Secondary' } })
    expect(resolveArtifactRendering(url('/components/Button?layout=tall#selected=Primary'), ctx, { stories }))
      .toMatchObject({ type: 'component-set', props: { storyId: 'Button', layout: 'tall', selected: 'Primary' } })
  })
  it('keeps Site identity and its authored query/hash route', () => {
    expect(resolveArtifactRendering(url('/sites/shop/products?sort=new#details'), ctx, { pages }))
      .toMatchObject({ type: 'site-frame', props: { siteId: 'shop', route: 'products?sort=new#details' } })
  })
  it('renders Canvas documents directly', () => {
    expect(resolveArtifactRendering(url('/canvas/board#widget'), ctx, { pages }))
      .toMatchObject({ type: 'prototype', props: { src: url('/canvas/board#widget') } })
    expect(resolveArtifactRendering('https://another.example/sites/shop', ctx, { pages })).toBeNull()
  })
  it('renders stable Doc routes through a frame, retaining authored state independently of the payload path', () => {
    const source = url('/docs/readme?mode=review&keep=a%2Fb#body')
    const result = resolveArtifactRendering(source, ctx, { pages })
    expect(result).toMatchObject({ type: 'prototype', props: { src: source, label: 'Research notes' } })
    expect(result.props).not.toHaveProperty('path')
    expect(resolveArtifactRendering(source, ctx, { pages: pages.map(page => ({ ...page, path: 'moved/renamed.doc.mdx' })) })).toEqual(result)
    expect(resolveArtifactRendering(url('/docs/invalid'), ctx, { pages })).toBeNull()
    expect(resolveArtifactRendering(url('/docs/missing'), ctx, { pages })).toBeNull()
  })
})

it('inserts even when copying fails, with truthful feedback', async () => {
  const dispatch = vi.fn(), notify = vi.fn()
  await expect(copyArtifactRenderingUrl('/branch--x/sites/shop', {
    origin: 'https://app.example', canvasActive: true,
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, dispatch, notify,
  })).resolves.toMatchObject({ copied: false, insertionRequested: true })
  expect(dispatch).toHaveBeenCalledExactlyOnceWith('https://app.example/branch--x/sites/shop')
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('clipboard unavailable'))
})

it('copies without inserting when no canvas is active', async () => {
  const dispatch = vi.fn(), writeText = vi.fn().mockResolvedValue()
  await copyArtifactRenderingUrl('/components/Button?export=Primary', {
    origin: 'https://app.example', canvasActive: false, clipboard: { writeText }, dispatch, notify: vi.fn(),
  })
  expect(writeText).toHaveBeenCalledWith('https://app.example/components/Button?export=Primary')
  expect(dispatch).not.toHaveBeenCalled()
})

it('requests canvas insertion while clipboard permission is still pending', async () => {
  let finishCopy
  const pending = new Promise(resolve => { finishCopy = resolve })
  const dispatch = vi.fn()
  const copy = copyArtifactRenderingUrl('/components/Button?export=Primary#details', {
    origin: 'https://app.example', canvasActive: true,
    clipboard: { writeText: () => pending }, dispatch, notify: vi.fn(),
  })
  expect(dispatch).toHaveBeenCalledWith('https://app.example/components/Button?export=Primary#details')
  finishCopy()
  await copy
})
