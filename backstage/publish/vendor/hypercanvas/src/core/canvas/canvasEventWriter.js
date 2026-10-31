/**
 * Guard and append canvas JSONL events without replaying the whole stream.
 * The baseline record determines the supported format version. The scanner
 * reads only through the first complete JSON object, including objects that
 * span multiple filesystem chunks.
 */
import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { assertSupportedCanvasFormat } from './canvasEvents.js';
import { serializeEvent } from './materializer.js';
const canvasFormatCache = new Map();
function fileIdentity(stat) {
    return `${stat.dev}:${stat.ino}`;
}
/** Verify the persisted baseline format before mutating its event stream. */
export function assertCanvasWritable(filePath) {
    const stat = fs.statSync(filePath);
    const identity = fileIdentity(stat);
    const cached = canvasFormatCache.get(filePath);
    if (cached?.identity === identity && cached.ctimeMs === stat.ctimeMs)
        return;
    const fd = fs.openSync(filePath, 'r');
    const decoder = new TextDecoder();
    const parts = [];
    let objectStarted = false;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let record = null;
    try {
        const bytes = Buffer.alloc(16 * 1024);
        while (true) {
            const count = fs.readSync(fd, bytes, 0, bytes.length, null);
            if (count === 0)
                break;
            const chunk = decoder.decode(bytes.subarray(0, count), { stream: true });
            let segmentStart = -1;
            for (let i = 0; i < chunk.length; i++) {
                const ch = chunk[i];
                if (!objectStarted) {
                    if (ch !== '{')
                        continue;
                    objectStarted = true;
                    depth = 1;
                    segmentStart = i;
                    continue;
                }
                if (inString) {
                    if (escaped)
                        escaped = false;
                    else if (ch === '\\')
                        escaped = true;
                    else if (ch === '"')
                        inString = false;
                }
                else if (ch === '"') {
                    inString = true;
                }
                else if (ch === '{') {
                    depth++;
                }
                else if (ch === '}') {
                    depth--;
                    if (depth === 0) {
                        parts.push(chunk.slice(segmentStart >= 0 ? segmentStart : 0, i + 1));
                        record = JSON.parse(parts.join(''));
                        break;
                    }
                }
            }
            if (record)
                break;
            if (objectStarted)
                parts.push(chunk.slice(segmentStart >= 0 ? segmentStart : 0));
        }
    }
    finally {
        fs.closeSync(fd);
    }
    if (record)
        assertSupportedCanvasFormat([record]);
    canvasFormatCache.set(filePath, { identity, ctimeMs: stat.ctimeMs });
}
/** Refresh the cached baseline identity after a successful append or replace. */
export function rememberCanvasFormat(filePath) {
    const stat = fs.statSync(filePath);
    canvasFormatCache.set(filePath, {
        identity: fileIdentity(stat),
        ctimeMs: stat.ctimeMs,
    });
}
/** Check the baseline guard, then append a validated JSONL event. */
export function appendCanvasEventRaw(filePath, event) {
    assertCanvasWritable(filePath);
    fs.appendFileSync(filePath, `${serializeEvent(event)}\n`, 'utf-8');
    rememberCanvasFormat(filePath);
}
