/**
 * Canvas agents tool module — dropdown menu for adding agent widgets to canvas.
 *
 * Renders agent options from canvas.agents config. Only active on canvas pages
 * when agents are configured.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'canvas-agents';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export async function guard(_ctx) {
    void _ctx;
    const { isLocalDev } = await import('../../utils/prodMode.js');
    if (!isLocalDev())
        return false;
    const { getConfig } = await import('../../index.js');
    const canvasConfig = getConfig('canvas');
    if (!isRecord(canvasConfig))
        return false;
    const agents = canvasConfig?.agents;
    return Boolean(agents && typeof agents === 'object' && Object.keys(agents).length > 0);
}
export async function component() {
    const mod = await loadUiComponent('CanvasAgentsMenu');
    return mod.default;
}
