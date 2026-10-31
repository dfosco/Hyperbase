/**
 * Publication Git operations.
 *
 * Repository ownership (DOCS/publishing.md):
 * - Default mode: the Notebook root IS the repository; `publish/` is a
 *   generated directory inside it, never a nested repository. A repository
 *   above the Notebook root is rejected — a publish never stages or pushes a
 *   parent repository.
 * - External mode: the bound project directory is the repository.
 *
 * Staging respects `.gitignore`; the private `.hypercanvas/` runtime directory
 * is always excluded. Reconciliation pulls and rebases before push; a conflict
 * aborts the rebase, restores tracked and untracked local work, and never
 * pushes. Publishing never force-pushes.
 */
type GitResult = {
    ok: true;
    output: string;
    runtime: 'system' | 'bundled';
};
type RepositoryOptions = {
    repositoryRoot: string;
};
type BranchOptions = RepositoryOptions & {
    branch: string;
    remote?: string;
};
export declare function runGit(cwd: string, args: string[]): GitResult;
/** Repository root containing `dir`, or null when none exists. */
export declare function findRepositoryRoot(dir: string): string | null;
/**
 * Resolve the repository root for a repository mode. Rejects enclosing parent
 * repositories in default mode and nested repositories inside `publish/`.
 */
export declare function resolveRepositoryRoot({ notebookRoot, mode, projectDir }: {
    notebookRoot: string;
    mode: 'default' | 'external';
    projectDir: string;
}): string;
/** Initialize a repository when missing; returns the repository root. */
export declare function ensureRepository({ repositoryRoot, branch }: {
    repositoryRoot: string;
    branch?: string;
}): string;
/**
 * Ensure a commit identity exists. A missing identity gets a repository-local
 * publishing identity; existing configuration is never changed.
 */
export declare function ensureCommitIdentity(repositoryRoot: string): boolean;
/**
 * Stage the publication through the correct repository root. Default mode
 * stages all unignored Notebook content (respecting `.gitignore`) with the
 * private runtime directory explicitly excluded; external mode stages the
 * site project. Git ignore rules decide what user content is public.
 */
export declare function stagePublication({ repositoryRoot }: RepositoryOptions): void;
export declare function hasStagedChanges(repositoryRoot: string): boolean;
/** Commit staged changes; a no-op commit is not an error. */
export declare function commitPublication({ repositoryRoot, message }: RepositoryOptions & {
    message: string;
}): {
    committed: boolean;
};
/** All branch names advertised by a remote (used for ownership checks). */
export declare function remoteBranches({ repositoryRoot, remote }: {
    repositoryRoot: string;
    remote?: string;
}): string[];
/** Whether HEAD resolves to a commit, including when the working tree is dirty. */
export declare function hasCommit(repositoryRoot: string): boolean;
export declare function remoteUrl({ repositoryRoot, remote }: {
    repositoryRoot: string;
    remote?: string;
}): string | null;
/**
 * Safely reconcile with the remote before push: stash uncommitted work
 * (including untracked), fetch, then rebase the local branch onto the remote
 * branch. On conflict: abort the rebase, restore the stash, and throw
 * REMOTE_CONFLICT — nothing is pushed and local work is intact.
 */
export declare function reconcileWithRemote({ repositoryRoot, branch, remote }: BranchOptions): {
    reconciled: boolean;
    reason?: 'no-remote' | 'unborn-local-repository';
    stashed?: boolean;
};
/**
 * Full reconciliation including restoring stashed uncommitted work on
 * success. Kept separate from reconcileWithRemote for testability.
 */
export declare function reconcileAndRestore({ repositoryRoot, branch, remote }: BranchOptions): ReturnType<typeof reconcileWithRemote>;
/**
 * Push the local branch to the remote. Non-fast-forward failures surface as
 * REMOTE_CONFLICT — publishing never force-pushes.
 */
export declare function pushToRemote({ repositoryRoot, branch, remote, setUpstream }: BranchOptions & {
    setUpstream?: boolean;
}): {
    pushed: true;
};
/**
 * Read a file from a remote branch without a checkout (clone verification):
 * returns the text or null when the path does not exist on that ref.
 */
export declare function readFileOnRemote({ repositoryRoot, remote, branch, relativePath }: BranchOptions & {
    relativePath: string;
}): string | null;
/** Fetch a branch into its remote-tracking ref. */
export declare function fetchRemote({ repositoryRoot, remote, branch }: BranchOptions): {
    fetched: true;
} | {
    fetched: false;
    reason: 'branch-not-found';
};
export declare function currentBranch(repositoryRoot: string): string | null;
export declare function stagedFileExists(repositoryRoot: string, relativePath: string): boolean;
export declare const __test: {
    runGit: typeof runGit;
};
export {};
