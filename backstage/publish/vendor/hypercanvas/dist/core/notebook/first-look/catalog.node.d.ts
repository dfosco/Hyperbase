/**
 * Read-only catalog integration for portable first-look artifacts.
 *
 * Portable identity comes from the pinned descriptors and Canvas headers. The
 * legacy Hypercanvas reader keeps its markers, manifests, aggregate Sites, and
 * name routes. This module never writes. It maps scanner results into the
 * Notebook artifact shape, claims their folders away from the legacy reader,
 * and reports portable/legacy identity conflicts instead of choosing a winner.
 */
import type { NotebookArtifact, NotebookDiagnostic } from '../notebook.js';
export declare const FIRST_LOOK_DIAGNOSTIC_SOURCE = "first-look";
export type PortableCatalog = {
    artifacts: NotebookArtifact[];
    claimedLocators: Set<string>;
    diagnostics: NotebookDiagnostic[];
};
export type ManifestRecord = Record<string, unknown> & {
    id: string;
    type: string;
    title: string;
    path: string;
};
/** Read the portable catalog. Pure reads only; no file is created, changed, or migrated. */
export declare function readPortableCatalog(root: string): PortableCatalog;
/**
 * Compare a portable identity with a legacy `.hypercanvas-artifact.json` marker in
 * the same artifact folder. Mismatches and malformed markers block the artifact.
 */
export declare function reportMarkerConflicts(root: string, artifacts: NotebookArtifact[]): NotebookDiagnostic[];
/**
 * A legacy manifest page registered at a portable artifact's path is superseded by
 * the portable artifact. A different page ID is an identity conflict.
 */
export declare function supersededRegistrations(artifacts: NotebookArtifact[], pages: Record<string, unknown>[]): {
    pages: Record<string, unknown>[];
    diagnostics: NotebookDiagnostic[];
};
/** Duplicate IDs and canonical route collisions across portable and legacy artifacts. */
export declare function reportCrossCatalogConflicts(artifacts: NotebookArtifact[]): NotebookDiagnostic[];
/** Manifest-shaped page records for portable artifacts; they are in-memory only and never persisted. */
export declare function portablePageRecords(artifacts: NotebookArtifact[]): Array<{
    record: ManifestRecord;
    artifact: NotebookArtifact;
}>;
/** A stable in-memory notebook ID for a folder that has portable artifacts but no manifest. */
export declare function portableNotebookId(root: string): string;
