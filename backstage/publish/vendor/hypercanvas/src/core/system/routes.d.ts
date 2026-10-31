import { filesystemGrants as defaultFilesystemGrants, type FilesystemGrantRequest, type FilesystemGrantPurpose } from './filesystem-grants.js';
type SystemResponse = {
    writeHead(status: number, headers: Record<string, string>): unknown;
    end(body?: string): unknown;
};
type SystemRequest = FilesystemGrantRequest & {
    url?: string | undefined;
};
type SystemRouteContext = {
    path?: string;
    method?: string;
    body?: unknown;
};
type PickerOptions = {
    purpose: FilesystemGrantPurpose;
    e2eDirectory?: unknown;
};
type FilesystemGrantService = typeof defaultFilesystemGrants;
type SystemRouteHandler = {
    bivarianceHack(req: SystemRequest, res: SystemResponse, ctx?: SystemRouteContext): Promise<void>;
}['bivarianceHack'];
declare function sendJson(res: SystemResponse, status: number, body: unknown): void;
declare function pickWithAppleScript(kind: 'directory' | 'file'): Promise<string | null>;
export declare function openInFinder(directory: string): Promise<void>;
export declare function createSystemRoutes({ sendJson: send, selectDirectory, openDirectory, selectFile, filesystemGrants, getNotebookRoot, eventSender, }?: {
    sendJson?: typeof sendJson;
    selectDirectory?: (options?: PickerOptions) => Promise<string | null>;
    openDirectory?: (directory: string) => Promise<void>;
    selectFile?: () => Promise<string | null>;
    filesystemGrants?: FilesystemGrantService;
    getNotebookRoot?: () => string | null;
    eventSender?: ((event: {
        type: 'custom';
        event: string;
        data: Record<string, unknown>;
    }) => unknown) | null;
}): SystemRouteHandler;
export { pickWithAppleScript };
