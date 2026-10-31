/**
 * Side Panel Store — manages the open/close state and active tab of the
 * side panel UI.
 *
 * Framework-agnostic state with a subscribe/set interface.
 * Toggles the `sb-sidepanel-open` class on `<html>` so CSS can react
 * to the panel being open (e.g. shifting the main content area).
 */
export type SidePanelTab = 'docs' | 'inspector' | 'sites' | 'publish';
export interface SidePanelState {
    /** Whether the side panel is currently open */
    open: boolean;
    /** The currently active tab */
    activeTab: SidePanelTab;
}
type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;
interface Readable<T> {
    subscribe(run: Subscriber<T>): Unsubscriber;
}
/**
 * Readable store for the side panel state.
 */
export declare const sidePanelState: Readable<SidePanelState>;
/**
 * Open the side panel to the given tab.
 *
 * @param tab — The tab to display when the panel opens.
 */
export declare function openPanel(tab: SidePanelTab): void;
/**
 * Close the side panel. The active tab is preserved so that
 * re-opening the panel returns to the same tab.
 */
export declare function closePanel(): void;
/**
 * Toggle the side panel for a specific tab.
 *
 * - If the panel is open **and** already showing this tab → close it.
 * - Otherwise → open the panel to the given tab.
 *
 * @param tab — The tab to toggle.
 */
export declare function togglePanel(tab: SidePanelTab): void;
/**
 * Reset the side panel store to its default state.
 * Only for use in tests.
 */
export declare function _resetSidePanel(): void;
export {};
