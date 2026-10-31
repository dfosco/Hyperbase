export type HostToolsRequestErrorOptions = {
    status?: number;
};
export declare class HostToolsRequestError extends Error {
    status: number;
    constructor(message: string, { status }?: HostToolsRequestErrorOptions);
}
export declare function hostToolsApiBase(basePath?: string): string;
export type HostToolsBrowserClient = Readonly<{
    preflight(): Promise<unknown>;
}>;
type HostToolsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export declare function createHostToolsBrowserClient({ fetchImpl, basePath, }?: {
    fetchImpl?: HostToolsFetch;
    basePath?: string;
}): HostToolsBrowserClient;
export {};
