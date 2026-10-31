/**
 * localStorage persistence for comment drafts.
 *
 * Saves in-progress comment text so it survives window close/reopen.
 * Each draft is a structured entry with a type discriminator:
 *   - { type: 'comment', text }  — top-level comment (keyed by route)
 *   - { type: 'reply',   text }  — reply to an existing thread (keyed by comment ID)
 */
export interface CommentDraft {
    type: 'comment' | 'reply';
    text: string;
}
/**
 * Save a draft entry.
 * @param {string} key - Storage key (use composerDraftKey / replyDraftKey)
 * @param {{ type: string, text: string }} draft
 */
export declare function saveDraft(key: string, draft: CommentDraft): void;
/**
 * Get a draft entry by key. Returns null if not found.
 * @param {string} key
 * @returns {{ type: string, text: string } | null}
 */
export declare function getDraft(key: string): CommentDraft | null;
/**
 * Clear a draft entry.
 * @param {string} key
 */
export declare function clearDraft(key: string): void;
/** Key for a top-level comment draft on a given route. */
export declare function composerDraftKey(route: string): string;
/** Key for a reply draft on a given comment thread. */
export declare function replyDraftKey(commentId: string): string;
