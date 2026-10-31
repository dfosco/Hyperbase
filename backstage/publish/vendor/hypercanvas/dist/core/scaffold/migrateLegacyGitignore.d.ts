/**
 * Migrate legacy ad-hoc `.gitignore` blocks (written by setup.js lines 401–431
 * pre-0.6.10, or copied from the pre-fragment `scaffold/gitignore`) into the
 * new fragment-marker form so subsequent scaffolds keep them in sync via the
 * fragments system.
 *
 * Two legacy forms are handled:
 *
 *   1. The setup.js banner (single trailing block):
 *
 *        # Storyboard: runtime state (gitignored) + private tilde-prefixed files
 *        .storyboard/
 *        src/canvas/images/~*
 *        ... etc.
 *
 *   2. The old scaffold/gitignore split form (two separate blocks):
 *
 *        # Runtime/transient state (per-machine, per-session)
 *        .storyboard/agent-sessions/
 *        ... etc.
 *
 *        # Private canvas images (tilde prefix = not committed)
 *        src/canvas/images/~*
 *        ... etc.
 *
 * After migration both end up as:
 *
 *        # <!-- storyboard:scaffold/gitignore:runtime-state --start-->
 *        ... (library-managed body)
 *        # <!-- storyboard:scaffold/gitignore:runtime-state --end-->
 *
 * Idempotent — if the file already contains the marker, leave it alone.
 */
/**
 * Detect + rewrite legacy block(s) in a `.gitignore` text.
 *
 * @param {string} text
 * @returns {{ text: string, migrated: boolean }}
 */
export declare function migrateLegacyGitignore(text: string): {
    text: string;
    migrated: boolean;
};
/**
 * Apply the migration to an on-disk `.gitignore`. Returns true if the file
 * was rewritten. Safe to call when the file doesn't exist (returns false).
 *
 * @param {string} gitignorePath
 * @returns {boolean}
 */
export declare function migrateLegacyGitignoreFile(gitignorePath: string): boolean;
/**
 * Remove storyboard-managed orphan lines that live outside the runtime-state
 * marker block. Idempotent — once a client is clean, this is a no-op.
 *
 * @param {string} text
 * @returns {{ text: string, cleaned: boolean }}
 */
export declare function cleanupOrphanedGitignore(text: string): {
    text: string;
    cleaned: boolean;
};
/**
 * Apply orphan cleanup to an on-disk `.gitignore`. Returns true if rewritten.
 *
 * @param {string} gitignorePath
 * @returns {boolean}
 */
export declare function cleanupOrphanedGitignoreFile(gitignorePath: string): boolean;
