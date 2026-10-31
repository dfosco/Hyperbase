import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { notebookContentPath } from '../notebook/layout.js';
import { codingTargetBootstrap } from './terminal-coding-target.js';
import { ensureTerminalAgentGuidance } from './terminal-agent-profiles.js';
import { updateTerminalCodingContext } from './terminal-config.js';
function isBoundCodingTarget(value) {
    return value !== null && typeof value === 'object'
        && typeof value.siteId === 'string'
        && typeof value.title === 'string'
        && typeof value.root === 'string';
}
function stable(value) {
    if (Array.isArray(value))
        return value.map(stable);
    if (value && typeof value === 'object') {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map(key => [key, stable(record[key])]));
    }
    return value;
}
function atomic(file, content) {
    writeFileSync(`${file}.${process.pid}.tmp`, content);
    renameSync(`${file}.${process.pid}.tmp`, file);
}
/** The server materializes connected props into config before calling this. */
export function writeTerminalContext(root, config, { targetState = null } = {}) {
    if (!config?.widgetId || !config?.canvasId)
        throw new Error('Terminal identity is incomplete; cannot bootstrap canvas context');
    const directory = join(resolveRuntimeDir(root), 'terminals');
    mkdirSync(directory, { recursive: true });
    const guidancePath = ensureTerminalAgentGuidance(root);
    const guidance = existsSync(guidancePath) ? readFileSync(guidancePath, 'utf8') : null;
    const widgets = (config.connectedWidgets || []).map(widget => {
        const data = { id: widget.id, type: widget.type, props: widget.props || {} };
        if (widget.type === 'image' && typeof widget.props?.src === 'string') {
            const imageRoot = notebookContentPath(root, 'assets', 'canvas', 'images');
            const imagePath = resolve(imageRoot, widget.props.src);
            data.imagePath = imagePath.startsWith(`${imageRoot}${sep}`) ? imagePath : null;
        }
        return data;
    }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const context = {
        schemaVersion: 1,
        notebookRoot: root,
        widgetId: config.widgetId,
        displayName: config.displayName || config.preDisplayName || config.widgetId,
        canvasId: config.canvasId,
        branch: config.branch || null,
        serverUrl: config.serverUrl || null,
        configPath: join(directory, `${config.widgetId}.json`),
        guidancePath,
        guidance,
        connectedWidgets: widgets,
        codingTarget: config.codingTarget || null,
        targetState,
        assignment: config.sessionAssignment ?? config.widgetProps?.initialPrompt ?? config.widgetProps?.prompt ?? null,
        instructions: [
            codingTargetBootstrap(root, config, isBoundCodingTarget(config.codingTarget) ? config.codingTarget : null, { includeAssignment: false }),
            `Screenshot shortcodes in agent input, such as [2026-10-13--17:56:00--screenshot.png], refer to PNG files in ${notebookContentPath(root, 'assets', 'screenshots')}. Resolve them against the Notebook root, not the canvas or agent folder. Open the referenced file when needed; do not treat the shortcode as a literal shell command.`,
        ].join('\n'),
    };
    // Peer runtime status and canvas geometry do not change semantic context.
    const semantic = { ...context, connectedWidgets: widgets.map(widget => {
            const props = { ...widget.props };
            for (const field of ['width', 'height', 'expanded'])
                delete props[field];
            if (['terminal', 'agent', 'agent-chat', 'prompt'].includes(widget.type)) {
                for (const field of ['status', 'latestOutput', 'agentStatus', 'width', 'height'])
                    delete props[field];
            }
            return { ...widget, props };
        }) };
    const revision = createHash('sha256').update(JSON.stringify(stable(semantic))).digest('hex').slice(0, 20);
    const snapshot = { revision, ...context };
    const snapshotPath = join(directory, `${config.widgetId}.context.${revision}.json`);
    if (!existsSync(snapshotPath))
        atomic(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    atomic(join(directory, `${config.widgetId}.context.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
    updateTerminalCodingContext(config.widgetId, () => ({ contextRevision: revision, contextPath: snapshotPath }));
    return { revision, snapshotPath, snapshot };
}
export function terminalContextPrompt(context, launchId, { resume = false, initial = false } = {}) {
    const { snapshotPath, revision } = context;
    // The mutable context file stays current if the user changes connectors
    // while an agent is warming up. The versioned snapshot is still retained
    // for audit and the initial acknowledgement remains tied to this launch.
    const livePath = snapshotPath.replace(/\.context\.[a-f0-9]{20}\.json$/, '.context.json');
    return [
        `Hypercanvas ${initial ? 'startup' : 'session'}: Read ${JSON.stringify(livePath)} now. Its guidance, connectedWidgets, coding target and assignment are your Notebook context.`,
        `Acknowledge the initial delivery with: hypercanvas terminal context --ack ${revision} --launch ${launchId}. Do not narrate the context or its acknowledgement unless something is blocked.`,
        'The file updates silently as canvas connections change. Check it before subsequent user tasks; do not interrupt an unfinished task just to report a context update.',
        initial && !resume ? 'Follow the initial assignment if present; otherwise wait for the user.' : 'Continue the current session without replaying completed assignments.',
    ].join(' ');
}
