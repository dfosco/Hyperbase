import type { KnobDefinition } from './contracts.js';
/** Filter a flattened schema, retaining object groups around matching controls. */
export declare function filterKnobsByName(knobs: KnobDefinition[], search: string): KnobDefinition[];
