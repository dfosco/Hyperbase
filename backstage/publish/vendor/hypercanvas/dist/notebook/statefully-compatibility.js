/** Source-owned compatibility at the host boundary; never mutate installed packages. */
const sessions = new WeakMap()
const knobIdentity = key => /^knob(?:\.|[A-Z])/.test(key) ? key.slice(4).replace(/[./_-]/g, '').toLowerCase() : null
const equivalent = (left, right) => left === right || (knobIdentity(left) !== null && knobIdentity(left) === knobIdentity(right))

export function updateParamString(input = '', changes = {}) {
  const value = String(input)
  const prefix = /^[?#]/.test(value) ? value[0] : ''
  let raw = prefix ? value.slice(1) : value
  const fragmentIndex = raw.indexOf('#')
  const fragment = fragmentIndex < 0 ? '' : raw.slice(fragmentIndex)
  if (fragmentIndex >= 0) raw = raw.slice(0, fragmentIndex)
  const routeIndex = raw.startsWith('/') ? raw.indexOf('?') : -1
  const route = raw.startsWith('/') ? routeIndex < 0 ? raw : raw.slice(0, routeIndex) : ''
  const params = new URLSearchParams(route ? routeIndex < 0 ? '' : raw.slice(routeIndex + 1) : raw)
  const entries = changes instanceof URLSearchParams ? changes.entries() : Object.entries(changes)
  for (const [key, next] of entries) {
    const matches = [...params.keys()].filter(existing => equivalent(existing, key))
    const selected = params.has(key) ? key : matches[0] || key
    for (const existing of matches) params.delete(existing)
    if (next !== null && next !== undefined) params.set(selected, String(next))
  }
  const query = params.toString()
  return `${prefix}${route}${route && query ? '?' : ''}${query}${fragment}`
}

export function createCompatibleSession(session) {
  if (sessions.has(session)) return sessions.get(session)
  const updateParams = changes => {
    const next = updateParamString(new URLSearchParams(session.getAllParams()).toString(), changes)
    session.replaceParams(Object.fromEntries(new URLSearchParams(next)))
  }
  const compatible = Object.freeze({
    ...session,
    getParam(key) {
      const direct = session.getParam(key)
      if (direct !== null && direct !== undefined) return direct
      return Object.entries(session.getAllParams()).find(([existing]) => equivalent(existing, key))?.[1] ?? null
    },
    setParam: (key, value) => updateParams({ [key]: value }),
    removeParam: key => updateParams({ [key]: null }),
    updateParams,
  })
  sessions.set(session, compatible)
  sessions.set(compatible, compatible)
  return compatible
}

/** Exact virtual entries reuse the pinned implementation and its single data store. */
export function statefullyCompatibilityModule({ coreSource, reactSource, helperSource, react = false }) {
  if (react) return `
import { createElement, useEffect, useMemo } from 'react';
import { PrototypeProvider as OriginalProvider } from ${JSON.stringify(reactSource)};
export * from ${JSON.stringify(reactSource)};
import { createSessionStore } from '@dfosco/statefully';
import { createCompatibleSession } from ${JSON.stringify(helperSource)};
export function PrototypeProvider(props) {
  const { session: supplied, prototype = null, dataset = null, route = null } = props;
  const session = useMemo(() => supplied ? createCompatibleSession(supplied) : createSessionStore({ namespace: 'statefully:' + (prototype ?? 'default') + ':' + (dataset ?? 'default'), route }), [supplied, prototype, dataset, route]);
  useEffect(() => () => { if (!supplied) session.dispose(); }, [session, supplied]);
  return createElement(OriginalProvider, { ...props, session });
}
`
  return `
import * as core from ${JSON.stringify(coreSource)};
export * from ${JSON.stringify(coreSource)};
import { createCompatibleSession, updateParamString } from ${JSON.stringify(helperSource)};
export { updateParamString };
export const getDefaultSession = () => createCompatibleSession(core.getDefaultSession());
export const createSessionStore = options => createCompatibleSession(core.createSessionStore(options));
export const getParam = key => getDefaultSession().getParam(key);
export const getAllParams = () => getDefaultSession().getAllParams();
export const readParams = () => new URLSearchParams(getAllParams());
export const setParam = (key, value) => getDefaultSession().setParam(key, value);
export const removeParam = key => getDefaultSession().removeParam(key);
export const updateParams = changes => getDefaultSession().updateParams(changes);
export const createKnobStore = (definitions = [], options = {}) => core.createKnobStore(definitions, { ...options, session: createCompatibleSession(options.session || core.getDefaultSession()) });
const knobs = () => createKnobStore(core.listKnobs());
export const getKnob = (...args) => knobs().getKnob(...args);
export const setKnob = (...args) => knobs().setKnob(...args);
export const clearKnob = (...args) => knobs().clearKnob(...args);
export const resolveKnob = (id, options = {}) => knobs().resolve(id, options.route ?? options.scope);
export const applyKnobPreset = (values, options = {}) => knobs().applyPreset(values, options.route ?? options.scope);
export const resetKnobs = (options = {}) => knobs().reset(options.route ?? options.scope);
export const setKnobValue = (id, value, options = {}) => options.session || !options.target
  ? createKnobStore(options.definition ? [{ ...options.definition, id }] : core.listKnobs(), options).setKnob(id, value, options.route ?? options.scope)
  : core.setKnobValue(id, value, options);
export const clearKnobValue = (id, options = {}) => options.session || !options.target
  ? createKnobStore(options.definition ? [{ ...options.definition, id }] : core.listKnobs(), options).clearKnob(id, options.route ?? options.scope)
  : core.clearKnobValue(id, options);
`
}
