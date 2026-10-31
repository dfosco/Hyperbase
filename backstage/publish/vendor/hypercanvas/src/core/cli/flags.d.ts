/**
 * Shared CLI flag parser — converts argv into a validated flags object.
 *
 * Supports:
 *   --key value       string/number value
 *   --key=value       equals-separated
 *   --bool            boolean true
 *   --no-bool         boolean false (negation prefix)
 *   --key a --key b   repeated flags → array
 *
 * Usage:
 *   const { flags, missing, errors } = parseFlags(process.argv.slice(3), schema)
 */
export type FlagType = 'string' | 'boolean' | 'number' | 'array';
export interface FlagDefinition {
    type: FlagType;
    required?: boolean;
    default?: unknown;
    description?: string;
    aliases?: string[];
}
export type FlagSchema = Record<string, FlagDefinition>;
export interface ParsedFlags {
    flags: Record<string, unknown>;
    positional: string[];
    missing: string[];
    errors: string[];
}
/**
 * Parse argv tokens against a schema.
 *
 */
export declare function parseFlags(argv: readonly string[], schema: FlagSchema): ParsedFlags;
/**
 * Check if any flags were provided (beyond defaults).
 * Useful to decide interactive vs non-interactive mode.
 */
export declare function hasFlags(argv: readonly string[]): boolean;
/**
 * Format a schema into help text lines.
 *
 * @param {FlagSchema} schema
 * @returns {string}
 */
export declare function formatFlagHelp(schema: FlagSchema): string;
