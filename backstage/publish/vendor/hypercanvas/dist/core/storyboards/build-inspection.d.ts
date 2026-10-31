import type { StoryboardStateDeclarations } from './statefully.ts';
export interface StoryboardBehaviorDefinition {
    conditions: readonly {
        id: string;
        description: string;
        reads?: readonly string[];
    }[];
    controls: readonly {
        id: string;
        action: string;
        condition?: string;
    }[];
    actions: readonly {
        id: string;
        writes: readonly string[];
    }[];
}
export interface StoryboardStructuralSummary {
    sourcePath: string;
    nodeId: string;
    component: string;
    kind: string;
    line: number;
    column: number;
    children: readonly string[];
}
export type StoryboardInspectionNodeKind = 'scenario' | 'object' | 'record' | 'condition' | 'control' | 'action' | 'state-field' | 'structure';
export interface StoryboardInspectionNode {
    id: string;
    kind: StoryboardInspectionNodeKind;
    label: string;
    details: readonly string[];
}
export type StoryboardInspectionEdgeKind = 'references' | 'reads' | 'guarded-by' | 'invokes' | 'writes' | 'contains';
export interface StoryboardInspectionEdge {
    id: string;
    kind: StoryboardInspectionEdgeKind;
    from: string;
    to: string;
    detail: string;
}
export interface StoryboardInspectionDiagnostic {
    code: 'unresolved-reference' | 'ambiguous-reference' | 'unresolved-action' | 'unresolved-condition';
    message: string;
    sourceNode: string;
}
export interface StoryboardInspectionGraph {
    nodes: readonly StoryboardInspectionNode[];
    edges: readonly StoryboardInspectionEdge[];
    diagnostics: readonly StoryboardInspectionDiagnostic[];
}
interface BuildStoryboardInspectionGraphInput {
    declarations: StoryboardStateDeclarations;
    behavior: StoryboardBehaviorDefinition;
    structure?: readonly StoryboardStructuralSummary[];
}
/** Build a read-only, source-derived model for the Storyboard Build inspector. */
export declare function buildStoryboardInspectionGraph({ declarations, behavior, structure }: BuildStoryboardInspectionGraphInput): StoryboardInspectionGraph;
export {};
//# sourceMappingURL=build-inspection.d.ts.map