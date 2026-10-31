/**
 * Hide Chrome tool — toolbar button that toggles toolbar/branch bar visibility.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'hide-chrome';
export async function component() {
    const mod = await loadUiComponent('HideChromeTrigger');
    return mod.default;
}
