/**
 * Shared Design Notebook first-look contract.
 *
 * Pinned to dfosco/design-notebook 0.10.0-first-look at commit
 * 87348d6bc54afebb74094c02cd95b7b8c58be032. This module is browser-safe: it
 * holds constants, identity rules, and types only. Filesystem discovery lives
 * in discovery.node.ts.
 */
export declare const FIRST_LOOK_FORMAT_VERSION = 1;
export declare const FIRST_LOOK_PROTOTYPE_RUNTIME: Readonly<{
    id: "@dfosco/statefully";
    version: "0.2.1";
}>;
export declare const FIRST_LOOK_KINDS: readonly ["prototype", "canvas", "site", "doc"];
export type FirstLookKind = typeof FIRST_LOOK_KINDS[number];
export declare const FIRST_LOOK_DIRECTORY_SUFFIXES: Readonly<{
    readonly prototype: ".prototype";
    readonly canvas: ".canvas";
    readonly site: ".site";
}>;
export declare const FIRST_LOOK_EXCLUDED_DIRECTORIES: ReadonlySet<string>;
export declare const RESERVED_PUBLIC_ROUTE_ROOTS: ReadonlySet<string>;
export declare function isFirstLookId(value: unknown): value is string;
export type FirstLookDiagnostic = {
    code: string;
    message: string;
    severity: 'error' | 'warning';
    path: string | null;
    field?: string;
    line?: number;
    id?: string;
    paths?: string[];
    matches?: string[];
    nestedArtifact?: {
        kind: FirstLookKind;
        path: string;
    };
    containingArtifact?: {
        kind: FirstLookKind;
        path: string;
    };
    [key: string]: unknown;
};
export type FirstLookView = {
    id: string;
    title: string;
    path?: string;
    [key: string]: unknown;
};
