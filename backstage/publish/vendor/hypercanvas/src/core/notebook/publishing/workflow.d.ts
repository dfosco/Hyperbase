/**
 * Small deterministic runner for registered Notebook publishing actions.
 * Workflow JSON selects trusted action IDs; it never contains shell strings.
 */
export type WorkflowStep = {
    id: string;
    uses: string;
    with?: Record<string, unknown>;
};
export type WorkflowDefinition = {
    name: string;
    steps: WorkflowStep[];
    version?: unknown;
};
export type WorkflowActionContext<Input = unknown, Context = unknown> = {
    input: Input;
    context: Context;
    outputs: Record<string, unknown>;
    step: WorkflowStep;
};
export type WorkflowAction = (context: WorkflowActionContext) => unknown | Promise<unknown>;
export type WorkflowActions = Record<string, WorkflowAction>;
export type WorkflowRunStep = (id: string, execute: () => unknown | Promise<unknown>) => unknown | Promise<unknown>;
export declare const notebookPublishWorkflow: WorkflowDefinition;
/** Execute each registered step sequentially with shared inputs and prior outputs. */
export declare function runWorkflow({ definition, actions, input, context, runStep, }?: {
    definition?: unknown;
    actions?: WorkflowActions;
    input?: unknown;
    context?: unknown;
    runStep?: WorkflowRunStep;
}): Promise<{
    input: unknown;
    context: unknown;
    outputs: Record<string, unknown>;
}>;
