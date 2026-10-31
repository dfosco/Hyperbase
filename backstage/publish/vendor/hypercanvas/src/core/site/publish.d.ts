export interface SiteFrameReferenceInput {
    siteId?: unknown;
    route?: unknown;
    title?: unknown;
    width?: unknown;
    height?: unknown;
}
export interface SiteFrameReference {
    siteId: string;
    route: string;
    title?: string;
    width?: number;
    height?: number;
}
export interface SiteFrameOptions {
    productionBaseUrl?: unknown;
    snapshotUrl?: string | null;
    bindingRevision?: number;
    theme?: string;
}
export declare function normalizeSiteReference(value?: SiteFrameReferenceInput): SiteFrameReference;
export declare function siteCaptureKey(reference: SiteFrameReferenceInput, { bindingRevision, theme }?: Pick<SiteFrameOptions, 'bindingRevision' | 'theme'>): string;
export declare function createPublishedSiteFrame(reference: SiteFrameReferenceInput, { productionBaseUrl, snapshotUrl, bindingRevision, theme }?: SiteFrameOptions): {
    openUrl: string;
    snapshotUrl: string | null;
    captureKey: string;
    mode: string;
    siteId: string;
    route: string;
    title?: string;
    width?: number;
    height?: number;
};
/**
 * Resolve a published Site Frame's production link.
 *
 * Unlike the development resolver, the configured production base URL is the
 * Site's actual web root: only the normalized route is appended — no Site ID
 * path segment is invented. Loopback bases are rejected because a published
 * frame must link to a real deployment.
 */
export declare function resolveProductionSiteUrl(productionBaseUrl: unknown, route?: unknown): string;
