/**
 * Embed-managed URL params. The parent PrototypeEmbed adds these when building
 * the iframe URL, so they must never round-trip back into the persisted src.
 */
export const EMBED_MANAGED_PARAMS = ['_sb_embed', '_sb_component_view', '_sb_hide_branch_bar', '_sb_theme_target', '_sb_canvas_theme', 'sb_knobs'];
/**
 * Convert an embedded route into its public host URL while preserving authored
 * query and hash state. Handles direct routes, legacy loader URLs, and branch
 * prefixes.
 */
export function computeEmbedNavigationSrc(pathname, hash, basePath = '', search = '') {
    const cleanBase = (basePath || '').replace(/\/$/, '');
    const stripped = cleanBase && pathname.startsWith(cleanBase)
        ? pathname.slice(cleanBase.length) || '/'
        : pathname.replace(/^\/branch--[^/]+/, '') || '/';
    let searchSuffix = '';
    if (search) {
        const params = new URLSearchParams(search);
        for (const name of EMBED_MANAGED_PARAMS)
            params.delete(name);
        searchSuffix = params.toString() ? `?${params.toString()}` : '';
    }
    if (/^\/(prototypes|stories)\.html\//.test(stripped)) {
        const route = stripped.replace(/^\/(prototypes|stories)\.html/, '') || '/';
        return route + searchSuffix + (hash || '');
    }
    if (stripped === '/prototypes.html' || stripped.endsWith('/prototypes.html')) {
        const inner = (hash || '').startsWith('#') ? hash.slice(1) : (hash || '');
        if (!inner)
            return '/';
        return inner.startsWith('/') ? inner : `/${inner}`;
    }
    return stripped + searchSuffix + (hash || '');
}
