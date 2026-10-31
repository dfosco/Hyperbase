/**
 * storyboard create — Create prototypes, canvases, flows, and pages.
 *
 * Supports both interactive prompts and non-interactive flags.
 * When all required flags are provided, skips prompts entirely.
 * When some flags are provided, prompts only for missing fields.
 *
 * Usage:
 *   storyboard create                                 Interactive picker
 *   storyboard create prototype                       Interactive prototype creation
 *   storyboard create prototype --name my-proto       Non-interactive (or partial)
 *   storyboard create canvas --name my-canvas         Non-interactive (or partial)
 *   storyboard create flow --name default --prototype my-proto
 *   storyboard create page --prototype my-proto --path settings
 */
import { getServerUrl } from './serverUrl.js';
type JsonRecord = Record<string, unknown>;
declare function serverPost(path: string, body: JsonRecord): Promise<JsonRecord>;
declare function ensureDevServer({ quiet }?: {
    quiet?: boolean;
}): Promise<void>;
/**
 * After creation: show URL and open in browser.
 * @param {string} resultPath — e.g. "src/canvas/test.canvas.jsonl" or "src/prototypes/MyProto"
 * @param {'canvas'|'prototype'} type
 */
declare function postCreateFlow(resultPath: string, type: 'canvas' | 'prototype'): Promise<void>;
declare function createFlow(): Promise<undefined>;
declare function createPage(): Promise<undefined>;
declare function createComponent(): Promise<void>;
export { createFlow, createPage, createComponent, ensureDevServer, serverPost, postCreateFlow, getServerUrl };
