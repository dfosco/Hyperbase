import { initTerminalConfig, readTerminalConfigById, updateTerminalCodingContext } from './terminal-config.js';
import { resolveTerminalCodingTargets, selectTerminalCodingTarget, validateBoundCodingTarget } from './terminal-coding-target.js';
import { writeTerminalContext } from './terminal-context.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveRuntimeDir } from '../runtimeDir.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function contextWidgets(value) {
    if (!Array.isArray(value))
        return undefined;
    return value.flatMap((item) => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.type !== 'string')
            return [];
        const props = item.props;
        if (props === null || props === undefined)
            return [{ id: item.id, type: item.type, ...(props === null ? { props: null } : {}) }];
        return isRecord(props) ? [{ id: item.id, type: item.type, props }] : [{ id: item.id, type: item.type }];
    });
}
function contextState(config) {
    return config && isRecord(config.contextState) ? config.contextState : {};
}
function isBoundTarget(value) {
    return isRecord(value) && typeof value.siteId === 'string' && typeof value.title === 'string' && typeof value.root === 'string';
}
// Readiness is process-local. A Core restart cannot trust a persisted ready flag.
const launches = new Map();
const keyFor = (root, widgetId) => `${root}\0${widgetId}`;
const notifyDefault = (widgetId, state) => import('./terminal-server.js').then(module => module.notifyTerminalContext(widgetId, state)).catch(() => { });
/** True only after this Core has verified interactive-agent startup context. */
export function isManagedTerminalReady(root, widgetId) {
    const launch = launches.get(keyFor(root, widgetId));
    const config = readTerminalConfigById(widgetId);
    return Boolean(launch?.ready && launch.interactive && contextState(config).phase === 'ready');
}
function persist(root, widgetId, update, notify) {
    initTerminalConfig(root);
    const config = updateTerminalCodingContext(widgetId, update);
    if (config)
        notify(widgetId, config.contextState);
    return config;
}
export function startTerminalContext(root, widgetId, { launchId, revision, interactive = true }, { notify = notifyDefault } = {}) {
    if (typeof interactive !== 'boolean')
        throw new Error('interactive must be a boolean');
    if (typeof launchId !== 'string' || !/^[a-f0-9-]{36}$/.test(launchId))
        throw new Error('Invalid managed launch identity');
    initTerminalConfig(root);
    const config = readTerminalConfigById(widgetId);
    if (!config)
        throw new Error('Terminal context is unavailable');
    const existing = launches.get(keyFor(root, widgetId));
    // A response can be lost after the server accepted a start. Retrying the
    // same launch must not reset an acknowledgement or its ready state.
    if (existing?.launchId === launchId && existing.revisions.has(revision))
        return config.contextState;
    if (config.contextRevision !== revision) {
        let initial;
        if (/^[a-f0-9]{20}$/.test(revision)) {
            try {
                initial = JSON.parse(readFileSync(join(resolveRuntimeDir(root), 'terminals', `${widgetId}.context.${revision}.json`), 'utf8'));
            }
            catch { /* absent snapshot */ }
        }
        if (!isRecord(initial) || initial.revision !== revision || initial.widgetId !== widgetId)
            throw new Error('Startup context changed; prepare the launch again');
    }
    launches.set(keyFor(root, widgetId), { launchId, ready: false, interactive, revisions: new Set([revision]) });
    return persist(root, widgetId, () => ({ contextState: {
            revision: config.contextRevision || revision, launchId, delivery: 'pending', phase: 'starting', targetStatus: 'available',
            target: config.codingTarget || null, candidates: resolveTerminalCodingTargets(root, config),
            message: 'Waiting for the primary agent to read startup context',
        } }), notify)?.contextState;
}
export function stopTerminalContext(root, widgetId, launchId, { notify = notifyDefault } = {}) {
    initTerminalConfig(root);
    const key = keyFor(root, widgetId);
    const launch = launches.get(key);
    if (launchId && launch?.launchId !== launchId)
        return readTerminalConfigById(widgetId)?.contextState;
    launches.delete(key);
    return persist(root, widgetId, current => ({ contextState: {
            ...current.contextState, phase: 'stopped', message: 'Agent process is stopped; context will be loaded at its next start',
        } }), notify)?.contextState;
}
/**
 * Explicit graph changes can retarget the coding target. Always materialize
 * the latest context on disk, but never inject an unsolicited PTY message:
 * a foreground agent TUI's draft input cannot be observed reliably.
 */
