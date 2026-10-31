/**
 * Guard and append canvas JSONL events without replaying the whole stream.
 * The baseline record determines the supported format version. The scanner
 * reads only through the first complete JSON object, including objects that
 * span multiple filesystem chunks.
 */
/** Verify the persisted baseline format before mutating its event stream. */
export declare function assertCanvasWritable(filePath: string): void;
/** Refresh the cached baseline identity after a successful append or replace. */
export declare function rememberCanvasFormat(filePath: string): void;
/** Check the baseline guard, then append a validated JSONL event. */
export declare function appendCanvasEventRaw(filePath: string, event: unknown): void;
