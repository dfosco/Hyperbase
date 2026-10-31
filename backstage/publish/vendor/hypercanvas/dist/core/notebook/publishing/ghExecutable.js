/**
 * GitHub CLI executable resolution and provisioning handoff.
 *
 * The MyGo (Go) bootstrap discovers a usable existing `gh` or installs an
 * app-managed official CLI, then hands the exact executable to Core:
 *
 *   HYPERCANVAS_GH_PATH      exact `gh` executable discovered/installed by Go
 *   HYPERCANVAS_GH_HANDOFF   JSON file Go keeps current while it provisions
 *                            (`<handoff>.retry` is how Core asks Go to retry)
 *
 * Without the desktop bootstrap (CLI, dev server) Core falls back to `gh` on
 * PATH. Core never installs the CLI itself and never reads GitHub tokens.
 */
import fs from 'node:fs';
import process from 'node:process';
import { publishingError } from './errors.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function executable(path) {
    if (typeof path !== 'string' || !path || !path.startsWith('/'))
        return false;
    try {
        fs.accessSync(path, fs.constants.X_OK);
        return fs.statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function readHandoff() {
    const file = process.env.HYPERCANVAS_GH_HANDOFF;
    if (!file)
        return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return isRecord(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
const text = (value) => typeof value === 'string' && value ? value : null;
/** Resolve the `gh` executable Core must run: Go's exact path, the handoff, then PATH. */
export function resolveGhExecutable() {
    const fromEnvironment = process.env.HYPERCANVAS_GH_PATH;
    if (executable(fromEnvironment))
        return fromEnvironment;
    const handoff = readHandoff();
    if (handoff?.status === 'ready' && executable(handoff.path))
        return handoff.path;
    return 'gh';
}
/** Provisioning/discovery state for the Publish UI, API and CLI. */
export function ghCliState() {
    const retryable = Boolean(process.env.HYPERCANVAS_GH_HANDOFF);
    const environmentPath = process.env.HYPERCANVAS_GH_PATH;
    const handoff = readHandoff();
    const version = text(handoff?.version);
    if (executable(environmentPath)) {
        return { status: 'ready', source: 'environment', path: environmentPath, version, error: null, hint: null, retryable };
    }
    if (handoff?.status === 'ready' && executable(handoff.path)) {
        const source = handoff.source === 'managed' ? 'managed' : 'existing';
        return { status: 'ready', source, path: handoff.path, version, error: null, hint: null, retryable };
    }
    if (handoff?.status === 'installing') {
        return {
            status: 'installing', source: 'none', path: null, version: null, error: null,
            hint: 'Hypercanvas is setting up the GitHub CLI. This can take a minute.', retryable,
        };
    }
    if (handoff?.status === 'failed') {
        return {
            status: 'failed', source: 'none', path: null, version: null,
            error: text(handoff.error) || 'The GitHub CLI could not be set up.',
            hint: 'Check your connection and retry. The rest of Hypercanvas keeps working.', retryable,
        };
    }
    return { status: 'missing', source: 'none', path: null, version: null, error: null, hint: null, retryable };
}
/**
 * Ask the desktop bootstrap to retry provisioning. Unavailable outside the
 * desktop app, where the user must install `gh` themselves.
 */
export function requestGhCliRetry() {
    const file = process.env.HYPERCANVAS_GH_HANDOFF;
    if (!file) {
        throw publishingError('GH_PROVISIONING_UNSUPPORTED', 'This Hypercanvas session cannot install the GitHub CLI.', null, 'Install the GitHub CLI from https://cli.github.com/ and recheck.');
    }
    fs.writeFileSync(`${file}.retry`, `${new Date().toISOString()}\n`, { mode: 0o600 });
    return ghCliState();
}
