/** Public metadata emitted by prototypes, components, and extension providers. */
export interface KnobDefinition {
    id: string;
    label?: string;
    type?: string;
    itemType?: string;
    scope?: string | null;
    knobMeta?: unknown;
    options?: unknown[];
    knobs?: KnobDefinition[];
    [key: string]: unknown;
}
/** Values produced by parsing or writing a supported knob input. */
export type CoercedKnobValue = string | number | boolean | number[] | string[] | undefined;
