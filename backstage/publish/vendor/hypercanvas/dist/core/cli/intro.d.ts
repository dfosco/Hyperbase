/**
 * Single source of truth for CLI getting-started content.
 * Used by both `hypercanvas setup` and the help screen (`hypercanvas`).
 */
export declare const dim: (s: string) => string;
export declare const magenta: (s: string) => string;
export declare const cyan: (s: string) => string;
export declare const green: (s: string) => string;
export declare const bold: (s: string) => string;
export declare const white: (s: string) => string;
export declare const yellow: (s: string) => string;
/**
 * Returns the getting-started intro lines as an array of strings.
 * @param {object} [opts]
 * @param {string} [opts.indent='  '] Prefix for each non-empty line
 */
export declare function gettingStartedLines({ indent }?: {
    indent?: string;
}): string[];
