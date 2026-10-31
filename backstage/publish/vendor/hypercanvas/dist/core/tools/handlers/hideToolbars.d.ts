/**
 * Hide/Show toolbars tool — command palette only.
 *
 * Toggles the `storyboard-chrome-hidden` class (same as Cmd+.).
 * Label flips between "Hide toolbars" and "Show toolbars" based on state.
 */
export declare const id = "hide-toolbars";
interface MenuItem {
    id: string;
    label: string;
    type: 'default';
    execute(): void;
}
export declare function handler(): Promise<{
    getChildren(): MenuItem[];
}>;
export {};
