/**
 * Canvas write guard — coordinates the canvas server with Vite's file watcher
 * to prevent duplicate HMR events.
 *
 * When the canvas server writes to a .canvas.jsonl file, it immediately pushes
 * an HMR event via pushCanvasUpdate(). Vite's file watcher also detects the
 * change ~100-500ms later and the data plugin sends a second HMR event. This
 * duplicate event can cause visible rollbacks when the client has made new edits
 * in the intervening window.
 *
 * The guard tracks files currently being written by the canvas server. The data
 * plugin checks this before sending watcher-triggered HMR events and skips them
 * if the server has already pushed.
 *
 * Uses globalThis with a Symbol key to guarantee the same Map instance is shared
 * across all import paths (e.g., relative imports from server.js vs package
 * imports from data-plugin.js).
 */
/**
 * Atomic canvas replacement writes a UUID-named sibling before renaming it to
 * the final .canvas.jsonl path. Watchers must ignore only that staging file;
 * the rename to the final path still carries the durable document update.
 */
export declare function isAtomicCanvasStagingFile(filePath: string): boolean;
/**
 * Mark a file as being written by the canvas server.
 * Call before appendEvent / writeFileSync.
 */
export declare function markCanvasWrite(filePath: string): void;
/**
 * Unmark a file after the watcher has had time to fire.
 * Call via setTimeout after the write + push completes.
 */
export declare function unmarkCanvasWrite(filePath: string): void;
/**
 * Check if a file is currently being written by the canvas server.
 * The data plugin uses this to skip duplicate watcher-triggered HMR events.
 */
export declare function isCanvasWriteInFlight(filePath: string): boolean;
export declare const canvasWritesInFlight: Map<string, number>;
