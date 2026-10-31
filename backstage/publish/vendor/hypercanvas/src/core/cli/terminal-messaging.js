/**
 * Terminal Messaging CLI — send messages between terminals and save output.
 *
 * Commands:
 *   storyboard terminal output --summary "..." --content "..."  Save latest output
 *   storyboard terminal status <widgetId>               Check terminal status
 *   storyboard terminal read <widgetId>                 Read terminal buffer
 *   storyboard terminal input --widget <id> (--text "..." | --key <key>...) [--enter]
 *                                                     Submit text to a terminal PTY
 */
import { getServerUrl } from './serverUrl.js';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function errorMessage(error) {
    if (error !== null && typeof error === 'object' && 'message' in error) {
        const message = error.message;
        return typeof message === 'string' ? message : '';
    }
    return '';
}
function errorName(error) {
    if (error !== null && typeof error === 'object' && 'name' in error) {
        return typeof error.name === 'string' ? error.name : undefined;
    }
    return undefined;
}
function parseArgs(args) {
    const result = { positional: [], flags: {} };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === undefined)
            continue;
        if (arg.startsWith('--')) {
            const equalsIndex = arg.indexOf('=');
            if (equalsIndex !== -1) {
                const key = arg.slice(2, equalsIndex);
                const value = arg.slice(equalsIndex + 1);
                if (key === 'key')
                    result.flags.key = appendKey(result.flags.key, value);
                else
                    result.flags[key] = value;
                continue;
            }
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                if (key === 'key')
                    result.flags.key = appendKey(result.flags.key, next);
                else
                    result.flags[key] = next;
                i++;
            }
            else {
                result.flags[key] = true;
            }
        }
        else {
            result.positional.push(arg);
        }
    }
    return result;
}
function appendKey(previous, value) {
    if (Array.isArray(previous))
        return [...previous, value];
    return previous === undefined ? [value] : [previous, value];
}
export async function requestTerminalInput(request) {
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/_hypercanvas/canvas/terminal/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json();
    const result = isRecord(payload) ? payload : {};
    if (!response.ok || !result.success) {
        const error = new Error(result.error || `Terminal input failed with HTTP ${response.status}`);
        error.code = result.code || 'TERMINAL_INPUT_FAILED';
        error.statusCode = response.status;
        throw error;
    }
    return result;
}
export async function handleInput() {
    const args = process.argv.slice(4); // skip: node, sb, terminal, input
    const { positional, flags } = parseArgs(args);
    const allowedFlags = new Set(['widget', 'session', 'text', 'key', 'enter', 'paste', 'canvas', 'branch']);
    const unknownFlag = Object.keys(flags).find(key => !allowedFlags.has(key));
    const widgetId = typeof flags.widget === 'string' ? flags.widget : null;
    const sessionId = typeof flags.session === 'string' ? flags.session : null;
    const text = typeof flags.text === 'string' ? flags.text : undefined;
    const hasKeys = flags.key !== undefined;
    const keys = Array.isArray(flags.key) ? flags.key : hasKeys && typeof flags.key === 'string' ? [flags.key] : null;
    const usage = 'Usage: hypercanvas terminal input (--widget <id> | --session <id>) (--text "..." | --key <key>...) [--enter] [--paste] [--canvas <id>] [--branch <name>]';
    if (unknownFlag) {
        console.error(`Error: unknown option --${unknownFlag}`);
        process.exit(1);
        return;
    }
    if (positional.length || Number(Boolean(widgetId)) + Number(Boolean(sessionId)) !== 1 || (typeof text !== 'string' && !hasKeys) || (typeof text === 'string' && hasKeys) || (hasKeys && !keys)) {
        console.error(usage);
        process.exit(1);
        return;
    }
    if (flags.enter !== undefined && flags.enter !== true) {
        console.error('Error: --enter takes no value; omit it to insert text without submitting');
        process.exit(1);
        return;
    }
    if (flags.paste !== undefined && flags.paste !== true) {
        console.error('Error: --paste takes no value');
        process.exit(1);
        return;
    }
    if (flags.paste === true && hasKeys) {
        console.error('Error: --paste can only be used with --text');
        process.exit(1);
        return;
    }
    if (flags.canvas !== undefined && typeof flags.canvas !== 'string') {
        console.error('Error: --canvas requires a canvas ID');
        process.exit(1);
        return;
    }
    if (flags.branch !== undefined && typeof flags.branch !== 'string') {
        console.error('Error: --branch requires a branch name');
        process.exit(1);
        return;
    }
    const request = {
        ...(widgetId ? { widgetId } : { sessionId }),
        ...(hasKeys ? { keys: keys ?? [] } : typeof text === 'string' ? { text } : {}),
        submit: flags.enter === true,
        ...(flags.paste === true ? { paste: true } : {}),
        ...(flags.canvas ? { canvasId: flags.canvas } : {}),
        ...(flags.branch ? { branch: flags.branch } : {}),
    };
    try {
        const result = await requestTerminalInput(request);
        console.log(`Terminal runtime accepted ${result.written} bytes; Enter ${result.submitted ? 'sent' : 'not sent'}.`);
    }
    catch (error) {
        if (errorName(error) === 'TimeoutError') {
            console.error(`Error: request timed out — is the dev server running? (tried ${getServerUrl()})`);
        }
        else {
            console.error(`Error: ${errorMessage(error)}`);
        }
        process.exit(1);
    }
}
export async function requestAgentActivation(agentId = null) {
    const widgetId = process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID');
    if (!widgetId)
        throw new Error('STORYBOARD_WIDGET_ID is not set');
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/_hypercanvas/canvas/terminal/activate-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            widgetId,
            canvasId: (process.env.HYPERCANVAS_CANVAS_ID ?? legacyEnv('STORYBOARD_CANVAS_ID')) || 'unknown',
            branch: (process.env.HYPERCANVAS_BRANCH ?? legacyEnv('STORYBOARD_BRANCH')) || 'unknown',
            agentId,
        }),
        signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json();
    const result = isRecord(payload) ? payload : {};
    if (!response.ok)
        throw new Error(result.error ? String(result.error) : 'Agent activation failed');
    return result;
}
export async function handleActivateAgent() {
    const agentId = process.argv[4] || null;
    try {
        const result = await requestAgentActivation(agentId);
        console.log(`Agent activated for terminal ${result.sessionId}`);
    }
    catch (error) {
        console.error(`Error: ${errorMessage(error)}`);
        process.exit(1);
    }
}
export async function handleOutput() {
    const args = process.argv.slice(4); // skip: node, sb, terminal, output
    const { flags } = parseArgs(args);
    const widgetId = (typeof flags.widget === 'string' ? flags.widget : undefined)
        || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
    const summary = flags.summary || '';
    const content = flags.content || '';
    if (!widgetId) {
        console.error('Error: --widget <id> or $STORYBOARD_WIDGET_ID required');
        process.exit(1);
    }
    const serverUrl = getServerUrl();
    try {
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/terminal/output`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgetId, content, summary }),
            signal: AbortSignal.timeout(10000),
        });
        const payload = await res.json();
        const data = isRecord(payload) ? payload : {};
        if (data.success) {
            console.log('Output saved');
        }
        else {
            console.error(`Failed: ${data.error}`);
            process.exit(1);
        }
    }
    catch (err) {
        if (errorName(err) === 'TimeoutError') {
            console.error(`Error: request timed out — is the dev server running? (tried ${serverUrl})`);
        }
        else {
            console.error(`Error: ${errorMessage(err)}`);
        }
        process.exit(1);
    }
}
export async function handleStatus() {
    const args = process.argv.slice(4); // skip: node, sb, terminal, status
    const { positional } = parseArgs(args);
    const widgetId = positional[0];
    if (!widgetId) {
        console.error('Usage: hypercanvas terminal status <widgetId>');
        process.exit(1);
    }
    try {
        const { readTerminalConfigById, initTerminalConfig } = await import('../canvas/terminal-config.js');
        initTerminalConfig(resolveNotebookRoot());
        const config = readTerminalConfigById(widgetId);
        if (!config) {
            console.error(`No config found for ${widgetId}`);
            process.exit(1);
        }
        console.log(JSON.stringify({
            widgetId: config.widgetId,
            displayName: config.displayName || null,
            agentStatus: config.agentStatus || null,
            latestOutput: config.latestOutput ? { summary: config.latestOutput.summary, updatedAt: config.latestOutput.updatedAt } : null,
            hubs: config.hubs || [],
        }, null, 2));
    }
    catch (err) {
        console.error(`Error: ${errorMessage(err)}`);
        process.exit(1);
    }
}
export async function handleRead() {
    const args = process.argv.slice(4); // skip: node, sb, terminal, read
    const { positional, flags } = parseArgs(args);
    const widgetId = positional[0] || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
    if (!widgetId) {
        console.error('Usage: hypercanvas terminal read <widgetId> [--length N]');
        process.exit(1);
    }
    const lengthFlag = flags.length;
    const length = lengthFlag ? parseInt(typeof lengthFlag === 'string' ? lengthFlag : String(lengthFlag), 10) : undefined;
    // Try HTTP API first (dev server may have fresher data)
    try {
        const serverUrl = getServerUrl();
        const qs = length ? `?length=${length}` : '';
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/terminal-buffer/${encodeURIComponent(widgetId)}${qs}`, {
            signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
            const data = await res.json();
            console.log(JSON.stringify(data, null, 2));
            return;
        }
    }
    catch {
        // Server not reachable — read directly from file
    }
    // Fallback: read buffer file directly
    try {
        const { readFileSync, existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        const bufferPath = join(resolveRuntimeDir(resolveNotebookRoot()), 'terminal-buffers', `${widgetId}.buffer.json`);
        if (!existsSync(bufferPath)) {
            console.error(`No buffer found for ${widgetId}`);
            process.exit(1);
        }
        const raw = JSON.parse(readFileSync(bufferPath, 'utf8'));
        const data = isRecord(raw) ? raw : {};
        if (length) {
            const scrollback = data.scrollback;
            if (scrollback && scrollback.length > length) {
                data.scrollback = typeof scrollback === 'string' ? scrollback.slice(-length) : scrollback.slice(-length);
            }
            const paneContent = data.paneContent;
            if (paneContent && paneContent.length > length) {
                data.paneContent = typeof paneContent === 'string' ? paneContent.slice(-length) : paneContent.slice(-length);
            }
        }
        console.log(JSON.stringify(data, null, 2));
    }
    catch (err) {
        console.error(`Error: ${errorMessage(err)}`);
        process.exit(1);
    }
}
export async function handleKill() {
    const args = process.argv.slice(4); // skip: node, sb, terminal, kill
    const { positional, flags } = parseArgs(args);
    const widgetId = positional[0] || (typeof flags.widget === 'string' ? flags.widget : undefined) || (typeof flags.w === 'string' ? flags.w : undefined);
    if (!widgetId) {
        console.error('Usage: hypercanvas terminal kill <widgetId>');
        console.error('       storyboard terminal kill --widget <widgetId>');
        process.exit(1);
    }
    const serverUrl = getServerUrl();
    try {
        const res = await fetch(`${serverUrl}/_hypercanvas/canvas/terminal/kill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgetId }),
            signal: AbortSignal.timeout(10000),
        });
        const payload = await res.json();
        const data = isRecord(payload) ? payload : {};
        if (data.success) {
            console.log(`Terminal ${widgetId} killed (session: ${data.killed || 'unknown'})`);
        }
        else {
            console.error(`Failed: ${data.error}`);
            process.exit(1);
        }
    }
    catch (err) {
        if (errorName(err) === 'TimeoutError') {
            console.error(`Error: request timed out — is the dev server running? (tried ${serverUrl})`);
        }
        else {
            console.error(`Error: ${errorMessage(err)}`);
        }
        process.exit(1);
    }
}
