/**
 * Create tool module — workshop prototype/flow/canvas creation.
 *
 * Loads the workshop feature registry and CreateMenuButton component.
 * Guard: only mounts if at least one create feature has an overlay.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'create';
export async function setup(ctx = {}) {
    const { config } = ctx;
    const { features } = await import('../../workshop/features/registry.js');
    const createActions = config && Array.isArray(config.actions)
        ? config.actions.filter((action) => !!action && typeof action === 'object')
        : [];
    const createFeatures = [];
    for (const action of createActions) {
        if (!action.feature)
            continue;
        const feat = features[action.feature];
        if (!feat || !feat.overlayId || !feat.overlay)
            continue;
        createFeatures.push({
            name: feat.name,
            label: action.label || feat.label,
            overlayId: feat.overlayId,
            overlay: feat.overlay,
        });
    }
    return { features: createFeatures };
}
export async function guard(ctx = {}) {
    const result = await setup(ctx);
    return result.features.length > 0;
}
export async function component() {
    const mod = await loadUiComponent('CreateMenuButton');
    return mod.default;
}
