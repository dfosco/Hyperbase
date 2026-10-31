import type { IncomingMessage, ServerResponse } from 'node:http';
interface PreviewMiddlewareOptions {
    base?: string;
    authorizeRequest?: (request: IncomingMessage) => boolean;
    getDevelopmentBaseUrl?: (siteId: string) => string | null | undefined;
}
/**
 * Keep Site previews on the Core origin so the parent can observe their URL.
 * Root-relative Site assets are associated with the preview through Referer;
 * document navigations are redirected back under the per-Site preview path.
 */
export declare function createSitePreviewMiddleware({ base, authorizeRequest, getDevelopmentBaseUrl }?: PreviewMiddlewareOptions): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
export {};
