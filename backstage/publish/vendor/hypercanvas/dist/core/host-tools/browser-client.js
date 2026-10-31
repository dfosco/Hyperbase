const BASE_URL = import.meta.env?.BASE_URL || '/';
export class HostToolsRequestError extends Error {
    status;
    constructor(message, { status = 0 } = {}) {
        super(message);
        this.name = 'HostToolsRequestError';
        this.status = status;
    }
}
export function hostToolsApiBase(basePath = BASE_URL) {
    const normalized = String(basePath || '/')
        .replace(/^([^/])/, '/$1')
        .replace(/\/+$/, '');
    return `${normalized}/_hypercanvas/host-tools`;
}
export function createHostToolsBrowserClient({ fetchImpl = globalThis.fetch, basePath = BASE_URL, } = {}) {
    const apiBase = hostToolsApiBase(basePath);
    return Object.freeze({
        async preflight() {
            if (typeof fetchImpl !== 'function')
                throw new HostToolsRequestError('Browser requests are unavailable');
            let response;
            try {
                response = await fetchImpl(`${apiBase}/preflight`, { method: 'GET' });
            }
            catch {
                throw new HostToolsRequestError('Could not reach the host-tools service');
            }
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const errorPayload = payload && typeof payload === 'object' && 'error' in payload
                    ? payload.error
                    : null;
                const errorRecord = errorPayload && typeof errorPayload === 'object'
                    ? errorPayload
                    : null;
                const message = typeof errorRecord?.message === 'string'
                    ? errorRecord.message
                    : `Host-tools request failed (${response.status})`;
                throw new HostToolsRequestError(message, { status: response.status });
            }
            return payload;
        },
    });
}
