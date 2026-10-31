type Api = {
    post(path: string, body: unknown): Promise<unknown>;
};
type ErrorWithBody = Error & {
    responseBody?: unknown;
    status?: number;
};
export declare const notebookMigrationHelp: string;
/** CLI flags mirror the guarded migration request fields exactly. */
export declare function runNotebookMigrationCommand(args: string[], api?: Api): Promise<unknown>;
export declare function isMigrationCliError(error: unknown): error is ErrorWithBody;
export {};
