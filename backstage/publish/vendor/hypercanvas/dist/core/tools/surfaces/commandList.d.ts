/**
 * Command Palette surface — items rendered inside the ⌘K command palette.
 *
 * Tools here appear as menu items, submenus, or links within
 * the command palette. They don't render as standalone buttons.
 */
export declare const id = "command-palette";
export declare const label = "Command Palette";
export declare const position = "overlay";
export declare const renderTypes: readonly ["link", "submenu"];
