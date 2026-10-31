/// <reference path="../storyboards/statefully-core.d.ts" />
import * as statefullyCore from '@dfosco/statefully/core';
import { getAllParams, getParam, removeParam, setParam, } from '../session/session.js';
import { getHashSnapshot, subscribeToHash } from '../session/hashSubscribe.js';
import { getStorageSnapshot, subscribeToStorage } from '../session/localStorage.js';
import { getAllShadows, getShadow, isHideMode, removeShadow, setShadow, } from '../session/hideMode.js';
const noStorage = Object.freeze({
    get length() { return 0; },
    key() { return null; },
    getItem() { return null; },
    setItem() { },
    removeItem() { },
    clear() { },
});
function requireFunction(runtime, name) {
    if (typeof runtime?.[name] !== 'function') {
        throw new TypeError(`The installed Statefully runtime must expose ${name}().`);
    }
    return runtime[name];
}
function resolveTargetWindow(target) {
    if (!target)
        return null;
    try {
        if ('contentWindow' in target) {
            return target.contentWindow?.location ? target.contentWindow : null;
        }
        return target.location && typeof target.addEventListener === 'function' ? target : null;
    }
    catch {
        return null;
    }
}
function providerDefinitions(definitions, route, buildLegacyKnobKey) {
    if (!Array.isArray(definitions))
        return [];
    return definitions.map(definition => {
        if (!definition || typeof definition !== 'object')
            return definition;
        const authored = definition;
        const aliases = authored.aliases ?? authored.legacyIds ?? [];
        const ids = [authored.id, ...(Array.isArray(aliases) ? aliases : [aliases])];
        const scopes = [
            authored.scope === undefined ? route : authored.scope,
            ...(Array.isArray(authored.scopeAliases)
                ? authored.scopeAliases
                : authored.scopeAliases == null ? [] : [authored.scopeAliases]),
        ];
        const legacyKeys = new Set(Array.isArray(authored.legacyKeys)
            ? authored.legacyKeys
            : authored.legacyKeys ? [authored.legacyKeys] : []);
        for (const scope of scopes) {
            for (const id of ids) {
                if (typeof id !== 'string' || !id)
                    continue;
                legacyKeys.add(buildLegacyKnobKey(id, scope === undefined ? {} : { route: scope }));
            }
        }
        return {
            ...authored,
            ...(authored.type === 'text' ? { type: 'string' } : {}),
            legacyKeys: [...legacyKeys],
        };
    });
}
function createHostSession() {
    function subscribe(listener) {
        const unsubscribeHash = subscribeToHash(listener);
        const unsubscribeStorage = subscribeToStorage(listener);
        return () => {
            unsubscribeHash();
            unsubscribeStorage();
        };
    }
    function getSnapshot() {
        return JSON.stringify([getHashSnapshot(), isHideMode(), getStorageSnapshot()]);
    }
    const readAllParams = () => (isHideMode() ? getAllShadows() : getAllParams());
    function writeParam(key, value) {
        const serialized = String(value);
        if (isHideMode()) {
            setShadow(key, serialized);
            return;
        }
        setParam(key, serialized);
        setShadow(key, serialized);
    }
    function deleteParam(key) {
        if (isHideMode()) {
            removeShadow(key);
            return;
        }
        removeParam(key);
        removeShadow(key);
    }
    return Object.freeze({
        getParam(key) {
            return isHideMode() ? getShadow(key) : getParam(key);
        },
        getAllParams: readAllParams,
        replaceParams(values = {}) {
            const next = Object.entries(values).filter(([, value]) => value !== null && value !== undefined);
            const keep = new Set(next.map(([key]) => key));
            for (const key of Object.keys(readAllParams()))
                if (!keep.has(key))
                    deleteParam(key);
            for (const [key, value] of next)
                writeParam(key, String(value));
        },
        setParam(key, value) {
            const serialized = String(value);
            if (isHideMode()) {
                setShadow(key, serialized);
                return;
            }
            setParam(key, serialized);
            setShadow(key, serialized);
        },
        removeParam(key) {
            if (isHideMode()) {
                removeShadow(key);
                return;
            }
            removeParam(key);
            removeShadow(key);
        },
        subscribe,
        getSnapshot,
    });
}
/**
 * Bind the accepted Statefully knob store to Hypercanvas persistence.
 *
 * Statefully owns flattening, selection, keys, codecs, aliases, presets,
 * resets, and target hash writes. Hypercanvas supplies its existing hide-mode
 * session view, or a public Statefully session bound to an iframe Window.
 */
