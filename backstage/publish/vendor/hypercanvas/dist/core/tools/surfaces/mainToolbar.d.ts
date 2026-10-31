/**
 * Command Toolbar surface — the primary floating bar at bottom-right.
 *
 * Supports all standard render types. Tools appear in reverse JSON order
 * (first in config = leftmost in toolbar). The command menu button is
 * always the rightmost item and is not a tool.
 */
export declare const id = "command-toolbar";
export declare const label = "Command Toolbar";
export declare const position = "bottom-right";
export declare const renderTypes: readonly ["button", "menu", "sidepanel", "separator"];
