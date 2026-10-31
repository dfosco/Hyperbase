/**
 * Command Actions — config-driven registry for command menu entries.
 *
 * The command section of toolbar.config.json declares action metadata:
 *   id, label, type, hideFrom, separatorBefore
 *
 * Handler shapes by type:
 *   default:  () => void
 *   toggle:   { execute(), getState() → boolean }
 *   submenu:  { getChildren() → Array<{ id?, label, type, active?, execute }> }
 */
export interface CommandActionDefinition extends Record<string, unknown> {
    id?: string;
    label?: string;
    type?: string;
    separatorBefore?: boolean;
    url?: string | null;
    toolKey?: string | null;
    modes?: string | string[];
    excludeRoutes?: unknown;
    localOnly?: boolean;
    hideFromCommandPaletteSearch?: boolean;
    hideFromCommandMenu?: boolean;
}
export interface CommandMenuConfig extends Record<string, unknown> {
    actions?: unknown;
    footer?: string;
}
export interface CommandActionChild extends Record<string, unknown> {
    id?: string;
    label: string;
    type?: string;
    active?: boolean;
    execute?: () => unknown;
}
export interface CommandActionHandler extends Record<string, unknown> {
    execute?: () => unknown;
    getState?: () => boolean;
    getChildren?: () => CommandActionChild[];
}
export type CommandActionFunction = (() => unknown) & Partial<CommandActionHandler>;
export type CommandHandler = CommandActionFunction | CommandActionHandler;
export interface ResolvedCommandAction extends CommandActionDefinition {
    type: string;
    url: string | null;
    toolKey: string | null;
    localOnly: boolean;
    hideFromCommandPaletteSearch: boolean;
    hideFromCommandMenu: boolean;
    handler: CommandHandler | undefined;
    active: boolean;
}
type DynamicActionInput = CommandActionDefinition & {
    id: string;
};
/**
 * Seed the registry from a menu config object.
 * Called once at app startup.
 *
 * @param {{ actions: Array, footer?: string }} config
 */
export declare function initCommandActions(config: CommandMenuConfig): void;
/**
 * Register a handler for a declared action.
 *
 * @param {string} id     Action id (e.g. "core/viewfinder")
 * @param {Function|object} handler
 *   - default type: () => void
 *   - toggle type:  { execute(), getState() }
 *   - submenu type: { getChildren() }
 */
export declare function registerCommandAction(id: string, handler: CommandHandler): void;
/**
 * Remove a previously registered handler.
 * @param {string} id
 */
export declare function unregisterCommandAction(id: string): void;
/**
 * Add dynamic actions (e.g. comments menu items).
 * These are appended after config-declared actions.
 *
 * @param {string} group  Group key for bulk replacement (e.g. "comments")
 * @param {Array<{ id: string, label: string, type?: string, separatorBefore?: boolean }>} actions
 * @param {Record<string, Function|object>} [handlers]  id → handler map
 */
export declare function setDynamicActions(group: string, actions: DynamicActionInput[], handlers?: Record<string, CommandHandler>): void;
/**
 * Remove all dynamic actions for a group.
 * @param {string} group
 */
export declare function clearDynamicActions(group: string): void;
/**
 * Set the base path used by isExcludedByRoute for portable pattern matching.
 * @param {string} basePath
 */
export declare function setRoutingBasePath(basePath: string): void;
/**
 * Check if an item is excluded from the current route.
 * Strips the base path so patterns match against app-relative paths
 * (e.g. "/" for the root, "/Signup" for a prototype page).
 * @param {object} item  Action or menu with optional excludeRoutes array
 * @returns {boolean} true if the item should be hidden
 */
export declare function isExcludedByRoute(item: Pick<CommandActionDefinition, 'excludeRoutes'>): boolean;
/**
 * Get resolved actions for a given mode.
 * Filters by each action's modes array, appends dynamic actions.
 *
 * @param {string} mode  Current mode name
 * @returns {Array<{ id, label, type, separatorBefore?, handler?, active? }>}
 */
export declare function getActionsForMode(mode: string): ResolvedCommandAction[];
/**
 * Execute an action by id.
 * @param {string} id
 */
export declare function executeAction(id: string): void;
/**
 * Get submenu children for a submenu-type action.
 * @param {string} id
 * @returns {Array<{ id?, label, type, active?, execute? }>}
 */
export declare function getActionChildren(id: string): CommandActionChild[];
/**
 * Check if a handler provides dynamic children (getChildren).
 * Used by CoreUIBar to distinguish action-menu tools (gate on children count)
 * from custom-component menus (always visible, render their own content).
 * @param {string} id
 * @returns {boolean}
 */
export declare function hasChildrenProvider(id: string): boolean;
/**
 * Subscribe to action changes. Compatible with useSyncExternalStore.
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export declare function subscribeToCommandActions(callback: () => void): () => boolean;
/**
 * Snapshot for useSyncExternalStore.
 * @returns {string}
 */
export declare function getCommandActionsSnapshot(): string;
/** Reset all state. Only for tests. */
export declare function _resetCommandActions(): void;
export {};