export function createHypercanvasKnobRuntime(definitions = [], { target = null, route, statefully = statefullyCore } = {}) {
    const createKnobStore = requireFunction(statefully, 'createKnobStore');
    const buildKnobKey = requireFunction(statefully, 'buildKnobKey');
    const buildLegacyKnobKey = requireFunction(statefully, 'buildLegacyKnobKey');
    const coerce = requireFunction(statefully, 'coerce');
    const targetWindow = resolveTargetWindow(target);
    if (target && !targetWindow) {
        throw new TypeError('The knob target must be a same-origin Window or iframe element.');
    }
    const ownsSession = Boolean(targetWindow && targetWindow !== window);
    const session = ownsSession
        ? requireFunction(statefully, 'createSessionStore')({
            targetWindow,
            storage: noStorage,
            namespace: 'hypercanvas-knobs',
        })
        : createHostSession();
    const options = { session };
    if (route !== undefined)
        options.route = route;
    const presentationStore = createKnobStore(definitions);
    const flattenedDefinitions = presentationStore.listKnobs();
    const store = createKnobStore(providerDefinitions(flattenedDefinitions, route, buildLegacyKnobKey), options);
    const typedStore = store;
    function selectedScope(definition) {
        if (Object.hasOwn(definition ?? {}, 'scope') && definition.scope !== undefined) {
            return definition.scope;
        }
        return route;
    }
    function withScope(method, definition, args = []) {
        const scope = selectedScope(definition);
        const operation = method;
        return scope === undefined
            ? operation(definition.id, ...args)
            : operation(definition.id, ...args, scope);
    }
    function getKey(definition) {
        const scope = selectedScope(definition);
        return buildKnobKey(definition.id, scope === undefined ? {} : { route: scope });
    }
    function rawKeys(definition, canonicalKey) {
        const providerDefinition = typedStore.listKnobs().find(candidate => candidate?.id === definition?.id && candidate.scope === selectedScope(definition));
        const legacyKeys = providerDefinition?.legacyKeys;
        const declared = typeof legacyKeys === 'string'
            ? [legacyKeys]
            : Array.isArray(legacyKeys)
                ? legacyKeys.filter((key) => typeof key === 'string')
                : [];
        return [canonicalKey, ...declared.filter(key => key !== canonicalKey)];
    }
    function read(definition, fallback = definition?.default) {
        const key = getKey(definition);
        let rawValue = null;
        for (const candidate of rawKeys(definition, key)) {
            rawValue = session.getParam(candidate);
            if (rawValue != null)
                break;
        }
        const value = withScope(typedStore.getKnob, definition, [fallback]);
        const type = definition?.type === 'text' ? 'string' : definition?.type;
        const validationDefinition = { ...definition };
        delete validationDefinition.min;
        delete validationDefinition.max;
        const coercedValue = rawValue == null
            ? undefined
            : coerce(rawValue, type, undefined, validationDefinition);
        return {
            key,
            rawValue,
            value,
            coercedValue,
            errorValue: rawValue == null ? undefined : coercedValue,
            hasOverride: rawValue != null || value !== fallback,
        };
    }
    function set(definition, value) {
        withScope(typedStore.setKnob, definition, [value]);
    }
    function clear(definition) {
        withScope(typedStore.clearKnob, definition);
    }
    function reset() {
        const scopes = new Map();
        for (const definition of store.listKnobs()) {
            if (!definition || definition.type === 'object')
                continue;
            const scope = selectedScope(definition);
            const key = scope === undefined ? 'implicit' : JSON.stringify(scope);
            scopes.set(key, scope);
        }
        if (scopes.size === 0) {
            typedStore.reset();
            return;
        }
        for (const [key, scope] of scopes) {
            if (key === 'implicit')
                typedStore.reset();
            else
                typedStore.reset(scope);
        }
    }
    const subscribe = session.subscribe?.bind(session) ?? (() => () => { });
    const getSnapshot = session.getSnapshot?.bind(session) ?? (() => '');
    return Object.freeze({
        store,
        listKnobs: () => flattenedDefinitions.map(definition => ({ ...definition })),
        session,
        targetWindow,
        subscribe,
        getSnapshot,
        read,
        set,
        clear,
        reset,
        dispose() {
            if (ownsSession)
                session.dispose?.();
        },
    });
}
