/**
 * Command Palette tool — toolbar button that opens the ⌘K command palette.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'command-palette';
export async function component() {
    const mod = await loadUiComponent('CommandPaletteTrigger');
    return mod.default;
}
