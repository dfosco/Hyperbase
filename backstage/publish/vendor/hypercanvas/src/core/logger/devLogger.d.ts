/**
 * Dev Logger — structured JSONL logging for hypercanvas dev server errors.
 *
 * Writes one JSONL file per day to `.hypercanvas/logs/{YYYY-MM-DD}.jsonl`
 * (legacy Notebooks stay on `.storyboard/logs/`).
 * Automatically enriches log entries with context extracted from request URLs
 * (canvas name, prototype, page, etc.).
 *
 * Usage:
 *   import { createDevLogger } from './logger/devLogger.js'
 *   const logger = createDevLogger({ root, devDomain, branch })
 *   logger.logResponse({ status: 404, method: 'GET', url: '/...', route: 'canvas', error: '...' })
 *   logger.logEvent('warn', 'Something happened', { extra: 'context' })
 */
export interface DevLogContext {
    [key: string]: unknown;
}
export interface DevLogResponseOptions {
    status: number;
    method: string;
    url: string;
    route?: string | null;
    subRoute?: string | null;
    error?: string | null;
    context?: DevLogContext;
}
export interface DevLogEntry extends Record<string, unknown> {
    ts: string;
    level: 'info' | 'warn' | 'error';
    status?: number;
    method?: string;
    url?: string;
    route?: string | null;
    subRoute?: string | null;
    error?: string | null;
    message?: string;
    devDomain: string | null;
    branch: string | null;
    context?: DevLogContext;
}
export interface DevLogger {
    logResponse(options: DevLogResponseOptions): void;
    logEvent(level: DevLogEntry['level'], message: string, context?: DevLogContext): void;
    logsDir: string;
    _extractContext(url: string | null | undefined): RequestContext;
}
export interface DevLoggerOptions {
    root: string;
    devDomain?: string | null;
    branch?: string | null;
    verbose?: boolean;
}
interface RequestContext {
    canvas: string | null;
    prototype: string | null;
    page: string | null;
}
/**
 * Format a Date as YYYY-MM-DD.
 */
declare function dateStamp(date?: Date): string;
/**
 * Extract contextual metadata from a request URL.
 * Parses query params and path segments to find canvas, prototype, and page.
 */
declare function extractContext(url: string | null | undefined): RequestContext;
/**
 * Prune log files older than MAX_AGE_DAYS.
 */
declare function pruneOldLogs(logsDir: string): void;
/**
 * Create a dev logger instance.
 *
 * @param {object} opts
 * @param {string} opts.root — project root directory
 * @param {string} [opts.devDomain] — dev domain from config (e.g. "storyboard-core")
 * @param {string} [opts.branch] — current git branch
 * @param {boolean} [opts.verbose] — also log to console (controlled by dev-logs flag)
 * @returns {{ logResponse: Function, logEvent: Function, logsDir: string }}
 */
export declare function createDevLogger({ root, devDomain, branch, verbose }: DevLoggerOptions): DevLogger;
/**
 * Register the global dev logger instance.
 * Called once during server startup (server-plugin.js configureServer).
 */
export declare function setDevLogger(logger: DevLogger | null): void;
/**
 * Get the global dev logger. Returns a no-op logger if not yet initialized.
 * Safe to call from any server-side module without constructor plumbing.
 */
export declare function devLog(): DevLogger;
export { extractContext, pruneOldLogs, dateStamp };
