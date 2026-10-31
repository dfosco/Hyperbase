/**
 * Shared CLI helpers for server communication.
 *
 * Lightweight wrappers around fetch() using the resolved server URL.
 * Unlike create.js helpers, these don't depend on @clack/prompts so
 * they can be used in simple/non-interactive CLI commands.
 */
type CliResponse = Record<string, unknown>;
type ParsedArgs = {
    positional: string[];
    flags: Record<string, string | boolean>;
};
/**
 * POST JSON to the dev server.
 * @param {string} path - URL path (e.g. '/_hypercanvas/canvas/widget')
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export declare function post(path: string, body: unknown): Promise<CliResponse>;
/**
 * GET JSON from the dev server.
 * @param {string} path - URL path with query string
 * @returns {Promise<object>} Parsed JSON response
 */
export declare function get(path: string): Promise<CliResponse>;
/**
 * PUT JSON to the dev server.
 * @param {string} path - URL path
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export declare function put(path: string, body: unknown): Promise<CliResponse>;
/**
 * PATCH JSON to the dev server.
 * @param {string} path - URL path
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export declare function patch(path: string, body: unknown): Promise<CliResponse>;
/**
 * DELETE JSON to the dev server.
 * @param {string} path - URL path
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export declare function del(path: string, body: unknown): Promise<CliResponse>;
/**
 * Parse simple CLI args into { positional, flags }.
 */
export declare function parseSimpleArgs(args: string[]): ParsedArgs;
/**
 * Print JSON output and exit.
 */
export declare function jsonOut(data: unknown): void;
/**
 * Print error and exit.
 */
export declare function die(msg: string, code?: number): never;
export {};
