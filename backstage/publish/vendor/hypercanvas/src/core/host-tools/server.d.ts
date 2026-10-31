import type { IncomingMessage, ServerResponse } from 'node:http';
import { type HostToolsPreflightResult } from './preflight.js';
type HostToolsHandlerContext = {
    method?: string;
    path?: string;
};
type SendJson = (res: ServerResponse, status: number, body: unknown) => void;
type HostToolsHandler = (req: IncomingMessage, res: ServerResponse, context?: HostToolsHandlerContext) => Promise<void>;
/** Read-only host diagnostics. Hypercanvas does not install or repair agent CLIs. */
export declare function createHostToolsHandler({ preflight, sendJson, }?: {
    preflight?: () => Promise<HostToolsPreflightResult>;
    sendJson?: SendJson;
}): HostToolsHandler;
export {};
