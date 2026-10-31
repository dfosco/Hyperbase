/**
 * Publish operations.
 *
 * Every publish flow runs as a recorded operation: structured steps, redacted
 * output tails, actionable pause states, and retry (DOCS/publishing.md —
 * "Recovery"). Git command output is captured for the read-only recovery
 * terminal; publishing does not create a shell or agent session.
 */
import { readState, writeState, saveBinding, readBinding } from './state.js';
type OperationStatus = 'running' | 'succeeded' | 'awaiting_retry' | 'failed';
type FinalStatus = 'warning' | 'success' | 'error' | null;
type OperationStep = {
    name: string;
    status: 'running' | 'succeeded' | 'failed';
    error?: {
        code: string;
        message: string;
    };
};
export type PublishOperation = {
    id: string;
    kind: string;
    request: unknown;
    status: OperationStatus;
    finalStatus: FinalStatus;
    steps: OperationStep[];
    output: string[];
    warnings: unknown[];
    error: Record<string, unknown> | null;
    result: unknown;
    startedAt: string;
    finishedAt: string | null;
    retriedFrom?: string;
};
type OperationState = {
    operations: Record<string, PublishOperation>;
};
export type StepRunner = <T>(name: string, fn: () => T | Promise<T>) => Promise<T>;
type OperationRunner = (step: StepRunner) => unknown | Promise<unknown>;
/** Redact credentials and machine noise from captured output. */
export declare function redactOutput(text: unknown): string;
/** Record redacted process output when called inside a publishing operation. */
export declare function recordOperationOutput(source: unknown, value: unknown): void;
/**
 * Run a flow as a recorded operation. `run(step)` receives helpers:
 * `step(name, fn)` records each step. Actionable failures pause the operation
 * as `awaiting_retry`; other failures mark it `failed`. All failures keep the
 * recorded request for retry.
 */
export declare function runOperation({ state, kind, request, persist, run }: {
    state: OperationState;
    kind: string;
    request: unknown;
    persist?: () => void;
    run: OperationRunner;
}): Promise<PublishOperation>;
/** Re-run a paused or failed operation from its recorded request. */
export declare function retryOperation({ state, operationId: id, rerun }: {
    state: OperationState;
    operationId: string;
    rerun: (args: {
        state: OperationState;
        request: unknown;
        previous: PublishOperation;
    }) => Promise<PublishOperation>;
}): Promise<PublishOperation>;
export declare function publicOperation(operation: PublishOperation | null | undefined): (PublishOperation & {
    finalStatus: FinalStatus;
    warnings: unknown[];
    output: string[];
}) | null;
export { readState, writeState, saveBinding, readBinding };
