import type { NotebookSiblingRef } from './sibling-order.js';
export type NotebookTreeArtifactKind = 'prototype' | 'component' | 'canvas' | 'site' | 'doc';
export type NotebookTreeDiagnostic = {
    code: string;
    message: string;
    path: string | null;
    nestedArtifact?: {
        kind: NotebookTreeArtifactKind;
        path: string;
    };
    containingArtifact?: {
        kind: NotebookTreeArtifactKind;
        path: string;
    };
    repairParentPath?: string;
    proposedDestination?: string;
};
export type NotebookTreeRoot = {
    kind: 'folder';
    ref: null;
    name: string;
    path: '';
    parentPath: null;
    depth: 0;
    capabilities: {
        reorderSiblings: boolean;
    };
    children: NotebookTreeNode[];
};
export type NotebookTreeFolder = {
    kind: 'folder';
    ref: {
        kind: 'folder';
        path: string;
    };
    name: string;
    path: string;
    parentPath: string;
    depth: number;
    capabilities: {
        reorderSiblings: boolean;
    };
    children: NotebookTreeNode[];
};
export type NotebookTreeArtifact = {
    kind: 'artifact';
    ref: {
        kind: 'artifact';
        id: string;
    } | null;
    id: string;
    pageId: string | null;
    artifactKind: NotebookTreeArtifactKind;
    name: string;
    title: string;
    path: string | null;
    parentPath: string;
    depth: number;
    payloadPath: string | null;
    route: string | null;
    siteId: string | null;
    available: boolean;
    diagnostics: NotebookTreeDiagnostic[];
};
export type NotebookTreeNode = NotebookTreeFolder | NotebookTreeArtifact;
export type NotebookNavigationTree = {
    /** Effective rules used by the authoritative tree, including explicit []. */
    sidebarIgnored?: string[];
    root: NotebookTreeRoot;
    capabilities: {
        reorderSiblings: boolean;
    };
};
export type NotebookTreeSibling = {
    ref: NotebookSiblingRef;
    kind: 'folder' | 'artifact';
    name: string;
};
