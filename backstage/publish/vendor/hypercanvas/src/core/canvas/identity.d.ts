/**
 * Canvas Identity — path-based canvas ID utilities.
 *
 * Canonical canvas IDs are normalized relative paths derived from the file
 * location. They uniquely identify a canvas even when two canvases share the
 * same basename in different folders.
 *
 * Format examples:
 *   src/canvas/overview.canvas.jsonl                  → "overview"
 *   src/canvas/design.folder/overview.canvas.jsonl    → "design/overview"
 *   src/canvas/design.folder/sub.folder/a.canvas.jsonl → "design/sub/a"
 *   src/prototypes/Main/board.canvas.jsonl            → "proto:Main/board"
 *
 * Canvases under src/canvas/ get plain IDs; those under src/prototypes/ get
 * a "proto:" prefix so the two namespaces never collide.
 *
 * Legacy IDs (bare names like "overview") remain supported as aliases when
 * they resolve to exactly one canvas.
 *
 * @module canvas/identity
 */
/**
 * Convert a relative file path to a canonical canvas ID.
 *
 * @param {string} relPath — path relative to project root
 * @returns {string} canonical canvas ID
 */
export declare function toCanvasId(relPath: string): string;
/**
 * Parse a canvas ID into its segments.
 *
 * @param {string} id — canonical canvas ID
 * @returns {{ namespace: 'canvas' | 'prototype', segments: string[], name: string }}
 */
export declare function parseCanvasId(id: string): {
    namespace: 'canvas' | 'prototype';
    segments: string[];
    name: string;
};
/**
 * Extract the basename from a canvas ID (the last segment).
 * Useful for backward-compatible lookups.
 *
 * @param {string} id
 * @returns {string}
 */
export declare function canvasIdBasename(id: string): string;
/**
 * Check whether an ID is a legacy bare name (no path segments, no namespace prefix).
 *
 * @param {string} id
 * @returns {boolean}
 */
export declare function isLegacyCanvasId(id: string): boolean;
/**
 * Known consumers of canvas identity that must be updated when migrating
 * from basename-only to path-based IDs. This inventory is used by downstream
 * slices to track migration completeness.
 */
export declare const CANVAS_IDENTITY_CONSUMERS: string[];
