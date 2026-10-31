import { createHash } from 'node:crypto';
/** Compute the SHA-256 revision used by Storyboard source read/edit commands. */
export function getStoryboardSourceRevision(source) {
    return createHash('sha256').update(source, 'utf8').digest('hex');
}
/** Parse an untrusted source revision received from a command boundary. */
export function parseStoryboardSourceRevision(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new TypeError('Storyboard source revision must be a 64-character SHA-256 digest');
    }
    return value.toLowerCase();
}
//# sourceMappingURL=source-revision.js.map