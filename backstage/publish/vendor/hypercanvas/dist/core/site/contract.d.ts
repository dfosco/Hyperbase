interface SiteUrlOptions {
    loopbackOnly?: boolean;
    label?: string;
}
interface SitePathOptions {
    basePath?: string;
    origin?: string | null;
}
interface SiteRouteOptions {
    basePath?: string;
    siteIdInUrl?: boolean;
}
interface ParsedSiteUrl {
    origin: string;
    baseUrl: string;
    siteId: string | null;
    route: string;
}
export declare function normalizeSiteId(value: unknown): string;
export declare function normalizeSiteUrl(value: unknown, { loopbackOnly, label }?: SiteUrlOptions): string;
export declare function normalizeSiteRoute(value?: unknown): string;
export declare function resolveSiteUrl(baseUrl: unknown, siteId: unknown, route?: unknown): string;
/** Local dev servers own their path; the Site ID belongs only to the Core viewer URL. */
export declare function resolveSiteDevelopmentUrl(baseUrl: unknown, route?: unknown): string;
/** Build a same-origin Core URL for serving and tracking an embedded Site route. */
export declare function sitePreviewPath(basePath: unknown, siteId: unknown, route?: unknown): string;
/** Resolve a same-origin Site preview URL back to its route, including query/hash. */
export declare function siteRouteFromPreviewUrl(value: unknown, siteId: unknown, { basePath, origin }?: SitePathOptions): string | null;
export declare function siteRouteForUrl(value: unknown, baseUrl: unknown, siteId: unknown, { basePath, siteIdInUrl }?: SiteRouteOptions): string | null;
export declare function parseSiteUrl(value: unknown, { basePath, siteIdInUrl }?: SiteRouteOptions): ParsedSiteUrl | null;
export {};
