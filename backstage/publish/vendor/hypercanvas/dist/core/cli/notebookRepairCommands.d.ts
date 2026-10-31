type ApiRequest = {
    post(path: string, body: unknown): Promise<unknown>;
};
export declare const notebookRepairHelp: string;
/** Call the guarded repair endpoint with a 1:1 mapping from CLI flags to request fields. */
export declare function runNotebookRepairCommand(args: string[], request?: ApiRequest): Promise<unknown>;
export {};
