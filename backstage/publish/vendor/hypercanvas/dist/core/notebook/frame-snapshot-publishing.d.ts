/** Build static Site page and Site Frame descriptors for Notebook exports. */
interface Diagnostic {
    code: string;
    message: string;
    canvas?: string;
    widgetId?: string;
    title?: string;
}
interface PublishedPageInput {
    id: string;
    type?: string;
    siteId: string;
    title?: string;
    available?: boolean;
    diagnostics?: Diagnostic[];
}
interface PublishedPage extends PublishedPageInput {
    available: boolean;
    diagnostics: Diagnostic[];
    productionUrl: string | null;
    snapshot: string | null;
    snapshotDark: string | null;
    publicationStatus: 'snapshot' | 'link-only' | 'unavailable';
}
interface PublishedFrame {
    snapshot?: string;
    snapshotDark?: string;
}
interface PublishedSitePage {
    snapshot?: string | null;
    snapshotDark?: string | null;
}
interface MaterializedCanvas {
    id?: string;
    slug: string;
    state?: {
        widgets?: unknown;
    };
}
/** Site pages always represent the local home route, independent of navigation. */
export declare function preparePublishedSitePages({ notebookRoot, pages, }: {
    notebookRoot: string;
    pages: PublishedPageInput[];
}): Promise<Map<string, PublishedPage>>;
/** Every persisted snapshot path a publication references, across standalone Sites and canvas Site Frames. */
export declare function collectPublishedSnapshotPaths(frames: Map<string, Record<string, PublishedFrame | null | undefined>>, sitePages: Map<string, PublishedSitePage>): string[];
/**
 * Publication-time snapshot integrity check: a published Site must never emit
 * a broken snapshot URL. Fails when a referenced snapshot path does not
 * resolve to a real file under the publication's `public/` directory — which
 * also catches the historic `/undefined` defect where a dropped manifest
 * filename leaked into generated metadata.
 */
export declare function validatePublishedSnapshots({ destination, frames, sitePages, }: {
    destination: string;
    frames: Map<string, Record<string, PublishedFrame | null | undefined>>;
    sitePages: Map<string, PublishedSitePage>;
}): void;
/**
 * Build published Site Frame data for the given materialized canvases.
 * Returns `{ frames, warnings }` where `frames` maps canvas slug → widget id
 * → partial or complete published frame data, and `warnings` lists optional
 * details that may be unavailable for an individual Site Frame.
 */
export declare function preparePublishedFrames({ notebookRoot, canvases, }: {
    notebookRoot: string;
    canvases: MaterializedCanvas[];
}): Promise<{
    frames: Map<string, Record<string, Record<string, unknown>>>;
    warnings: Diagnostic[];
}>;
export {};
