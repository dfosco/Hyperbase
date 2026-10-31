import * as statefullyCore from '@dfosco/statefully/core';
import type { StatefullyKnobSession, StatefullyKnobStore } from '@dfosco/statefully/core';
import type { KnobDefinition } from './contracts.js';
interface KnobRuntimeOptions {
    target?: Window | HTMLIFrameElement | null;
    route?: string | null;
    statefully?: typeof statefullyCore;
}
interface KnobReadState {
    key: string;
    rawValue: string | null;
    value: unknown;
    coercedValue: unknown;
    errorValue: unknown;
    hasOverride: boolean;
}
export interface HypercanvasKnobRuntime {
    store: StatefullyKnobStore;
    listKnobs(): KnobDefinition[];
    session: StatefullyKnobSession;
    targetWindow: Window | null;
    subscribe(listener: () => void): () => void;
    getSnapshot(): string;
    read(definition: KnobDefinition, fallback?: unknown): KnobReadState;
    set(definition: KnobDefinition, value: unknown): void;
    clear(definition: KnobDefinition): void;
    reset(): void;
    dispose(): void;
}
/**
 * Bind the accepted Statefully knob store to Hypercanvas persistence.
 *
 * Statefully owns flattening, selection, keys, codecs, aliases, presets,
 * resets, and target hash writes. Hypercanvas supplies its existing hide-mode
 * session view, or a public Statefully session bound to an iframe Window.
 */
export declare function createHypercanvasKnobRuntime(definitions?: KnobDefinition[], { target, route, statefully }?: KnobRuntimeOptions): HypercanvasKnobRuntime;
export {};
