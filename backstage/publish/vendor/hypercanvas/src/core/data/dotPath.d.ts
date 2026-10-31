/** Resolves a dot-notation path against an object. */
export declare function getByPath(obj: unknown, path: unknown): unknown;
/** Deep-clone arrays and plain objects while preserving the caller's type. */
export declare function deepClone<T>(val: T): T;
/** Set a value at a dot-notation path inside an object, mutating it. */
export declare function setByPath<T extends object>(obj: T, path: string, value: unknown): void;
