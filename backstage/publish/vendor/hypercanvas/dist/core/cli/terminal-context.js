import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { getServerUrl } from './serverUrl.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
import { initTerminalConfig, readTerminalConfigById } from '../canvas/terminal-config.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function errorText(error) {
    if (error !== null && typeof error === 'object' && 'message' in error) {
        const message = error.message;
        return typeof message === 'string' ? message : '';
    }
    return '';
}
function currentWidgetServerUrl(widgetId) {
    const sessionRoot = process.env.HYPERCANVAS_PROJECT_ROOT || legacyEnv('STORYBOARD_PROJECT_ROOT');
    if (!sessionRoot || !widgetId)
        return null;
    try {
        // The live agent retains its launch environment when Core changes ports.
        // Resolve only its explicitly identified Notebook and widget, never a
        // guessed public port or another Notebook's service.
        initTerminalConfig(resolveNotebookRoot(sessionRoot));
        const config = readTerminalConfigById(widgetId);
        if (config?.widgetId !== widgetId || typeof config.serverUrl !== 'string')
            return null;
        const url = new URL(config.serverUrl);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
            ? config.serverUrl.replace(/\/$/, '') : null;
    }
    catch {
        return null;
    }
}
export async function requestTerminalContext(request) {
    const retryDelays = [250, 750];
    let serverUrl = getServerUrl();
    for (let attempt = 0;; attempt++) {
        let response;
        try {
            response = await fetch(`${serverUrl}/_hypercanvas/canvas/terminal/context`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request), signal: AbortSignal.timeout(10_000),
            });
        }
        catch (error) {
            if (attempt >= retryDelays.length)
                throw error;
            serverUrl = currentWidgetServerUrl(request.widgetId) || serverUrl;
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
            continue;
        }
        if ([408, 425, 429, 500, 502, 503, 504].includes(response.status) && attempt < retryDelays.length) {
            await response.body?.cancel();
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
            continue;
        }
        const payload = await response.json();
        const result = isRecord(payload) ? payload : {};
        if (!response.ok || !result.success)
            throw new Error(result.error || 'Terminal context request failed');
        return result;
    }
}
export async function handleTerminalContext() {
    try {
        const args = process.argv.slice(4);
        if (args.includes('--help')) {
            console.log('storyboard terminal context [--widget <id>] [--action state|start|exit|ack|retry] [--ack <revision> | --retry] [--revision <revision>] [--launch <id>] [--interactive true|false]');
            return;
        }
        const values = {};
        for (let index = 0; index < args.length; index++) {
            const flag = args[index];
            if (flag === undefined)
                throw new Error('Unknown terminal context option');
            if (!['--widget', '--action', '--ack', '--retry', '--revision', '--launch', '--interactive'].includes(flag))
                throw new Error(`Unknown terminal context option ${flag}`);
            if (flag === '--retry') {
                values.retry = true;
                continue;
            }
            const value = args[++index];
            if (!value || value.startsWith('--'))
                throw new Error(`${flag} requires a value`);
            switch (flag) {
                case '--widget':
                    values.widgetId = value;
                    break;
                case '--action':
                    values.action = value;
                    break;
                case '--ack':
                    values.ack = value;
                    break;
                case '--revision':
                    values.revision = value;
                    break;
                case '--launch':
                    values.launchId = value;
                    break;
                case '--interactive':
                    values.interactive = value;
                    break;
            }
        }
        const interactive = values.interactive;
        if (interactive && !['true', 'false'].includes(interactive))
            throw new Error('--interactive must be true or false');
        const widgetId = values.widgetId || process.env.HYPERCANVAS_WIDGET_ID || legacyEnv('STORYBOARD_WIDGET_ID');
        const revision = values.ack || values.revision;
        const launchId = values.launchId || process.env.HYPERCANVAS_CONTEXT_LAUNCH_ID || legacyEnv('STORYBOARD_CONTEXT_LAUNCH_ID');
        const result = await requestTerminalContext({
            action: values.ack ? 'ack' : values.retry ? 'retry' : values.action || 'state',
            ...(widgetId ? { widgetId } : {}),
            ...(revision ? { revision } : {}),
            ...(launchId ? { launchId } : {}),
            ...(interactive ? { interactive: interactive === 'true' } : {}),
        });
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error(`Error: ${errorText(error)}`);
        process.exitCode = 1;
    }
}
