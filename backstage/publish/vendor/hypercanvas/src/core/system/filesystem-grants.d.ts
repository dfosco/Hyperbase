export type FilesystemGrantPurpose = 'notebook' | 'site';
export type FilesystemGrantRequest = {
    headers?: Record<string, unknown> | undefined;
};
export declare function isFilesystemGrantPurpose(purpose: unknown): purpose is FilesystemGrantPurpose;
export declare function isBrowserFilesystemRequest(request: FilesystemGrantRequest | null | undefined): boolean;
/** Short-lived Core picker grants for browser-selected Notebook and Site roots. */
export declare function createFilesystemGrants({ ttlMs, now }?: {
    ttlMs?: number;
    now?: () => number;
}): Readonly<{
    registerBrowserOrigin: (origin: string) => boolean;
    grantDirectory: (directory: string, { purpose, request }?: {
        purpose?: FilesystemGrantPurpose;
        request?: FilesystemGrantRequest | null;
    }) => string;
    resolveDirectory: (request: FilesystemGrantRequest | null | undefined, directory: unknown, { purpose, consume, allowedRoots }?: {
        purpose?: FilesystemGrantPurpose;
        consume?: boolean;
        allowedRoots?: readonly string[];
    }) => string;
    hasDirectoryGrant: (request: FilesystemGrantRequest | null | undefined, directory: unknown, options?: {
        purpose?: FilesystemGrantPurpose;
        allowedRoots?: readonly string[];
    }) => boolean;
    clear: () => void;
}>;
export declare const filesystemGrants: Readonly<{
    registerBrowserOrigin: (origin: string) => boolean;
    grantDirectory: (directory: string, { purpose, request }?: {
        purpose?: FilesystemGrantPurpose;
        request?: FilesystemGrantRequest | null;
    }) => string;
    resolveDirectory: (request: FilesystemGrantRequest | null | undefined, directory: unknown, { purpose, consume, allowedRoots }?: {
        purpose?: FilesystemGrantPurpose;
        consume?: boolean;
        allowedRoots?: readonly string[];
    }) => string;
    hasDirectoryGrant: (request: FilesystemGrantRequest | null | undefined, directory: unknown, options?: {
        purpose?: FilesystemGrantPurpose;
        allowedRoots?: readonly string[];
    }) => boolean;
    clear: () => void;
}>;
