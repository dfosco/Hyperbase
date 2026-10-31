export declare const GH_INSTALL_URL = "https://github.com/cli/cli";
type GitHubEmbedTarget = {
    kind: 'issue' | 'discussion' | 'pull_request' | 'comment';
    parentKind: 'issue' | 'discussion' | 'pull_request';
    owner: string;
    repo: string;
    number: number;
    commentId?: number;
    commentSubKind?: 'issue_comment' | 'review_comment';
    url: string;
};
export declare class GitHubEmbedError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status?: number);
}
/**
 * Parse a GitHub URL to a supported embed target.
 *
 * Supported patterns:
 * - /{owner}/{repo}/issues/{number}
 * - /{owner}/{repo}/discussions/{number}
 * - /{owner}/{repo}/pull/{number}
 * - /{owner}/{repo}/issues/{number}#issuecomment-{id}
 * - /{owner}/{repo}/discussions/{number}#discussioncomment-{id}
 * - /{owner}/{repo}/pull/{number}#issuecomment-{id}    (top-level PR comment)
 * - /{owner}/{repo}/pull/{number}#discussion_r{id}     (inline review comment)
 *
 * @param {string} rawUrl
 * @returns {null | {
 *   kind: 'issue' | 'discussion' | 'pull_request' | 'comment',
 *   parentKind: 'issue' | 'discussion' | 'pull_request',
 *   owner: string,
 *   repo: string,
 *   number: number,
 *   commentId?: number,
 *   commentSubKind?: 'issue_comment' | 'review_comment',
 *   url: string
 * }}
 */
export declare function parseGitHubEmbedUrl(rawUrl: string): GitHubEmbedTarget | null;
export declare function isGitHubEmbedUrl(rawUrl: string): boolean;
export declare function isGhCliAvailable(): boolean;
export declare function fetchGitHubEmbedSnapshot(rawUrl: string): Record<string, unknown>;
export {};
