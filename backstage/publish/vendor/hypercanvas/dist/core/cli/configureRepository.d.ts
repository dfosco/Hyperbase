/**
 * configureRepository — Detect the current GitHub repo via `gh`, compare
 * to `storyboard.config.json`, and offer to update mismatching fields.
 * Optionally commits + pushes the change and prints the GH Pages enable
 * URL.
 *
 * Called from `hypercanvas setup` after the gh-auth step. Designed to be
 * fully idempotent and safe to skip (e.g. when offline, not authed, or
 * the repo identity already matches).
 */
/**
 * Run the repo-configuration flow. Returns silently on any non-fatal
 * skip condition.
 *
 * @param {{ cwd?: string, nonInteractive?: boolean }} [opts]
 */
export declare function configureRepository(opts?: {
    cwd?: string;
    nonInteractive?: boolean;
}): Promise<void>;
