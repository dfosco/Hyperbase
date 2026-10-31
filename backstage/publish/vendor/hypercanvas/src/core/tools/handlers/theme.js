/**
 * Theme tool module — theme switcher menu.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'theme';
export async function component() {
    const mod = await loadUiComponent('ThemeMenuButton');
    return mod.default;
}
