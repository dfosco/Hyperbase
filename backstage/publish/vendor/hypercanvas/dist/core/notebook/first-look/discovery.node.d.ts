/**
 * Read-only first-look discovery for a Notebook content root.
 *
 * Discovery never writes, migrates, or repairs files. Ordinary directories are
 * navigation groups. Artifact boundaries are `name.prototype/`, `name.canvas/`,
 * `name.site/`, `name.doc.mdx`, and `name.doc/name.doc.mdx`.
 *
 * Existing Hypercanvas folder-model artifacts that lack portable identity
 * (`name.prototype.json` with `meta`, canvas headers without `canvasId`) are
 * reported as `legacy` for the Hypercanvas notebook reader. They are not
 * diagnosed as broken first-look artifacts.
 */
import { type FirstLookDiagnostic, type FirstLookKind, type FirstLookView } from './contract.js';
type JsonRecord = Record<string, unknown>;
export type FirstLookArtifact = {
    id: string | null;
    kind: FirstLookKind;
    title: string;
    folderPath: string;
    path: string;
    descriptorPath: string;
    payloadPath: string;
    descriptor: JsonRecord | null;
    references: string[];
    views: FirstLookView[];
    diagnostics: FirstLookDiagnostic[];
    available: boolean;
    runtime?: {
        id: string;
        version: string;
    };
    entry?: string | null;
    local?: JsonRecord | null;
    published?: JsonRecord | null;
    resolvedReferences?: Array<{
        id: string;
        kind: FirstLookKind;
        path: string;
    }>;
    wrapped?: boolean;
};
export type LegacyArtifact = {
    kind: FirstLookKind;
    name: string;
    path: string;
    reason: 'no-first-look-identity' | 'missing-first-look-payload';
};
export type FirstLookEntry = {
    type: 'group';
    name: string;
    path: string;
    children: FirstLookEntry[];
} | {
    type: 'artifact';
    artifact: FirstLookArtifact;
} | {
    type: 'legacy';
    kind: FirstLookKind;
    name: string;
    path: string;
};
export type FirstLookDiscovery = {
    root: string;
    entries: FirstLookEntry[];
    artifacts: FirstLookArtifact[];
    legacy: LegacyArtifact[];
    diagnostics: FirstLookDiagnostic[];
};
/** Resolve a portable path from a notebook-relative base; throws when it escapes the notebook. */
export declare function resolveNotebookPath(root: string, basePath: string | null, relativePath: string): string;
/** Discover first-look artifacts and the ordinary folder tree. Read-only. */
export declare function discoverFirstLookNotebook(notebookRoot: string): FirstLookDiscovery;
export {};
