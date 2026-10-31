/** Executable, typed bindings for invisible Storyboard Controls. */
export interface StoryboardCondition<State> {
    description: string;
    reads: readonly string[];
    test(state: State): boolean;
}
export interface StoryboardAction<State, Input = void> {
    writes: readonly string[];
    run(state: State, input: Input): State | Promise<State>;
}
export interface StoryboardControl<ActionId extends string, ConditionId extends string> {
    action: ActionId;
    condition?: ConditionId;
}
export interface StoryboardExecutableBehavior<State, Actions extends Record<string, StoryboardAction<State, unknown>>, Conditions extends Record<string, StoryboardCondition<State>>, Controls extends Record<string, StoryboardControl<keyof Actions & string, keyof Conditions & string>>> {
    actions: Actions;
    conditions: Conditions;
    controls: Controls;
}
export type StoryboardControlId<Behavior> = keyof Behavior extends never ? never : Behavior extends {
    controls: infer Controls;
} ? keyof Controls & string : never;
/**
 * Evaluate and execute declarations against a caller-owned snapshot. The
 * executor owns no state; a successful command commits through the supplied
 * callback, which should write to the authoritative Statefully session.
 */
export declare function createStoryboardBehaviorExecutor<State, Actions extends Record<string, StoryboardAction<State, unknown>>, Conditions extends Record<string, StoryboardCondition<State>>, Controls extends Record<string, StoryboardControl<keyof Actions & string, keyof Conditions & string>>>(behavior: StoryboardExecutableBehavior<State, Actions, Conditions, Controls>, commit: (next: State) => void): Readonly<{
    isEnabled: (controlId: keyof Controls & string, state: State) => boolean;
    execute: (controlId: keyof Controls & string, state: State, input: unknown) => Promise<boolean>;
}>;
//# sourceMappingURL=behavior-runtime.d.ts.map