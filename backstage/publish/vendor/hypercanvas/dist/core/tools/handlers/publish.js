/** Publish tool module — generates and connects a Notebook publication. */
import { getFlag } from '../../stores/featureFlags.js';
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'publish';
export async function component() {
    const mod = await loadUiComponent('PublishControl');
    return mod.default;
}
export function handler() {
    return () => {
        if (!getFlag('notebook-publishing'))
            return;
        document.querySelector('[aria-label="Publish"]')?.click();
    };
}
