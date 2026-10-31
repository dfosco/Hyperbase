/**
 * Agents Ready tool — collab-bar button that surfaces the count of agents
 * in `done` state on the active canvas and cycles through them on click.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'agents-ready';
export async function component() {
    const mod = await loadUiComponent('AgentsReadyTrigger');
    return mod.default;
}
