import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createPaseoConnection, DEFAULT_PASEO_DAEMON_URL } from './paseo-runtime-client.js';
import { selectEphemeralPort } from '../cli/devContract.js';
import { redactDiagnosticText } from '../server/diagnostics.js';
export const BUNDLED_PASEO_VERSION = '0.8.0-beta.1';
async function probe(url, password, authHeader, { timeoutMs = 1500 } = {}) {
    // Use only this endpoint's credentials. A private probe must never inherit
    // the parent's App auth header through the runtime client's env fallback.
    const connection = await createPaseoConnection({
        env: {}, url,
        ...(password === undefined ? {} : { password }),
        ...(authHeader === undefined ? {} : { authHeader }),
        connectTimeoutMs: timeoutMs,
        reconnect: { enabled: false },
    });
    let timer;
    try {
        await Promise.race([
            connection.client.workspaces.list({}),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Paseo workspace probe timed out')), timeoutMs); }),
        ]);
        const info = connection.daemon.getLastServerInfoMessage();
        // Require the workspace-era protocol, but do not reject newer App releases
        // just because the private fallback is pinned to an older package version.
        // The SDK handshake and workspace call above are the live contract probe.
        const version = /^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/.exec(info?.version || '');
        const supported = info?.version === BUNDLED_PASEO_VERSION
            || Boolean(version && info?.version && (Number(version[1]) > 0 || (Number(version[2]) >= 8 && !info.version.includes('-'))));
        if (!info?.serverId || !supported) {
            throw new Error('The local Paseo daemon is incompatible with this Hypercanvas release');
        }
        return info.serverId;
    }
    finally {
        if (timer)
            clearTimeout(timer);
        await connection.close();
    }
}
/** Select once per Core launch. Never migrate to a different daemon mid-run. */
export async function startDesktopPaseo({ stateDir, env = process.env, usePaseoApp = true, connect = probe, launch = spawn, defaultUrl = DEFAULT_PASEO_DAEMON_URL, selectPort = selectEphemeralPort, resolveSupervisorEntry = () => {
    const require = createRequire(import.meta.url);
    return join(dirname(require.resolve('@getpaseo/server')), '../../scripts/supervisor-entrypoint.js');
}, timeoutMs = 25_000, } = {}) {
    if (!stateDir)
        throw new Error('Core Paseo startup requires an application state directory');
    if (typeof usePaseoApp !== 'boolean')
        throw new Error('usePaseoApp must be a boolean');
    const preferApp = usePaseoApp && env.HYPERCANVAS_PASEO_ISOLATED !== '1';
    const requestedUrl = env.PASEO_DAEMON_URL || defaultUrl;
    let reuseProbeFailure = null;
    if (preferApp) {
        try {
            const serverId = await connect(requestedUrl, env.PASEO_DAEMON_PASSWORD, env.PASEO_DAEMON_AUTH_HEADER);
            return {
                owned: false,
                usePaseoApp: preferApp,
                url: requestedUrl,
                serverId,
                connectionOptions: {
                    url: requestedUrl,
                    ...(env.PASEO_DAEMON_PASSWORD ? { password: env.PASEO_DAEMON_PASSWORD } : {}),
                    ...(env.PASEO_DAEMON_AUTH_HEADER ? { authHeader: env.PASEO_DAEMON_AUTH_HEADER } : {}),
                },
                child: null,
                stop: async () => { },
            };
        }
        catch (probeError) {
            if (env.PASEO_DAEMON_URL || env.PASEO_DAEMON_PASSWORD || env.PASEO_DAEMON_AUTH_HEADER) {
                throw new Error('Could not connect to the configured Paseo daemon; check its compatibility and authentication');
            }
            // Falling back to a private daemon must be explainable: the reason is
            // reported on the owned handle and in the paseo-ready desktop event.
            reuseProbeFailure = probeError instanceof Error ? probeError.message : String(probeError);
            for (const secret of [requestedUrl, env.PASEO_DAEMON_PASSWORD, env.PASEO_DAEMON_AUTH_HEADER]) {
                if (secret)
                    reuseProbeFailure = reuseProbeFailure.replaceAll(secret, '[redacted]');
            }
            reuseProbeFailure = redactDiagnosticText(reuseProbeFailure).slice(0, 500);
        }
    }
    const port = await selectPort('127.0.0.1');
    const url = `ws://127.0.0.1:${port}/ws`;
    const password = randomBytes(32).toString('hex');
    const home = join(stateDir, 'paseo');
    mkdirSync(home, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32')
        chmodSync(home, 0o700);
    const entry = resolveSupervisorEntry();
    const daemonEnv = {
        ...env,
        PASEO_HOME: home,
        PASEO_LISTEN: `127.0.0.1:${port}`,
        PASEO_PASSWORD: password,
    };
    // Browser/SDK session tokens must not flow into Paseo's PTY/provider children.
    delete daemonEnv.HYPERCANVAS_LAUNCH_TOKEN;
    delete daemonEnv.PASEO_DAEMON_URL;
    delete daemonEnv.PASEO_DAEMON_PASSWORD;
    delete daemonEnv.PASEO_DAEMON_AUTH_HEADER;
    const child = launch(process.execPath, [entry, '--no-relay', '--no-web-ui'], {
        env: daemonEnv,
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: false,
    });
    let exited = false;
    let launchError = false;
    let stderr = '';
    child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-16_384); });
    child.once('exit', () => { exited = true; });
    child.once('error', () => { launchError = true; });
    let stopping;
    const stop = () => stopping ||= (async () => {
        if (exited || launchError)
            return;
        child.kill('SIGTERM');
        const deadline = Date.now() + 3000;
        while (!exited && Date.now() < deadline)
            await delay(50);
        if (!exited)
            child.kill('SIGKILL');
    })();
    try {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (exited || launchError)
                throw new Error('The bundled Paseo daemon exited during startup');
            try {
                // A fresh daemon initializes providers before serving its first requests.
                // Keep both handshake and workspace probe inside the startup deadline.
                const probeTimeoutMs = Math.min(10_000, Math.max(1, Math.floor((deadline - Date.now()) / 2)));
                const serverId = await connect(url, password, undefined, { timeoutMs: probeTimeoutMs });
                return {
                    owned: true,
                    usePaseoApp: preferApp,
                    url,
                    serverId,
                    reuseProbeFailure,
                    connectionOptions: { url, password },
                    child,
                    stop,
                };
            }
            catch {
                await delay(150);
            }
        }
        throw new Error('Timed out waiting for the bundled Paseo daemon handshake');
    }
    catch (error) {
        await stop();
        let detail = stderr;
        for (const [name, value] of Object.entries(daemonEnv)) {
            if (value && /password|token|secret|auth|credential|api.?key/i.test(name))
                detail = detail.replaceAll(value, '[redacted]');
        }
        // Classify the whole bounded buffer before display redaction truncates it.
        // The pinned supervisor calls a live PID lock "Another Paseo daemon is
        // already running"; retain that actionable line even after noisy logs.
        const conflictPattern = /(?:pid.{0,30}lock|lock.{0,30}(?:held|owner|process)|another paseo daemon is already running|EADDRINUSE)/i;
        const conflictLine = detail.split(/\r?\n/).find(line => conflictPattern.test(line));
        const conflict = conflictLine !== undefined;
        detail = redactDiagnosticText(conflictLine ? `${conflictLine}\n${detail}` : detail).trim();
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${conflict ? 'Bundled Paseo daemon ownership conflict. ' : ''}${message}${detail ? `: ${detail}` : ''}`);
    }
}
