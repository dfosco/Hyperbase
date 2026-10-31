/**
 * GitHub account connection through the real `gh` CLI.
 *
 * - Auth preflight: an already-authenticated `gh` is reused and no login runs.
 * - Otherwise one owned `gh auth login --web` (or `gh auth refresh` when only
 *   permissions are missing) runs per Core process. It is cancelable, bounded
 *   by a time limit, and its device code / browser prompts are captured for
 *   the Publish UI. Hypercanvas never reads, stores or logs a GitHub token and
 *   registers no OAuth app: GitHub's own `gh` client performs the browser flow.
 * - Auth/status reads are cached and short-lived so fast UI polling never
 *   spawns repeated remote `gh api user` calls.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { publishingError } from './errors.js';
import { ghCliState, resolveGhExecutable } from './ghExecutable.js';
import { ghOutputOf, ghProcessEnv, ghUnavailable, runGhCommand } from './github.js';
import { redactOutput } from './operations.js';
export const GITHUB_HOST = 'github.com';
/** Scopes publishing needs: repository access and permission to push workflow files. */
export const REQUIRED_SCOPES = Object.freeze(['repo', 'workflow']);
const AUTHENTICATED_TTL_MS = 30_000;
const UNAUTHENTICATED_TTL_MS = 5_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const KILL_GRACE_MS = 2_000;
const OUTPUT_LINE_LIMIT = 80;
const OUTPUT_LINE_LENGTH = 400;
const GIT_COMMAND_TIMEOUT_MS = 20_000;
const settings = { loginTimeoutMs: LOGIN_TIMEOUT_MS, killGraceMs: KILL_GRACE_MS };
let session = null;
let cached = null;
const active = (candidate) => candidate !== null && (candidate.snapshot.status === 'starting' || candidate.snapshot.status === 'awaiting_browser' || candidate.snapshot.status === 'verifying');
// ---------------------------------------------------------------------------
// Auth state (cached)
// ---------------------------------------------------------------------------
function cacheKey() {
    return [resolveGhExecutable(), process.env.PATH ?? '', process.env.GH_CONFIG_DIR ?? '', process.env.GH_TOKEN ? 't' : '', process.env.HYPERCANVAS_GH_HANDOFF ?? ''].join('|');
}
export function invalidateGitHubAuthCache() {
    cached = null;
}
const NETWORK_FAILURE = /could not resolve|dial tcp|timeout|timed out|ETIMEDOUT|ENOTFOUND|network is unreachable|connection refused|no such host/i;
const AUTH_FAILURE = /auth|login|credential|401|token|not logged|bad credentials/i;
function parseScopes(output) {
    const line = output.split('\n').find(item => /token scopes:/i.test(item));
    if (!line)
        return null;
    const raw = line.slice(line.toLowerCase().indexOf('token scopes:') + 'token scopes:'.length);
    if (/none/i.test(raw) && !/'/.test(raw))
        return [];
    return [...raw.matchAll(/'([^']+)'/g)].map(match => match[1] ?? '').filter(Boolean);
}
function readScopes() {
    try {
        const out = runGhCommand(['auth', 'status', '--hostname', GITHUB_HOST]);
        return parseScopes(out);
    }
    catch (error) {
        // Older gh prints status to stderr and may exit nonzero for secondary accounts;
        // the scope line is still usable when present.
        return parseScopes(ghOutputOf(error));
    }
}
function gitCredentialState() {
    try {
        const helpers = execFileSync('git', ['config', '--get-all', `credential.https://${GITHUB_HOST}.helper`], {
            encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_COMMAND_TIMEOUT_MS,
        });
        return /auth\s+git-credential/.test(helpers) ? 'configured' : 'missing';
    }
    catch (error) {
        // `git config --get-all` exits 1 when the key is unset.
        const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
        return status === 1 ? 'missing' : 'unknown';
    }
}
function probeAuth() {
    const cli = ghCliState();
    const base = { account: null, scopes: null, missingScopes: [], gitCredentials: 'unknown', cli, checkedAt: new Date().toISOString() };
    let raw;
    try {
        raw = runGhCommand(['api', 'user', '--jq', '.login']);
    }
    catch (error) {
        if (ghUnavailable(error)) {
            const hint = cli.status === 'installing' ? cli.hint
                : cli.status === 'failed' ? `${cli.error ?? 'The GitHub CLI could not be set up.'} ${cli.hint ?? ''}`.trim()
                    : 'The GitHub CLI isn’t available yet. Recheck, or install it from https://cli.github.com/.';
            return { ...base, available: false, authenticated: false, hint };
        }
        const output = ghOutputOf(error);
        const timedOut = typeof error === 'object' && error !== null && error.code === 'ETIMEDOUT';
        if (!AUTH_FAILURE.test(output) && (timedOut || NETWORK_FAILURE.test(output))) {
            return { ...base, available: true, authenticated: false, offline: true, hint: 'Can’t reach GitHub. Check your connection and recheck.' };
        }
        return { ...base, available: true, authenticated: false, hint: 'Connect GitHub to publish this notebook.' };
    }
    const account = String(raw ?? '').trim();
    if (!account)
        return { ...base, available: true, authenticated: false, hint: 'Connect GitHub to publish this notebook.' };
    const scopes = readScopes();
    const missingScopes = scopes ? REQUIRED_SCOPES.filter(scope => !scopes.includes(scope)) : [];
    return {
        ...base,
        available: true,
        authenticated: true,
        account,
        scopes,
        missingScopes,
        gitCredentials: gitCredentialState(),
        hint: missingScopes.length ? `GitHub needs permission to ${missingScopes.includes('workflow') ? 'update workflows' : 'access repositories'} for publishing.` : null,
    };
}
/** Cached auth state. A fresh `gh` probe runs at most once per TTL unless forced. */
export function getGitHubAuthState({ force = false } = {}) {
    const key = cacheKey();
    const now = Date.now();
    if (!force && cached && cached.key === key) {
        const ttl = cached.state.authenticated ? AUTHENTICATED_TTL_MS : UNAUTHENTICATED_TTL_MS;
        if (now - cached.at < ttl)
            return { ...cached.state, cli: ghCliState() };
    }
    const state = probeAuth();
    cached = { key, at: now, state };
    return state;
}
/**
 * Configure Git to authenticate pushes through gh, only when it is not already
 * configured. Runs after a login Hypercanvas performed; never replaces other helpers.
 */
export function ensureGitCredentials() {
    if (gitCredentialState() === 'configured')
        return 'configured';
    try {
        execFileSync(resolveGhExecutable(), ['auth', 'setup-git', '--hostname', GITHUB_HOST], {
            encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_COMMAND_TIMEOUT_MS, env: ghProcessEnv(),
        });
    }
    catch {
        return 'unknown';
    }
    return gitCredentialState();
}
// ---------------------------------------------------------------------------
// Login session
// ---------------------------------------------------------------------------
const MESSAGES = {
    denied: 'GitHub authorization was denied. Start again when you’re ready to approve.',
    expired: 'The GitHub code expired before it was entered. Start again for a new code.',
    timeout: 'Waiting for GitHub took too long, so the connection was stopped. Start again to retry.',
    permission: 'GitHub connected, but publishing still needs a permission it doesn’t have yet. Grant it to continue.',
    unavailable: 'The GitHub CLI couldn’t be started.',
    environment_token: 'A GitHub token in the environment is already used by gh. Remove GH_TOKEN or GITHUB_TOKEN to sign in here.',
    verification: 'GitHub reported success, but Hypercanvas couldn’t confirm the signed-in account. Recheck and try again.',
    error: 'GitHub CLI sign-in didn’t finish. Review the technical output, then try again.',
};
function classifyFailure(output) {
    if (/GH_TOKEN|GITHUB_TOKEN|environment variable is being used/i.test(output))
        return 'environment_token';
    if (/access_denied|authorization.*denied|denied/i.test(output))
        return 'denied';
    if (/expired_token|device code.*expired|code.*expired|expired/i.test(output))
        return 'expired';
    if (/scope|permission/i.test(output))
        return 'permission';
    return 'error';
}
function publicSnapshot(candidate) {
    return { ...candidate.snapshot, output: [...candidate.snapshot.output] };
}
function update(candidate, patch) {
    candidate.snapshot = { ...candidate.snapshot, ...patch, updatedAt: new Date().toISOString() };
}
function finish(candidate, patch) {
    if (candidate.settled)
        return;
    candidate.settled = true;
    if (candidate.timer)
        clearTimeout(candidate.timer);
    candidate.timer = null;
    update(candidate, patch);
    invalidateGitHubAuthCache();
}
function fail(candidate, reason, message = MESSAGES[reason]) {
    finish(candidate, { status: 'failed', reason, message });
}
function appendOutput(candidate, chunk) {
    candidate.outputBuffer = (candidate.outputBuffer + chunk).slice(-8_192);
    const lines = redactOutput(chunk).split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean);
    const output = [...candidate.snapshot.output, ...lines.map(line => line.slice(0, OUTPUT_LINE_LENGTH))].slice(-OUTPUT_LINE_LIMIT);
    const patch = { output };
    const code = candidate.outputBuffer.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)?.[1];
    if (code && !candidate.snapshot.code) {
        patch.code = code.toUpperCase();
        patch.verificationUri = `https://${GITHUB_HOST}/login/device`;
        patch.status = 'awaiting_browser';
        patch.message = 'Enter this code on GitHub to continue.';
        // gh waits for Enter before opening the default browser; Core owns its stdin.
        if (!candidate.enterSent) {
            candidate.enterSent = true;
            try {
                candidate.child?.stdin?.write('\n');
            }
            catch { /* process already ended */ }
        }
    }
    const opened = candidate.outputBuffer.match(/Failed opening a web browser at (\S+)/i);
    if (opened) {
        patch.browserOpenFailed = true;
        patch.verificationUri = opened[1] ?? patch.verificationUri ?? null;
        patch.message = 'Couldn’t open your browser. Open the GitHub page yourself and enter the code.';
    }
    update(candidate, patch);
}
function killChild(candidate) {
    const child = candidate.child;
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
        return;
    const signal = (name) => {
        try {
            process.kill(-child.pid, name);
        }
        catch {
            try {
                child.kill(name);
            }
            catch { /* already gone */ }
        }
    };
    signal('SIGTERM');
    const force = setTimeout(() => { if (child.exitCode === null && child.signalCode === null)
        signal('SIGKILL'); }, settings.killGraceMs);
    force.unref();
    child.once('exit', () => clearTimeout(force));
}
function onExit(candidate, code) {
    if (candidate.settled)
        return;
    if (code !== 0) {
        fail(candidate, classifyFailure(candidate.outputBuffer));
        return;
    }
    update(candidate, { status: 'verifying', message: 'Confirming your GitHub account…' });
    const auth = getGitHubAuthState({ force: true });
    if (!auth.authenticated) {
        fail(candidate, 'verification');
        return;
    }
    // Success requires gh to report every required scope; an unreadable scope list is not proof.
    if (auth.scopes === null) {
        fail(candidate, 'verification', MESSAGES.verification);
        return;
    }
    if (auth.missingScopes.length) {
        fail(candidate, 'permission');
        return;
    }
    const gitCredentials = ensureGitCredentials();
    invalidateGitHubAuthCache();
    finish(candidate, {
        status: 'succeeded',
        reason: null,
        account: auth.account,
        message: gitCredentials === 'configured'
            ? `Connected as ${auth.account}.`
            : `Connected as ${auth.account}. Git credentials still need setup before pushing.`,
    });
}
/**
 * Spawn the owned gh process. `scopes` is what gh must add: the full required set
 * for a new sign-in, or only the missing scopes when an account is already connected
 * (gh refresh adds scopes to the existing credential; it cannot repair a scope it
 * was never asked for).
 */
