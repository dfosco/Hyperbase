import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import statefullyPlugin from '@dfosco/statefully/vite'
import { createHypercanvasStatefullyAdapter, createPrototypeCompatibilityView } from './statefully-adapter.js'

function harness() {
  let roots = []
  let index = { flows: {}, objects: {}, records: {}, prototypes: {} }
  const store = { replaceIndex: vi.fn(next => { index = { flows: next.flows ?? {}, objects: next.objects ?? {}, records: next.records ?? {}, prototypes: next.prototypes ?? {} } }), getIndex: () => index }
  const discovery = {
    setRoots: vi.fn(next => { roots = next; return next.length ? discovery.rebuild().index : {} }),
    rebuild: vi.fn(() => ({ index: roots.length
      ? { flows: { 'Demo/default': { title: roots[0].path } }, objects: { nav: { label: 'Home' } }, records: {}, prototypes: {} }
      : { flows: {}, objects: {}, records: {}, prototypes: {} }, diagnostics: [] })),
    getDiagnostics: () => [],
  }
  const statefully = {
    createPrototypeStore: vi.fn(() => store),
    setKnobValue: vi.fn(),
    clearKnobValue: vi.fn(),
  }
  const onCompatibilityIndex = vi.fn()
  const resolveIframe = vi.fn(() => ({ location: { hash: '#/Demo?keep=1' } }))
  const adapter = createHypercanvasStatefullyAdapter({ discovery, statefully, onCompatibilityIndex, resolveIframe })
  return { adapter, discovery, statefully, store, onCompatibilityIndex, resolveIframe }
}

describe('Hypercanvas Statefully adapter', () => {
  it('discovers active Notebook data through the published Statefully package', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hypercanvas-statefully-'))
    const dataDirectory = path.join(root, 'src/prototypes/Demo')
    fs.mkdirSync(dataDirectory, { recursive: true })
    fs.writeFileSync(path.join(dataDirectory, 'default.flow.json'), JSON.stringify({ title: 'From package' }))
    const discovery = statefullyPlugin({ roots: [] }).api
    const adapter = createHypercanvasStatefullyAdapter({ discovery })

    try {
      adapter.setNotebookRoot(root)
      expect(adapter.getStore().getIndex().flows['Demo/default']).toEqual({ title: 'From package' })
    } finally {
      adapter.dispose()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('scopes portable prototype state files by stable artifact ID', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hypercanvas-statefully-portable-'))
    const stateDirectory = path.join(root, 'Team', 'Research', 'Borrow.prototype', 'state')
    fs.mkdirSync(stateDirectory, { recursive: true })
    fs.writeFileSync(path.join(stateDirectory, 'default.flow.json'), JSON.stringify({ title: 'Borrow flow' }))
    const discovery = statefullyPlugin({ roots: [] }).api
    const adapter = createHypercanvasStatefullyAdapter({ discovery })

    try {
      adapter.setNotebookRoot(root, [{
        id: 'borrow-flow',
        kind: 'prototype',
        portable: true,
        folderPath: 'Team/Research/Borrow.prototype',
        runtime: { id: '@dfosco/statefully', version: '0.2.1' },
      }])
      expect(adapter.getIndex().flows['borrow-flow/default']).toEqual({ title: 'Borrow flow' })
    } finally {
      adapter.dispose()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('projects Statefully data once and replaces the provider store on Notebook changes', () => {
    const { adapter, discovery, store, onCompatibilityIndex } = harness()
    adapter.setNotebookRoot('/notebooks/first')
    expect(discovery.setRoots).toHaveBeenCalledWith([{
      path: '/notebooks/first/src',
      identityRoot: 'src',
      identityProfile: 'hypercanvas',
    }])
    expect(store.getIndex().flows['Demo/default'].title).toBe('/notebooks/first/src')
    const view = onCompatibilityIndex.mock.calls.at(-1)[0]
    expect(view.scenes).toBe(view.flows)
    expect(view.objects.nav.label).toBe('Home')

    adapter.setNotebookRoot('/notebooks/second')
    expect(store.getIndex().flows['Demo/default'].title).toBe('/notebooks/second/src')
    expect(onCompatibilityIndex).toHaveBeenCalledTimes(2)
  })

  it('passes route, page and iframe context to Statefully knob writes', () => {
    const { adapter, statefully, resolveIframe } = harness()
    const route = { pathname: '/branch--work/prototypes/Demo/settings', basePath: '/branch--work/' }
    const page = adapter.prepare({ prototype: 'Demo', flow: 'settings', route })
    page.setKnobValue('accent', '#123', { pageId: 'page-17' })
    page.clearKnobValue('accent', { pageId: 'page-17' })
    expect(resolveIframe).toHaveBeenCalledWith('page-17', route)
    expect(statefully.setKnobValue).toHaveBeenCalledWith('accent', '#123', {
      pageId: 'page-17', route: route.pathname, target: { location: { hash: '#/Demo?keep=1' } },
    })
    expect(statefully.clearKnobValue).toHaveBeenCalledWith('accent', {
      pageId: 'page-17', route: route.pathname, target: { location: { hash: '#/Demo?keep=1' } },
    })
  })

  it('clears runtime state and projects an empty compatibility view when no Notebook is active', () => {
    const { adapter, discovery, store, onCompatibilityIndex } = harness()
    adapter.setNotebookRoot('/notebooks/first')
    adapter.setNotebookRoot(null)
    expect(discovery.setRoots).toHaveBeenLastCalledWith([])
    expect(store.getIndex().flows).toEqual({})
    expect(onCompatibilityIndex.mock.calls.at(-1)[0]).toEqual(createPrototypeCompatibilityView({}))
  })
})
