declare const sourceRevisionBrand: unique symbol;
/** A SHA-256 digest identifying the exact source snapshot a command targets. */
export type StoryboardSourceRevision = string & {
    readonly [sourceRevisionBrand]: true;
};
/** Compute the SHA-256 revision used by Storyboard source read/edit commands. */
export declare function getStoryboardSourceRevision(source: string): StoryboardSourceRevision;
/** Parse an untrusted source revision received from a command boundary. */
export declare function parseStoryboardSourceRevision(value: unknown): StoryboardSourceRevision;
export {};
//# sourceMappingURL=source-revision.d.ts.map