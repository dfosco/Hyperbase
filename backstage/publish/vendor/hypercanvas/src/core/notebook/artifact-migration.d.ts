import { type NotebookArtifactKind, type NotebookSnapshot } from './notebook.js';
type JsonRecord = Record<string, unknown>;
export type MigrationItem = {
    itemId: string;
    kind: NotebookArtifactKind;
    id: string;
    fromPath: string;
    toPath: string;
    oldRoute: string | null;
    newRoute: string | null;
    pageId?: string;
    siteId?: string;
    sourceHash: string;
    payloadPath?: string;
    marker?: JsonRecord;
    aliases?: JsonRecord;
    sourceType?: 'path' | 'aggregate-site';
    descriptor?: JsonRecord;
};
export type NotebookArtifactMigrationPreviewRequest = {
    notebookId: string;
    generation: number;
    expectedRevision: string;
};
export type NotebookArtifactMigrationApplyRequest = NotebookArtifactMigrationPreviewRequest & {
    planId: string;
    planDigest: string;
    acceptRouteChanges: boolean;
};
export type NotebookArtifactMigrationRecoverRequest = {
    notebookId: string;
    generation: number;
    migrationId: string;
    expectedJournalRevision: string;
    action: 'resume' | 'rollback';
};
declare function safeChain(root: string, relative: string, allowMissing?: boolean): string;
declare function hashPath(root: string, relative: string): string;
declare function collectItems(root: string, snapshot: Extract<NotebookSnapshot, {
    status: 'valid';
}>): {
    items: MigrationItem[];
    conflicts: JsonRecord[];
};
declare function planFor(rootValue: string, request: NotebookArtifactMigrationPreviewRequest): {
    success: boolean;
    notebookId: string;
    generation: number;
    revision: string;
    planId: string;
    planDigest: string;
    items: MigrationItem[];
    routeChanges: {
        itemId: string;
        fromPath: string;
        toPath: string;
        oldRoute: string | null;
        newRoute: string | null;
    }[];
    conflicts: JsonRecord[];
    pendingRecovery: JsonRecord[];
};
declare function listJournals(root: string): JsonRecord[];
declare function readJournal(root: string, id: string): JsonRecord;
declare function writeJournal(file: string, journal: JsonRecord): JsonRecord;
export declare function previewNotebookArtifactMigration(root: string, request: NotebookArtifactMigrationPreviewRequest): {
    success: boolean;
    notebookId: string;
    generation: number;
    revision: string;
    planId: string;
    planDigest: string;
    items: MigrationItem[];
    routeChanges: {
        itemId: string;
        fromPath: string;
        toPath: string;
        oldRoute: string | null;
        newRoute: string | null;
    }[];
    conflicts: JsonRecord[];
    pendingRecovery: JsonRecord[];
};
export declare function applyNotebookArtifactMigration(rootValue: string, request: NotebookArtifactMigrationApplyRequest): JsonRecord | {
    success: boolean;
    notebookId: string;
    generation: number;
    revision: string;
    migrationId: `${string}-${string}-${string}-${string}-${string}`;
    state: string;
    backupPath: string;
    moved: {
        itemId: string;
        kind: NotebookArtifactKind;
        id: string;
        fromPath: string;
        toPath: string;
    }[];
    current: JsonRecord;
};
export declare function recoverNotebookArtifactMigration(rootValue: string, request: NotebookArtifactMigrationRecoverRequest): {
    success: boolean;
    migrationId: string;
    state: unknown;
    backupPath: string;
    moved: {};
    restored: string[];
    current: JsonRecord;
};
export declare function migrationJournalRevision(root: string, migrationId: string): string;
export declare const __artifactMigrationTest: {
    planFor: typeof planFor;
    collectItems: typeof collectItems;
    safeChain: typeof safeChain;
    hashPath: typeof hashPath;
    readJournal: typeof readJournal;
    writeJournal: typeof writeJournal;
    listJournals: typeof listJournals;
    SUFFIX: Record<string, NotebookArtifactKind>;
    NOTEBOOK_INFRASTRUCTURE_DIRECTORIES: ReadonlySet<string>;
};
export {};
