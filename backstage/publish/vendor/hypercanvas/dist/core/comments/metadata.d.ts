/**
 * Metadata parser/serializer for comment body metadata blocks.
 *
 * Format: <!-- sb-meta {"x":45.2,"y":30.1} -->
 *
 * Embedded as an HTML comment at the start of the Discussion comment body.
 */
/**
 * Parse metadata from a comment body string.
 * @param {string} body - The full comment body
 * @returns {{ meta: object|null, text: string }} - Parsed meta and remaining text
 */
export interface ParsedMetadata {
    meta: unknown | null;
    text: string;
}
export type CommentMetadata = Record<string, unknown>;
export declare function parseMetadata(body: string | null | undefined): ParsedMetadata;
/**
 * Serialize metadata into a comment body string.
 * @param {object} meta - Metadata object (e.g. { x: 45.2, y: 30.1 })
 * @param {string} text - The comment text content
 * @returns {string} - Full comment body with embedded metadata
 */
export declare function serializeMetadata(meta: unknown, text: string): string;
/**
 * Update metadata in an existing comment body, preserving the text.
 * @param {string} body - The existing comment body
 * @param {object} updates - Fields to merge into the existing metadata
 * @returns {string} - Updated comment body
 */
export declare function updateMetadata(body: string, updates: CommentMetadata): string;
