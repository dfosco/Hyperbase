/**
 * Shared CLI helpers for server communication.
 *
 * Lightweight wrappers around fetch() using the resolved server URL.
 * Unlike create.js helpers, these don't depend on @clack/prompts so
 * they can be used in simple/non-interactive CLI commands.
 */
import { getServerUrl } from './serverUrl.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function responseError(data, fallback) {
    if (!isRecord(data))
        return fallback;
    const error = data.error;
    if (isRecord(error) && typeof error.message === 'string')
        return error.message;
    if (typeof error === 'string')
        return error;
    return fallback;
}
async function requestJson(urlPath, method, body) {
    const base = getServerUrl();
    const res = await fetch(`${base}${urlPath}`, {
        method,
        ...(body === undefined ? {} : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        signal: AbortSignal.timeout(15000),
    });
    const parsed = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(responseError(parsed, `${res.status} ${res.statusText}`));
    return isRecord(parsed) ? parsed : {};
}
/**
 * POST JSON to the dev server.
 * @param {string} path - URL path (e.g. '/_hypercanvas/canvas/widget')
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export async function post(path, body) {
    return requestJson(path, 'POST', body);
}
/**
 * GET JSON from the dev server.
 * @param {string} path - URL path with query string
 * @returns {Promise<object>} Parsed JSON response
 */
export async function get(path) {
    return requestJson(path, 'GET');
}
/**
 * PUT JSON to the dev server.
 * @param {string} path - URL path
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export async function put(path, body) {
    return requestJson(path, 'PUT', body);
}
/**
 * PATCH JSON to the dev server.
 * @param {string} path - URL path
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export async function patch(path, body) {
    return requestJson(path, 'PATCH', body);
}
/**
 * DELETE JSON to the dev server.
 * @param {string} path - URL path
 * @param {object} body - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
export async function del(path, body) {
    return requestJson(path, 'DELETE', body);
}
/**
 * Parse simple CLI args into { positional, flags }.
 */
export function parseSimpleArgs(args) {
    const result = { positional: [], flags: {} };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === undefined)
            continue;
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                result.flags[key] = next;
                i++;
            }
            else {
                result.flags[key] = true;
            }
        }
        else if (arg.startsWith('-') && arg.length === 2) {
            const key = arg.slice(1);
            const next = args[i + 1];
            if (next !== undefined && !next.startsWith('-')) {
                result.flags[key] = next;
                i++;
            }
            else {
                result.flags[key] = true;
            }
        }
        else {
            result.positional.push(arg);
        }
    }
    return result;
}
/**
 * Print JSON output and exit.
 */
export function jsonOut(data) {
    console.log(JSON.stringify(data, null, 2));
}
/**
 * Print error and exit.
 */
export function die(msg, code = 1) {
    console.error(`Error: ${msg}`);
    process.exit(code);
}
