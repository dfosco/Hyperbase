import type { KnobDefinition } from './contracts.js';
import type { StatefullyKnobTargetOptions } from '@dfosco/statefully/core';
export declare function setKnobValue(id: string, value: unknown, options?: StatefullyKnobTargetOptions): void;
export declare function clearKnobValue(id: string, options?: StatefullyKnobTargetOptions): void;
export declare function serializeKnobValue(value: unknown, definition?: Partial<KnobDefinition>): string;
