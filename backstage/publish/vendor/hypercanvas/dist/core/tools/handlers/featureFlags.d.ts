/**
 * Feature Flags tool module — toggle feature flags submenu.
 *
 * Renders as a submenu in the command menu listing all declared flags.
 * Flags already exposed as devtool toggles are excluded to avoid duplication.
 */
export declare const id = "feature-flags";
interface FlagMenuItem {
    id: string;
    label: string;
    type: 'toggle';
    active: boolean;
    execute(): void;
}
export declare function handler(): Promise<{
    getChildren(): FlagMenuItem[];
}>;
export {};
