/**
 * Fiber Walker — React fiber tree inspector for DOM elements.
 *
 * Framework-agnostic (zero npm dependencies). Intended for dev-time inspection
 * only; React's fiber keys and `_debugSource` are development internals.
 */
type UnknownRecord = Record<string, unknown>;
export interface FiberNode {
    type?: unknown;
    return?: FiberNode | null;
    memoizedProps?: unknown;
    _debugSource?: unknown;
    _debugOwner?: FiberNode | null;
    [key: string]: unknown;
}
export interface DebugSource {
    fileName: string | null;
    lineNumber: number | null;
    columnNumber: number | null;
}
export interface ComponentInfo {
    name: string;
    props: UnknownRecord;
    source: DebugSource | null;
    hostSource: DebugSource | null;
    owner: string | null;
}
export interface ComponentChainEntry {
    name: string;
    source: DebugSource | null;
}
/** Return the React fiber node attached to a DOM element, if present. */
export declare function getFiberFromElement(el: Element | null | undefined): FiberNode | null;
/** Find component information for the nearest user component in a fiber chain. */
export declare function getComponentInfo(fiber: FiberNode | null | undefined): ComponentInfo | null;
/** Return all user components in the ancestry chain, from the given fiber up. */
export declare function getComponentChain(fiber: FiberNode | null | undefined): ComponentChainEntry[];
/** Convenience: inspect a DOM element and return its nearest component info. */
export declare function inspectElement(el: Element | null | undefined): ComponentInfo | null;
/** Return all React components in a DOM element's ancestry chain. */
export declare function inspectElementChain(el: Element | null | undefined): ComponentChainEntry[];
export {};
