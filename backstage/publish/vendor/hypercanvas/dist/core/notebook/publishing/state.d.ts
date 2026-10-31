/**
 * Persistent publishing state.
 *
 * Lives in the Notebook runtime directory (`.hypercanvas/publishing.json`; legacy `.storyboard/publishing.json`) and
 * never enters a commit. Holds the destination bindings per repository mode,
 * operation records for progress and retry, and the legacy provider credential
 * store (the release flow authenticates through the signed-in `gh` CLI).
 */
export type PublishingBinding = Record<string, unknown>;
export type PublishingState = {
    credentials: Record<string, PublishingBinding>;
    bindings: Record<string, PublishingBinding>;
    operations: Record<string, PublishingBinding>;
    projects: Record<string, PublishingBinding>;
};
export declare function runtimePath(root: string): string;
export declare function readState(root: string): PublishingState;
export declare function writeState(root: string, state: PublishingState): void;
export declare function withState<T>(root: string, mutator: (state: PublishingState) => T): T;
/** Persist only after asynchronous mutations have completed. */
export declare function withStateAsync<T>(root: string, mutator: (state: PublishingState) => T | Promise<T>): Promise<T>;
export declare function operationId(): string;
/** Record a binding between a repository mode and its destination/repository. */
export declare function saveBinding(state: PublishingState, mode: string, binding: PublishingBinding): PublishingBinding;
export declare function readBinding(state: PublishingState, mode: string): PublishingBinding | null;