export async function refreshLiveCodingTarget(root, widgetId, { notify = notifyDefault } = {}) {
    initTerminalConfig(root);
    let config = readTerminalConfigById(widgetId);
    if (!config)
        return null;
    let launch = launches.get(keyFor(root, widgetId));
    if (launch && config.contextState?.phase === 'stopped') {
        launches.delete(keyFor(root, widgetId));
        launch = undefined;
    }
    const candidates = resolveTerminalCodingTargets(root, config);
    let target = isBoundTarget(config.codingTarget) ? config.codingTarget : null;
    let targetStatus = 'available';
    let message = null;
    // A stopped session's saved target belongs to its native ID. Preferences can
    // change now, but binding happens on the next fresh launch or explicit resume.
    if (launch) {
        let selection = typeof config.widgetProps?.codingTargetSiteId === 'string' ? config.widgetProps.codingTargetSiteId : null;
        if (selection && !candidates.some(candidate => candidate.siteId === selection))
            selection = null;
        try {
            const pinnedCandidates = candidates.map(candidate => candidate.siteId === target?.siteId
                ? { ...candidate, root: target.root, error: null } : candidate);
            const selected = selectTerminalCodingTarget(pinnedCandidates, selection);
            target = validateBoundCodingTarget(selected);
        }
        catch (error) {
            const failure = error && typeof error === 'object' ? error : null;
            targetStatus = failure?.code === 'CODING_TARGET_REQUIRED' ? 'selection-required' : 'unavailable';
            message = typeof failure?.message === 'string' ? failure.message : 'Coding target is unavailable';
        }
        config = updateTerminalCodingContext(widgetId, current => ({
            codingTarget: target,
            ...(launch.ready && current.lastAgentSessionId ? { lastAgentCodingTarget: target } : {}),
        }));
        if (!config)
            return null;
    }
    const { connectedWidgets: rawConnectedWidgets, ...contextConfig } = config;
    const connectedWidgets = contextWidgets(rawConnectedWidgets);
    const context = writeTerminalContext(root, {
        ...contextConfig,
        widgetId,
        ...(connectedWidgets === undefined ? {} : { connectedWidgets }),
    }, { targetState: targetStatus });
    if (config.contextState?.revision !== context.revision) {
        config = persist(root, widgetId, current => ({ contextState: {
                ...current.contextState, revision: context.revision, target, candidates, targetStatus,
                // Startup's native prompt is already dispatched. A mid-start change
                // remains visible in the live context file, without interrupting it.
                delivery: launch && !launch.ready ? 'pending' : 'available',
                message: message || 'Context updated on disk; read it before the next task',
            } }), notify);
    }
    if (!launch && config?.contextState?.phase === 'ready') {
        config = persist(root, widgetId, current => ({ contextState: {
                ...current.contextState, phase: 'unverified', delivery: 'available',
                message: 'Agent readiness is unknown after a Core restart; latest context remains on disk',
            } }), notify);
    }
    return config?.contextState || null;
}
export async function acknowledgeTerminalContext(root, widgetId, { launchId, revision }, options = {}) {
    initTerminalConfig(root);
    const launch = launches.get(keyFor(root, widgetId));
    if (!launch || launch.launchId !== launchId || !launch.revisions.has(revision))
        throw new Error('Context acknowledgement does not belong to this managed launch');
    launch.ready = true;
    const config = persist(root, widgetId, current => {
        const isCurrent = current.contextState?.revision === revision;
        return { contextState: {
                ...current.contextState, phase: 'ready', acknowledgedRevision: revision,
                delivery: isCurrent ? 'acknowledged' : 'available',
                message: isCurrent
                    ? 'Primary agent acknowledged startup context'
                    : 'Context changed during startup and is available on disk; no PTY injection',
            } };
    }, options.notify || notifyDefault);
    return config?.contextState || null;
}
