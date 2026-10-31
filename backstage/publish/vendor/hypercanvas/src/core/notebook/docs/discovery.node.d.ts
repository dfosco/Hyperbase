import { type DocDiagnostic, type DocMetadata } from './metadata.js';
export type DocArtifact = {
    id: string;
    type: 'doc';
    kind: 'doc';
    title: string;
    path: string;
    payloadPath: string;
    folderPath: string;
    route: string;
    available: boolean;
    portable: true;
    metadata: DocMetadata;
    diagnostics: DocDiagnostic[];
};
/** Bounded Doc discovery. The downstream first-look catalog can replace this adapter. */
export declare function discoverDocs(root: string): DocArtifact[];
/** Only discovered payloads and explicitly requested contained assets are readable. */
export declare function resolveDocAsset(root: string, folder: string, reference: string): string | null;
