/**
 * Public API for comments — fetch, create, reply, resolve, move, delete, reactions.
 *
 * All functions assume comments config has been initialized via initCommentsConfig().
 */
import { graphql } from './graphql.js';
import { getCommentsConfig } from './config.js';
import { parseMetadata, serializeMetadata, updateMetadata } from './metadata.js';
import { SEARCH_DISCUSSION, SEARCH_DISCUSSION_LIGHTWEIGHT, GET_COMMENT_DETAIL, GET_CATEGORY_ID, CREATE_DISCUSSION, ADD_COMMENT, ADD_REPLY, UPDATE_COMMENT, DELETE_COMMENT, ADD_REACTION, REMOVE_REACTION, LIST_DISCUSSIONS, } from './queries.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function asRecord(value, label) {
    if (!isRecord(value))
        throw new Error(`Invalid GitHub GraphQL response: expected ${label}`);
    return value;
}
function optionalRecord(value) {
    return isRecord(value) ? value : null;
}
function connectionNodes(owner, key) {
    const connectionValue = owner[key];
    if (connectionValue === undefined || connectionValue === null)
        return [];
    const connection = asRecord(connectionValue, `${key} connection`);
    const nodes = connection.nodes;
    if (nodes === undefined || nodes === null)
        return [];
    if (!Array.isArray(nodes) || !nodes.every(isRecord)) {
        throw new Error(`Invalid GitHub GraphQL response: ${key}.nodes must be an array of objects`);
    }
    return nodes;
}
function commentBody(comment) {
    if (comment.body === undefined || comment.body === null || typeof comment.body === 'string')
        return comment.body;
    throw new Error('Invalid GitHub GraphQL response: comment body must be a string or null');
}
function findDiscussion(data) {
    const root = optionalRecord(data);
    const search = root && optionalRecord(root.search);
    if (!search || !Array.isArray(search.nodes))
        return null;
    return optionalRecord(search.nodes[0]);
}
function requireConfig() {
    const config = getCommentsConfig();
    if (!config)
        throw new Error('Comments are not configured');
    return config;
}
function requireString(value, label) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid GitHub GraphQL response: missing ${label}`);
    }
    return value;
}
function commentFromResult(data, operation) {
    const root = asRecord(data, `${operation} result`);
    const result = asRecord(root[operation], `${operation} result`);
    return asRecord(result.comment, `${operation} comment`);
}
function serializeReplies(comment) {
    const { meta, text } = parseMetadata(commentBody(comment));
    const replies = connectionNodes(comment, 'replies').map((reply) => {
        const { meta: replyMeta, text: replyText } = parseMetadata(commentBody(reply));
        return { ...reply, meta: replyMeta, text: replyText };
    });
    return { ...comment, meta, text, replies };
}
function serializeSummaryComment(comment) {
    const { meta, text } = parseMetadata(commentBody(comment));
    return { ...comment, meta, text };
}
/**
 * Fetch the discussion for a given route, including all comments and replies.
 * Returns null if no discussion exists for the route.
 * @param {string} route - The route path (e.g. "/Overview")
 * @returns {Promise<object|null>}
 */
export async function fetchRouteDiscussion(route) {
    const config = requireConfig();
    const title = `Comments: ${route}`;
    const query = `"${title}" in:title repo:${config.repo.owner}/${config.repo.name}`;
    const data = await graphql(SEARCH_DISCUSSION, { query });
    const discussion = findDiscussion(data);
    if (!discussion)
        return null;
    // Parse metadata from each comment
    const comments = connectionNodes(discussion, 'comments').map(serializeReplies);
    return { ...discussion, comments };
}
/**
 * Fetch lightweight comment listing for a route (pins only — no replies, no reactions).
 * Returns null if no discussion exists for the route.
 * @param {string} route - The route path (e.g. "/Overview")
 * @returns {Promise<object|null>}
 */
export async function fetchRouteCommentsSummary(route) {
    const config = requireConfig();
    const title = `Comments: ${route}`;
    const query = `"${title}" in:title repo:${config.repo.owner}/${config.repo.name}`;
    const data = await graphql(SEARCH_DISCUSSION_LIGHTWEIGHT, { query });
    const discussion = findDiscussion(data);
    if (!discussion)
        return null;
    const comments = connectionNodes(discussion, 'comments').map(serializeSummaryComment);
    return { ...discussion, comments };
}
/**
 * Fetch full detail for a single comment (replies, reactions, etc.).
 * @param {string} commentId - The GraphQL node ID of the comment
 * @returns {Promise<object|null>}
 */
export async function fetchCommentDetail(commentId) {
    const data = await graphql(GET_COMMENT_DETAIL, { id: commentId });
    const root = optionalRecord(data);
    const nodeValue = root?.node;
    if (!nodeValue)
        return null;
    const node = asRecord(nodeValue, 'comment');
    const { meta, text } = parseMetadata(commentBody(node));
    const replies = connectionNodes(node, 'replies').map((reply) => {
        const { meta: replyMeta, text: replyText } = parseMetadata(commentBody(reply));
        return { ...reply, meta: replyMeta, text: replyText };
    });
    const discussion = optionalRecord(node.discussion);
    return { ...node, discussionId: discussion?.id ?? null, meta, text, replies };
}
/**
 * Get the repository ID and discussion category ID.
 * @returns {Promise<{ repositoryId: string, categoryId: string }>}
 */
async function getRepoAndCategoryIds() {
    const config = requireConfig();
    const categorySlug = config.discussions.category.toLowerCase().replace(/\s+/g, '-');
    const data = await graphql(GET_CATEGORY_ID, {
        owner: config.repo.owner,
        name: config.repo.name,
        slug: categorySlug,
    });
    const root = optionalRecord(data);
    const repository = root && optionalRecord(root.repository);
    const repositoryId = repository?.id;
    const directCategory = repository && optionalRecord(repository.discussionCategory);
    let categoryId = directCategory?.id;
    // Fallback: search by name in the list
    if (!categoryId && repository) {
        const categories = optionalRecord(repository.discussionCategories);
        const nodes = categories?.nodes;
        if (Array.isArray(nodes)) {
            const cat = nodes.find((item) => isRecord(item) && item.name === config.discussions.category);
            categoryId = isRecord(cat) ? cat.id : undefined;
        }
    }
    if (typeof repositoryId !== 'string' || typeof categoryId !== 'string' || !repositoryId || !categoryId) {
        throw new Error(`Could not find repository or discussion category "${config.discussions.category}" in ${config.repo.owner}/${config.repo.name}`);
    }
    return { repositoryId, categoryId };
}
/**
 * Create a new comment on a route. Creates the route discussion if it doesn't exist.
 * @param {string} route - The route path
 * @param {number} x - X coordinate (percentage)
 * @param {number} y - Y coordinate (percentage)
 * @param {string} text - Comment text
 * @returns {Promise<object>} - The created comment
 */
export async function createComment(route, x, y, text) {
    let discussion = await fetchRouteDiscussion(route);
    if (!discussion) {
        // Create the route discussion first
        const { repositoryId, categoryId } = await getRepoAndCategoryIds();
        const title = `Comments: ${route}`;
        const body = serializeMetadata({ route, createdAt: new Date().toISOString() }, '');
        const result = asRecord(await graphql(CREATE_DISCUSSION, { repositoryId, categoryId, title, body }), 'create discussion result');
        const creation = asRecord(result.createDiscussion, 'create discussion payload');
        discussion = asRecord(creation.discussion, 'created discussion');
    }
    const discussionId = requireString(discussion.id, 'discussion ID');
    const body = serializeMetadata({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }, text);
    const result = await graphql(ADD_COMMENT, { discussionId, body });
    return commentFromResult(result, 'addDiscussionComment');
}
/**
 * Reply to an existing comment.
 * @param {string} discussionId - The discussion ID
 * @param {string} commentId - The comment ID to reply to
 * @param {string} text - Reply text
 * @returns {Promise<object>}
 */
export async function replyToComment(discussionId, commentId, text) {
    const result = await graphql(ADD_REPLY, { discussionId, replyToId: commentId, body: text });
    return commentFromResult(result, 'addDiscussionComment');
}
/**
 * Resolve a comment by updating its metadata and prepending "(Resolved)" to the text.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body
 * @returns {Promise<object>}
 */
export async function resolveComment(commentId, currentBody) {
    const { meta, text } = parseMetadata(currentBody);
    const newMeta = { ...meta, resolved: true };
    const resolvedText = text.startsWith('(Resolved) ') ? text : `(Resolved) ${text}`;
    const newBody = serializeMetadata(newMeta, resolvedText);
    const result = await graphql(UPDATE_COMMENT, { commentId, body: newBody });
    return commentFromResult(result, 'updateDiscussionComment');
}
/**
 * Unresolve a comment by removing the resolved flag and "(Resolved)" prefix.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body
 * @returns {Promise<object>}
 */
export async function unresolveComment(commentId, currentBody) {
    const { meta, text } = parseMetadata(currentBody);
    const newMeta = { ...meta };
    delete newMeta.resolved;
    const cleanText = text.replace(/^\(Resolved\)\s*/, '');
    const newBody = serializeMetadata(newMeta, cleanText);
    const result = await graphql(UPDATE_COMMENT, { commentId, body: newBody });
    return commentFromResult(result, 'updateDiscussionComment');
}
/**
 * Edit a comment's text, preserving its metadata.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body (with metadata)
 * @param {string} newText - The new text content
 * @returns {Promise<object>}
 */
export async function editComment(commentId, currentBody, newText) {
    const { meta } = parseMetadata(currentBody);
    const newBody = meta ? serializeMetadata(meta, newText) : newText;
    const result = await graphql(UPDATE_COMMENT, { commentId, body: newBody });
    return commentFromResult(result, 'updateDiscussionComment');
}
/**
 * Edit a reply's text (replies have no metadata).
 * @param {string} replyId - The reply ID
 * @param {string} newText - The new text content
 * @returns {Promise<object>}
 */
export async function editReply(replyId, newText) {
    const result = await graphql(UPDATE_COMMENT, { commentId: replyId, body: newText });
    return commentFromResult(result, 'updateDiscussionComment');
}
/**
 * Move a comment to new coordinates.
 * @param {string} commentId - The comment ID
 * @param {string} currentBody - The current comment body
 * @param {number} x - New X coordinate (percentage)
 * @param {number} y - New Y coordinate (percentage)
 * @returns {Promise<object>}
 */
export async function moveComment(commentId, currentBody, x, y) {
    const newBody = updateMetadata(currentBody, {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
    });
    const result = await graphql(UPDATE_COMMENT, { commentId, body: newBody });
    return commentFromResult(result, 'updateDiscussionComment');
}
/**
 * Delete a comment (typically a reply).
 * @param {string} commentId - The comment ID to delete
 * @returns {Promise<void>}
 */
export async function deleteComment(commentId) {
    await graphql(DELETE_COMMENT, { commentId });
}
/**
 * Add a reaction to a comment or reply.
 * @param {string} subjectId - The comment/reply ID
 * @param {string} content - Reaction type (e.g. "THUMBS_UP", "HEART")
 * @returns {Promise<void>}
 */
export async function addReaction(subjectId, content) {
    await graphql(ADD_REACTION, { subjectId, content });
}
/**
 * Remove a reaction from a comment or reply.
 * @param {string} subjectId - The comment/reply ID
 * @param {string} content - Reaction type
 * @returns {Promise<void>}
 */
export async function removeReaction(subjectId, content) {
    await graphql(REMOVE_REACTION, { subjectId, content });
}
/**
 * List all comment discussions in the configured category.
 * @returns {Promise<object[]>}
 */
export async function listDiscussions() {
    const config = requireConfig();
    const { categoryId } = await getRepoAndCategoryIds();
    const data = await graphql(LIST_DISCUSSIONS, {
        owner: config.repo.owner,
        name: config.repo.name,
        categoryId,
    });
    const root = optionalRecord(data);
    const repository = root && optionalRecord(root.repository);
    const discussions = repository && optionalRecord(repository.discussions);
    const nodes = discussions?.nodes;
    if (nodes === undefined || nodes === null)
        return [];
    if (!Array.isArray(nodes) || !nodes.every(isRecord)) {
        throw new Error('Invalid GitHub GraphQL response: discussions.nodes must be an array of objects');
    }
    return nodes;
}
