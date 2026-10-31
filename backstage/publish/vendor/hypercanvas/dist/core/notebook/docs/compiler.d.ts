import { type DocDiagnostic } from './metadata.js';
export declare const DOCS_IMPORT_PATH = "design-notebook/docs";
/** Host-independent MDX compiler. Hosts supply imports, catalog and asset URLs. */
export declare function compileDocument(source: string, sourcePath: string): Promise<{
    source: string;
    compiledSource: string | null;
    assets: string[];
    diagnostics: DocDiagnostic[];
    available: boolean;
    metadata: import("./metadata.js").DocMetadata;
    body: string;
    lineOffset: number;
}>;
