/**
 * userState — Per-user local state for the current repo, stored in
 * the runtime directory `.hypercanvas/.user.json` (gitignored; legacy `.storyboard/.user.json` still read).
 *
 * This is a free-form key/value bag for things that should persist across
 * runs but never be committed:
 *   - setupVersion   (string) — @dfosco/hypercanvas version setup was last
 *     run against. Compared against the installed version on `npm run dev`
 *     to decide whether scaffolding needs to re-run.
 *   - setupRanAt     (ISO date) — last setup timestamp.
 *   - … future:        onboarded, username, lastSeenChangelog, etc.
 */
type UserState = Record<string, unknown>;
export declare function userStatePath(cwd?: string): string;
export declare function readUserState(cwd?: string): UserState;
export declare function writeUserState(patch: UserState, cwd?: string): UserState;
/**
 * Read the installed @dfosco/hypercanvas package version, or null if not
 * resolvable (e.g. running from a worktree without node_modules).
 */
export declare function getInstalledStoryboardVersion(cwd?: string): string | null;
/**
 * Decide whether `hypercanvas setup` should run before `dev`.
 * Returns null when up-to-date, or { reason, ... } otherwise.
 */
export declare function setupNeeded(cwd?: string): {
    reason: 'first-run';
    current: string | null;
} | {
    reason: 'version-changed';
    from: string;
    to: string;
} | null;
export {};
