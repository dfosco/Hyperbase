/**
 * Comments configuration — load and validate storyboard.config.json
 *
 * The config is passed in at app startup via initCommentsConfig().
 * This mirrors the core init() pattern.
 */
interface CommentsConfigInput {
    comments?: {
        discussions?: {
            category?: string | null;
        } | null;
    } | null;
    repository?: {
        owner?: string | null;
        name?: string | null;
    } | null;
}
interface CommentsConfigOptions {
    basePath?: string;
}
export interface CommentsConfig {
    repo: {
        owner: string;
        name: string;
    };
    discussions: {
        category: string;
    };
    basePath: string;
}
/**
 * Initialize comments config from storyboard.config.json contents.
 * @param {object} rawConfig - The parsed storyboard.config.json object
 * @param {object} [options] - Additional options
 * @param {string} [options.basePath] - Base URL path for filtering comments (e.g. "/storyboard-source/")
 */
export declare function initCommentsConfig(rawConfig: CommentsConfigInput | null | undefined, options?: CommentsConfigOptions): void;
/**
 * Get the current comments config. Returns null if not configured.
 */
export declare function getCommentsConfig(): CommentsConfig | null;
/**
 * Check whether the comments system is enabled (config was provided and valid).
 */
export declare function isCommentsEnabled(): boolean;
export {};
