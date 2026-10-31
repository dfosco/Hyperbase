/**
 * Artifact validation — schema + semantic validation for all artifact types.
 *
 * Validates against JSON Schema definitions and performs semantic checks
 * (uniqueness, reference existence, mutual exclusivity).
 */
export type ArtifactType = 'prototype' | 'canvas' | 'component' | 'flow' | 'object' | 'record' | 'page' | 'site';
export type ArtifactValues = Record<string, unknown>;
export type ArtifactValidationError = {
    field: string;
    message: string;
};
export type ArtifactValidationResult = {
    valid: true;
    normalized: ArtifactValues;
} | {
    valid: false;
    errors: ArtifactValidationError[];
};
type SchemaProperty = {
    pattern?: string;
    maxLength?: number;
    format?: string;
};
type ArtifactSchema = {
    properties?: Record<string, SchemaProperty>;
    required?: string[];
    mutuallyExclusive?: string[][];
};
declare const VALID_TYPES: ArtifactType[];
declare function loadSchema(type: string): ArtifactSchema | null;
/**
 * Resolve a prototype directory by name, searching in folder and root.
 */
declare function resolvePrototypeDir(prototypesDir: string, name: unknown, folder?: unknown): string | null;
/** Resolve a Notebook prototype by its logical name, marker ID, or folder path. */
export declare function resolveNotebookPrototypeDir(root: string, name: unknown, parentPath?: unknown): string | null;
declare function toPascalCase(kebab: string): string;
/**
 * Main validation entry point.
 *
 * @param {string} type - Artifact type
 * @param {object} values - Input values
 * @param {string} root - Project root directory
 * @returns {{ valid: boolean, errors?: Array<{field: string, message: string}>, normalized?: object }}
 */
export declare function validateArtifact(type: string, values: ArtifactValues, root: string): ArtifactValidationResult;
export { VALID_TYPES, loadSchema, resolvePrototypeDir, toPascalCase };
