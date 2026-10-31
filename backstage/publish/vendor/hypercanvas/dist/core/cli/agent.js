#!/usr/bin/env node
/**
 * storyboard agent signal — signal agent status to the canvas server.
 *
 * Usage:
 *   npx hypercanvas agent signal --widget <id> --canvas <canvasId> --status done|error|running|working [--message "..."]
 *
 * Environment variables (auto-set by terminal server):
 *   STORYBOARD_WIDGET_ID  — widget ID (fallback if --widget not provided)
 *   STORYBOARD_CANVAS_ID  — canvas ID (fallback if --canvas not provided)
 *   STORYBOARD_SERVER_URL — server base URL
 *   STORYBOARD_BRANCH     — current branch
 */
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { parseFlags } from './flags.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { dim, bold, cyan, yellow } from './intro.js';
import { getServerUrl } from './serverUrl.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function textValue(...values) {
    return values.find((value) => typeof value === 'string' && value.length > 0);
}
function responseMessage(value, fallback) {
    if (!isRecord(value))
        return fallback;
    return typeof value.error === 'string' ? value.error : fallback;
}
/**
 * Resolve a list of candidate server URLs to try, in priority order:
 *   1. Live server registry / worktree port (getServerUrl)
 *   2. STORYBOARD_SERVER_URL env (set when terminal was spawned — may be stale)
 *   3. Terminal config file (`.hypercanvas/terminals/<widgetId>.json`)
 *
 * Registry-first because the env var can be stale if the dev server was
 * restarted on a new port since the agent was spawned.
 */
async function resolveServerUrlCandidates(widgetId) {
    const urls = [];
    const add = (u) => {
        if (!u)
            return;
        const norm = String(u).replace(/\/$/, '');
        if (!urls.includes(norm))
            urls.push(norm);
    };
    try {
        add(getServerUrl());
    }
    catch { /* ignore */ }
    add((process.env.HYPERCANVAS_SERVER_URL ?? legacyEnv('STORYBOARD_SERVER_URL')));
    if (widgetId) {
        try {
            const { readFileSync, existsSync } = await import('node:fs');
            const path = await import('node:path');
            const cfgPath = path.join(resolveRuntimeDir(resolveNotebookRoot()), 'terminals', `${widgetId}.json`);
            if (existsSync(cfgPath)) {
                const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
                if (isRecord(cfg))
                    add(cfg.serverUrl);
            }
        }
        catch { /* ignore */ }
    }
    return urls;
}
/**
 * POST to the first reachable candidate. Returns { url, res } on a server
 * response (caller checks res.ok). Returns null if every candidate failed
 * at the network layer.
 */
