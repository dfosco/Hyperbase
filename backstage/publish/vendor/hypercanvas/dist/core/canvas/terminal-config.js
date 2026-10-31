/**
 * Terminal Config — per-terminal context files for agent awareness.
 *
 * Each terminal widget gets a config at `.hypercanvas/terminals/{hash}.json`
 * (legacy Notebooks stay under `.storyboard/terminals/`).
 * that agents read on startup to understand their canvas context.
 *
 * Files are keyed by a stable widget identity hash so renames do not break them.
 * The canvasId/widgetId are stored inside the JSON payload.
 *
 * Connected widget props are refreshed from materialized canvas state on edits.
 * Versioned snapshots make startup and live delivery inspectable.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, symlinkSync, unlinkSync, readdirSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { readAppConfig } from '../configFile.js';
import { readCurrentViewport } from './selectedWidgets.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
function parseTerminalConfig(raw) {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed))
        return {};
    const connectedWidgets = Array.isArray(parsed.connectedWidgets)
        ? parsed.connectedWidgets.filter((widget) => isRecord(widget) && typeof widget.id === 'string' && typeof widget.type === 'string'
            && (widget.props === undefined || widget.props === null || isRecord(widget.props)))
        : undefined;
    return {
        ...parsed,
        ...(connectedWidgets === undefined ? {} : { connectedWidgets }),
    };
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Resolve the terminals directory per the active Notebook's runtime dir. */
function runtimeDirForTerminalConfigs() {
    if (rootDir === null)
        throw new Error('Terminal config has not been initialized.');
    return resolveRuntimeDir(rootDir);
}
/** Legacy terminal-session env access (old agent shells export STORYBOARD_*). */
function legacySessionEnv(base) {
    return process.env[`STORYBOARD_${base}`];
}
let rootDir = null;
/** Initialize with the project root directory */
export function initTerminalConfig(root) {
    if (!root) {
        const error = new Error('No active Notebook is configured for terminal state.');
        throw Object.assign(error, { code: 'NO_ACTIVE_NOTEBOOK' });
    }
    rootDir = root;
    const dir = join(runtimeDirForTerminalConfigs(), 'terminals');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
/** Read the application config for the dev domain (sourced from repository.name) */
function readDevDomain() {
    if (!rootDir)
        return 'hypercanvas';
    try {
        const raw = readAppConfig(rootDir);
        const repository = isRecord(raw?.repository) ? raw.repository : null;
        return typeof repository?.name === 'string' ? repository.name : 'hypercanvas';
    }
    catch {
        return 'hypercanvas';
    }
}
/** Detect worktree name */
function getWorktreeName() {
    if (!rootDir)
        return 'main';
    try {
        // Check if we're in a worktrees/ directory
        const cwd = rootDir;
        const match = cwd.match(/worktrees\/([^/]+)/);
        return match?.[1] || 'main';
    }
    catch {
        return 'main';
    }
}
/** Generate a stable filename from branch + canvasId + widgetId */
function configKey(branch, canvasId, widgetId) {
    const input = `${branch}::${canvasId}::${widgetId}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
/** Public accessor for the per-widget key (used by agent-session capture). */
export function getConfigKey(branch, canvasId, widgetId) {
    return configKey(branch, canvasId, widgetId);
}
/** Get the config file path */
function configPath(branch, canvasId, widgetId) {
    if (!rootDir)
        throw new Error('No active Notebook is configured for terminal state.');
    return join(runtimeDirForTerminalConfigs(), 'terminals', `${configKey(branch, canvasId, widgetId)}.json`);
}
/** Atomic write — write to temp then rename */
function atomicWrite(filePath, data) {
    const tmp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, filePath);
}
/**
 * Pre-reserve terminal identity at widget creation time.
 * Called from POST /widget when a terminal/agent widget is added to the canvas,
 * BEFORE the widget renders or the WebSocket connects.
 *
 * Writes a minimal config file at `.hypercanvas/terminals/{widgetId}.json` so
 * agents (especially hot-pool sessions) can find their identity immediately.
 * The `reserved` flag marks this as a pre-reserve — writeTerminalConfig() will
 * later overwrite it with the full config.
 */
export function preReserveTerminalIdentity({ widgetId, preDisplayName, canvasId, branch, serverUrl, workspaceId = null, widgetProps = null }) {
    const dir = join(runtimeDirForTerminalConfigs(), 'terminals');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const fp = join(dir, `${widgetId}.json`);
    const data = {
        widgetId,
        preDisplayName,
        displayName: preDisplayName,
        canvasId,
        branch,
        serverUrl: serverUrl || null,
        workspaceId: workspaceId || null,
        widgetProps: widgetProps || null,
        reserved: true,
        connectedWidgets: [],
        agentStatus: null,
        viewport: readCurrentViewport(rootDir) || null,
        updatedAt: new Date().toISOString(),
    };
    atomicWrite(fp, data);
}
/**
 * Write or update a terminal config file.
 * Called when a terminal widget is created or reconnected.
 */
export function writeTerminalConfig({ branch, canvasId, widgetId, canvasFile = null, serverUrl = null, workspaceId = null, sessionId = null, widgetProps = null, displayName = null }) {
    const fp = configPath(branch, canvasId, widgetId);
    const dir = dirname(fp);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    let existing = {};
    try {
        existing = parseTerminalConfig(readFileSync(fp, 'utf8'));
    }
    catch {
        // Core can have a different branch from the active Notebook. Widget
        // identity already exists before the PTY and owns its live context.
        const reserved = readTerminalConfigById(widgetId);
        if (reserved?.canvasId === canvasId)
            existing = reserved;
    }
    const worktree = getWorktreeName();
    const devDomain = readDevDomain();
    // The active Hypercanvas server is the only valid default. Consumers that
    // need a different workspace must pass its resolved service URL explicitly.
    if (!serverUrl)
        serverUrl = process.env.HYPERCANVAS_SERVER_URL || legacySessionEnv('SERVER_URL') || 'http://localhost:1234';
    const config = {
        ...existing,
        widgetId,
        displayName: displayName || existing.displayName || widgetProps?.alias || widgetProps?.prettyName || existing.widgetProps?.prettyName || null,
        canvasId,
        canvasFile: canvasFile || existing.canvasFile || null,
        branch,
        worktree,
        devDomain,
        serverUrl,
        workspaceId: workspaceId || existing.workspaceId || null,
        sessionId: sessionId || existing.sessionId || null,
        workingDirectory: rootDir,
        reserved: false,
        deleted: false,
        widgetProps: widgetProps || existing.widgetProps || null,
        connectedWidgets: existing.connectedWidgets || [],
        agentStatus: existing.agentStatus || null,
        viewport: readCurrentViewport(rootDir) || existing.viewport || null,
        updatedAt: new Date().toISOString(),
    };
    atomicWrite(fp, config);
    // Create a widgetId-named symlink so agents can find their config directly
    const hashName = `${configKey(branch, canvasId, widgetId)}.json`;
    const symPath = join(dir, `${widgetId}.json`);
    try {
        if (existsSync(symPath))
            unlinkSync(symPath);
        symlinkSync(hashName, symPath);
    }
    catch { /* symlink creation is best-effort */ }
    // Create a session-named symlink for process-level identity lookup.
    if (sessionId) {
        const sessionSymPath = join(dir, `${sessionId}.json`);
        try {
            if (existsSync(sessionSymPath))
                unlinkSync(sessionSymPath);
            symlinkSync(hashName, sessionSymPath);
        }
        catch { /* best-effort */ }
    }
    return config;
}
/**
 * Update connected widgets for a terminal.
 * Called when connectors are added/removed.
 * Stores full widget objects (id, type, props, position) so agents
 * can read context directly without additional API calls.
 */
export function updateTerminalConnections({ branch, canvasId, widgetId, connectedWidgets, widgetProps = null, }) {
    const live = readTerminalConfigById(widgetId);
    const fp = live?.reserved && live.canvasId === canvasId
        ? join(runtimeDirForTerminalConfigs(), 'terminals', `${widgetId}.json`)
        : configPath(live?.canvasId === canvasId ? live.branch || branch : branch, canvasId, widgetId);
    let config = {};
    try {
        config = parseTerminalConfig(readFileSync(fp, 'utf8'));
    }
    catch { /* file may not exist yet */ }
    if (widgetProps) {
        config.widgetProps = widgetProps;
        // Promote displayName: alias > prettyName
        if (widgetProps.alias)
            config.displayName = widgetProps.alias;
        else if (widgetProps.prettyName)
            config.displayName = widgetProps.prettyName;
    }
    config.connectedWidgets = connectedWidgets || [];
    config.viewport = readCurrentViewport(rootDir) || config.viewport || null;
    config.updatedAt = new Date().toISOString();
    atomicWrite(fp, config);
    return config;
}
/**
 * Mark a terminal config as deleted (tombstone).
 * Called when a terminal widget is deleted.
 */
export function markTerminalDeleted({ branch, canvasId, widgetId }) {
    const live = readTerminalConfigById(widgetId);
    const config = live || { branch, canvasId, widgetId, reserved: true };
    const fp = config.reserved
        ? join(runtimeDirForTerminalConfigs(), 'terminals', `${widgetId}.json`)
        : configPath(config.branch || branch, config.canvasId || canvasId, widgetId);
    mkdirSync(dirname(fp), { recursive: true });
    config.deleted = true;
    config.updatedAt = new Date().toISOString();
    atomicWrite(fp, config);
}
/**
 * Unmark a terminal config as deleted (undo).
 * Called when a deleted terminal widget is restored.
 */
export function unmarkTerminalDeleted({ branch, canvasId, widgetId }) {
    const live = readTerminalConfigById(widgetId);
    const fp = live?.reserved
        ? join(runtimeDirForTerminalConfigs(), 'terminals', `${widgetId}.json`)
        : configPath(live?.branch || branch, live?.canvasId || canvasId, widgetId);
    try {
        const config = parseTerminalConfig(readFileSync(fp, 'utf8'));
        config.deleted = false;
        config.updatedAt = new Date().toISOString();
        atomicWrite(fp, config);
    }
    catch { /* file may not exist */ }
}
/**
 * Record the Paseo agent id backing an agent-chat widget so server-side
 * lookups (canvas agent lists, agent status) can resolve widget → agent.
 * Called when the browser creates or resumes an agent for the widget.
 */
export function recordWidgetAgentBinding({ widgetId, agentId }) {
    const config = readTerminalConfigById(widgetId);
    if (!config)
        return null;
    config.widgetProps = { ...(config.widgetProps || {}), agentId };
    if (agentId) {
        config.lastAgentId = agentId;
        config.lastAgentBoundAt = new Date().toISOString();
    }
    config.updatedAt = new Date().toISOString();
    const fp = configPath(config.branch || 'unknown', config.canvasId || 'unknown', widgetId);
    try {
        atomicWrite(fp, config);
    }
    catch { /* best-effort */ }
    return config;
}
/**
 * Build the Squad bootstrap prompt for a widget joining the numbered room protocol.
 * Shared by terminal PTY sessions (prepareTerminalFiles) and Paseo agent
 * chats (initial prompt injection at create time).
 */
export function buildSquadBootstrapPrompt(widgetId, agentProfile = 'terminal-agent') {
    return [
        'Use Storyboard Squads for durable agent coordination; generic event channels are not the turn ledger.',
        `Your widget id is ${widgetId}. Before work, read '.agents/${agentProfile}.agent.md' when it exists, then run 'storyboard squad list'. For every listed Squad, read its numbered room. An empty list means there is no Squad assignment.`,
        'Record every turn in every Squad you belong to, including information-only turns and results. Submit kind and plaintext description; Core verifies the member author and assigns the number/timestamp. Never invent or predict a number.',
        'Scan each room between turns and before going idle; run storyboard squad reconcile <squad-id> to see addressed instructions and numbered per-recipient replies. Room visibility or an information post does not assign work to everyone. Do not repeat active or completed work.',
        'Reply to the original ledger number. Record ack before material work, then result or blocked before idle; acknowledgement is receipt, not completion. Completion requires a result and leader acknowledgement.',
        'The only message kinds are information and instruction. Never use --kind result or --kind ack. Use storyboard squad reply <returned-squad-id> <committed-assignment-number> --response ack|result|blocked --description <text>. The leader acknowledges EACH returned result number with --response ack before declaring the assignment complete.',
        'When creating peers, use the actual IDs returned by canvas creation. Create the Squad with storyboard squad create <name> --canvas <current-canvas-id> --members <returned-peer-ids>; this establishes the leader-to-peer connectors and enables broadcast. Use the returned squadId, never the room name or invented widget IDs. Give the assignment through a committed instruction after creation, not a guessed room in the worker initial prompt.',
        'Broadcast off means visually connected only; broadcast on makes the connected agents a communicating Squad with dotted connectors. Respect disabled/disconnected membership: read history, but do not execute old assignments or bypass the mode with direct terminal input. The agent input is the message entry point; no separate room-post composer is needed.',
        'Injection is an attention trigger, not storage: initial Squad bootstrap and direct actionable follow-ups normally inject the exact description plus {squadId, number}; omitted injection means ledger-only. Persist first, then scan again to reconcile.',
        'Do not poll continuously. A five-second periodic room check is only for an explicit response wait; ordinary reconciliation happens between turns.',
    ].join('\n');
}
/**
 * Read a terminal config. Connected widgets are already inline —
 * no additional resolution needed.
 */
export function readTerminalConfig({ branch, canvasId, widgetId }) {
    const fp = configPath(branch, canvasId, widgetId);
    try {
        return parseTerminalConfig(readFileSync(fp, 'utf8'));
    }
    catch {
        return null;
    }
}
/**
 * Update agent status in the terminal config.
 * Called by the signal endpoint.
 */
export function updateAgentStatus({ branch, canvasId, widgetId, status, message = null, data = null }) {
    const fp = configPath(branch, canvasId, widgetId);
    let config = {};
    try {
        config = parseTerminalConfig(readFileSync(fp, 'utf8'));
    }
    catch { /* may not exist */ }
    config.agentStatus = {
        status,
        message,
        data,
        updatedAt: new Date().toISOString(),
    };
    config.updatedAt = new Date().toISOString();
    atomicWrite(fp, config);
    return config;
}
/**
 * Read a terminal config by widget ID (searches by symlink).
 * @param {string} widgetId
 * @returns {Object|null}
 */
export function readTerminalConfigById(widgetId) {
    const dir = join(runtimeDirForTerminalConfigs(), 'terminals');
    const symPath = join(dir, `${widgetId}.json`);
    try {
        return parseTerminalConfig(readFileSync(symPath, 'utf8'));
    }
    catch {
        return null;
    }
}
/**
 * List storyboard-spawned agent sessions on a canvas.
 *
 * Scans the runtime terminals directory for widget configs whose id starts with
 * `agent-` and matches the requested canvasId/branch. External agents
 * (running in a user's CLI / VS Code on the same repo) never write
 * to this directory, so they're excluded by construction.
 *
 * @param {{ branch?: string|null, canvasId: string }} args
 * @returns {Array<object>}
 */
export function listAgentsForCanvas({ branch = null, canvasId }) {
    if (!canvasId)
        return [];
    const dir = join(runtimeDirForTerminalConfigs(), 'terminals');
    if (!existsSync(dir))
        return [];
    let entries = [];
    try {
        entries = readdirSync(dir)
            .filter((name) => name.endsWith('.json') && name.startsWith('agent-'))
            .filter((name) => {
            try {
                return lstatSync(join(dir, name)).isSymbolicLink();
            }
            catch {
                return true;
            }
        });
    }
    catch { /* fall through */ }
    const out = [];
    for (const name of entries) {
        const widgetId = name.replace(/\.json$/, '');
        let cfg = null;
        try {
            cfg = parseTerminalConfig(readFileSync(join(dir, name), 'utf8'));
        }
        catch {
            continue;
        }
        if (!cfg)
            continue;
        if (cfg.deleted)
            continue;
        if (cfg.canvasId !== canvasId)
            continue;
        if (branch && cfg.branch && cfg.branch !== branch)
            continue;
        out.push({
            widgetId: cfg.widgetId || widgetId,
            canvasId: cfg.canvasId,
            branch: cfg.branch || null,
            worktree: cfg.worktree || null,
            displayName: cfg.displayName || null,
            agentId: cfg.widgetProps?.agentId || null,
            sessionId: cfg.sessionId || null,
            status: cfg.agentStatus?.status || 'idle',
            message: cfg.agentStatus?.message || null,
            statusUpdatedAt: cfg.agentStatus?.updatedAt || null,
            updatedAt: cfg.updatedAt || null,
        });
    }
    out.sort((a, b) => String(b.statusUpdatedAt || b.updatedAt || '').localeCompare(String(a.statusUpdatedAt || a.updatedAt || '')));
    return out;
}
/**
 * Save the latest output from an agent for peers to read.
 * @param {string} widgetId
 * @param {{ content: string, summary: string, updatedAt: string }} output
 */
export function updateLatestOutput(widgetId, output) {
    const config = readTerminalConfigById(widgetId);
    if (!config)
        return;
    config.latestOutput = output;
    config.updatedAt = new Date().toISOString();
    const fp = configPath(config.branch || 'unknown', config.canvasId || 'unknown', widgetId);
    atomicWrite(fp, config);
}
/**
 * Persist the captured agent CLI session id for a widget so the next
 * cold start can resume it instead of launching fresh.
 *
 * Called by the agent-session watcher after the SessionStart hook fires.
 */
export function recordAgentSession({ branch, canvasId, widgetId, agentId, sessionId }) {
    if (!sessionId)
        return null;
    const fp = configPath(branch, canvasId, widgetId);
    let config = {};
    try {
        config = parseTerminalConfig(readFileSync(fp, 'utf8'));
    }
    catch { /* may not exist */ }
    config.lastAgentSessionId = sessionId;
    config.lastAgentSessionAt = new Date().toISOString();
    // Snapshot the target alongside the native ID. Connector updates only change
    // live context; they must not redirect a resumed coding session.
    config.lastAgentCodingTarget = config.codingTarget ?? null;
    if (agentId)
        config.lastAgentId = agentId;
    config.updatedAt = new Date().toISOString();
    try {
        if (!existsSync(dirname(fp)))
            mkdirSync(dirname(fp), { recursive: true });
        atomicWrite(fp, config);
    }
    catch { /* best-effort */ }
    return config;
}
/** Bind a target for a native launch without changing the terminal's cwd. */
export function bindTerminalCodingTarget(widgetId, target) {
    const config = readTerminalConfigById(widgetId);
    if (!config)
        throw new Error(`Terminal config missing for ${widgetId}`);
    config.codingTarget = target ?? null;
    config.updatedAt = new Date().toISOString();
    const file = config.reserved
        ? join(runtimeDirForTerminalConfigs(), 'terminals', `${widgetId}.json`)
        : configPath(config.branch || 'unknown', config.canvasId || 'unknown', widgetId);
    atomicWrite(file, config);
    return config;
}
/** Update runtime context without replacing concurrent live widget fields. */
export function updateTerminalCodingContext(widgetId, update) {
    const config = readTerminalConfigById(widgetId);
    if (!config)
        return null;
    Object.assign(config, update(config));
    config.updatedAt = new Date().toISOString();
    const file = config.reserved
        ? join(runtimeDirForTerminalConfigs(), 'terminals', `${widgetId}.json`)
        : configPath(config.branch || 'unknown', config.canvasId || 'unknown', widgetId);
    atomicWrite(file, config);
    return config;
}
/**
 * Read the previously-captured agent session id for a widget, if any.
 * @returns {{ sessionId: string, agentId: string|null, capturedAt: string|null } | null}
 */
export function getLastAgentSession({ branch, canvasId, widgetId }) {
    const cfg = readTerminalConfig({ branch, canvasId, widgetId });
    if (!cfg?.lastAgentSessionId)
        return null;
    return {
        sessionId: cfg.lastAgentSessionId,
        agentId: cfg.lastAgentId || null,
        capturedAt: cfg.lastAgentSessionAt || null,
    };
}
