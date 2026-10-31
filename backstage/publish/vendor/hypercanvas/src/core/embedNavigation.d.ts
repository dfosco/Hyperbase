/**
 * Embed-managed URL params. The parent PrototypeEmbed adds these when building
 * the iframe URL, so they must never round-trip back into the persisted src.
 */
export declare const EMBED_MANAGED_PARAMS: string[];
/**
 * Convert an embedded route into its public host URL while preserving authored
 * query and hash state. Handles direct routes, legacy loader URLs, and branch
 * prefixes.
 */
export declare function computeEmbedNavigationSrc(pathname: string, hash: string, basePath?: string, search?: string): string;
