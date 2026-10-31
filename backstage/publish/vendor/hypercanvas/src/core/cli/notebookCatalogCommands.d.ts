type ApiRequest = {
    get(path: string): Promise<unknown>;
    post(path: string, body: unknown): Promise<unknown>;
};
export declare const notebookCatalogHelp: string;
/** Read the live primary-page catalog or inspect/apply a guarded layout operation. */
export declare function runNotebookCatalogCommand(args: string[], request?: ApiRequest): Promise<unknown>;
export {};
