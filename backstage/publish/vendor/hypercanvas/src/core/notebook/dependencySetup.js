import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
function pathExistsIncludingLinks(target) {
    try {
        fs.lstatSync(target);
        return true;
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code)))
            return false;
        throw error;
    }
}
function canonicalRoot(root) {
    const absolute = path.resolve(root);
    try {
        return fs.realpathSync.native(absolute);
    }
    catch {
        return absolute;
    }
}
export function notebookDependencySessionId(root) {
    return `notebook-dependencies-${createHash('sha256').update(canonicalRoot(root)).digest('hex').slice(0, 20)}`;
}
/** Start at most one first-open install for a canonical Notebook root. */
export function createNotebookDependencySetup({ launch, onFailure = () => { } }) {
    const attempts = new Map();
    function ensure(root) {
        const canonical = canonicalRoot(root);
        const existing = attempts.get(canonical);
        if (existing)
            return existing.promise;
        if (!pathExistsIncludingLinks(path.join(canonical, 'package.json'))
            || pathExistsIncludingLinks(path.join(canonical, 'node_modules'))) {
            return Promise.resolve({ status: 'skipped' });
        }
        const attempt = { status: 'installing', promise: null };
        const promise = Promise.resolve()
            .then(() => launch(canonical, notebookDependencySessionId(canonical)))
            .then(result => {
            if (result?.exitCode !== 0) {
                const output = String(result?.output || '').trim();
                throw new Error(`npm install exited with ${result?.exitCode ?? 'an unknown status'}${output ? `: ${output.slice(-1600)}` : '.'}`);
            }
            attempt.status = 'ready';
            return { status: 'ready' };
        })
            .catch(cause => {
            const error = cause instanceof Error ? cause : new Error(String(cause));
            attempt.status = 'failed';
            attempt.error = error;
            try {
                onFailure({ root: canonical, error, output: error.message });
            }
            catch { /* diagnostics must not hide install failure */ }
            throw error;
        });
        attempt.promise = promise;
        attempts.set(canonical, attempt);
        // Background callers intentionally do not await; the request is awaited
        // later by Notebook-bound execution through wait().
        promise.catch(() => { });
        return promise;
    }
    function wait(root) {
        return ensure(root);
    }
    function status(root) {
        const attempt = attempts.get(canonicalRoot(root));
        return attempt ? { status: attempt.status, ...(attempt.error ? { error: attempt.error.message } : {}) } : { status: 'not-started' };
    }
    return { ensure, wait, status };
}
/** Run the install in a background shell owned by the Notebook's Paseo workspace. */
export async function runNotebookInstallInPaseo(pty, root, sessionId) {
    const created = await pty.create({ sessionId, cwd: root, cols: 120, rows: 32 });
    const reused = Boolean(created && typeof created === 'object' && 'reused' in created && created.reused === true);
    let output = '';
    let finish = null;
    let fail = null;
    const exited = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    const append = (value) => {
        if (typeof value === 'string')
            output += value;
        else if (value instanceof Uint8Array)
            output += Buffer.from(value).toString('utf8');
        else if (value && typeof value === 'object') {
            const record = value;
            if (Array.isArray(record.bytes) || record.bytes instanceof Uint8Array) {
                output += Buffer.from(record.bytes).toString('utf8');
            }
            else if (typeof record.data === 'string' || record.data instanceof Uint8Array || Array.isArray(record.data)) {
                output += Buffer.from(record.data).toString('utf8');
            }
            else if (typeof record.text === 'string')
                output += record.text;
        }
    };
    let subscription = null;
    try {
        subscription = await pty.subscribe(sessionId, {
            onOutput: append,
            onGap: event => {
                const gap = event;
                append(gap?.snapshot?.text ?? gap?.bytes);
            },
            onExit: () => {
                const match = output.match(/__HYPERCANVAS_NPM_INSTALL_EXIT__=(\d+)/);
                finish?.({ exitCode: match ? Number(match[1]) : null, output });
            },
            onError: error => fail?.(error),
        });
        if (!reused) {
            const command = 'npm install; install_status=$?; printf "\\n__HYPERCANVAS_NPM_INSTALL_EXIT__=%s\\n" "$install_status"; exit "$install_status"';
            await pty.writeBytes(sessionId, Buffer.from(`${command}\r`));
        }
        return await exited;
    }
    catch (error) {
        if (!reused)
            await pty.terminate(sessionId).catch(() => { });
        throw error;
    }
    finally {
        subscription?.close();
    }
}
