/**
 * Fuzzy Search — lightweight substring + fuzzy scoring for the command palette.
 *
 * Scoring tiers (highest → lowest):
 *   1. Exact prefix match           — query matches start of text
 *   2. Word-boundary match          — query matches at a word boundary
 *   3. Consecutive substring match  — query appears as a contiguous substring
 *   4. Fuzzy character match        — all query chars appear in order
 *
 * Each tier gets a base score, with bonuses for shorter text (tighter match)
 * and penalties for distance between matched characters (fuzzy only).
 */
export interface FuzzySearchResult<T> {
    item: T;
    score: number;
}
interface FuzzySearchOptions {
    key?: string;
    maxResults?: number;
}
/** Score a single text against a query already lowercased by the caller. */
export declare function scoreMatch(text: string, query: string): number;
/** Search items by a string property and return scored, sorted results. */
export declare function fuzzySearch<T extends object>(items: readonly T[], query: string, opts?: FuzzySearchOptions): FuzzySearchResult<T>[];
export {};
