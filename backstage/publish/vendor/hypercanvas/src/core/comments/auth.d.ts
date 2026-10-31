/**
 * PAT authentication for comments.
 *
 * Stores and retrieves the GitHub PAT from localStorage.
 * Provides validation by fetching the authenticated user and
 * verifying the token can access repository discussions.
 */
export interface CachedCommentUser {
    login: string;
    avatarUrl: string;
    scopes?: string[];
}
export interface AuthenticatedCommentUser extends CachedCommentUser {
    scopes: string[];
}
/**
 * Get the stored PAT token.
 * @returns {string|null}
 */
export declare function getToken(): string | null;
/**
 * Store a PAT token.
 * @param {string} token
 */
export declare function setToken(token: string): void;
/**
 * Remove the stored PAT token and user.
 */
export declare function clearToken(): void;
/**
 * Get the cached authenticated user info.
 * @returns {{ login: string, avatarUrl: string }|null}
 */
export declare function getCachedUser(): CachedCommentUser | null;
/**
 * Validate a PAT by fetching the authenticated user from GitHub,
 * then probing the GraphQL API to verify the token can access
 * the configured repository's discussions.
 *
 * Caches the user in localStorage on success.
 * @param {string} token - GitHub PAT to validate
 * @returns {Promise<{ login: string, avatarUrl: string }>}
 */
export declare function validateToken(token: string): Promise<AuthenticatedCommentUser>;
/**
 * Check whether the user is currently authenticated.
 * @returns {boolean}
 */
export declare function isAuthenticated(): boolean;
