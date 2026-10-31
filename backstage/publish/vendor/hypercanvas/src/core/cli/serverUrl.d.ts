export declare function getServerUrl(): string;
/**
 * Resolve the Vite base path used to serve the app. Priority:
 *   1. `VITE_BASE_PATH` env var (matches vite.config.js convention)
 *   2. `basePath` key in storyboard.config.json
 *   3. `/` (Vite default)
 *
 * Always returns a path starting and ending with `/`.
 */
export declare function resolveBasePath(cwd?: string): string;
