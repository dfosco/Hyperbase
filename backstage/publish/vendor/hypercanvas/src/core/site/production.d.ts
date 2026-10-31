export interface ProductionSiteFinding {
    provider: string;
    config: string;
    baseUrl?: string | null;
    needsInput?: boolean;
}
interface ConfirmProductionSiteUrlOptions {
    candidate?: unknown;
    provided?: unknown;
    confirmed?: unknown;
}
export declare function discoverProductionSiteUrl(root: string): ProductionSiteFinding[];
export declare function confirmProductionSiteUrl({ candidate, provided, confirmed }?: ConfirmProductionSiteUrlOptions): string;
export {};
