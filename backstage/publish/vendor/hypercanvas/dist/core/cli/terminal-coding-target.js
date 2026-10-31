import { join } from 'node:path';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { randomUUID } from 'node:crypto';
import { ensureTerminalAgentProfiles, ensureTerminalAgentCli } from '../canvas/terminal-agent-profiles.js';
import { writeTerminalContext, terminalContextPrompt } from '../canvas/terminal-context.js';
import { bindTerminalCodingTarget, initTerminalConfig, readTerminalConfigById, updateTerminalCodingContext } from '../canvas/terminal-config.js';
import { resolveTerminalCodingTargets, selectTerminalCodingTarget, validateBoundCodingTarget, writeCodingTargetPrompt } from '../canvas/terminal-coding-target.js';
import { getServerUrl } from './serverUrl.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
import { captureFilePath, clearCaptureFile } from '../canvas/agent-session.js';
function restoreBoundTarget(value) {
    if (value == null)
        return null;
    if (typeof value !== 'object' || Array.isArray(value))
        throw new Error('The saved coding target is invalid; start a new session with a new target.');
    const target = value;
    if (typeof target.siteId !== 'string' || typeof target.title !== 'string' || typeof target.root !== 'string') {
        throw new Error('The saved coding target is invalid; start a new session with a new target.');
    }
    return validateBoundCodingTarget(value);
}
function isConnectedWidget(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const widget = value;
    return typeof widget.id === 'string'
        && typeof widget.type === 'string'
        && (widget.props === undefined || widget.props === null || (typeof widget.props === 'object' && !Array.isArray(widget.props)));
}
export async function saveCodingTargetPreference(config, selection) {
    const response = await fetch(`${getServerUrl()}/_hypercanvas/canvas/widget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: config.canvasId, widgetId: config.widgetId, props: { codingTargetSiteId: selection } }),
        signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json();
    const error = result !== null && typeof result === 'object' ? result.error : undefined;
    if (!response.ok || error)
        throw new Error(typeof error === 'string' ? error : 'Could not save coding target selection');
}
/** Runs in the Notebook PTY before the native agent starts. */
/** @param {string} root @param {string} widgetId @param {{ resume?: boolean, assignment?: string, choose?: (candidates: unknown[]) => Promise<string | undefined>, savePreference?: (config: unknown, selection: unknown) => Promise<void> }} [options] */
export async function prepareTerminalCodingLaunch(root, widgetId, { resume = false, assignment, choose, savePreference = saveCodingTargetPreference } = {}) {
    initTerminalConfig(root);
    ensureTerminalAgentProfiles(root);
    const config = readTerminalConfigById(widgetId);
    if (!config)
        throw new Error(`Terminal config missing for ${widgetId}`);
    let target;
    if (resume) {
        // Legacy native sessions have no bound target: resume them in Notebook.
        const priorTarget = config.lastAgentCodingTarget;
        target = restoreBoundTarget(priorTarget);
    }
    else {
        const candidates = resolveTerminalCodingTargets(root, config);
        let selection = typeof config.widgetProps?.codingTargetSiteId === 'string' ? config.widgetProps.codingTargetSiteId : null;
        if (selection == null && candidates.length > 1 && choose) {
            const chosen = await choose(candidates);
            if (chosen === undefined)
                throw new Error('Coding target selection cancelled');
            selection = chosen;
            await savePreference(config, selection);
        }
        const candidate = selectTerminalCodingTarget(candidates, selection);
        target = candidate ? validateBoundCodingTarget(candidate) : null;
    }
    // Old SessionStart output must not associate a new target with the previous
    // native session before the new process has actually reported its ID.
    if (!resume)
        clearCaptureFile(captureFilePath(root, widgetId));
    let bound = bindTerminalCodingTarget(widgetId, target);
    if (!resume)
        bound = updateTerminalCodingContext(widgetId, () => ({ sessionAssignment: assignment ?? (typeof config.widgetProps?.initialPrompt === 'string' ? config.widgetProps.initialPrompt : null) ?? (typeof config.widgetProps?.prompt === 'string' ? config.widgetProps.prompt : null) })) ?? bound;
    const binDirectory = ensureTerminalAgentCli(root);
    const promptFile = writeCodingTargetPrompt(root, bound, target, { includeAssignment: !resume });
    const context = writeTerminalContext(root, {
        ...(bound.widgetId ? { widgetId: bound.widgetId } : {}),
        canvasId: typeof bound.canvasId === 'string' ? bound.canvasId : null,
        displayName: typeof bound.displayName === 'string' ? bound.displayName : null,
        preDisplayName: typeof bound.preDisplayName === 'string' ? bound.preDisplayName : null,
        branch: typeof bound.branch === 'string' ? bound.branch : null,
        serverUrl: typeof bound.serverUrl === 'string' ? bound.serverUrl : null,
        connectedWidgets: Array.isArray(bound.connectedWidgets) ? bound.connectedWidgets.filter(isConnectedWidget) : [],
        codingTarget: target,
        sessionAssignment: typeof bound.sessionAssignment === 'string' ? bound.sessionAssignment : null,
        widgetProps: bound.widgetProps ?? null,
    }, { targetState: 'available' });
    const launchId = randomUUID();
    return {
        target,
        promptFile,
        ...context,
        launchId,
        binDirectory,
        prompt: terminalContextPrompt(context, launchId, { resume, initial: true }),
    };
}
/** Local CLI uses the same canonical widget PATCH as canvas update. */
export async function handleCodingTarget() {
    try {
        const args = process.argv.slice(4);
        if (args.includes('--help')) {
            console.log('storyboard terminal coding-target [--site <id> | --notebook | --auto]\nShows candidates/bound target, or sets the current target for a running managed agent, or the next fresh launch.');
            return;
        }
        const root = resolveNotebookRoot();
        initTerminalConfig(root);
        const widgetId = process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID');
        if (!widgetId)
            throw new Error('STORYBOARD_WIDGET_ID must identify a managed terminal');
        const config = readTerminalConfigById(widgetId);
        if (!config)
            throw new Error('STORYBOARD_WIDGET_ID must identify a managed terminal');
        const candidates = resolveTerminalCodingTargets(root, config);
        const index = args.indexOf('--site');
        const changes = Number(index >= 0) + Number(args.includes('--notebook')) + Number(args.includes('--auto'));
        if (changes > 1)
            throw new Error('Choose only one of --site, --notebook, or --auto');
        const selectedSite = index >= 0 ? args[index + 1] : undefined;
        if (index >= 0 && (!selectedSite || selectedSite.startsWith('--')))
            throw new Error('--site requires a Site ID');
        const selection = index >= 0 ? selectedSite : args.includes('--notebook') ? '' : null;
        if (changes) {
            if (selection != null)
                selectTerminalCodingTarget(candidates, selection);
            await saveCodingTargetPreference(config, selection);
        }
        console.log(JSON.stringify({ candidates, selection: changes ? selection : config.widgetProps?.codingTargetSiteId ?? null, boundTarget: config.codingTarget ?? null, notebookRoot: root, configPath: join(resolveRuntimeDir(root), 'terminals', `${config.widgetId}.json`) }, null, 2));
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
}
