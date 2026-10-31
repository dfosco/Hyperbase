import { describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createKnobStore, createSessionStore } from '@dfosco/statefully'
import { createCompatibleSession, statefullyCompatibilityModule, updateParamString } from './statefullyCompatibility.js'

function session(hash = '#/Demo?keep=1') {
  let current = hash
  const targetWindow = { location: { get hash() { return current }, set hash(value) { current = `#${String(value).replace(/^#/, '')}` } }, addEventListener() {}, removeEventListener() {} }
  const original = createSessionStore({ targetWindow })
  return { original, targetWindow, store: createCompatibleSession(original) }
}

describe('Statefully source compatibility', () => {
  it('runs the generated public entry with default-session legacy helpers and current target APIs', () => {
    const generated = statefullyCompatibilityModule({
      coreSource: pathToFileURL(createRequire(import.meta.url).resolve('@dfosco/statefully')).href,
      helperSource: pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), 'statefullyCompatibility.js')).href,
    })
    const script = `
      import assert from 'node:assert/strict';
      globalThis.window = { location: { hash: '#/Demo?keep=1&knobDemoShowDetails=true' }, addEventListener() {}, removeEventListener() {} };
      const runtime = await import(${JSON.stringify(`data:text/javascript,${encodeURIComponent(generated)}`)});
      runtime.initKnobs([{ id: 'showDetails', type: 'boolean', default: false }]);
      runtime.setKnobValue('showDetails', false, { route: '/Demo' });
      assert.deepEqual(runtime.getAllParams(), { keep: '1', knobDemoShowDetails: 'false' });
      runtime.clearKnobValue('showDetails', { route: '/Demo' });
      assert.deepEqual(runtime.getAllParams(), { keep: '1' });
      const explicit = runtime.createSessionStore();
      explicit.setParam('knobDemoShowDetails', true);
      runtime.clearKnobValue('showDetails', { scope: '/Demo', session: explicit });
      assert.deepEqual(explicit.getAllParams(), { keep: '1' });
      const target = { location: { hash: '#/Other?keep=2' } };
      runtime.setKnobValue('showDetails', true, { route: '/Demo', target });
      assert.equal(target.location.hash, '/Other?keep=2&knob.Demo.showDetails=true');
      runtime.clearKnobValue('showDetails', { route: '/Demo', target });
      assert.equal(target.location.hash, '/Other?keep=2');
      assert.deepEqual(runtime.getAllParams(), { keep: '1' });
    `
    expect(() => execFileSync(process.execPath, ['--input-type=module'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] })).not.toThrow()
  })

  it('updates query/hash strings without losing route, unrelated params or fragments', () => {
    expect(updateParamString('?keep=1&old=2', { old: null, next: 'a b' })).toBe('?keep=1&next=a+b')
    expect(updateParamString('#/Demo/details?keep=1&old=2', { old: undefined, next: 3 })).toBe('#/Demo/details?keep=1&next=3')
    expect(updateParamString('/Demo?keep=1#body', { next: false })).toBe('/Demo?keep=1&next=false#body')
    expect(updateParamString('key=old', new URLSearchParams({ key: 'new' }))).toBe('key=new')
  })

  it('adds atomic explicit-session updates and equivalence without mutating the pinned session', () => {
    const { original, store, targetWindow } = session('#/Demo?keep=1&knobDemoShowDetails=true')
    const notify = vi.fn(); const unsubscribe = store.subscribe(notify)
    expect(store.getParam('knob.Demo.showDetails')).toBe('true')
    store.updateParams({ 'knob.Demo.showDetails': false, extra: 5 })
    expect(notify).toHaveBeenCalledOnce()
    expect(store.getParam('knobDemoShowDetails')).toBe('false')
    expect(store.getAllParams()).toEqual({ keep: '1', knobDemoShowDetails: 'false', extra: '5' })
    store.removeParam('knob.Demo.showDetails')
    expect(store.getParam('knobDemoShowDetails')).toBeNull()
    expect(targetWindow.location.hash).toBe('#/Demo?keep=1&extra=5')
    expect(original.updateParams).toBeUndefined()
    expect(createCompatibleSession(original)).toBe(store)
    unsubscribe(); store.dispose()
  })

  it('preserves scoped knob presets/reset and legacy PascalCase keys through the current runtime', () => {
    const { store } = session('#/Demo?keep=1&knobDemoShowDetails=true')
    const knobs = createKnobStore([{ id: 'showDetails', type: 'boolean', default: false }, { id: 'count', type: 'number', default: 1 }], { session: store, route: '/Demo' })
    expect(knobs.getKnob('showDetails')).toBe(true)
    knobs.setKnob('showDetails', false)
    expect(store.getParam('knobDemoShowDetails')).toBe('false')
    knobs.applyPreset({ showDetails: true, count: 3 })
    expect(knobs.getKnob('showDetails')).toBe(true)
    expect(knobs.getKnob('count')).toBe(3)
    knobs.reset()
    expect(knobs.getKnob('showDetails')).toBe(false)
    expect(knobs.getKnob('count')).toBe(1)
    expect(store.getAllParams()).toEqual({ keep: '1' })
    store.dispose()
  })
})
