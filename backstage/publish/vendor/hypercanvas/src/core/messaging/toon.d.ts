/**
 * TOON Wire Format Boundary
 *
 * Thin wrapper around @toon-format/toon for HTTP content negotiation.
 * Used by routes.js to encode/decode TOON at the HTTP boundary.
 * The bus core and JSONL storage remain JSON — TOON is an agent-facing optimization.
 */
/**
 * Determine the response format from the Accept header.
 * @param {import('node:http').IncomingMessage} req
 * @returns {'toon' | 'json'}
 */
export declare function negotiateFormat(req: {
    headers?: {
        accept?: string | undefined;
    } | undefined;
}): 'toon' | 'json';
/**
 * Serialize data for the response based on negotiated format.
 * Falls back to JSON if TOON encoding fails or isn't available.
 *
 * @param {unknown} data
 * @param {'toon' | 'json'} format
 * @returns {Promise<{ body: string, contentType: string }>}
 */
export declare function serializeResponse(data: unknown, format: 'toon' | 'json'): Promise<{
    body: string | undefined;
    contentType: string;
}>;
/**
 * Parse a request body based on Content-Type.
 * Supports application/json and text/toon.
 *
 * @param {string | object} body - Raw body string or already-parsed object
 * @param {string} [contentType]
 * @returns {Promise<unknown>}
 */
export declare function parseRequestBody(body: unknown, contentType?: string): Promise<unknown>;
