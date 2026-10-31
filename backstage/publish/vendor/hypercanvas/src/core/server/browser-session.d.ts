import type { IncomingMessage, ServerResponse } from 'node:http';
type BrowserRequest = Pick<IncomingMessage, 'headers'> & Partial<Pick<IncomingMessage, 'method' | 'url'>>;
interface BrowserSessionOptions {
    required?: boolean;
    launchToken?: string | null;
    sessionSecret?: string | null;
    generateSession?: () => string;
}
interface BootstrapOptions {
    base?: string;
}
interface IssueLaunchTokenOptions {
    ttlMs?: number;
}
export declare function createBrowserSession({ required, launchToken, sessionSecret, generateSession, }?: BrowserSessionOptions): {
    isAuthenticated: (request: BrowserRequest | null | undefined) => boolean;
    authorizeWebSocket: (request: BrowserRequest | null | undefined) => boolean;
    bootstrapMiddleware: ({ base }?: BootstrapOptions) => (request: BrowserRequest, response: ServerResponse, next: () => void) => void;
    registerBrowserOrigin: (origin: string) => boolean;
    setRequired: (value: unknown) => void;
    issueLaunchToken: ({ ttlMs }?: IssueLaunchTokenOptions) => string;
};
export {};
