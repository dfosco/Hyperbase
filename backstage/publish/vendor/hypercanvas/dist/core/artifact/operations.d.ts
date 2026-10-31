/**
 * Artifact disk operations — create, edit, delete artifacts on the filesystem.
 *
 * Each operation validates first, then performs the FS mutation.
 */
type OperationResult = {
    success: boolean;
    [key: string]: unknown;
};
type ArtifactListResult = {
    type: string;
    items: unknown[];
};
/**
 * Create an artifact. Validates first, then performs FS operations.
 */
export declare function createArtifact(type: string, values: unknown, root: string): OperationResult;
/**
 * Edit artifact metadata.
 */
export declare function editArtifact(type: string, name: string, updates: unknown, root: string): OperationResult;
/**
 * Delete an artifact.
 */
export declare function deleteArtifact(type: string, name: string, options: unknown, root: string): Promise<OperationResult>;
/**
 * List artifacts of a given type.
 */
export declare function listArtifacts(type: string, options: unknown, root: string): ArtifactListResult;
export {};
