type ApiRequest = {
    get(path: string): Promise<unknown>;
    post(path: string, body: unknown): Promise<unknown>;
};
export declare function notebookRuntimeHelp(): string;
export declare function runNotebookRuntimeCommand(args: string[], request?: ApiRequest): Promise<unknown>;
export {};
