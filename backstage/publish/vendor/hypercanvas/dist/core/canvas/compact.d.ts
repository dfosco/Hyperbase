/**
 * Canvas JSONL Compaction
 *
 * Replays the event stream, then rewrites the file as a single
 * `canvas_created` event containing the current materialized state.
 * This eliminates redundant history (widgets_replaced, etc.) that
 * bloats the file over time.
 *
 * Threshold: files over 500 KB are compacted.
 */
interface CanvasFile {
    name: string;
    filePath: string;
    size: number;
}
interface CompactOptions {
    force?: boolean;
}
interface CompactResult {
    compacted: boolean;
    before: number;
    after: number;
}
interface CompactedFile {
    name: string;
    before: number;
    after: number;
}
/**
 * Find all .canvas.jsonl files under src/canvas/ in the given root.
 * @param {string} root - Project root directory
 * @returns {{ name: string, filePath: string, size: number }[]}
 */
export declare function findCanvasFiles(root: string): CanvasFile[];
/**
 * Compact a single .canvas.jsonl file if it exceeds the threshold.
 * @param {string} filePath - Absolute path to the JSONL file
 * @param {{ force?: boolean }} options
 * @returns {{ compacted: boolean, before: number, after: number }}
 */
export declare function compactCanvas(filePath: string, { force }?: CompactOptions): CompactResult;
/**
 * Compact all canvas files that exceed the threshold.
 * @param {string} root - Project root directory
 * @param {{ force?: boolean }} options
 * @returns {{ name: string, before: number, after: number }[]}
 */
export declare function compactAll(root: string, { force }?: CompactOptions): CompactedFile[];
export {};
