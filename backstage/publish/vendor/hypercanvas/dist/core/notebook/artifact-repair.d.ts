import { writeNotebookManifest, type NotebookArtifactKind, type NotebookDiagnostic, type NotebookSnapshot } from './notebook.js';
type ArtifactRef = {
    kind: NotebookArtifactKind;
    path: string;
};
export type NotebookArtifactRepairRequest = {
    nestedArtifact: ArtifactRef;
    containingArtifact: ArtifactRef;
    expectedProposedDestination: string;
};
export type NotebookArtifactRepairResult = {
    repaired: {
        id: string;
        kind: NotebookArtifactKind;
        fromPath: string;
        toPath: string;
    };
    repairParentPath: string;
    proposedDestination: string;
    diagnostics: NotebookDiagnostic[];
};
/** Move a currently nested artifact to the closest ancestor outside every artifact boundary. */
export declare function repairNestedNotebookArtifact(rootInput: string, snapshotInput: NotebookSnapshot, request: NotebookArtifactRepairRequest, { reconcile }?: {
    reconcile?: typeof writeNotebookManifest;
}): NotebookArtifactRepairResult;
export {};
