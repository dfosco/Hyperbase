/**
 * Public API for comments — fetch, create, reply, resolve, move, delete, reactions.
 *
 * All functions assume comments config has been initialized via initCommentsConfig().
 */
type ApiRecord = Record<string, unknown>;
/**
 * Fetch the discussion for a given route, including all comments and replies.
 * Returns null if no discussion exists for the route.
 * @param {string} route - The route path (e.g. "/Overview")
 * @returns {Promise<object|null>}
 */
export declare function fetchRouteDiscussion(route: string): Promise<ApiRecord | null>;
/**
 * Fetch lightweight comment listing for a route (pins only — no replies, no reactions).
 * Returns null if no discussion exists for the route.
 * @param {string} route - The route path (e.g. "/Overview")
 * @returns {Promise<object|null>}
 */
export declare function fetchRouteCommentsSummary(route: string): Promise<ApiRecord | null>;
/**
 * Fetch full detail for a single comment (replies, reactions, etc.).
 * @param {string} commentId - The GraphQL node ID of the comment
 * @returns {Promise<object|null>}
 */
export declare function fetchCommentDetail(commentId: string): Promise<ApiRecord | null>;
/**
 * Create a new comment on a route. Creates the route discussion if it doesn't exist.
 * @param {string} route - The route path
 * @param {number} x - X coordinate (percentage)
 * @param {number} y - Y coordinate (percentage)
 * @param {string} text - Comment text
 * @returns {Promise<object>} - The created comment
 */
export declare function createComment(route: string, x: number, y: number, text: string): Promise<ApiRecord>;
/**
 * Reply to an existing comment.
 * @param {string} discussionId - The discussion ID
 * @param {string} commentId - The comment ID to reply to
 * @param {string} text - Reply text
 * @returns {Promise<object>}
 */
export declare function replyToComment(discussionId: string, commentId: string, text: string): Promise<ApiRecord>;
/**
 * Resolve a comment by updating its metadata and prepending "(Resolved)" to the text.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body
 * @returns {Promise<object>}
 */
export declare function resolveComment(commentId: string, currentBody: string): Promise<ApiRecord>;
/**
 * Unresolve a comment by removing the resolved flag and "(Resolved)" prefix.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body
 * @returns {Promise<object>}
 */
export declare function unresolveComment(commentId: string, currentBody: string): Promise<ApiRecord>;
/**
 * Edit a comment's text, preserving its metadata.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body (with metadata)
 * @param {string} newText - The new text content
 * @returns {Promise<object>}
 */
export declare function editComment(commentId: string, currentBody: string, newText: string): Promise<ApiRecord>;
/**
 * Edit a reply's text (replies have no metadata).
 * @param {string} replyId - The reply ID
 * @param {string} newText - The new text content
 * @returns {Promise<object>}
 */
export declare function editReply(replyId: string, newText: string): Promise<ApiRecord>;
/**
 * Move a comment to new coordinates.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body
 * @param {number} x - New X coordinate (percentage)
 * @param {number} y - New Y coordinate (percentage)
 * @returns {Promise<object>}
 */
export declare function moveComment(commentId: string, currentBody: string, x: number, y: number): Promise<ApiRecord>;
/**
 * Delete a comment (typically a reply).
 * @param {string} commentId - The comment ID to delete
 * @returns {Promise<void>}
 */
export declare function deleteComment(commentId: string): Promise<void>;
/**
 * Add a reaction to a comment or reply.
 * @param {string} subjectId - The comment/reply ID
 * @param {string} content - Reaction type (e.g. "THUMBS_UP", "HEART")
 * @returns {Promise<void>}
 */
export declare function addReaction(subjectId: string, content: string): Promise<void>;
/**
 * Remove a reaction from a comment or reply.
 * @param {string} subjectId - The comment/reply ID
 * @param {string} content - Reaction type
 * @returns {Promise<void>}
 */
export declare function removeReaction(subjectId: string, content: string): Promise<void>;
/**
 * List all comment discussions in the configured category.
 * @returns {Promise<object[]>}
 */
export declare function listDiscussions(): Promise<ApiRecord[]>;
export {};
