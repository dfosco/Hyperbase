/**
 * Palette Theme tool — theme submenu for the command palette.
 *
 * Returns theme options as children, plus a "Theme settings" entry
 * that opens the toolbar Theme menu with the settings submenu expanded.
 */
export declare const id = "palette-theme";
interface ThemeMenuItem {
    id: string;
    label: string;
    type?: 'toggle';
    active?: boolean;
    execute(): void;
}
export declare function handler(): Promise<{
    getChildren(): ThemeMenuItem[];
}>;
export {};
