import * as statefullyCore from '@dfosco/statefully/core'
import fs from 'node:fs'
import path from 'node:path'

/** Host adapter around Statefully's public discovery, store, and knob APIs. */
export function createPrototypeCompatibilityView(index = {}) {
  return {
    flows: index.flows ?? {},
    scenes: index.flows ?? {},
    objects: index.objects ?? {},
    records: index.records ?? {},
    prototypes: index.prototypes ?? {},
  }
}

export function createHypercanvasStatefullyAdapter({
  discovery,
  statefully: statefullyRuntime = statefullyCore,
  onCompatibilityIndex = () => {},
  resolveIframe = () => null,
} = {}) {
  if (!discovery?.setRoots || !discovery?.rebuild) throw new TypeError('The Statefully Vite discovery API must expose setRoots() and rebuild().')
  if (!statefullyRuntime?.createPrototypeStore || !statefullyRuntime?.setKnobValue || !statefullyRuntime?.clearKnobValue) {
    throw new TypeError('The Statefully runtime must expose createPrototypeStore(), setKnobValue(), and clearKnobValue().')
  }

  let store = statefullyRuntime.createPrototypeStore()
  let notebookRoot = null
  let route = null
  let disposed = false
  let invalidateStatefullyModule = () => {}

  function publish(result) {
    if (disposed) return null
    const index = result?.index ?? result ?? {}
    store.replaceIndex(index)
    onCompatibilityIndex(createPrototypeCompatibilityView(index), result?.diagnostics ?? [])
    return index
  }

  function rootsForNotebook(root, artifacts = []) {
    if (!root) return []
    const roots = [{
      path: path.join(root, 'src'),
      identityRoot: 'src',
      identityProfile: 'hypercanvas',
    }]
    for (const artifact of artifacts) {
      if (artifact?.portable !== true || artifact.kind !== 'prototype'
        || artifact.runtime?.id !== '@dfosco/statefully' || artifact.runtime?.version !== '0.2.1'
        || typeof artifact.id !== 'string' || typeof artifact.folderPath !== 'string') continue
      const stateRoot = path.join(root, ...artifact.folderPath.split('/'), 'state')
      try {
        if (!fs.statSync(stateRoot).isDirectory()) continue
      } catch { continue }
      roots.push({
        path: stateRoot,
        identityRoot: 'src',
        scope: artifact.id,
        identityProfile: 'standalone',
      })
    }
    return roots
  }

  function setNotebookRoot(root, artifacts = []) {
    if (disposed) return null
    notebookRoot = root || null
    if (!notebookRoot) {
      const index = discovery.setRoots([]) ?? {}
      const published = publish({ index, diagnostics: discovery.getDiagnostics?.() ?? [] })
      invalidateStatefullyModule()
      return published
    }
    const index = discovery.setRoots(rootsForNotebook(notebookRoot, artifacts)) ?? {}
    const published = publish({ index, diagnostics: discovery.getDiagnostics?.() ?? [] })
    invalidateStatefullyModule()
    return published
  }

  function prepare({ prototype, dataset, flow, route: routeBinding } = {}) {
    route = routeBinding ?? null
    return {
      store,
      prototype: prototype ?? null,
      dataset: dataset ?? null,
      flow: flow ?? 'default',
      route,
      setKnobValue(id, value, options = {}) {
        const target = options.target ?? resolveIframe(options.pageId, options.route ?? route)
        return statefullyRuntime.setKnobValue(id, value, { ...options, route: options.route ?? route?.pathname, target })
      },
      clearKnobValue(id, options = {}) {
        const target = options.target ?? resolveIframe(options.pageId, options.route ?? route)
        return statefullyRuntime.clearKnobValue(id, { ...options, route: options.route ?? route?.pathname, target })
      },
    }
  }

  function update() {
    if (!notebookRoot || disposed) return null
    const published = publish(discovery.rebuild())
    invalidateStatefullyModule()
    return published
  }

  function dispose() {
    if (disposed) return
    disposed = true
    notebookRoot = null
    route = null
    store.replaceIndex({})
  }

  function setModuleInvalidator(invalidate) {
    invalidateStatefullyModule = typeof invalidate === 'function' ? invalidate : () => {}
  }

  return Object.freeze({
    setNotebookRoot,
    prepare,
    update,
    dispose,
    getStore: () => store,
    getIndex: () => store.getIndex(),
    getDiagnostics: () => discovery.getDiagnostics?.() ?? [],
    setModuleInvalidator,
  })
}
