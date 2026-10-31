/**
 * Devtools tool module — developer utilities submenu.
 *
 * Renders as a submenu in the command menu with:
 * - Show flow info
 * - Reset all params
 * - Hide mode toggle
 * - Logout (when authenticated)
 */
export declare const id = "devtools";
interface DevtoolsContext {
    showFlowInfoDialog?: (name: string, data: string, error: string | null) => void;
}
interface MenuItem {
    id: string;
    label: string;
    type: 'toggle' | 'default';
    active?: boolean;
    execute(): void;
}
interface HandlerResult {
    getChildren(): MenuItem[];
}
/**
 * @param {object} ctx
 * @param {Function} ctx.showFlowInfoDialog - callback to open flow info dialog
 */
export declare function handler(ctx?: DevtoolsContext): Promise<HandlerResult>;
export {};
