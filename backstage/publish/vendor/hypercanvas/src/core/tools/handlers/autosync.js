/**
 * Autosync tool handler.
 *
 * Dev-only tool (localOnly) that auto-commits and pushes changes
 * to a selected branch every 30 seconds.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'autosync';
export async function component() {
    const mod = await loadUiComponent('AutosyncMenuButton');
    return mod.default;
}
