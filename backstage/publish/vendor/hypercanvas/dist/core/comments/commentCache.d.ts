/**
 * localStorage cache for comment pin data.
 *
 * Stores lightweight comment listings per route so pins render instantly
 * on repeat visits without hitting the GitHub API.
 */
export interface CachedComment extends Record<string, unknown> {
    id?: string;
    meta?: unknown;
    text?: string;
}
export interface CachedDiscussion extends Record<string, unknown> {
    comments: CachedComment[];
}
export interface PendingComment {
    id: string;
    x: number;
    y: number;
    text: string;
    author: {
        login: string;
        avatarUrl: string;
    };
}
/**
 * Get cached comment listing for a route.
 * Returns null if cache is missing or expired.
 * @param {string} route
 * @returns {object|null} - Cached discussion object (with .comments array)
 */
export declare function getCachedComments(route: string): CachedDiscussion | null;
/**
 * Store comment listing in cache for a route.
 * @param {string} route
 * @param {object} data - Discussion object with .comments array
 */
export declare function setCachedComments(route: string, data: CachedDiscussion): void;
/**
 * Clear cached comments for a specific route.
 * @param {string} route
 */
export declare function clearCachedComments(route: string): void;
/**
 * Save a pending comment that failed to submit.
 * @param {string} route
 * @param {{ id: string, x: number, y: number, text: string, author: object }} comment
 */
export declare function savePendingComment(route: string, comment: PendingComment): void;
/**
 * Get all pending (failed) comments for a route.
 * @param {string} route
 * @returns {Array<{ id: string, x: number, y: number, text: string, author: object }>}
 */
export declare function getPendingComments(route: string): PendingComment[];
/**
 * Remove a pending comment (after successful retry or dismissal).
 * @param {string} route
 * @param {string} pendingId
 */
export declare function removePendingComment(route: string, pendingId: string): void;
