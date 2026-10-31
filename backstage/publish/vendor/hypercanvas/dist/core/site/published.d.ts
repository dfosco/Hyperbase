import { createPublishedSiteFrame } from './publish.js';
import type { SiteFrameOptions, SiteFrameReferenceInput } from './publish.js';
export interface PublishedSiteFrame extends ReturnType<typeof createPublishedSiteFrame> {
    openUrl: string;
    snapshotUrl: string | null;
}
export declare function renderPublishedSiteFrame(frame: Partial<PublishedSiteFrame>): string;
export declare function buildPublishedSiteManifest(references?: SiteFrameReferenceInput[], options?: SiteFrameOptions & Record<string, unknown>): PublishedSiteFrame[];
