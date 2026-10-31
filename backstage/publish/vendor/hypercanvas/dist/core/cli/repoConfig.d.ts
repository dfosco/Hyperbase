/**
 * repoConfig — Read & write the `repository`/`prodDomain` fields in the
 * application config (`hypercanvas.config.json`, legacy
 * `storyboard.config.json` keeps working) without disturbing formatting,
 * comments, or unrelated keys.
 *
 * Uses jsonc-parser's `modify` + `applyEdits` so the user's preferred
 * indent style (tabs vs spaces) and key order are preserved.
 */
type RepoConfig = Record<string, unknown>;
type RepoUpdate = {
    path: Array<string | number>;
    value: string;
    label: string;
    from: string;
};
/**
 * Return parsed config (best-effort) and the raw source text of whichever
 * config file already exists.
 * Returns `{ config: {}, raw: '', exists: false }` when no config is present.
 */
export declare function readRepoConfig(cwd?: string): {
    file: string;
    exists: boolean;
    raw: string;
    config: RepoConfig;
};
/**
 * Compute the diff between the desired repo identity and what's currently
 * in the application config file. Only returns keys that need to change.
 *
 * @param {object} current  parsed config
 * @param {object} desired  { owner, name, prodDomain }
 * @returns Updates that change the current identity fields.
 */
export declare function diffRepoIdentity(current: RepoConfig, desired: {
    owner?: string;
    name?: string;
    prodDomain?: string;
}): RepoUpdate[];
/**
 * Write a set of pre-validated updates back to the application config file
 * (whichever name already exists), preserving formatting. Returns the
 * updated raw source text (also persisted to disk).
 */
export declare function writeRepoConfig(cwd: string, updates: RepoUpdate[]): string;
export {};
