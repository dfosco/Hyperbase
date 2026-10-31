import { ensureTerminalAgentProfiles, writeTerminalShim } from './terminal-agent-profiles.js';
/**
 * Terminal WebSocket bridge backed by the Hypercanvas PTY runtime.
 *
 * The browser protocol is intentionally unchanged: raw terminal text flows in
 * both directions and resize requests remain JSON control messages. Broker
 * sequences, authentication, and process ownership stay server-side.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync, } from 'node:fs';
import { tmpdir } from 'node:os';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { dirname, join, resolve } from 'node:path';
import { resolveRuntimeDir, resolvePublicSnapshotDir } from '../runtimeDir.js';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildHostWorkloadEnv, formatCoreCliExecutable, HostRuntimeError, HOST_RUNTIME_ERROR_CODES, quoteShellWord, resolveAgentHostRuntime, resolveCoreCliRuntime, resolveTerminalHostRuntime, rewriteAgentConfig, } from '../host-tools/runtime.js';
import { getAgentDefinition } from '../host-tools/catalog.js';
import { devLog } from '../logger/devLogger.js';
import { findByWorktree } from '../worktree/serverRegistry.js';
import { detectWorktreeName } from '../worktree/port.js';
import { adoptRuntimeSession, disconnectSession, findSessionIdForWidget, generateSessionId, getSessionByWidget, getSessionStats, initRegistry, killSession, orphanSession, registerSession, } from './terminal-registry.js';
import { attachExistingTerminalSession, createTerminalSession, resizeTerminalSession, snapshotTerminalSession, subscribeTerminalSession, terminalSessionExists, terminalWidgetStartupKey, withTerminalStartup, writeTerminalBytes, writeTerminalText, } from './terminal-runtime.js';
import { buildSquadBootstrapPrompt, getLastAgentSession, initTerminalConfig, readTerminalConfigById, recordAgentSession, updateAgentStatus, writeTerminalConfig, } from './terminal-config.js';
import { readAgentsConfig, readTerminalSettings } from './configReader.js';
import { resolveApplicationRoot } from '../cli/filesystemRoots.js';
import { initPaseoTerminalRuntime } from './paseo-terminal-runtime.js';
import { confirmNotebookPaseoBinding } from './paseo-notebook-binding.js';
import { isAllowedRequestOrigin } from '../cli/devContract.js';
import { codingTargetBootstrap } from './terminal-coding-target.js';
import { captureFilePath, ensureClaudeCaptureHookInstalled, ensureCodexCaptureHookInstalled, ensureCopilotCaptureHookInstalled, watchSessionIdFile, } from './agent-session.js';
let WebSocketServer;
try {
    WebSocketServer = createRequire(import.meta.url)('ws').WebSocketServer || null;
}
catch {
    WebSocketServer = null;
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function configuredStartupCommand(value) {
    if (!isRecord(value) || typeof value.startupCommand !== 'string')
        return null;
    return value.startupCommand;
}
export function isAgentConfig(value) {
    return isRecord(value)
        && typeof value.startupCommand === 'string'
        && (value.postStartup == null || typeof value.postStartup === 'string')
        && (value.readinessSignal == null || typeof value.readinessSignal === 'string')
        && (value.sessionIdEnv == null || typeof value.sessionIdEnv === 'string');
}
export function outputBytes(event) {
    if (!isRecord(event))
        return new Uint8Array();
    if (Buffer.isBuffer(event.bytes) || event.bytes instanceof Uint8Array)
        return event.bytes;
    // The Paseo runtime normalizes native stream data to JSON-compatible bytes.
    if (Array.isArray(event.bytes) && event.bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255))
        return Uint8Array.from(event.bytes);
    return new Uint8Array();
}
function resizePayload(value) {
    if (!isRecord(value) || value.type !== 'resize')
        return null;
    const { cols, rows } = value;
    return typeof cols === 'number' && Number.isFinite(cols) && typeof rows === 'number' && Number.isFinite(rows)
        ? { cols, rows }
        : null;
}
function createdTerminalResult(value) {
    if (!isRecord(value))
        return null;
    return {
        ...(typeof value.reused === 'boolean' ? { reused: value.reused } : {}),
        ...(typeof value.workspaceId === 'string' ? { workspaceId: value.workspaceId } : {}),
        ...(typeof value.terminalId === 'string' ? { terminalId: value.terminalId } : {}),
    };
}
const TERMINAL_PATH_PREFIX = '/_hypercanvas/terminal/';
const BUFFER_MAX_AGE_MS = 5 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 60 * 1000;
const SNAPSHOT_INDEX_JSON = 'agents.snapshot.json';
const SNAPSHOT_INDEX_TXT = 'agents-txt.snapshot.json';
const SNAPSHOT_INDEX_MAX_ENTRIES = 50;
const wsConnections = new Map();
const wsViewIds = new Map();
const subscriptions = new Map();
const sessionCaptureStops = new Map();
const snapshotIntervals = new Map();
const rollingBuffers = new Map();
let currentBranch = 'unknown';
let actualServerPort = null;
let actualBase = '/';
let actualHttpServer = null;
let runtimeReadyRef = Promise.resolve(true);
let hotPoolRef = null;
let projectRoot = null;
let workspaceIdResolver = null;
let snapshotIndexCache = null;
let snapshotTxtIndexCache = null;
let snapshotLegacyFilesCleaned = false;
export function resolveStoryboardCli(moduleUrl = import.meta.url) {
    try {
        const here = dirname(fileURLToPath(moduleUrl));
        // Built output sits beside this module; loaded from source (src/core/canvas)
        // the built CLI lives in the package's dist, three levels up.
        const cliPath = [
            resolve(here, '..', 'cli', 'index.js'),
            resolve(here, '..', '..', '..', 'dist', 'core', 'cli', 'index.js'),
        ].find((candidate) => existsSync(candidate));
        if (cliPath) {
            const runtime = resolveCoreCliRuntime();
            return `${formatCoreCliExecutable(runtime)} ${quoteShellWord(cliPath)}`;
        }
    }
    catch { /* Vite's bundled config may not preserve import.meta.url */ }
    try {
        const bundleRoot = process.env.HYPERCANVAS_BUNDLE_ROOT;
        if (bundleRoot) {
            const bundledCli = resolve(bundleRoot, 'storyboard', 'node_modules', '@dfosco', 'hypercanvas', 'dist', 'core', 'cli', 'index.js');
            if (existsSync(bundledCli)) {
                const runtime = resolveCoreCliRuntime();
                return `${formatCoreCliExecutable(runtime)} ${quoteShellWord(bundledCli)}`;
            }
        }
    }
    catch { /* unavailable bundled Core package */ }
    try {
        // The desktop shell stages source beside the installed package. Resolve
        // from its working directory even when Vite bundles this module.
        const packageConfig = createRequire(resolve(process.cwd(), 'package.json')).resolve('@dfosco/hypercanvas/hypercanvas.config.json');
        const packagedCli = resolve(dirname(packageConfig), 'dist', 'core', 'cli', 'index.js');
        if (existsSync(packagedCli)) {
            const runtime = resolveCoreCliRuntime();
            return `${formatCoreCliExecutable(runtime)} ${quoteShellWord(packagedCli)}`;
        }
    }
    catch { /* unavailable Core package */ }
    return null;
}
// Resolve per launch rather than once at module load: a miss during a dist
// rebuild or a repaired install must not stay cached for the process lifetime.
export function createCliCommandResolver(resolveCommand) {
    let command = null;
    return () => {
        if (!command)
            command = resolveCommand();
        return command;
    };
}
const storyboardCliCommand = createCliCommandResolver(() => resolveStoryboardCli());
function requireProjectRoot() {
    if (!projectRoot)
        throw new Error('Terminal server is not initialized.');
    return projectRoot;
}
function terminalSettings() {
    const raw = readTerminalSettings(projectRoot || undefined, resolveApplicationRoot());
    const sequence = raw.defaultStartupSequence;
    return {
        ...(typeof raw.snapshotInterval === 'number' ? { snapshotInterval: raw.snapshotInterval } : {}),
        ...(typeof raw.startupCommand === 'string' ? { startupCommand: raw.startupCommand } : {}),
        ...(typeof raw.orphanGracePeriod === 'number' ? { orphanGracePeriod: raw.orphanGracePeriod } : {}),
        ...(typeof raw.prompt === 'string' ? { prompt: raw.prompt } : {}),
        ...(isRecord(sequence) && Array.isArray(sequence.steps) ? { defaultStartupSequence: sequence } : {}),
    };
}
async function resolveVerifiedAgent(agentId) {
    const root = requireProjectRoot();
    const runtime = await resolveAgentHostRuntime(root, agentId);
    const config = readAgentsConfig(root, resolveApplicationRoot())?.[agentId];
    if (!isAgentConfig(config)) {
        throw new HostRuntimeError(HOST_RUNTIME_ERROR_CODES.COMMAND_INVALID, `Agent ${agentId} is not configured.`, { agentId });
    }
    const rewritten = rewriteAgentConfig(runtime, config);
    if (typeof rewritten.startupCommand !== 'string')
        throw new HostRuntimeError(HOST_RUNTIME_ERROR_CODES.COMMAND_INVALID, `Agent ${agentId} has an invalid startup command.`);
    return { id: agentId, runtime, config: rewritten };
}
function configuredAgentIdForCommand(command) {
    const executable = typeof command === 'string' ? command.trim().match(/^[^\s]+/)?.[0] : null;
    if (!executable)
        return null;
    return Object.entries(readAgentsConfig(requireProjectRoot(), resolveApplicationRoot()) || {}).find(([id, config]) => (getAgentDefinition(id) && configuredStartupCommand(config)?.trim().match(/^[^\s]+/)?.[0] === executable))?.[0] || null;
}
function serverUrl() {
    let port = actualServerPort;
    if (!port && actualHttpServer) {
        try {
            const address = actualHttpServer.address();
            port = typeof address === 'object' && address ? address.port || null : null;
        }
        catch { /* not listening */ }
    }
    if (!port) {
        try {
            port = findByWorktree(detectWorktreeName(), requireProjectRoot())[0]?.port || null;
        }
        catch { /* no registry */ }
    }
    const host = (process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1' ? '127.0.0.1' : 'localhost';
    const base = (actualBase || '/').replace(/\/$/, '');
    return `http://${host}:${port || 1234}${base}`;
}
async function resolveActiveWorkspaceId() {
    const root = requireProjectRoot();
    if (typeof workspaceIdResolver === 'function')
        return workspaceIdResolver(root);
    // Fallback for direct runtime use — still gates on the verified binding so
    // failures are recorded instead of silently degrading.
    const confirmed = await confirmNotebookPaseoBinding(root);
    return confirmed.workspaceId;
}
function safeCanvasDir(canvasId) {
    return canvasId.replace(/\//g, '--');
}
function legacySnapshotDir(canvasId) {
    return join(resolveRuntimeDir(requireProjectRoot()), 'terminal-snapshots', safeCanvasDir(canvasId));
}
function bufferDir() {
    return join(resolveRuntimeDir(requireProjectRoot()), 'terminal-buffers');
}
function publicSnapshotDir() {
    return resolvePublicSnapshotDir(requireProjectRoot());
}
function appendToRollingBuffer(sessionId, data) {
    const entries = rollingBuffers.get(sessionId) || [];
    entries.push({ ts: Date.now(), data });
    const cutoff = Date.now() - BUFFER_MAX_AGE_MS;
    while (entries[0] && entries[0].ts < cutoff)
        entries.shift();
    rollingBuffers.set(sessionId, entries);
}
function getRollingBufferContent(sessionId, maxAgeMs = BUFFER_MAX_AGE_MS) {
    const cutoff = Date.now() - maxAgeMs;
    return (rollingBuffers.get(sessionId) || [])
        .filter((entry) => entry.ts >= cutoff)
        .map((entry) => entry.data)
        .join('');
}
const ANSI_ESCAPE = String.fromCharCode(27);
const ANSI_BELL = String.fromCharCode(7);
const ANSI_CONTROL_SEQUENCE = new RegExp(`${ANSI_ESCAPE}\\[[0-9;?]*[ -/]*[@-~]|${ANSI_ESCAPE}\\].*?(${ANSI_BELL}|${ANSI_ESCAPE}\\\\)`, 'g');
function stripAnsi(value) {
    return value.replace(ANSI_CONTROL_SEQUENCE, '');
}
function emptyIndex() {
    return { version: 1, updatedAt: null, agents: {} };
}
function readIndexFile(filePath) {
    try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        if (isRecord(parsed) && isRecord(parsed.agents))
            return parsed;
    }
    catch { /* absent or invalid */ }
    return emptyIndex();
}
function loadSnapshotIndexes() {
    snapshotIndexCache ||= readIndexFile(join(publicSnapshotDir(), SNAPSHOT_INDEX_JSON));
    snapshotTxtIndexCache ||= readIndexFile(join(publicSnapshotDir(), SNAPSHOT_INDEX_TXT));
    return { jsonIndex: snapshotIndexCache, txtIndex: snapshotTxtIndexCache };
}
function atomicWriteJson(filePath, data) {
    const temporary = `${filePath}.tmp`;
    try {
        writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
        renameSync(temporary, filePath);
    }
    catch (error) {
        try {
            unlinkSync(temporary);
        }
        catch { /* absent */ }
        throw error;
    }
}
function writeSnapshotIndexes(jsonIndex, txtIndex) {
    mkdirSync(publicSnapshotDir(), { recursive: true });
    const now = new Date().toISOString();
    jsonIndex.updatedAt = now;
    txtIndex.updatedAt = now;
    atomicWriteJson(join(publicSnapshotDir(), SNAPSHOT_INDEX_JSON), jsonIndex);
    atomicWriteJson(join(publicSnapshotDir(), SNAPSHOT_INDEX_TXT), txtIndex);
}
function cleanupLegacySnapshotFiles() {
    if (snapshotLegacyFilesCleaned)
        return;
    snapshotLegacyFilesCleaned = true;
    try {
        for (const file of readdirSync(publicSnapshotDir())) {
            if (file === SNAPSHOT_INDEX_JSON || file === SNAPSHOT_INDEX_TXT)
                continue;
            if (file.endsWith('.snapshot.json') || file.endsWith('.snapshot.txt')) {
                try {
                    unlinkSync(join(publicSnapshotDir(), file));
                }
                catch { /* best effort */ }
            }
        }
    }
    catch { /* directory absent */ }
}
function isWidgetPrivate(widgetId) {
    return readTerminalConfigById(widgetId)?.widgetProps?.private === true;
}
async function captureSnapshot({ sessionId, widgetId, canvasId, prettyName, createdAt }) {
    let snapshot;
    try {
        snapshot = await snapshotTerminalSession(sessionId);
    }
    catch {
        return;
    }
    const now = new Date().toISOString();
    const paneContent = snapshot.screen || '';
    const rawTail = getRollingBufferContent(sessionId);
    const data = {
        widgetId,
        canvasId,
        sessionId,
        prettyName: prettyName || null,
        createdAt: createdAt || now,
        timestamp: now,
        cols: snapshot.cols || 80,
        rows: snapshot.rows || 24,
        paneContent,
        scrollback: rawTail || snapshot.text || '',
        sequence: snapshot.sequence || 0,
    };
    mkdirSync(bufferDir(), { recursive: true });
    atomicWriteJson(join(bufferDir(), `${widgetId}.buffer.json`), data);
    writeFileSync(join(bufferDir(), `${widgetId}.buffer.txt`), `[${widgetId}${prettyName ? ` | ${prettyName}` : ''} | ${now}]\n\n--- screen ---\n${stripAnsi(paneContent) || '(empty)'}\n\n--- scrollback ---\n${stripAnsi(data.scrollback)}\n`);
    cleanupLegacySnapshotFiles();
    const { jsonIndex, txtIndex } = loadSnapshotIndexes();
    if (isWidgetPrivate(widgetId)) {
        delete jsonIndex.agents[widgetId];
        delete txtIndex.agents[widgetId];
        writeSnapshotIndexes(jsonIndex, txtIndex);
        return;
    }
    const publicScrollback = stripAnsi(getRollingBufferContent(sessionId, SNAPSHOT_MAX_AGE_MS) || snapshot.text || '');
    jsonIndex.agents[widgetId] = {
        widgetId,
        canvasId,
        prettyName: prettyName || null,
        timestamp: now,
        cols: data.cols,
        rows: data.rows,
        paneContent: stripAnsi(paneContent),
        scrollback: publicScrollback,
    };
    const separator = '='.repeat(80);
    txtIndex.agents[widgetId] = `SESSION: ${widgetId}${prettyName ? ` | ${prettyName}` : ''}\nCANVAS:  ${canvasId}\nBRANCH:  ${currentBranch}\nTIME:    ${now}\n\n${separator}\nSCREEN\n${separator}\n\n${stripAnsi(paneContent) || '(empty)'}\n\n${separator}\nSCROLLBACK (last 60s)\n${separator}\n\n${publicScrollback}\n`;
    const keys = Object.keys(jsonIndex.agents);
    if (keys.length > SNAPSHOT_INDEX_MAX_ENTRIES) {
        keys.sort((left, right) => String(jsonIndex.agents[left]?.timestamp).localeCompare(String(jsonIndex.agents[right]?.timestamp)));
        for (const key of keys.slice(0, keys.length - SNAPSHOT_INDEX_MAX_ENTRIES)) {
            delete jsonIndex.agents[key];
            delete txtIndex.agents[key];
        }
    }
    writeSnapshotIndexes(jsonIndex, txtIndex);
}
function startSnapshotCapture(options) {
    if (snapshotIntervals.has(options.sessionId))
        return;
    const interval = terminalSettings().snapshotInterval ?? 5000;
    const timer = setInterval(() => captureSnapshot(options).catch(() => { }), interval);
    timer.unref?.();
    snapshotIntervals.set(options.sessionId, timer);
}
function stopSnapshotCapture(sessionId, options) {
    const timer = snapshotIntervals.get(sessionId);
    if (timer)
        clearInterval(timer);
    snapshotIntervals.delete(sessionId);
    if (options)
        captureSnapshot(options).catch(() => { });
    // Keep the rolling buffer: it is the only retained output history (the
    // Paseo daemon's capture is screen-only) and must survive viewer
    // disconnects so the next attach can replay scrollback. It is bounded by
    // BUFFER_MAX_AGE_MS and is dropped when the session is terminated.
}
function sendJson(ws, value) {
    if (ws.readyState === 1)
        ws.send(JSON.stringify(value));
}
export function notifyTerminalContext(widgetId, state) {
    const sessionId = findSessionIdForWidget(widgetId);
    const ws = sessionId && wsConnections.get(sessionId);
    if (ws)
        sendJson(ws, { type: 'context-state', state });
}
async function submit(sessionId, text) {
    if (!text)
        return;
    await writeTerminalText(sessionId, text, { submit: true });
}
function prepareTerminalFiles({ widgetId, canvasId, prettyName, branch, server }) {
    const storyboardCli = storyboardCliCommand();
    if (!storyboardCli)
        throw new Error('The bundled Storyboard CLI could not be resolved.');
    const root = requireProjectRoot();
    ensureTerminalAgentProfiles(root);
    const directory = join(resolveRuntimeDir(root), 'terminals');
    const binDirectory = join(directory, 'bin');
    mkdirSync(binDirectory, { recursive: true });
    // Primary HYPERCANVAS_* names plus legacy STORYBOARD_* aliases so agent
    // templates from older installs keep working.
    const identity = {
        HYPERCANVAS_WIDGET_ID: widgetId,
        HYPERCANVAS_CANVAS_ID: canvasId,
        HYPERCANVAS_BRANCH: branch,
        HYPERCANVAS_SERVER_URL: server,
        HYPERCANVAS_PROJECT_ROOT: root,
        STORYBOARD_WIDGET_ID: widgetId,
        STORYBOARD_CANVAS_ID: canvasId,
        STORYBOARD_BRANCH: branch,
        STORYBOARD_SERVER_URL: server,
        STORYBOARD_PROJECT_ROOT: root,
    };
    const envFile = join(directory, `${widgetId}.env.sh`);
    const terminalConfig = readTerminalConfigById(widgetId);
    const explicitPrompt = terminalConfig?.widgetProps?.initialPrompt
        || terminalConfig?.widgetProps?.prompt;
    const initialPrompt = terminalConfig?.codingTarget ? codingTargetBootstrap(root, terminalConfig, terminalConfig.codingTarget) : [
        'Before starting, read `.agents/terminal-agent.agent.md` when it exists and follow its behavioral guidance.',
        explicitPrompt,
        buildSquadBootstrapPrompt(widgetId),
    ].filter((value, index, values) => typeof value === 'string' && value.trim() && values.indexOf(value) === index).join('\n\n');
    const initialPromptFile = join(directory, `${widgetId}.initial-prompt.md`);
    if (typeof initialPrompt === 'string' && initialPrompt.trim()) {
        writeFileSync(initialPromptFile, `${initialPrompt.trim()}\n`);
    }
    else {
        rmSync(initialPromptFile, { force: true });
    }
    writeFileSync(envFile, Object.entries(identity).map(([key, value]) => `export ${key}=${quoteShellWord(value)}`).join('\n') + '\n');
    const canvasArg = canvasId !== 'unknown' ? canvasId : '';
    const nameArg = prettyName ? ` --name ${quoteShellWord(prettyName)}` : '';
    const welcome = `${storyboardCli} terminal-welcome --branch ${quoteShellWord(branch)} --canvas ${quoteShellWord(canvasArg)}${nameArg}`;
    // Ensure agents resolve the CLI bundled with this server, rather than an
    // older global/npx installation that may not have the durable inbox routes.
    const storyboardShim = join(binDirectory, 'storyboard');
    writeTerminalShim(storyboardShim, `#!/usr/bin/env sh\nexec ${storyboardCli} "$@"\n`);
    const agentCases = [];
    const wrappers = [];
    for (const [id, config] of Object.entries(readAgentsConfig(root, resolveApplicationRoot()) || {})) {
        const startupCommand = configuredStartupCommand(config);
        if (!getAgentDefinition(id) || !startupCommand)
            continue;
        agentCases.push(`  ${id})\n    startup=${quoteShellWord(startupCommand)}\n    if [ "$#" -gt 0 ]; then startup="$startup $*"; fi\n    exec ${welcome} --agent ${quoteShellWord(id)} --startup "$startup"\n    ;;`);
        wrappers.push(id);
    }
    const startPath = join(binDirectory, 'start');
    const startScript = `#!/usr/bin/env sh
if [ "$#" -eq 0 ]; then exec ${welcome}; fi
agent="$1"
shift
case "$agent" in
  shell) exec ${welcome} --startup 'shell' ;;
${agentCases.join('\n')}
  *) printf '%s\n' 'Use start with shell or a configured agent ID.' >&2; exit 2 ;;
esac
`;
    writeTerminalShim(startPath, startScript);
    for (const id of wrappers) {
        writeTerminalShim(join(binDirectory, id), `#!/usr/bin/env sh\nexec ${quoteShellWord(startPath)} ${quoteShellWord(id)} "$@"\n`);
    }
    return { identity, envFile, binDirectory, welcome };
}
/** Launch ownership belongs to the idempotent PTY create, never delayed input. */
export function terminalStartupArgs(shell, command) {
    return [shell.endsWith('/zsh') || shell.endsWith('/bash') ? '-ilc' : '-c', command];
}
/** Repaint the retained emulator's screen without appending or clearing history. */
export function retainedTerminalScreen(snapshot) {
    // Native restores may contain a full reset or scrollback erasure. Preserve
    // the viewer's existing history while retaining cursor/mode restoration.
    const terminalEscape = String.fromCharCode(27);
    const repaint = (snapshot.ansi || snapshot.screen || '').replace(new RegExp(`${terminalEscape}c|${terminalEscape}\\[3J`, 'g'), '');
    return `\x1b[H\x1b[2J${repaint}`;
}
async function waitForReadiness(sessionId, readyFile, signal, timeoutMs = 60_000, afterSequence = null) {
    if (!readyFile && !signal) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
        return;
    }
    const baseline = afterSequence == null
        ? await snapshotTerminalSession(sessionId).then((snapshot) => snapshot.sequence || 0).catch(() => 0)
        : afterSequence;
    let output = '';
    let subscription = null;
    let fileTimer = null;
    let timeout = null;
    let finished = false;
    let resolveWait = () => { };
    const waiting = new Promise((resolve) => { resolveWait = resolve; });
    const finish = (result = 'ready') => {
        if (finished)
            return;
        finished = true;
        if (fileTimer)
            clearInterval(fileTimer);
        if (timeout)
            clearTimeout(timeout);
        subscription?.close();
        resolveWait(result);
    };
    if (readyFile) {
        if (existsSync(readyFile))
            finish('ready');
        else {
            fileTimer = setInterval(() => { if (existsSync(readyFile))
                finish('ready'); }, 250);
            fileTimer.unref?.();
        }
    }
    if (signal && !finished) {
        subscription = await subscribeTerminalSession(sessionId, {
            readOnly: true,
            afterSequence: baseline,
            onOutput: (event) => {
                output += Buffer.from(outputBytes(event)).toString('utf8');
                if (output.includes(signal))
                    finish('ready');
            },
            onExit: () => finish('exit'),
        }).catch(() => null);
    }
    if (!finished) {
        timeout = setTimeout(() => finish('timeout'), timeoutMs);
        timeout.unref?.();
    }
    const result = await waiting;
    if (result === 'exit')
        throw new Error('Agent exited before becoming ready');
    if (result === 'timeout')
        throw new Error(`Agent readiness timed out${signal ? ` waiting for ${JSON.stringify(signal)}` : ''}`);
}
async function runPostStartup(sessionId, agentConfig) {
    if (agentConfig?.postStartup)
        await submit(sessionId, agentConfig.postStartup).catch(() => { });
}
function watchNativeSession(sessionId, context, agentId, agentConfig) {
    sessionCaptureStops.get(sessionId)?.();
    sessionCaptureStops.delete(sessionId);
    if (!agentConfig?.sessionIdEnv)
        return;
    const stop = watchSessionIdFile(captureFilePath(requireProjectRoot(), context.widgetId), (nativeSessionId) => {
        if (context.branch)
            recordAgentSession({ branch: context.branch, canvasId: context.canvasId, widgetId: context.widgetId, agentId, sessionId: nativeSessionId });
    });
    sessionCaptureStops.set(sessionId, stop);
}
export async function activateTerminalAgent({ widgetId, canvasId = 'unknown', branch = currentBranch, agentId = null }) {
    const sessionId = findSessionIdForWidget(widgetId);
    if (!sessionId)
        throw new Error(`No active terminal session for widget ${widgetId}`);
    if (!agentId)
        throw new HostRuntimeError(HOST_RUNTIME_ERROR_CODES.AGENT_REQUIRED, 'An agent ID is required.');
    const resolvedAgent = await resolveVerifiedAgent(agentId);
    const { config: agentConfig } = resolvedAgent;
    const snapshot = await snapshotTerminalSession(sessionId);
    watchNativeSession(sessionId, { widgetId, canvasId, branch }, resolvedAgent.id, agentConfig);
    waitForReadiness(sessionId, null, agentConfig.readinessSignal, 60_000, snapshot.sequence || 0).then(async () => {
        updateAgentStatus({ branch, canvasId, widgetId, status: 'ready', message: 'Agent ready' });
        await runPostStartup(sessionId, agentConfig);
    }).catch((error) => {
        updateAgentStatus({ branch, canvasId, widgetId, status: 'error', message: error.message });
    });
    return { sessionId, agentId: resolvedAgent.id };
}
function prepareSessionCommand(sessionId, context, startupCommand, resolvedAgent) {
    const files = prepareTerminalFiles(context);
    const command = startupCommand;
    const agentConfig = resolvedAgent?.config || null;
    let resumeSessionId = null;
    if (agentConfig?.sessionIdEnv) {
        const saved = getLastAgentSession({
            branch: context.branch,
            canvasId: context.canvasId,
            widgetId: context.widgetId,
        });
        if (saved?.sessionId && (!saved.agentId || saved.agentId === resolvedAgent?.id))
            resumeSessionId = saved.sessionId;
    }
    watchNativeSession(sessionId, context, resolvedAgent?.id || null, agentConfig);
    const readyFile = agentConfig?.sessionIdEnv ? join(resolveRuntimeDir(requireProjectRoot()), 'terminals', `${context.widgetId}.ready`) : null;
    if (readyFile)
        rmSync(readyFile, { force: true });
    const startup = !command
        ? `clear && ${files.welcome}`
        : `${files.welcome}${resolvedAgent ? ` --agent ${quoteShellWord(resolvedAgent.id)}` : ''}${resumeSessionId ? ` --resume-session ${quoteShellWord(resumeSessionId)}` : ''} --startup ${quoteShellWord(command === 'shell' ? 'shell' : command)}`;
    return { command: `source ${quoteShellWord(files.envFile)} && ${startup}`, readyFile, agentConfig };
}
function monitorSessionStartup(sessionId, context, { readyFile, agentConfig }) {
    if (agentConfig) {
        waitForReadiness(sessionId, readyFile, agentConfig.readinessSignal, 60_000, 0)
            .then(async () => {
            updateAgentStatus({
                branch: context.branch,
                canvasId: context.canvasId,
                widgetId: context.widgetId,
                status: 'ready',
                message: 'Agent ready',
            });
            await runPostStartup(sessionId, agentConfig);
        })
            .catch((error) => {
            updateAgentStatus({
                branch: context.branch,
                canvasId: context.canvasId,
                widgetId: context.widgetId,
                status: 'error',
                message: error.message,
            });
        });
    }
}
async function executeStartupSequence(sessionId, ws, sequence) {
    if (!sequence?.steps?.length)
        return;
    const keys = { '{enter}': '\r', '{tab}': '\t', '{escape}': '\u001b', '{space}': ' ' };
    let outputBaseline = null;
    for (let index = 0; index < sequence.steps.length; index += 1) {
        const step = sequence.steps[index];
        if (!step)
            continue;
        try {
            if (step.type === 'command') {
                outputBaseline = await snapshotTerminalSession(sessionId).then((snapshot) => snapshot.sequence || 0).catch(() => 0);
                await submit(sessionId, step.value);
            }
            else if (step.type === 'keystroke')
                await writeTerminalText(sessionId, keys[step.value] || step.value);
            else if (step.type === 'wait' && (step.until === 'ready' || step.until === 'output')) {
                await waitForReadiness(sessionId, null, step.match, step.timeout || 10_000, outputBaseline);
                outputBaseline = null;
            }
            else if (step.type === 'wait') {
                await new Promise((resolveWait) => setTimeout(resolveWait, step.ms || 1000));
            }
            else if (step.type === 'env') {
                await submit(sessionId, `export ${step.name}=${JSON.stringify(step.value || '')}`);
            }
        }
        catch (error) {
            devLog().logEvent('warn', 'Terminal startup step failed', { step: index, error: errorMessage(error) });
        }
        if (index === sequence.renderAfterStep)
            sendJson(ws, { type: 'render' });
    }
}
export async function orphanTerminalSession(widgetId) {
    const sessionId = findSessionIdForWidget(widgetId);
    if (!sessionId)
        return;
    orphanSession(sessionId);
    subscriptions.get(sessionId)?.close();
    subscriptions.delete(sessionId);
    subscriptions.delete(sessionId);
    const ws = wsConnections.get(sessionId);
    if (ws && ws.readyState <= 1)
        ws.close();
    wsConnections.delete(sessionId);
    wsViewIds.delete(sessionId);
}
export function setupTerminalServer(httpServer, base = '/', branch = 'unknown', hotPoolManager = null, runtimeReady = null, root = null, resolveWorkspaceId = null) {
    if (!WebSocketServer) {
        devLog().logEvent('warn', 'ws is unavailable; terminal widgets are disabled');
        return;
    }
    currentBranch = branch;
    hotPoolRef = hotPoolManager;
    runtimeReadyRef = runtimeReady || Promise.resolve(true);
    workspaceIdResolver = resolveWorkspaceId;
    if (!root)
        throw new Error('Terminal server requires the Vite project root.');
    projectRoot = resolve(root);
    actualBase = base || '/';
    actualHttpServer = httpServer;
    try {
        const address = httpServer.address();
        actualServerPort = typeof address === 'object' && address ? address.port || null : null;
    }
    catch { /* not listening */ }
    if (!actualServerPort)
        httpServer.once('listening', () => {
            try {
                const address = httpServer.address();
                actualServerPort = typeof address === 'object' && address ? address.port || null : null;
            }
            catch { /* ignored */ }
        });
    const orphanGracePeriod = terminalSettings().orphanGracePeriod;
    initRegistry(projectRoot, orphanGracePeriod === undefined ? {} : { gracePeriod: orphanGracePeriod });
    initTerminalConfig(projectRoot);
    for (const install of [ensureCopilotCaptureHookInstalled, ensureClaudeCaptureHookInstalled, ensureCodexCaptureHookInstalled]) {
        try {
            install();
        }
        catch { /* optional CLI hook */ }
    }
    console.log(`[storyboard] terminal server ready (Hypercanvas PTY) [branch: ${branch}]`);
    const wss = new WebSocketServer({ noServer: true });
    const baseNoTrail = (base || '/').replace(/\/$/, '');
    httpServer.on('upgrade', (request, socket, head) => {
        let pathname = request.url || '';
        if (baseNoTrail && pathname.startsWith(baseNoTrail))
            pathname = pathname.slice(baseNoTrail.length) || '/';
        if (!pathname.startsWith(TERMINAL_PATH_PREFIX))
            return;
        if (!isAllowedTerminalOrigin(request)) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            return socket.destroy();
        }
        const [widgetId, query = ''] = pathname.slice(TERMINAL_PATH_PREFIX.length).split('?');
        if (!widgetId)
            return socket.destroy();
        const params = new URLSearchParams(query);
        wss.handleUpgrade(request, socket, head, (ws) => {
            const context = {
                widgetId,
                branch: currentBranch,
                canvasId: params.get('canvas') || 'unknown',
                prettyName: params.get('name') || null,
                agentId: params.get('agentId') || null,
                startupCommand: params.get('startupCommand') || null,
                viewId: params.get('viewId') || null,
                retained: params.get('retained') === '1',
                refresh: params.get('refresh') === '1',
                cols: Math.min(1000, Math.max(10, Number.parseInt(params.get('cols') || '', 10) || 80)),
                rows: Math.min(1000, Math.max(4, Number.parseInt(params.get('rows') || '', 10) || 24)),
            };
            if (params.get('readOnly') === '1')
                handleReadOnlyConnection(ws, context).catch((error) => failConnection(ws, error));
            else
                handleConnection(ws, context).catch((error) => failConnection(ws, error));
        });
    });
}
export function isAllowedTerminalOrigin(request) {
    return isAllowedRequestOrigin({
        ...(typeof request.headers.host === 'string' ? { host: request.headers.host } : {}),
        ...(typeof request.headers.origin === 'string' ? { origin: request.headers.origin } : {}),
    }, {
        desktop: (process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1',
    });
}
export function isTransientTerminalError(error) {
    if (!isRecord(error))
        return false;
    if (error.code === HOST_RUNTIME_ERROR_CODES.AGENT_UNAVAILABLE) {
        return isRecord(error.details) && error.details.reason === 'timeout';
    }
    if (['PASEO_UNAVAILABLE', 'TERMINAL_RUNTIME_UNAVAILABLE', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT'].includes(String(error.code)))
        return true;
    if (error.code !== 'DAEMON_REQUEST_FAILED' || !isRecord(error.cause))
        return false;
    return ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT'].includes(String(error.cause.code))
        || ['subscription generation changed', 'connection state changed'].includes(String(error.cause.message));
}
function failConnection(ws, error) {
    const errorRecord = isRecord(error) ? error : {};
    const message = errorMessage(error);
    devLog().logEvent('error', 'Terminal connection failed', { error: message, code: errorRecord.code || null });
    sendJson(ws, {
        type: errorRecord.code === 'RUNTIME_ERROR' && /PTY|allocate/i.test(message) ? 'resource-limited' : 'error',
        message,
        code: errorRecord.code || null,
        ...(isRecord(errorRecord.details) ? { details: errorRecord.details } : {}),
        retryable: isTransientTerminalError(error),
        counts: getSessionStats(),
    });
    if (ws.readyState <= 1)
        ws.close(isTransientTerminalError(error) ? 1012 : 1000);
}
async function handleReadOnlyConnection(ws, { widgetId, canvasId }) {
    const sessionId = findSessionIdForWidget(widgetId) || generateSessionId(currentBranch, canvasId, widgetId);
    let subscription = null;
    let disconnected = false;
    const close = () => {
        if (disconnected)
            return;
        disconnected = true;
        subscription?.close();
    };
    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(Buffer.from(message).toString('utf8'));
            const resize = resizePayload(parsed);
            if (resize) {
                resizeTerminalSession(sessionId, resize.cols, resize.rows).catch((error) => failConnection(ws, error));
            }
        }
        catch { /* read-only terminals ignore input */ }
    });
    ws.on('close', close);
    ws.on('error', close);
    try {
        if (disconnected || ws.readyState >= 2)
            return;
        const decoder = new StringDecoder('utf8');
        subscription = await subscribeTerminalSession(sessionId, {
            readOnly: true,
            restore: true,
            onOutput: (event) => { if (ws.readyState === 1)
                ws.send(decoder.write(Buffer.from(outputBytes(event)))); },
            onGap: (event) => { if (isRecord(event))
                sendTerminalRestore(ws, event.snapshot); },
            onExit: () => { if (ws.readyState <= 1)
                ws.close(); },
            onError: (error) => failConnection(ws, error),
        });
        if (disconnected || ws.readyState >= 2)
            return subscription.close();
        sendJson(ws, { type: 'session-info', sessionId, readOnly: true });
    }
    catch (error) {
        close();
        throw error;
    }
}
async function handleConnection(ws, context) {
    return withTerminalStartup(terminalWidgetStartupKey(requireProjectRoot(), context.widgetId), async () => {
        if (readTerminalConfigById(context.widgetId)?.deleted) {
            throw new Error('This terminal widget has been removed.');
        }
        let runtime = await runtimeReadyRef.catch(() => null);
        if (!runtime) {
            if ((process.env.HYPERCANVAS_DISABLE_PTY_RUNTIME ?? legacyEnv('STORYBOARD_DISABLE_PTY_RUNTIME')) === '1') {
                throw new Error('Hypercanvas PTY runtime is unavailable');
            }
            runtimeReadyRef = initPaseoTerminalRuntime(requireProjectRoot()).catch(() => null);
            runtime = await runtimeReadyRef;
        }
        if (!runtime)
            throw Object.assign(new Error('Hypercanvas PTY runtime is unavailable'), { code: 'TERMINAL_RUNTIME_UNAVAILABLE' });
        return handleConnectionUnlocked(ws, context);
    });
}
function sendTerminalRestore(ws, snapshot) {
    const value = isRecord(snapshot) ? snapshot : {};
    sendJson(ws, {
        type: 'terminal-restore',
        cols: value.cols,
        rows: value.rows,
        data: value.ansi || value.screen || '',
        // History-only replays append without resetting the emulator buffer.
        hardReset: value.hardReset !== false,
    });
}
async function handleConnectionUnlocked(ws, { widgetId, canvasId, prettyName, agentId, viewId, retained = false, refresh = false, startupCommand: requestedStartup, cols = 80, rows = 24 }) {
    const branch = currentBranch;
    const sessionId = generateSessionId(branch, canvasId, widgetId);
    const existing = wsConnections.get(sessionId);
    if (existing && existing !== ws && existing.readyState <= 1) {
        if (!viewId || wsViewIds.get(sessionId) !== viewId) {
            sendJson(ws, { type: 'attachment-busy', message: 'Terminal is in use in another view. Waiting for that view to disconnect.' });
            ws.close(4001, 'Terminal is in use in another view');
            return;
        }
        // A reconnect from the same mounted view may precede the old socket's
        // close event. Its identity permits replacement without stealing a TUI.
        sendJson(existing, { type: 'detached', message: 'This view reconnected to the terminal.' });
        existing.close(4001, 'Terminal view replaced');
    }
    subscriptions.get(sessionId)?.close();
    wsConnections.set(sessionId, ws);
    if (viewId)
        wsViewIds.set(sessionId, viewId);
    else
        wsViewIds.delete(sessionId);
    let entry = null;
    let priorRuntimeAlive = false;
    let warmSession = null;
    let warmConsumed = false;
    let targetPool = null;
    let conflict = null;
    let created = null;
    let priorEntry = null;
    let subscription = null;
    let snapshotOptions = null;
    let disconnected = false;
    const disconnect = () => {
        if (disconnected)
            return;
        disconnected = true;
        const isCurrentConnection = wsConnections.get(sessionId) === ws;
        if (isCurrentConnection) {
            wsConnections.delete(sessionId);
            wsViewIds.delete(sessionId);
            if (snapshotOptions)
                stopSnapshotCapture(sessionId, snapshotOptions);
            if (entry)
                disconnectSession(sessionId, entry.generation);
        }
        if (subscriptions.get(sessionId) === subscription)
            subscriptions.delete(sessionId);
        subscription?.close();
    };
    const ensureConnected = () => {
        if (disconnected || ws.readyState >= 2)
            throw new Error('Terminal connection closed during startup');
    };
    ws.on('close', disconnect);
    ws.on('error', disconnect);
    try {
        ensureConnected();
        const workspaceId = await resolveActiveWorkspaceId();
        let resolvedAgent = !refresh && agentId ? await resolveVerifiedAgent(agentId) : null;
        if (!refresh && widgetId.startsWith('agent-') && !agentId) {
            throw new HostRuntimeError(HOST_RUNTIME_ERROR_CODES.AGENT_REQUIRED, 'Visible agent sessions require an agent ID.');
        }
        if (!refresh && !resolvedAgent && requestedStartup && requestedStartup !== 'shell') {
            throw new HostRuntimeError(HOST_RUNTIME_ERROR_CODES.AGENT_REQUIRED, 'Visible agent sessions require an agent ID.');
        }
        const configuredStartup = terminalSettings().startupCommand ?? null;
        if (!refresh && !resolvedAgent && configuredStartup && configuredStartup !== 'shell') {
            const configuredAgentId = configuredAgentIdForCommand(configuredStartup);
            if (configuredAgentId)
                resolvedAgent = await resolveVerifiedAgent(configuredAgentId);
        }
        const startupCommand = (agentId
            ? resolvedAgent?.config.startupCommand
            : (requestedStartup || configuredStartup || resolvedAgent?.config.startupCommand)) ?? null;
        targetPool = resolvedAgent?.id || (!startupCommand ? 'terminal' : null);
        priorEntry = getSessionByWidget(branch, canvasId, widgetId);
        priorRuntimeAlive = priorEntry
            ? await terminalSessionExists(priorEntry.sessionId).catch(() => false)
            : false;
        const refreshedSession = refresh ? await attachExistingTerminalSession(sessionId, {
            runtimeSessionId: priorEntry?.runtimeSessionId || sessionId,
            ...(workspaceId ? { workspaceId } : {}), cwd: requireProjectRoot(),
        }) : null;
        if (refresh)
            priorRuntimeAlive = true;
        const priorAgentId = readTerminalConfigById(widgetId)?.widgetProps?.agentId || null;
        if (!refresh && priorRuntimeAlive && priorAgentId !== (resolvedAgent?.id || null)) {
            await killSession(sessionId);
            priorEntry = null;
            priorRuntimeAlive = false;
        }
        const saved = resolvedAgent?.config?.sessionIdEnv
            ? getLastAgentSession({ branch, canvasId, widgetId })
            : null;
        warmSession = !resolvedAgent && !priorRuntimeAlive && !saved && targetPool && hotPoolRef?.has(targetPool)
            ? hotPoolRef.acquire(targetPool)
            : null;
        const runtimeSessionId = priorRuntimeAlive
            ? priorEntry?.runtimeSessionId || sessionId
            : (warmSession?.runtimeSessionId || sessionId);
        const server = serverUrl();
        if (!refresh)
            prepareTerminalFiles({ widgetId, canvasId, ...(prettyName === undefined ? {} : { prettyName }), branch, server });
        const existingWidgetProps = readTerminalConfigById(widgetId)?.widgetProps || {};
        writeTerminalConfig({
            branch,
            canvasId,
            widgetId,
            serverUrl: server,
            ...(workspaceId ? { workspaceId } : {}),
            sessionId,
            ...(prettyName === undefined ? {} : { displayName: prettyName }),
            widgetProps: {
                ...existingWidgetProps,
                agentId: resolvedAgent?.id || existingWidgetProps.agentId || null,
                ...(prettyName ? { prettyName } : {}),
            },
        });
        const root = requireProjectRoot();
        const hostRuntime = resolvedAgent?.runtime || resolveTerminalHostRuntime(root);
        const shell = hostRuntime.shell;
        const prompt = terminalSettings().prompt || '$ ';
        const zdotdir = join(tmpdir(), 'storyboard-terminal');
        mkdirSync(zdotdir, { recursive: true });
        writeFileSync(join(zdotdir, '.zshenv'), '');
        writeFileSync(join(zdotdir, '.zshrc'), `export PS1=${JSON.stringify(prompt)}\nunset RPS1\n`);
        const launchContext = { widgetId, canvasId, ...(prettyName === undefined ? {} : { prettyName }), branch, server };
        const atomicStartup = !priorRuntimeAlive && !warmSession
            ? prepareSessionCommand(sessionId, launchContext, startupCommand, resolvedAgent) : null;
        const createdRaw = refresh ? { ...(isRecord(refreshedSession) ? refreshedSession : {}), reused: true } : await createTerminalSession(sessionId, {
            runtimeSessionId,
            ...(workspaceId ? { workspaceId } : {}),
            rollbackOnError: !priorRuntimeAlive,
            program: shell,
            ...(atomicStartup ? { args: terminalStartupArgs(shell, atomicStartup.command) } : {}),
            cwd: root,
            env: buildHostWorkloadEnv(hostRuntime, {
                TERM_PROGRAM: 'hypercanvas',
                FORCE_COLOR: '3',
                ZDOTDIR: zdotdir,
                STARSHIP_CONFIG: '/dev/null',
                POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD: 'true',
                STORYBOARD_WIDGET_ID: widgetId,
                STORYBOARD_CANVAS_ID: canvasId,
                STORYBOARD_BRANCH: branch,
                STORYBOARD_SERVER_URL: server,
                STORYBOARD_PROJECT_ROOT: root,
            }),
            cols,
            rows,
        });
        created = createdTerminalResult(createdRaw);
        const registered = registerSession({ branch, canvasId, widgetId, ...(prettyName === undefined ? {} : { prettyName }), runtimeSessionId });
        entry = registered.entry;
        if (atomicStartup && !created?.reused)
            monitorSessionStartup(sessionId, launchContext, atomicStartup);
        ensureConnected();
        conflict = registered.conflict;
        if (runtimeSessionId !== sessionId)
            adoptRuntimeSession(sessionId, runtimeSessionId);
        if (warmSession) {
            if (targetPool)
                hotPoolRef?.consume(targetPool, warmSession.id);
            warmConsumed = true;
        }
        // Negotiate dimensions before the native restore. Resuming cursor output
        // after plain capture text loses the TUI's cursor, modes and cell positions.
        await resizeTerminalSession(sessionId, cols, rows);
        const decoder = new StringDecoder('utf8');
        // The daemon's native restore repaints only the current screen with
        // cursor-preserving positioning (inside a full reset), so a freshly attached
        // viewer starts with an empty scrollback and cannot read anything above the
        // last screenful — output only enters the emulator's buffer when content
        // actually scrolls. Rebuild the history here instead: replay the rolling
        // output buffer as flowing lines, then repaint the captured current screen
        // on top, all in ONE restore message. The runtime attaches in LIVE mode
        // (restore + afterSequence>0) so the daemon does not send its own screen-only
        // restore, which would reset and erase the reconstructed buffer. Live output
        // emitted between the capture and the subscribe lands in the few serialized
        // milliseconds of that attach and is corrected by the TUI's next repaint.
        let liveResume = false;
        try {
            const captured = await snapshotTerminalSession(sessionId);
            const screen = String(captured?.screen || '').replaceAll('\n', '\r\n');
            if (screen && !retained) {
                // Drop output before the first line break: rolling chunks can split
                // escape sequences, and a mid-sequence fragment would render as garbage.
                let tail = getRollingBufferContent(sessionId);
                const firstBreak = tail.indexOf('\n');
                if (firstBreak !== -1)
                    tail = tail.slice(firstBreak + 1);
                if (tail)
                    sendJson(ws, {
                        type: 'terminal-restore',
                        cols,
                        rows,
                        data: `${tail.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')}${tail.endsWith('\n') ? '' : '\r\n'}`,
                        hardReset: false,
                    });
                if (screen)
                    sendJson(ws, {
                        type: 'terminal-restore',
                        cols,
                        rows,
                        data: screen,
                        hardReset: false,
                    });
                liveResume = true;
            }
        }
        catch { /* fall back to the daemon's native screen restore */ }
        subscription = await subscribeTerminalSession(sessionId, {
            restore: true,
            ...(liveResume ? { afterSequence: 1 } : {}),
            ...(retained ? { restoreScrollbackLines: 0 } : {}),
            onOutput: (event) => {
                const output = decoder.write(Buffer.from(outputBytes(event)));
                if (ws.readyState === 1)
                    ws.send(output);
                appendToRollingBuffer(sessionId, output);
            },
            onGap: (event) => {
                if (!isRecord(event))
                    return;
                if (retained && isRecord(event.snapshot)) {
                    sendJson(ws, { type: 'terminal-restore', data: retainedTerminalScreen(event.snapshot), hardReset: false });
                }
                else
                    sendTerminalRestore(ws, event.snapshot);
            },
            onConflict: (event) => sendJson(ws, { type: 'conflict', message: isRecord(event) ? event.reason : undefined }),
            onExit: (event) => {
                import('./live-terminal-coding-target.js').then(module => module.stopTerminalContext(requireProjectRoot(), widgetId, null)).catch(() => { });
                if (isRecord(event) && isRecord(event.processStatus) && typeof event.processStatus.message === 'string')
                    sendJson(ws, { type: 'error', message: event.processStatus.message });
                sendJson(ws, { type: 'session-ended', message: 'Terminal process exited.' });
                if (ws.readyState <= 1)
                    ws.close();
            },
            onError: (error) => failConnection(ws, error),
            onClose: ({ closedByClient }) => {
                if (!closedByClient && ws.readyState <= 1)
                    ws.close(1012, 'Terminal transport interrupted');
            },
        });
        ensureConnected();
        subscriptions.set(sessionId, subscription);
        sendJson(ws, {
            type: 'session-info',
            sessionId,
            name: entry.name,
            contextState: readTerminalConfigById(widgetId)?.contextState || null,
            reconnected: created?.reused === true,
            // Paseo placement is verifiable client-side: the terminal ID and the
            // workspace it lives in (the active Notebook's confirmed binding).
            ...(createdTerminalResult(created)?.workspaceId
                ? { workspaceId: createdTerminalResult(created)?.workspaceId, terminalId: createdTerminalResult(created)?.terminalId || null }
                : {}),
        });
        if (conflict)
            sendJson(ws, { type: 'conflict', ...conflict });
        const captureOptions = {
            sessionId, widgetId, canvasId,
            ...(prettyName === undefined ? {} : { prettyName }),
            createdAt: entry.createdAt,
        };
        snapshotOptions = captureOptions;
        startSnapshotCapture(captureOptions);
        if ((!created?.reused || warmSession) && !atomicStartup) {
            // Only plain-shell hot-pool sessions need stdin dispatch. Agent launches
            // belong to atomic PTY creation so an uncertain write can never duplicate
            // an agent or land in its interactive input buffer.
            const startup = prepareSessionCommand(sessionId, launchContext, startupCommand, resolvedAgent);
            await submit(sessionId, startup.command);
            monitorSessionStartup(sessionId, launchContext, startup);
        }
        if (!created?.reused) {
            const sequence = terminalSettings().defaultStartupSequence;
            if (sequence?.steps?.length)
                executeStartupSequence(sessionId, ws, sequence).catch(() => { });
        }
        ws.on('message', (message) => {
            const bytes = Buffer.isBuffer(message) || message instanceof Uint8Array ? Buffer.from(message) : Buffer.from(String(message));
            const text = bytes.toString('utf8');
            try {
                const parsed = JSON.parse(text);
                const resize = resizePayload(parsed);
                if (resize) {
                    resizeTerminalSession(sessionId, resize.cols, resize.rows).catch((error) => failConnection(ws, error));
                    return;
                }
            }
            catch { /* raw terminal input */ }
            writeTerminalBytes(sessionId, bytes).catch((error) => failConnection(ws, error));
        });
    }
    catch (error) {
        ws.off('close', disconnect);
        ws.off('error', disconnect);
        if (wsConnections.get(sessionId) === ws) {
            wsConnections.delete(sessionId);
            wsViewIds.delete(sessionId);
        }
        subscriptions.get(sessionId)?.close();
        subscriptions.delete(sessionId);
        if (warmSession && !warmConsumed && targetPool)
            hotPoolRef?.release(targetPool, warmSession.id);
        if (entry) {
            if (priorRuntimeAlive || disconnected || ws.readyState >= 2 || isTransientTerminalError(error))
                disconnectSession(sessionId, entry.generation);
            else
                await killSession(sessionId).catch(() => { });
        }
        else if (created && !priorRuntimeAlive) {
            await killSession(sessionId).catch(() => { });
        }
        else if (priorRuntimeAlive && priorEntry) {
            disconnectSession(sessionId, priorEntry.generation);
        }
        throw error;
    }
}
export async function killTerminalSession(sessionId, context) {
    const { getSession } = await import('./terminal-registry.js');
    const entry = getSession(sessionId);
    const result = await killSession(sessionId, context);
    if (entry?.widgetId) {
        try {
            const { stopTerminalContext } = await import('./live-terminal-coding-target.js');
            stopTerminalContext(context?.cwd || requireProjectRoot(), entry.widgetId, null);
        }
        catch (error) {
            devLog().logEvent('warn', 'Failed to stop terminal context after session shutdown', { sessionId, error: errorMessage(error) });
        }
    }
    sessionCaptureStops.get(sessionId)?.();
    sessionCaptureStops.delete(sessionId);
    subscriptions.get(sessionId)?.close();
    subscriptions.delete(sessionId);
    const ws = wsConnections.get(sessionId);
    if (ws && ws.readyState <= 1)
        ws.close();
    wsConnections.delete(sessionId);
    wsViewIds.delete(sessionId);
    return result;
}
export { legacySnapshotDir as terminalSnapshotDir };
export function readTerminalBuffer(widgetId, { maxLength } = {}) {
    try {
        const parsed = JSON.parse(readFileSync(join(bufferDir(), `${widgetId}.buffer.json`), 'utf8'));
        if (!isRecord(parsed))
            return null;
        const data = parsed;
        if (maxLength && typeof data.scrollback === 'string' && data.scrollback.length > maxLength)
            data.scrollback = data.scrollback.slice(-maxLength);
        if (maxLength && typeof data.paneContent === 'string' && data.paneContent.length > maxLength)
            data.paneContent = data.paneContent.slice(-maxLength);
        return data;
    }
    catch {
        return null;
    }
}
export function readTerminalSnapshot(widgetId, canvasId) {
    try {
        const entry = JSON.parse(readFileSync(join(publicSnapshotDir(), SNAPSHOT_INDEX_JSON), 'utf8'))?.agents?.[widgetId];
        if (entry)
            return entry;
    }
    catch { /* legacy fallback */ }
    if (canvasId) {
        try {
            return JSON.parse(readFileSync(join(legacySnapshotDir(canvasId), `${widgetId}.json`), 'utf8'));
        }
        catch { /* absent */ }
    }
    return null;
}
