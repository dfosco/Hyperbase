/**
 * Barrel exports for the comments system.
 */
export { initCommentsConfig, getCommentsConfig, isCommentsEnabled } from './config.js';
export { getToken, setToken, clearToken, getCachedUser, validateToken, isAuthenticated } from './auth.js';
export { isCommentModeActive, toggleCommentMode, setCommentMode, subscribeToCommentMode } from './commentMode.js';
export { parseMetadata, serializeMetadata, updateMetadata } from './metadata.js';
export { fetchRouteDiscussion, fetchRouteCommentsSummary, fetchCommentDetail, createComment, replyToComment, resolveComment, unresolveComment, editComment, editReply, moveComment, deleteComment, addReaction, removeReaction, listDiscussions, } from './api.js';
export { getCachedComments, setCachedComments, clearCachedComments, savePendingComment, getPendingComments, removePendingComment } from './commentCache.js';
export { saveDraft, getDraft, clearDraft, composerDraftKey, replyDraftKey } from './commentDrafts.js';
export { graphql } from './graphql.js';
export type { CommentsConfig } from './config.js';
export type { CachedCommentUser, AuthenticatedCommentUser } from './auth.js';
export type { CommentDraft } from './commentDrafts.js';
export type { CachedComment, CachedDiscussion, PendingComment } from './commentCache.js';
export type { CommentMetadata, ParsedMetadata } from './metadata.js';
export type { GraphqlOptions } from './graphql.js';