function startProcess(candidate, kind, scopes) {
    const requested = scopes.join(',');
    const args = kind === 'refresh'
        ? ['auth', 'refresh', '--hostname', GITHUB_HOST, '--scopes', requested]
        : ['auth', 'login', '--hostname', GITHUB_HOST, '--web', '--git-protocol', 'https', '--scopes', requested];
    const env = ghProcessEnv();
    // The desktop Core runs with BROWSER=none; gh must use the system default browser.
    if (env.BROWSER === 'none')
        delete env.BROWSER;
    let child;
    try {
        child = spawn(resolveGhExecutable(), args, { stdio: ['pipe', 'pipe', 'pipe'], detached: true, env });
    }
    catch {
        fail(candidate, 'unavailable');
        return;
    }
    candidate.child = child;
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => appendOutput(candidate, chunk));
    child.stderr?.on('data', (chunk) => appendOutput(candidate, chunk));
    child.stdin?.on('error', () => { });
    child.on('error', () => fail(candidate, 'unavailable'));
    child.on('exit', (code) => onExit(candidate, code));
    candidate.timer = setTimeout(() => {
        if (candidate.settled)
            return;
        fail(candidate, 'timeout');
        killChild(candidate);
    }, settings.loginTimeoutMs);
    candidate.timer.unref();
}
/** Public login state for a notebook. Another notebook's active session is reported as blocking, not exposed. */
export function getGitHubLogin(notebookRoot) {
    if (!session)
        return { login: null, blocked: false };
    if (session.notebookRoot !== notebookRoot)
        return { login: null, blocked: active(session) };
    return { login: publicSnapshot(session), blocked: false };
}
/** Start (or join) the browser sign-in. Skips entirely when gh is already authenticated. */
export function startGitHubLogin({ notebookRoot }) {
    if (active(session)) {
        if (session.notebookRoot !== notebookRoot) {
            throw publishingError('GH_LOGIN_IN_PROGRESS', 'GitHub sign-in is already in progress for another notebook.', null, 'Finish or cancel it there, then try again.');
        }
        return { skipped: false, reused: true, auth: getGitHubAuthState(), login: publicSnapshot(session) };
    }
    const auth = getGitHubAuthState({ force: true });
    if (!auth.available) {
        throw publishingError('GH_UNAVAILABLE', 'The GitHub CLI (gh) is unavailable.', null, auth.hint ?? 'Install gh: https://cli.github.com/');
    }
    if (auth.offline) {
        throw publishingError('GH_NETWORK_UNAVAILABLE', 'Can’t reach GitHub.', null, 'Check your connection and try again.');
    }
    if (auth.authenticated && auth.missingScopes.length === 0) {
        return { skipped: true, reused: false, auth, login: null };
    }
    const kind = auth.authenticated ? 'refresh' : 'login';
    const now = Date.now();
    const next = {
        notebookRoot,
        child: null,
        timer: null,
        settled: false,
        outputBuffer: '',
        enterSent: false,
        snapshot: {
            id: randomUUID(),
            kind,
            status: 'starting',
            reason: null,
            code: null,
            verificationUri: null,
            browserOpenFailed: false,
            message: 'Starting GitHub sign-in…',
            account: null,
            startedAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + settings.loginTimeoutMs).toISOString(),
            output: [],
        },
    };
    session = next;
    startProcess(next, kind, kind === 'refresh' ? auth.missingScopes : REQUIRED_SCOPES);
    return { skipped: false, reused: false, auth, login: publicSnapshot(next) };
}
/** Cancel the owned sign-in. A stale or foreign session id never cancels the current one. */
export function cancelGitHubLogin({ notebookRoot, sessionId }) {
    if (typeof sessionId !== 'string' || !sessionId) {
        throw publishingError('GH_LOGIN_NOT_FOUND', 'A sign-in session id is required.');
    }
    if (!session || session.snapshot.id !== sessionId || session.notebookRoot !== notebookRoot) {
        throw publishingError('GH_LOGIN_STALE', 'That GitHub sign-in is no longer current.', null, 'Refresh the Publish panel to see the current sign-in.');
    }
    if (!active(session))
        return publicSnapshot(session);
    finish(session, { status: 'cancelled', reason: null, message: 'GitHub sign-in was cancelled.' });
    killChild(session);
    return publicSnapshot(session);
}
/** Drop cached state and re-probe now. */
export function recheckGitHub() {
    invalidateGitHubAuthCache();
    return getGitHubAuthState({ force: true });
}
process.once('exit', () => { if (active(session))
    killChild(session); });
export const __test = {
    settings,
    reset() {
        if (session) {
            if (session.timer)
                clearTimeout(session.timer);
            killChild(session);
        }
        session = null;
        cached = null;
        settings.loginTimeoutMs = LOGIN_TIMEOUT_MS;
        settings.killGraceMs = KILL_GRACE_MS;
    },
    parseScopes,
    classifyFailure,
};
