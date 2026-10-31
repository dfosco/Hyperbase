/** Minimal Tauri bridge that keeps the external Notebook runtime dependency-free. */
function internals() {
    const value = globalThis.__TAURI_INTERNALS__;
    if (value === null || typeof value !== 'object')
        return null;
    const record = value;
    if (typeof record.invoke !== 'function')
        return null;
    return value;
}
function devlog(message, details = {}) {
    console.debug('[devlog][tauri-bridge]', message, details);
}
export function isTauriAvailable() {
    const api = internals();
    const available = Boolean(api?.invoke);
    devlog('availability check', { available, hasInternals: Boolean(api), hasInvoke: Boolean(api?.invoke) });
    return available;
}
export function invoke(command, args = {}) {
    const api = internals();
    devlog('invoke start', { command, args, available: Boolean(api?.invoke) });
    if (!api?.invoke) {
        const error = new Error('Native Hypercanvas bridge is unavailable.');
        devlog('invoke rejected: bridge unavailable', { command, error: error.message });
        return Promise.reject(error);
    }
    return api.invoke(command, args)
        .then(result => {
        devlog('invoke succeeded', { command, result });
        return result;
    })
        .catch(error => {
        const record = error !== null && typeof error === 'object' ? error : {};
        devlog('invoke failed', { command, error: typeof record.message === 'string' ? record.message : String(error), name: record.name });
        throw error;
    });
}
export async function listen(event, handler) {
    const api = internals();
    devlog('listen start', { event, available: Boolean(api?.invoke && api?.transformCallback) });
    if (!api?.invoke || !api.transformCallback) {
        throw new Error('Native Hypercanvas event bridge is unavailable.');
    }
    const eventId = await api.invoke('plugin:event|listen', {
        event,
        target: { kind: 'Any' },
        handler: api.transformCallback(handler),
    });
    devlog('listen succeeded', { event, eventId });
    return () => api.invoke('plugin:event|unlisten', { event, eventId });
}
