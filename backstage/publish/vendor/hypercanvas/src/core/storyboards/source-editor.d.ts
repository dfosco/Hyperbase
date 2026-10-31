import ts from 'typescript';
import type { AuthoredNodeIdentity } from './identity-index.ts';
import type { ComponentRegistration, ComponentRegistrationIndex, EditableLayoutFieldSchema, EditablePropSchema } from './structural-schema.ts';
import type { StoryboardSourceRevision } from './source-revision.ts';
export type SourceEditFailureCode = 'INVALID_SOURCE_PATH' | 'SOURCE_NOT_FOUND' | 'INVALID_TSX' | 'STALE_SOURCE_REVISION' | 'SOURCE_NODE_MISSING' | 'SOURCE_NODE_AMBIGUOUS' | 'INVALID_SOURCE_IDENTITY' | 'DUPLICATE_SOURCE_IDENTITY' | 'COMPONENT_NOT_REGISTERED' | 'PROP_NOT_EDITABLE' | 'INVALID_PROP_VALUE' | 'UNSAFE_SOURCE_PATH' | 'SOURCE_HISTORY_EMPTY' | 'SOURCE_HISTORY_CONFLICT';
export declare class StoryboardSourceEditError extends Error {
    readonly code: SourceEditFailureCode;
    readonly status: number;
    constructor(code: SourceEditFailureCode, message: string, status?: number);
}
export interface StoryboardSourceNode extends AuthoredNodeIdentity {
    component: string;
    kind: ComponentRegistration['kind'];
    line: number;
    column: number;
    props: Record<string, string | number | boolean | null>;
    editableProps: Record<string, EditablePropSchema>;
    layout: Record<string, string | number>;
    editableLayout: Record<string, EditableLayoutFieldSchema>;
    children: string[];
}
export interface StoryboardSourceInspection {
    sourcePath: string;
    revision: StoryboardSourceRevision;
    nodes: StoryboardSourceNode[];
    opaqueCount: number;
}
export interface SetStoryboardPropCommand {
    type: 'setProp';
    target: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
    prop: string;
    value: unknown;
}
export interface SetStoryboardLayoutCommand {
    type: 'setLayout';
    target: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
    field: string;
    value: unknown;
}
export interface StoryboardSourceHistoryCommand {
    type: 'undoSource' | 'redoSource';
    expectedRevision: StoryboardSourceRevision | string;
}
export interface SetStoryboardBindingCommand {
    type: 'setBinding';
    controlId: string;
    actionId: string;
    conditionId: string | null;
    expectedRevision: StoryboardSourceRevision | string;
}
export interface DeleteStoryboardNodeCommand {
    type: 'deleteNode';
    target: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
}
export interface InsertStoryboardNodeCommand {
    type: 'insertNode';
    target: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
    slot: string;
    index: number;
    component: string;
    props: Record<string, unknown>;
}
export interface DuplicateStoryboardNodeCommand {
    type: 'duplicateNode';
    target: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
    slot: string;
    index: number;
}
export interface ReorderStoryboardNodeCommand {
    type: 'reorderNode';
    target: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
    index: number;
}
export interface ReparentStoryboardNodeCommand {
    type: 'reparentNode';
    target: AuthoredNodeIdentity;
    parent: AuthoredNodeIdentity;
    expectedRevision: StoryboardSourceRevision | string;
    slot: string;
    index: number;
}
interface ParsedNode {
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement;
    name: string;
    registration: ComponentRegistration;
    id: string;
    parentId: string | null;
}
declare function sourceNodes(sourcePath: string, source: string, registrations: ComponentRegistrationIndex): {
    file: ts.SourceFile;
    nodes: ParsedNode[];
    nodeByStart: Map<number, ParsedNode>;
    opaqueCount: number;
};
export declare function inspectStoryboardSource(sourcePath: string, source: string, registrations: ComponentRegistrationIndex): StoryboardSourceInspection;
export declare function editStoryboardProp(sourcePath: string, source: string, command: SetStoryboardPropCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
};
export declare function editStoryboardLayout(sourcePath: string, source: string, command: SetStoryboardLayoutCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
};
export declare function inspectStoryboardBindings(sourcePath: string, source: string, declarationName?: string): {
    sourcePath: string;
    revision: StoryboardSourceRevision;
    controls: {
        id: string;
        action: string | null;
        condition: string | null;
    }[];
    actions: string[];
    conditions: string[];
};
export declare function editStoryboardBinding(sourcePath: string, source: string, command: SetStoryboardBindingCommand, declarationName?: string): {
    source: string;
    revision: StoryboardSourceRevision;
};
export declare function deleteStoryboardNode(sourcePath: string, source: string, command: DeleteStoryboardNodeCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
};
export declare function insertStoryboardNode(sourcePath: string, source: string, command: InsertStoryboardNodeCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
    nodeId: string;
};
export declare function duplicateStoryboardNode(sourcePath: string, source: string, command: DuplicateStoryboardNodeCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
    nodeId: string;
};
export declare function reorderStoryboardNode(sourcePath: string, source: string, command: ReorderStoryboardNodeCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
};
export declare function reparentStoryboardNode(sourcePath: string, source: string, command: ReparentStoryboardNodeCommand, registrations: ComponentRegistrationIndex): {
    source: string;
    revision: StoryboardSourceRevision;
};
declare function atomicWrite(root: string, filePath: string, source: string): void;
declare function withSourceLock<T>(filePath: string, operation: () => T | Promise<T>): Promise<T>;
/** Notebook/workspace-scoped inspect and schema-validated TSX Storyboard edits. */
export declare function createStoryboardSourceRoutes({ runtime, fallbackRoot, registrations, behaviorDeclarationName, resolvePath, sendJson, eventSender, }: {
    runtime: {
        status(): {
            active?: boolean;
            root?: string | null;
            notebook?: {
                manifest?: {
                    id?: string;
                };
            } | null;
            generation?: number;
        };
    } | null;
    fallbackRoot?: string | null;
    registrations?: ComponentRegistrationIndex;
    behaviorDeclarationName?: string;
    resolvePath: (root: string, relativePath: string) => string;
    sendJson: (response: unknown, status: number, data: unknown) => void;
    eventSender?: (event: unknown) => void;
}): (_req: unknown, res: unknown, context: {
    body?: Record<string, unknown>;
    path: string;
    method: string;
}) => Promise<void>;
export declare const __test: {
    atomicWrite: typeof atomicWrite;
    sourceNodes: typeof sourceNodes;
    withSourceLock: typeof withSourceLock;
};
export {};
//# sourceMappingURL=source-editor.d.ts.map