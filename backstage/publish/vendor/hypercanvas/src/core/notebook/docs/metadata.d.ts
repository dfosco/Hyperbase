export type DocDiagnostic = {
    code: string;
    message: string;
    path: string;
    line?: number;
};
export type DocMetadata = Record<string, unknown> & {
    id?: string;
    title?: string;
    references?: string[];
};
export declare const DOC_ID: RegExp;
/** Parse identity without serializing, normalizing or rewriting authored source. */
export declare function readDocMetadata(source: string, sourcePath: string): {
    metadata: DocMetadata;
    body: string;
    lineOffset: number;
    diagnostics: DocDiagnostic[];
};
