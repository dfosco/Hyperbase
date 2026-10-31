/** JSON-compatible source data accepted by the Statefully prototype index. */
export type StoryboardJsonValue = string | number | boolean | null | StoryboardJsonValue[] | {
    [key: string]: StoryboardJsonValue;
};
export interface StoryboardScenarioDeclaration {
    name: string;
    data: Record<string, StoryboardJsonValue>;
}
/**
 * Source declarations for one TSX Storyboard. These are immutable inputs;
 * runtime state remains owned by the supplied Statefully store.
 */
export interface StoryboardStateDeclarations {
    prototype: string;
    scenarios: readonly StoryboardScenarioDeclaration[];
    objects?: Readonly<Record<string, Record<string, StoryboardJsonValue>>>;
    records?: Readonly<Record<string, readonly Record<string, StoryboardJsonValue>[]>>;
}
export interface StatefullyPrototypeIndex {
    flows?: Record<string, unknown>;
    objects?: Record<string, unknown>;
    records?: Record<string, unknown>;
    prototypes?: Record<string, unknown>;
    [key: string]: unknown;
}
/** Structural contract of the public Statefully prototype store API. */
export interface StatefullyPrototypeStore {
    getIndex(): StatefullyPrototypeIndex;
    replaceIndex(index: StatefullyPrototypeIndex): void;
}
/** Validate declarations received from JS/serialized source at runtime. */
export declare function parseStoryboardStateDeclarations(value: unknown): StoryboardStateDeclarations;
/**
 * Replace one Storyboard's declarations in the existing Statefully store.
 * Other prototypes and Statefully index fields are preserved. The adapter
 * keeps no parallel copy of declarations or mutable runtime state.
 */
export declare function replaceStoryboardStateDeclarations(store: StatefullyPrototypeStore, untrustedDeclarations: unknown): StatefullyPrototypeIndex;
//# sourceMappingURL=statefully.d.ts.map