async function postWithFallback(candidates, pathSuffix, body, headers) {
    let lastErr = null;
    for (const base of candidates) {
        const url = `${base}${pathSuffix}`;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout(5000),
                });
                if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 404)) {
                    return { url, res };
                }
                if (attempt === 1)
                    break;
                await new Promise((r) => setTimeout(r, 200));
            }
            catch (err) {
                lastErr = err;
                break;
            }
        }
    }
    if (lastErr)
        throw lastErr;
    return null;
}
const subcommand = process.argv[3];
if (subcommand === 'signal') {
    const flagSchema = {
        widget: { type: 'string', description: 'Widget ID' },
        canvas: { type: 'string', description: 'Canvas ID' },
        status: { type: 'string', required: true, description: 'Status: done, error, running, or working' },
        message: { type: 'string', description: 'Optional status message' },
    };
    const { flags } = parseFlags(process.argv.slice(4), flagSchema);
    const widgetId = textValue(flags.widget, process.env.HYPERCANVAS_WIDGET_ID, legacyEnv('STORYBOARD_WIDGET_ID'));
    const canvasId = textValue(flags.canvas, process.env.HYPERCANVAS_CANVAS_ID, legacyEnv('STORYBOARD_CANVAS_ID'));
    const statusValue = flags.status;
    const status = statusValue === 'done' || statusValue === 'error' || statusValue === 'running' || statusValue === 'working' ? statusValue : undefined;
    const message = textValue(flags.message) ?? null;
    const branch = (process.env.HYPERCANVAS_BRANCH ?? legacyEnv('STORYBOARD_BRANCH')) || 'unknown';
    if (!widgetId || !canvasId || !status) {
        console.error(`${bold('Usage:')} npx hypercanvas agent signal --status done|error|running|working`);
        console.error(`${dim('Widget and canvas IDs are read from environment if not provided.')}`);
        process.exit(1);
    }
    const candidates = await resolveServerUrlCandidates(widgetId);
    const body = JSON.stringify({ widgetId, canvasId, branch, status, message });
    const headers = { 'Content-Type': 'application/json' };
    try {
        const result = candidates.length > 0
            ? await postWithFallback(candidates, '/_hypercanvas/canvas/agent/signal', body, headers)
            : null;
        if (result && result.res.ok) {
            console.log(`${cyan('✓')} Agent status: ${bold(status)}${message ? ` — ${message}` : ''} ${dim(`(${result.url})`)}`);
        }
        else if (result) {
            const data = await result.res.json().catch(() => ({}));
            console.error(`${yellow('⚠')} Server returned ${result.res.status}: ${responseMessage(data, 'unknown error')} ${dim(`(${result.url})`)}`);
            await fallbackWrite({ branch, canvasId, widgetId, status, message });
        }
        else {
            console.error(`${yellow('⚠')} No reachable server. Tried: ${candidates.join(', ') || '(none resolved)'}`);
            await fallbackWrite({ branch, canvasId, widgetId, status, message });
        }
    }
    catch (err) {
        console.error(`${yellow('⚠')} Signal failed (${err instanceof Error ? err.message : String(err)}). Tried: ${candidates.join(', ')}`);
        await fallbackWrite({ branch, canvasId, widgetId, status, message });
    }
}
else if (subcommand === 'spawn') {
    // POST /agent/spawn — spawn a headless agent session
    const spawnSchema = {
        widget: { type: 'string', description: 'Widget ID' },
        canvas: { type: 'string', description: 'Canvas ID' },
        prompt: { type: 'string', required: true, description: 'Prompt / task for the agent' },
        'agent-id': { type: 'string', description: 'Agent binary key (copilot, claude, codex, opencode)' },
        autopilot: { type: 'boolean', description: 'Run in autopilot mode', default: true },
        branch: { type: 'string', description: 'Git branch override' },
    };
    const { flags: spawnFlags } = parseFlags(process.argv.slice(4), spawnSchema);
    const widgetId = textValue(spawnFlags.widget, process.env.HYPERCANVAS_WIDGET_ID, legacyEnv('STORYBOARD_WIDGET_ID'));
    const canvasId = textValue(spawnFlags.canvas, process.env.HYPERCANVAS_CANVAS_ID, legacyEnv('STORYBOARD_CANVAS_ID'));
    const prompt = textValue(spawnFlags.prompt);
    const agentId = textValue(spawnFlags['agent-id']);
    const autopilot = spawnFlags.autopilot !== false;
    const branchOverride = textValue(spawnFlags.branch);
    const serverUrl = getServerUrl();
    if (!canvasId || !widgetId || !prompt) {
        console.error(`${bold('Usage:')} npx hypercanvas agent spawn --prompt "task description"`);
        console.error(`${dim('Canvas and widget IDs are read from environment if not provided.')}`);
        process.exit(1);
    }
    try {
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/agent/spawn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canvasId, widgetId, prompt, autopilot, agentId, branch: branchOverride }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const record = isRecord(data) ? data : {};
            console.log(`${cyan('✓')} Agent spawned: ${bold(textValue(record.sessionId) || widgetId)} (status: ${textValue(record.status) || 'running'})`);
        }
        else {
            console.error(`${yellow('⚠')} Server returned ${res.status}: ${responseMessage(data, 'unknown error')}`);
            process.exit(1);
        }
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
else if (subcommand === 'status') {
    // GET /agent/status — poll agent status
    const statusSchema = {
        widget: { type: 'string', description: 'Widget ID' },
        canvas: { type: 'string', description: 'Canvas ID' },
        branch: { type: 'string', description: 'Git branch' },
    };
    const { flags: statusFlags } = parseFlags(process.argv.slice(4), statusSchema);
    const widgetId = textValue(statusFlags.widget, process.env.HYPERCANVAS_WIDGET_ID, legacyEnv('STORYBOARD_WIDGET_ID'));
    const canvasId = textValue(statusFlags.canvas, process.env.HYPERCANVAS_CANVAS_ID, legacyEnv('STORYBOARD_CANVAS_ID')) || 'unknown';
    const branch = textValue(statusFlags.branch, process.env.HYPERCANVAS_BRANCH, legacyEnv('STORYBOARD_BRANCH')) || 'unknown';
    const serverUrl = getServerUrl();
    if (!widgetId) {
        console.error(`${bold('Usage:')} npx hypercanvas agent status --widget <id>`);
        process.exit(1);
    }
    try {
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/agent/status?widgetId=${encodeURIComponent(widgetId)}&canvasId=${encodeURIComponent(canvasId)}&branch=${encodeURIComponent(branch)}`, {
            signal: AbortSignal.timeout(10000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            console.log(JSON.stringify(data, null, 2));
        }
        else {
            console.error(`${yellow('⚠')} ${responseMessage(data, `Status ${res.status}`)}`);
            process.exit(1);
        }
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
else if (subcommand === 'peek') {
    // POST /agent/peek — read the headless PTY snapshot for a widget
    const peekSchema = {
        widget: { type: 'string', required: true, description: 'Widget ID' },
        canvas: { type: 'string', description: 'Canvas ID' },
    };
    const { flags: peekFlags } = parseFlags(process.argv.slice(4), peekSchema);
    const widgetId = textValue(peekFlags.widget, process.env.HYPERCANVAS_WIDGET_ID, legacyEnv('STORYBOARD_WIDGET_ID'));
    const canvasId = textValue(peekFlags.canvas, process.env.HYPERCANVAS_CANVAS_ID, legacyEnv('STORYBOARD_CANVAS_ID'));
    const serverUrl = getServerUrl();
    if (!widgetId) {
        console.error(`${bold('Usage:')} npx hypercanvas agent peek --widget <id>`);
        process.exit(1);
    }
    try {
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/agent/peek`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgetId, canvasId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            console.log(JSON.stringify(data, null, 2));
        }
        else {
            console.error(`${yellow('⚠')} ${responseMessage(data, `Status ${res.status}`)}`);
            process.exit(1);
        }
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
else if (subcommand === 'list') {
    // GET /agents — list storyboard-spawned agent sessions on a canvas
    const listSchema = {
        canvas: { type: 'string', description: 'Canvas ID' },
        branch: { type: 'string', description: 'Git branch (optional filter)' },
        json: { type: 'boolean', description: 'Print raw JSON instead of a table' },
    };
    const { flags: listFlags } = parseFlags(process.argv.slice(4), listSchema);
    const canvasId = textValue(listFlags.canvas, process.env.HYPERCANVAS_CANVAS_ID, legacyEnv('STORYBOARD_CANVAS_ID'));
    const branch = textValue(listFlags.branch, process.env.HYPERCANVAS_BRANCH, legacyEnv('STORYBOARD_BRANCH')) || null;
    const serverUrl = getServerUrl();
    if (!canvasId) {
        console.error(`${bold('Usage:')} npx hypercanvas agent list --canvas <id> [--branch <name>] [--json]`);
        process.exit(1);
    }
    try {
        const params = new URLSearchParams({ canvasId });
        if (branch)
            params.set('branch', branch);
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/agents?${params.toString()}`, {
            signal: AbortSignal.timeout(10000),
        });
        const data = await res.json().catch(() => ({}));
        const record = isRecord(data) ? data : {};
        if (!res.ok) {
            console.error(`${yellow('⚠')} ${responseMessage(data, `Status ${res.status}`)}`);
            process.exit(1);
        }
        if (listFlags.json) {
            console.log(JSON.stringify(data, null, 2));
        }
        else {
            const agents = Array.isArray(record.agents) ? record.agents.filter(isRecord) : [];
            if (agents.length === 0) {
                console.log(`${dim('No storyboard-spawned agents on canvas')} ${bold(canvasId)}${branch ? ` (branch ${branch})` : ''}`);
            }
            else {
                console.log(`${bold(`${agents.length} agent${agents.length === 1 ? '' : 's'}`)} on canvas ${cyan(canvasId)}${branch ? dim(` · branch ${branch}`) : ''}`);
                console.log(dim('(excludes external agents running outside storyboard)'));
                for (const a of agents) {
                    const ts = textValue(a.statusUpdatedAt, a.updatedAt) || '';
                    const when = ts ? dim(` · ${ts}`) : '';
                    const msg = typeof a.message === 'string' && a.message ? ` — ${a.message}` : '';
                    console.log(`  ${bold(textValue(a.widgetId) || 'unknown')} ${cyan(textValue(a.status) || 'unknown')}${when}${msg}`);
                }
            }
        }
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
else {
    console.error(`${bold('Usage:')} npx hypercanvas agent <signal|spawn|status|peek|list>`);
    console.error(`${dim('Subcommands: signal, spawn, status, peek, list')}`);
    process.exit(1);
}
async function fallbackWrite({ branch, canvasId, widgetId, status, message }) {
    try {
        const { updateAgentStatus, initTerminalConfig } = await import('../canvas/terminal-config.js');
        initTerminalConfig(resolveNotebookRoot());
        updateAgentStatus({ branch, canvasId, widgetId, status, message });
        console.error(`${yellow('⚠')} Agent status persisted to config file only — UI will NOT update until server reconnects: ${bold(status)}`);
    }
    catch (err) {
        console.error(`Failed to write agent status: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
