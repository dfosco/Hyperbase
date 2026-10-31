type SourceRequest = {
    get(path: string): Promise<Record<string, unknown>>;
    post(path: string, body: unknown): Promise<Record<string, unknown>>;
};
export declare function runStoryboardSourceCommand(args: string[], request?: SourceRequest): Promise<unknown>;
export {};
