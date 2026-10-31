/**
 * Storyboard Core UI Bar — React-based floating toolbar.
 *
 * Mounts the CoreUIBar React component into the DOM.
 * Contains the command menu and mode-specific buttons (workshop, etc.).
 * Uses dynamic import() for the React component to avoid
 * breaking non-React test environments.
 *
 * Usage:
 *   import { mountDevTools } from '../index.js'
 *   mountDevTools() // call once at app startup
 */
export interface DevToolsMountOptions {
    container?: HTMLElement;
    basePath?: string;
    toolbarConfig?: unknown;
    customHandlers?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}
/**
 * Mount the Storyboard Core UI Bar to the DOM.
 * Call once at app startup. Safe to call multiple times (no-ops after first).
 *
 * @param {object} [options]
 * @param {HTMLElement} [options.container=document.body] - Where to mount
 * @param {string} [options.basePath='/'] - Base URL path
 * @param {object} [options.toolbarConfig] - Merged toolbar config
 * @param {Record<string, () => Promise<unknown>>} [options.customHandlers] - Custom tool handlers
 */
export declare function mountDevTools(options?: DevToolsMountOptions): Promise<void>;
/**
 * Remove the Core UI Bar from the DOM.
 */
export declare function unmountDevTools(): Promise<void>;
/**
 * @deprecated Use mountDevTools instead.
 */
export declare function mountFlowDebug(options?: DevToolsMountOptions): Promise<void>;
/**
 * @deprecated Use mountDevTools instead.
 */
export declare function mountSceneDebug(options?: DevToolsMountOptions): Promise<void>;
