export { normalizeSiteId, normalizeSiteRoute, normalizeSiteUrl, parseSiteUrl, resolveSiteUrl, resolveSiteDevelopmentUrl, sitePreviewPath, siteRouteFromPreviewUrl, siteRouteForUrl } from './contract.js';
export declare const SITE_FORMAT_VERSION = 1;
export declare const SITE_RUNTIME_DIR = ".hypercanvas";
export declare const LEGACY_SITE_RUNTIME_DIR = ".storyboard";
export declare const SITE_DESCRIPTOR_FILE = "site.config.json";
export declare const SITE_ARTIFACT_MARKER_FILE = ".hypercanvas-artifact.json";
export declare const NOTEBOOK_INFRASTRUCTURE_DIRECTORIES: ReadonlySet<string>;
type DataRecord = {
    [key: string]: unknown;
    id?: string;
    title?: string;
    description?: string;
    defaultDeployment?: string | null;
    deployments?: Record<string, DataRecord>;
    capture?: {
        waitUntil?: string;
        delayMs?: unknown;
    };
    source?: string;
    workspaceId?: string;
    scriptName?: string;
    serviceName?: string;
    root?: string;
    startCommand?: string;
    env?: Record<string, unknown>;
    terminalSessionId?: string;
    legacyPid?: number;
    developmentBaseUrl?: string;
    developmentBaseUrlSource?: string;
    status?: string;
    pid?: number | null;
    revision?: number;
    updatedAt?: string;
    binding?: DataRecord;
    scripts?: Record<string, string>;
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
    packageManager?: string;
    port?: unknown;
    config?: {
        port?: unknown;
    };
    meta?: DataRecord;
};
type SiteState = {
    formatVersion: number;
    sites: Record<string, DataRecord>;
};
type NormalizedSite = DataRecord & {
    id: string;
};
type SiteEntry = {
    site: NormalizedSite;
    folderPath: string | null;
    artifactId: string | null;
};
/**
 * Site descriptors keep whichever runtime directory the project already has.
 * The active file lives under the active runtime directory; the very old
 * `.storyboard/sites.json` layout is read for migration/diagnostics only.
 */
/** Relative sites.config.json path inside the active runtime directory. */
export declare function siteConfigRelativePath(root: string): string;
export declare function siteDescriptorRelativePath(folderPath: string): string;
export declare function siteFolderPath(root: string, id: string, parentPath?: string): string;
export declare const SITE_RUNTIME_FILE = ".storyboard/sites.json";
export declare function readSiteDescriptorFile(file: string, fallbackId?: string): NormalizedSite;
export declare function isReservedSiteEnvironmentKey(key: unknown): boolean;
export declare function normalizeSiteDescriptor(value?: DataRecord): NormalizedSite;
export declare function updateSiteDescriptor(current: unknown, updates?: unknown): NormalizedSite;
export declare function normalizeSiteBinding(value?: DataRecord): DataRecord;
export declare class SiteStore {
    root: string;
    legacySiteDescriptorsRoot: string;
    resolveRuntimePath: (relativePath: string) => string;
    configPath: string;
    legacyRuntimePath: string;
    legacyRuntimeStates: Map<string, DataRecord>;
    constructor(notebookRoot: string);
    listEntries(): SiteEntry[];
    list(): NormalizedSite[];
    get(id: unknown): NormalizedSite | null;
    upsert(value: DataRecord, { parentPath }?: {
        parentPath?: string;
    }): NormalizedSite;
    move(id: string, parentPath: string): NormalizedSite;
    rename(id: string, newId: string): NormalizedSite;
    remove(id: string): boolean;
    getBinding(id: string): DataRecord | null;
    upsertBinding(id: string, value: unknown): DataRecord;
    removeBinding(id: string): boolean;
    bindings(): Record<string, DataRecord | null>;
    readState(_options?: {
        migrateLegacy?: boolean;
    }): SiteState;
    migrateLegacy(): SiteState;
    getLegacyRuntimeState(id: string): DataRecord | null;
    clearLegacyRuntimeState(id: string): void;
    writeState(sites: Record<string, DataRecord>): void;
    private withBinding;
    private readPortableEntries;
    private readLegacyDescriptors;
    private readRuntimeRegistry;
    private writeRuntimeRegistry;
    private readLegacyRuntimeBindings;
    private newFolderPath;
    private writeDescriptor;
    private removeLegacyDescriptor;
    private removeLegacyRuntimeBinding;
    private renameLegacyRuntimeBinding;
}
export declare function siteIdForTitle(title: string, store: Pick<SiteStore, 'get'>): string;
export declare function assertExternalSiteRoot(notebookRoot: string, root: string): string;
export declare function assertAvailableSiteRoot(store: SiteStore, root: string, exceptId?: string | null): string;
export declare function detectSiteConfiguration(root: string): {
    root: string;
    findings: DataRecord[];
};
