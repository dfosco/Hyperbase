/**
 * storyboard pull — Pull latest changes from remote (untracked-safe).
 *
 * Deterministic flow (no AI):
 *   1. Stash uncommitted work (including untracked files)
 *   2. Pull --rebase from origin
 *   3. If conflict: abort rebase, restore stash, inform user
 *   4. If clean: re-apply stash
 *
 * Usage:
 *   npx hypercanvas pull
 *   npx sb pull
 */
export {};
