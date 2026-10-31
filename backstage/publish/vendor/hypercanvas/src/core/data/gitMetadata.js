import { execFileSync } from 'node:child_process';
/** Read Git from the selected Notebook, including containing repos and worktrees. */
export function readNotebookGitBranch(root) {
    const read = (args, missingRef = false) => {
        try {
            return execFileSync('git', args, {
                cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 2000,
            }).trim() || null;
        }
        catch (error) {
            const failure = error;
            if (missingRef && failure.status === 1)
                return null;
            throw error;
        }
    };
    try {
        if (read(['rev-parse', '--is-inside-work-tree']) !== 'true') {
            return { isRepository: false, branch: null, commit: null, detached: false };
        }
    }
    catch (error) {
        const stderr = String(error.stderr || '');
        if (/not a git repository/i.test(stderr))
            return { isRepository: false, branch: null, commit: null, detached: false };
        throw error;
    }
    const branch = read(['symbolic-ref', '--quiet', '--short', 'HEAD'], true);
    const commit = read(['rev-parse', '--verify', '--quiet', 'HEAD'], true);
    return { isRepository: true, branch, commit, detached: branch === null };
}
/** Read optional Git metadata without replaying a failed Git command's stderr. */
export function readOptionalGitValue(cwd, args) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim() || null;
    }
    catch (error) {
        const stderr = String(error.stderr || '').trim();
        const status = error.status;
        // A standalone Notebook has no Git metadata by design. A missing value,
        // remote, or repository is also an ordinary result for these discoveries.
        if (/not a git repository|no such remote|no value/i.test(stderr))
            return null;
        if (args[0] === 'config' && status === 1 && !stderr)
            return null;
        const reason = stderr || (error instanceof Error ? error.message : String(error));
        console.warn(`[storyboard] Could not read optional Git metadata in ${cwd}: ${reason}`);
        return null;
    }
}
