/**
 * gh — Thin wrappers around the GitHub CLI for storyboard setup.
 *
 * All helpers are best-effort: they return `null` (or a similar empty
 * shape) instead of throwing when `gh` is missing, the user isn't logged
 * in, or the current directory isn't a GitHub repo. Setup uses that to
 * skip gracefully without breaking the flow.
 */
type GitHubRepository = {
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
};
type PagesInfo = {
    url: string | null;
    source: unknown;
    buildType: unknown;
};
/** Is the `gh` CLI on PATH? */
export declare function ghInstalled(): boolean;
/** Is the user logged in to `gh`? */
export declare function ghAuthed(): boolean;
/**
 * Detect the current repository via `gh repo view`.
 * Returns `{ owner, name, url, defaultBranch }` or `null` on any failure
 * (no remote, not a GitHub repo, not authed, gh missing, etc.).
 */
export declare function detectRepo(cwd?: string): GitHubRepository | null;
/**
 * Look up whether GitHub Pages is enabled for the repo, and where it is
 * being served from. Returns `{ url, source }` on success, or `null` on
 * any failure (Pages not enabled, no permission, etc.).
 */
export declare function getPagesInfo(owner: string, name: string): PagesInfo | null;
/**
 * Build the canonical GitHub Pages URL for a project repo.
 * Special-cases user/org Pages repos (`<owner>.github.io`) to omit the
 * trailing repo-name segment, matching GitHub's actual routing.
 */
export declare function defaultPagesUrl(owner: string, name: string): string;
/** Pages settings URL — where the user enables/configures Pages. */
export declare function pagesSettingsUrl(owner: string, name: string): string;
export {};
