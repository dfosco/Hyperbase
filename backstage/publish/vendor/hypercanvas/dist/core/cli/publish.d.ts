/**
 * storyboard publish — Push local commits to the remote branch (untracked-safe).
 *
 * Deterministic flow (no AI):
 *   1. Stash uncommitted work (including untracked files)
 *   2. Pull --rebase from origin (stay up to date)
 *   3. If conflict: abort rebase, restore stash, inform user
 *   4. Push to origin
 *   5. Re-apply stash
 *
 * Usage:
 *   npx hypercanvas publish
 *   npx sb publish
 */
export {};
