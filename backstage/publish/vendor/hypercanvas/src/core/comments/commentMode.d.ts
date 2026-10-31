/**
 * Comment mode state — manages the toggle between normal and comment mode.
 *
 * When active: cursor changes to crosshair, comment pins are visible,
 * clicking places a new comment.
 */
/**
 * Check whether comment mode is currently active.
 */
export declare function isCommentModeActive(): boolean;
/**
 * Toggle comment mode on/off.
 * Only activates if comments are enabled and user is authenticated.
 * @returns {boolean} The new state
 */
export declare function toggleCommentMode(): boolean;
/**
 * Explicitly set comment mode.
 * @param {boolean} active
 */
export declare function setCommentMode(active: boolean): void;
/**
 * Subscribe to comment mode changes.
 * @param {(active: boolean) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export declare function subscribeToCommentMode(callback: (active: boolean) => void): () => boolean;
