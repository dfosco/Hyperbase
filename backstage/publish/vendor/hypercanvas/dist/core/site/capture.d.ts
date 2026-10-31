import type { SiteFrameReferenceInput, SiteFrameOptions } from './publish.js';
interface SiteCaptureOptions extends Pick<SiteFrameOptions, 'bindingRevision' | 'theme'> {
}
interface CaptureResult {
    siteId: string;
    route: string;
    title?: string;
    width?: number;
    height?: number;
    captureKey: string;
    path: string;
    cached: boolean;
}
export declare function siteCapturePath(notebookRoot: string, reference: SiteFrameReferenceInput, options?: SiteCaptureOptions): string;
export declare function readSiteCapture(notebookRoot: string, reference: SiteFrameReferenceInput, options?: SiteCaptureOptions): Promise<({
    siteId: string;
    route: string;
    title?: string;
    width?: number;
    height?: number;
    captureKey: string;
    dataUrl: string;
}) | null>;
interface CaptureSiteFrameOptions extends SiteCaptureOptions {
    notebookRoot: string;
    reference: SiteFrameReferenceInput;
    developmentUrl: string;
    captureAdapter?: (options: {
        url: string;
        outputPath: string;
        viewport: {
            width: number;
            height: number;
        };
        colorScheme: 'dark' | 'light';
    }) => unknown | Promise<unknown>;
    force?: boolean;
}
export declare function captureSiteFrame({ notebookRoot, reference, developmentUrl, captureAdapter, bindingRevision, theme, force }: CaptureSiteFrameOptions): Promise<CaptureResult>;
export {};
